import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  fichaDoDavi,
  rngComSemente,
  type EventoDaMesa,
  type FichaOp2,
  type Rng,
  type TokenNaMesa,
} from '@membrana/shared';
import { campaigns, characters, memberships, sessionLog, testLog } from '../db/schema.ts';
import { bancoDeTeste, casoDeTeste, mapaDeTeste } from '../teste/apoio.ts';
import type { ResultadoDoComando } from './Mesa.ts';
import { casasEmVolta } from './comandos/tokens.ts';
import { Mesas } from './mesas.ts';

const bancos: { close: () => void }[] = [];
afterEach(() => {
  for (const banco of bancos.splice(0)) banco.close();
});

/** O caso com um mapa de 2000 × 1500 já na mesa (salvo como ativo: a mesa abre com ele). */
function montar({ comMapa = true, sorteio }: { comMapa?: boolean; sorteio?: Rng } = {}) {
  const { db, sqlite } = bancoDeTeste();
  const pessoas = casoDeTeste({ db });
  const mapa = comMapa ? mapaDeTeste({ db }, pessoas.caso, { ativo: true }) : null;
  const mesas = new Mesas(db, sorteio ? { sorteio } : {});
  bancos.push({
    close: () => {
      mesas.salvarTudo();
      sqlite.close();
    },
  });
  return { db, mesas, mapa, mesa: mesas.obter(pessoas.caso), ...pessoas };
}

function eventos(r: ResultadoDoComando): EventoDaMesa[] {
  if (!r.ok) throw new Error(`recusado: ${r.motivo}`);
  return r.eventos;
}

function motivo(r: ResultadoDoComando): string {
  if (r.ok) throw new Error('era para recusar');
  return r.motivo;
}

function criarToken(
  m: ReturnType<typeof montar>,
  campos: Record<string, unknown> = {},
): TokenNaMesa {
  const [evento] = eventos(
    m.mesa.aplicar(m.ana, { type: 'token.create', nome: 'Vulto', x: 100, y: 100, ...campos }),
  );
  if (evento?.type !== 'token.changed' || !evento.token) throw new Error('token não criado');
  return evento.token;
}

const BREU_NO_CANTO = {
  type: 'darkness.add',
  forma: { tipo: 'retangulo', x: 500, y: 500, largura: 200, altura: 200 },
} as const;

describe('Mesa.aplicar', () => {
  it('comando inválido volta motivo em português e não muda o estado', () => {
    const m = montar();
    const token = criarToken(m);
    const antes = m.mesa.estado;
    const seq = m.mesa.seq;

    expect(motivo(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 'a' }))).toBe(
      'A posição precisa ser um número.',
    );
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'token.voar', tokenId: token.id }))).toBe(
      'Comando desconhecido.',
    );
    expect(motivo(m.mesa.aplicar(m.ana, 'oi'))).toBe('Comando inválido.');
    expect(m.mesa.estado).toBe(antes);
    expect(m.mesa.seq).toBe(seq);
  });

  it('recusa no meio do tratador não deixa mudança pela metade', () => {
    const m = montar();
    const token = criarToken(m);
    const antes = structuredClone(m.mesa.estado);
    // O jogador tenta mudar campos que não pode: nada do pedido é aplicado.
    expect(
      motivo(m.mesa.aplicar(m.bia, { type: 'token.update', tokenId: token.id, nome: 'Meu' })),
    ).toBe('Só o mestre pode mudar este token.');
    expect(m.mesa.estado).toEqual(antes);
  });

  it('quem não participa do caso é recusado', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.estranho, { type: 'round.end' }))).toBe(
      'Você não está neste caso.',
    );
  });

  it('comando do contrato que ainda não tem tratador é recusado com aviso', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'audio.stop' }))).toBe(
      'Este comando ainda não está disponível na mesa.',
    );
  });

  it('eventos saem numerados em sequência, comando após comando', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    const seqs = [
      ...eventos(m.mesa.aplicar(m.bia, { type: 'token.move', tokenId: token.id, x: 10, y: 10 })),
      ...eventos(m.mesa.aplicar(m.ana, BREU_NO_CANTO)),
      ...eventos(m.mesa.aplicar(m.ana, { type: 'round.end' })),
    ].map((e) => e.seq);
    expect(seqs).toEqual([2, 3, 4]);
    expect(m.mesa.carimbar({ type: 'presence.changed', online: [] }).seq).toBe(5);
    expect(m.mesa.seq).toBe(5);
  });
});

describe('tokens', () => {
  it('o dono move o próprio token; outro jogador não', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    expect(token.donoId).toBe(m.bia.id);

    expect(
      eventos(m.mesa.aplicar(m.bia, { type: 'token.move', tokenId: token.id, x: 50, y: 60 })),
    ).toMatchObject([{ type: 'token.moved', tokenId: token.id, x: 50, y: 60 }]);
    expect(m.mesa.estado.tokens[0]).toMatchObject({ x: 50, y: 60 });

    expect(
      motivo(m.mesa.aplicar(m.caio, { type: 'token.move', tokenId: token.id, x: 1, y: 1 })),
    ).toBe('Só o dono do token ou o mestre pode movê-lo.');
  });

  it('o jogador não entra no breu; o mestre põe o token onde quiser', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    eventos(m.mesa.aplicar(m.ana, BREU_NO_CANTO));

    const dentro = { type: 'token.move', tokenId: token.id, x: 600, y: 600 } as const;
    expect(motivo(m.mesa.aplicar(m.bia, dentro))).toBe('Não dá para entrar no breu.');
    expect(motivo(m.mesa.aplicar(m.bia, { ...dentro, type: 'token.drag' }))).toBe(
      'Não dá para entrar no breu.',
    );
    expect(m.mesa.estado.tokens[0]).toMatchObject({ x: 100, y: 100 });
    expect(eventos(m.mesa.aplicar(m.ana, dentro))).toHaveLength(1);
  });

  it('o arrasto confere e avisa, mas não grava a posição', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    const salvo = m.mesa.estado;
    expect(
      eventos(m.mesa.aplicar(m.bia, { type: 'token.drag', tokenId: token.id, x: 70, y: 80 })),
    ).toMatchObject([{ type: 'token.dragging', x: 70, y: 80 }]);
    expect(m.mesa.estado.tokens[0]).toMatchObject({ x: 100, y: 100 });
    expect(m.mesa.estado).toEqual(salvo);
  });

  it('posição fora do mapa é recusada; a borda vale', () => {
    const m = montar();
    const token = criarToken(m);
    expect(
      motivo(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 2001, y: 10 })),
    ).toBe('Fora do mapa.');
    expect(
      eventos(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 2000, y: 1500 })),
    ).toHaveLength(1);
  });

  it('sem mapa na mesa, não há onde pôr token, prop ou breu', () => {
    const m = montar({ comMapa: false });
    const semMapa = 'Ponha um mapa na mesa antes.';
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'token.create', nome: 'V', x: 1, y: 1 }))).toBe(
      semMapa,
    );
    const imagem = `${'a'.repeat(64)}.webp`;
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'prop.create', imagem, x: 1, y: 1 }))).toBe(
      semMapa,
    );
    expect(motivo(m.mesa.aplicar(m.ana, BREU_NO_CANTO))).toBe(semMapa);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'darkness.remove', tudo: true }))).toBe(semMapa);
  });

  it('só o mestre cria e remove; personagem precisa ser do caso e ter um token só', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'token.create', nome: 'Eu', x: 1, y: 1 }))).toBe(
      'Só o mestre cria tokens.',
    );
    expect(
      motivo(
        m.mesa.aplicar(m.ana, {
          type: 'token.create',
          nome: 'Outro',
          x: 1,
          y: 1,
          personagemId: 'chr_de_outro_caso',
        }),
      ),
    ).toBe('Esse personagem não está neste caso.');

    const token = criarToken(m, { personagemId: m.davi });
    expect(
      motivo(
        m.mesa.aplicar(m.ana, {
          type: 'token.create',
          nome: 'Davi 2',
          x: 1,
          y: 1,
          personagemId: m.davi,
        }),
      ),
    ).toBe('Esse personagem já tem um token no mapa.');

    expect(motivo(m.mesa.aplicar(m.bia, { type: 'token.delete', tokenId: token.id }))).toBe(
      'Só o mestre remove tokens.',
    );
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'token.delete', tokenId: token.id }))).toEqual([
      // Recusas não gastam número: criar foi o 1, remover é o 2.
      { type: 'token.changed', tokenId: token.id, token: null, seq: 2 },
    ]);
    expect(m.mesa.estado.tokens).toEqual([]);
    expect(
      motivo(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 1, y: 1 })),
    ).toBe('Esse token não está mais no mapa.');
  });

  it('o jogador troca só a imagem e o tamanho do próprio token', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    expect(
      eventos(m.mesa.aplicar(m.bia, { type: 'token.update', tokenId: token.id, tamanho: 2 })),
    ).toMatchObject([{ type: 'token.changed', token: { tamanho: 2 } }]);
    expect(
      motivo(m.mesa.aplicar(m.bia, { type: 'token.update', tokenId: token.id, oculto: true })),
    ).toBe('No seu token, você troca só a imagem e o tamanho.');
    expect(
      motivo(m.mesa.aplicar(m.caio, { type: 'token.update', tokenId: token.id, tamanho: 3 })),
    ).toBe('Só o mestre pode mudar este token.');
  });
});

describe('props, breu e rodada', () => {
  it('só o mestre mexe em props; o novo fica por cima', () => {
    const m = montar();
    const imagem = `${'a'.repeat(64)}.webp`;
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'prop.create', imagem, x: 1, y: 1 }))).toBe(
      'Só o mestre mexe nos props.',
    );
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.create', imagem, x: 1, y: 1 }));
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.create', imagem, x: 2, y: 2 }));
    expect(m.mesa.estado.props.map((p) => p.ordem)).toEqual([0, 1]);

    const [primeiro] = m.mesa.estado.props;
    if (!primeiro) throw new Error('sem prop');
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: primeiro.id, rotacao: 90 }));
    expect(m.mesa.estado.props[0]?.rotacao).toBe(90);
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.delete', propId: primeiro.id }));
    expect(m.mesa.estado.props).toHaveLength(1);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'prop.delete', propId: primeiro.id }))).toBe(
      'Esse prop não está mais no mapa.',
    );
  });

  it('breu: cobrir, revelar, remover uma área e limpar tudo', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.bia, BREU_NO_CANTO))).toBe('Só o mestre mexe no breu.');
    eventos(m.mesa.aplicar(m.ana, BREU_NO_CANTO));
    const [evento] = eventos(m.mesa.aplicar(m.ana, { ...BREU_NO_CANTO, type: 'darkness.reveal' }));
    expect(evento).toMatchObject({
      type: 'darkness.changed',
      breu: [{ modo: 'cobrir' }, { modo: 'revelar' }],
    });

    const id = m.mesa.estado.breu[0]?.id ?? '';
    eventos(m.mesa.aplicar(m.ana, { type: 'darkness.remove', formaId: id }));
    expect(m.mesa.estado.breu.map((a) => a.modo)).toEqual(['revelar']);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'darkness.remove', formaId: id }))).toBe(
      'Essa área do breu não existe mais.',
    );
    eventos(m.mesa.aplicar(m.ana, { type: 'darkness.remove', tudo: true }));
    expect(m.mesa.estado.breu).toEqual([]);
  });

  it('breu: cobrir tudo vira uma área só, e revelar tudo limpa', () => {
    const m = montar();
    const tudo = { tipo: 'retangulo', x: 0, y: 0, largura: 2000, altura: 1500 } as const;
    eventos(m.mesa.aplicar(m.ana, BREU_NO_CANTO));
    eventos(m.mesa.aplicar(m.ana, { ...BREU_NO_CANTO, type: 'darkness.reveal' }));
    const [cobriu] = eventos(m.mesa.aplicar(m.ana, { type: 'darkness.add', forma: tudo }));
    expect(cobriu).toMatchObject({
      type: 'darkness.changed',
      breu: [{ modo: 'cobrir', forma: tudo }],
    });
    expect(m.mesa.estado.breu).toHaveLength(1);

    // Revelar uma sala empilha; revelar o mapa inteiro deixa sem breu.
    eventos(m.mesa.aplicar(m.ana, { ...BREU_NO_CANTO, type: 'darkness.reveal' }));
    expect(m.mesa.estado.breu.map((a) => a.modo)).toEqual(['cobrir', 'revelar']);
    eventos(m.mesa.aplicar(m.ana, { type: 'darkness.reveal', forma: tudo }));
    expect(m.mesa.estado.breu).toEqual([]);
  });

  it('névoa: só o mestre muda o nível, e vale sem mapa na mesa', () => {
    const m = montar({ comMapa: false });
    expect(m.mesa.estado.nevoa).toBe(0);
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'mist.set', nivel: 40 }))).toBe(
      'Só o mestre mexe na névoa.',
    );
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'mist.set', nivel: 40 }))).toEqual([
      { type: 'mist.changed', nivel: 40, seq: 1 },
    ]);
    expect(m.mesa.estado.nevoa).toBe(40);
  });

  it('névoa é só visual: no máximo, o jogador anda e vê tudo igual', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    eventos(m.mesa.aplicar(m.ana, { type: 'mist.set', nivel: 100 }));
    expect(
      eventos(m.mesa.aplicar(m.bia, { type: 'token.move', tokenId: token.id, x: 600, y: 600 })),
    ).toMatchObject([{ type: 'token.moved', x: 600, y: 600 }]);
    expect(m.mesa.estado.breu).toEqual([]);
  });

  it('a rodada passa pelo mestre e entra no registro da sessão', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'round.end' }))).toBe(
      'Só o mestre passa a rodada.',
    );
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'round.end' }))).toEqual([
      { type: 'round.started', numero: 2, seq: 1 },
    ]);
    const registro = m.db.select().from(sessionLog).where(eq(sessionLog.campaignId, m.caso)).all();
    expect(registro).toMatchObject([
      { seq: 1, tipo: 'round.started', dados: { type: 'round.started', numero: 2, seq: 1 } },
    ]);
  });

  it('movimento não entra no registro da sessão', () => {
    const m = montar();
    criarToken(m);
    expect(m.db.select().from(sessionLog).all()).toEqual([]);
  });
});

describe('mapa', () => {
  it('trocar o mapa traz o que está sobre ele e guarda o que estava no outro', () => {
    const m = montar();
    const primeiro = m.mapa?.id ?? '';
    criarToken(m, { nome: 'No primeiro' });
    const segundo = mapaDeTeste(m, m.caso, { nome: 'Porão', largura: 800, altura: 600 });

    const trocou = eventos(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: segundo.id }));
    expect(trocou).toMatchObject([
      { type: 'map.activated', mapa: { id: segundo.id, nome: 'Porão' } },
    ]);
    expect(m.mesa.estado.mapa).toMatchObject({ id: segundo.id, largura: 800, altura: 600 });
    expect(m.mesa.estado.tokens).toEqual([]);

    criarToken(m, { nome: 'No porão' });
    eventos(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: primeiro }));
    expect(m.mesa.estado.tokens.map((t) => t.nome)).toEqual(['No primeiro']);
    eventos(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: segundo.id }));
    expect(m.mesa.estado.tokens.map((t) => t.nome)).toEqual(['No porão']);
  });

  it('a troca entra no registro da sessão; ativar o mapa que já está na mesa não faz nada', () => {
    const m = montar();
    const segundo = mapaDeTeste(m, m.caso, { nome: 'Porão' });
    eventos(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: segundo.id }));
    expect(m.db.select().from(sessionLog).all()).toMatchObject([{ tipo: 'map.activated' }]);

    const estado = m.mesa.estado;
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: segundo.id }))).toEqual(
      [],
    );
    expect(m.mesa.estado).toBe(estado);
  });

  it('só o mestre troca o mapa; mapa de outro caso ou apagado não existe', () => {
    const m = montar();
    const segundo = mapaDeTeste(m, m.caso);
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'map.activate', mapaId: segundo.id }))).toBe(
      'Só o mestre mexe no mapa.',
    );
    const outroCaso = casoDeTeste(m);
    const deFora = mapaDeTeste(m, outroCaso.caso);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: deFora.id }))).toBe(
      'Esse mapa não existe mais.',
    );
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: 'map_nenhum' }))).toBe(
      'Esse mapa não existe mais.',
    );
  });

  it('a grade do mapa ativo muda pelo mestre', () => {
    const m = montar();
    const grade = { celula: 70, deslocamentoX: 12, deslocamentoY: 4 };
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'map.grid', grade }))).toBe(
      'Só o mestre mexe no mapa.',
    );
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'map.grid', grade }))).toMatchObject([
      { type: 'map.changed', mapa: { grade } },
    ]);
    expect(m.mesa.estado.mapa?.grade).toEqual(grade);
    const semMapa = montar({ comMapa: false });
    expect(motivo(semMapa.mesa.aplicar(semMapa.ana, { type: 'map.grid', grade }))).toBe(
      'Ponha um mapa na mesa antes.',
    );
  });
});

describe('trazer o grupo', () => {
  it('cria o token de quem falta (com o token da ficha) e põe em volta do ponto', () => {
    const m = montar();
    m.db
      .update(characters)
      .set({ tokenImg: `${'f'.repeat(64)}.webp` })
      .where(eq(characters.id, m.davi))
      .run();
    const r = eventos(m.mesa.aplicar(m.ana, { type: 'token.gather', x: 500, y: 400 }));
    expect(r).toMatchObject([
      {
        type: 'token.changed',
        token: {
          nome: 'Davi Rocha',
          personagemId: m.davi,
          donoId: m.bia.id,
          imagem: `${'f'.repeat(64)}.webp`,
          x: 500,
          y: 400,
        },
      },
    ]);
  });

  it('quem já está no mapa vai para perto do ponto; NPC fica onde está', () => {
    const m = montar();
    criarToken(m, { personagemId: m.davi, x: 10, y: 10 });
    const npc = criarToken(m, { nome: 'Vulto', x: 30, y: 30 });
    expect(eventos(m.mesa.aplicar(m.ana, { type: 'token.gather', x: 700, y: 600 }))).toMatchObject([
      { type: 'token.moved', x: 700, y: 600 },
    ]);
    expect(m.mesa.estado.tokens.find((t) => t.id === npc.id)).toMatchObject({ x: 30, y: 30 });
  });

  it('só o mestre; sem mapa ou sem ninguém no grupo, não há o que trazer', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'token.gather', x: 1, y: 1 }))).toBe(
      'Só o mestre traz o grupo.',
    );
    m.db
      .update(memberships)
      .set({ characterId: null })
      .where(eq(memberships.userId, m.bia.id))
      .run();
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'token.gather', x: 1, y: 1 }))).toBe(
      'Ninguém do grupo escolheu um personagem ainda.',
    );
    const semMapa = montar({ comMapa: false });
    expect(motivo(semMapa.mesa.aplicar(semMapa.ana, { type: 'token.gather', x: 1, y: 1 }))).toBe(
      'Ponha um mapa na mesa antes.',
    );
  });

  it('as casas vão do centro para fora, uma célula de distância, sem sair do mapa', () => {
    const limite = { largura: 1000, altura: 1000 };
    expect(casasEmVolta({ x: 500, y: 500 }, 3, 50, limite)).toEqual([
      { x: 500, y: 500 },
      { x: 450, y: 450 },
      { x: 500, y: 450 },
    ]);
    expect(casasEmVolta({ x: 0, y: 0 }, 9, 50, limite)).toHaveLength(9);
    expect(casasEmVolta({ x: 0, y: 0 }, 9, 50, limite).every((c) => c.x >= 0 && c.y >= 0)).toBe(
      true,
    );
  });
});

describe('props: prontos, trava e arrasto', () => {
  function criarProp(m: ReturnType<typeof montar>, imagem = 'pronto:caixote') {
    const [evento] = eventos(
      m.mesa.aplicar(m.ana, { type: 'prop.create', imagem, x: 100, y: 100 }),
    );
    if (evento?.type !== 'prop.changed' || !evento.prop) throw new Error('prop não criado');
    return evento.prop;
  }

  it('aceita os props prontos e as imagens enviadas; recusa o resto', () => {
    const m = montar();
    expect(criarProp(m).imagem).toBe('pronto:caixote');
    expect(criarProp(m, `${'a'.repeat(64)}.webp`).imagem).toMatch(/\.webp$/);
    expect(
      motivo(m.mesa.aplicar(m.ana, { type: 'prop.create', imagem: 'pronto:piano', x: 1, y: 1 })),
    ).toBe('Use um prop pronto ou uma imagem enviada pelo app.');
  });

  it('travado não sai do lugar até destravar; trazer à frente continua valendo', () => {
    const m = montar();
    const prop = criarProp(m);
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: prop.id, travado: true }));
    const travado = 'O prop está travado. Destrave para mexer nele.';
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: prop.id, x: 5 }))).toBe(
      travado,
    );
    expect(
      motivo(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: prop.id, rotacao: 45 })),
    ).toBe(travado);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'prop.drag', propId: prop.id, x: 5, y: 5 }))).toBe(
      travado,
    );
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: prop.id, ordem: 9 }));
    // Destravar e mover no mesmo pedido vale.
    eventos(m.mesa.aplicar(m.ana, { type: 'prop.update', propId: prop.id, travado: false, x: 5 }));
    expect(m.mesa.estado.props[0]).toMatchObject({ x: 5, ordem: 9, travado: false });
  });

  it('o arrasto do prop é do mestre, avisa todos e não grava', () => {
    const m = montar();
    const prop = criarProp(m);
    m.mesas.salvarTudo();
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'prop.drag', propId: prop.id, x: 5, y: 5 }))).toBe(
      'Só o mestre mexe nos props.',
    );
    expect(
      eventos(m.mesa.aplicar(m.ana, { type: 'prop.drag', propId: prop.id, x: 50, y: 60 })),
    ).toMatchObject([{ type: 'prop.dragging', propId: prop.id, x: 50, y: 60 }]);
    expect(m.mesa.estado.props[0]).toMatchObject({ x: 100, y: 100 });
    expect(m.mesas.pendentes).toBe(0);
  });
});

describe('dados avulsos, testes da ficha e chat', () => {
  it('dice.roll: rola expressão simples ou secreta, grava no registro e recusa expressão inválida', () => {
    const m = montar({ sorteio: rngComSemente(11) });
    const [publica] = eventos(m.mesa.aplicar(m.bia, { type: 'dice.roll', expressao: '2d6 + 1' }));
    expect(publica).toMatchObject({
      type: 'dice.rolled',
      autorId: m.bia.id,
      expressao: '2d6+1',
      secreta: false,
    });
    if (publica?.type !== 'dice.rolled') throw new Error('esperava dice.rolled');
    expect(publica.dados).toHaveLength(2);
    expect(publica.total).toBe((publica.dados[0] ?? 0) + (publica.dados[1] ?? 0) + 1);

    const [secreta] = eventos(
      m.mesa.aplicar(m.ana, { type: 'dice.roll', expressao: 'd20', secreta: true }),
    );
    expect(secreta).toMatchObject({
      type: 'dice.rolled',
      autorId: m.ana.id,
      expressao: 'd20',
      secreta: true,
    });

    expect(motivo(m.mesa.aplicar(m.bia, { type: 'dice.roll', expressao: 'banana' }))).toBe(
      'Expressão inválida. Use algo como d20, 2d6 ou 2d6+1.',
    );
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'dice.roll', expressao: '1d1' }))).toBe(
      'O dado precisa ter entre 2 e 100 lados.',
    );
    expect(
      m.db
        .select()
        .from(sessionLog)
        .all()
        .map((l) => l.tipo),
    ).toEqual(['dice.rolled', 'dice.rolled']);
  });

  it('test.resolve: aplica consequências na ficha, avisa todos e grava sem repetir no registro', () => {
    const fila: [number, number][] = [
      [5, 6],
      [9, 10],
      [3, 4],
      [2, 4],
    ];
    const m = montar({
      sorteio: () => {
        const par = fila.shift();
        if (!par) throw new Error('faltou dado');
        return (par[0] - 0.5) / par[1];
      },
    });

    const gerados = eventos(
      m.mesa.aplicar(m.bia, {
        type: 'test.resolve',
        personagemId: m.davi,
        periciaId: 'maquinas',
        impeto: true,
        habilidades: ['gambiarra'],
      }),
    );
    expect(gerados).toMatchObject([
      {
        type: 'test.resolved',
        registro: {
          personagemId: m.davi,
          personagemNome: 'Davi Rocha',
          autor: { id: m.bia.id, nome: 'Bia' },
          origem: 'virtual',
          periciaId: 'maquinas',
          atributo: 'mente',
          resultado: { total: 17, dt: 7, veredito: 'sucesso' },
          efeitos: ['Ímpeto gasto: +d4.', 'Gambiarra usada: −2 PV.'],
        },
      },
      { type: 'character.changed', campanhaId: m.caso, personagemId: m.davi, removido: false },
    ]);

    const salvo = m.db.select().from(characters).where(eq(characters.id, m.davi)).get();
    expect(salvo?.ficha).toMatchObject({ impeto: 0, pv: 10, usadasNaCena: ['gambiarra'] });
    expect(m.db.select().from(testLog).all()).toHaveLength(1);
    // Só test.resolved entra em session_log (character.changed não repete lá).
    expect(
      m.db
        .select()
        .from(sessionLog)
        .all()
        .map((l) => l.tipo),
    ).toEqual(['test.resolved']);

    // Outro jogador não testa pela ficha alheia; o mestre pode.
    expect(
      motivo(
        m.mesa.aplicar(m.caio, {
          type: 'test.resolve',
          personagemId: m.davi,
          periciaId: 'luta',
        }),
      ),
    ).toBe('Só quem joga com este personagem ou o mestre do caso pode testar por ele.');
  });

  it('test.report: modo físico com valores ou veredito, falha crítica e permissões', () => {
    const m = montar();
    const fichaFisica: FichaOp2 = { ...fichaDoDavi(), modoDados: 'fisico' };
    m.db.update(characters).set({ ficha: fichaFisica }).where(eq(characters.id, m.davi)).run();

    // No modo físico, test.resolve avisa para informar manualmente.
    expect(
      motivo(
        m.mesa.aplicar(m.bia, {
          type: 'test.resolve',
          personagemId: m.davi,
          periciaId: 'maquinas',
        }),
      ),
    ).toBe('Esta ficha está no modo de dados físicos: role na mão e informe o resultado.');

    // Nem outro jogador nem o mestre informam dados físicos na ficha alheia.
    for (const quem of [m.caio, m.ana]) {
      expect(
        motivo(
          m.mesa.aplicar(quem, {
            type: 'test.report',
            personagemId: m.davi,
            periciaId: 'maquinas',
            resultado: { modo: 'dados', valores: [5, 8] },
          }),
        ),
      ).toBe('Só quem joga com este personagem pode informar dados físicos.');
    }

    const gerados = eventos(
      m.mesa.aplicar(m.bia, {
        type: 'test.report',
        personagemId: m.davi,
        periciaId: 'maquinas',
        impeto: true,
        resultado: { modo: 'veredito', veredito: 'falhaCritica' },
        falhaCritica: { d8: 5, d4: 3 },
      }),
    );
    expect(gerados[0]).toMatchObject({
      type: 'test.resolved',
      registro: {
        origem: 'fisico',
        falhaCritica: { d8: 5, d4: 3, nome: 'Acidente' },
      },
    });
    const salvo = m.db.select().from(characters).where(eq(characters.id, m.davi)).get();
    expect(salvo?.ficha).toMatchObject({ pv: 9, impeto: 1 });

    m.db.update(campaigns).set({ dadosFisicos: false }).where(eq(campaigns.id, m.caso)).run();
    expect(
      motivo(
        m.mesa.aplicar(m.bia, {
          type: 'test.report',
          personagemId: m.davi,
          periciaId: 'maquinas',
          resultado: { modo: 'veredito', veredito: 'sucesso' },
        }),
      ),
    ).toBe('O mestre deste caso não permite dados físicos. Troque a ficha para dados virtuais.');
  });

  it('chat.send: mensagem comum, narração só do mestre e sussurro só para membro do caso', () => {
    const m = montar();
    expect(
      eventos(m.mesa.aplicar(m.bia, { type: 'chat.send', texto: 'Olhem os faders.' })),
    ).toMatchObject([
      {
        type: 'chat.message',
        autorId: m.bia.id,
        texto: 'Olhem os faders.',
        para: null,
        narracao: false,
      },
    ]);

    expect(
      motivo(m.mesa.aplicar(m.bia, { type: 'chat.send', texto: 'Escurece.', narracao: true })),
    ).toBe('Só o mestre pode narrar.');
    expect(
      eventos(m.mesa.aplicar(m.ana, { type: 'chat.send', texto: 'O ar esfria.', narracao: true })),
    ).toMatchObject([{ type: 'chat.message', autorId: m.ana.id, narracao: true, para: null }]);

    expect(
      motivo(
        m.mesa.aplicar(m.ana, {
          type: 'chat.send',
          texto: 'Segredo',
          narracao: true,
          para: m.bia.id,
        }),
      ),
    ).toBe('A narração é para toda a mesa, não um sussurro.');
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'chat.send', texto: 'Oi', para: m.bia.id }))).toBe(
      'Escolha outra pessoa para sussurrar.',
    );
    expect(
      motivo(m.mesa.aplicar(m.bia, { type: 'chat.send', texto: 'Oi', para: m.estranho.id })),
    ).toBe('Essa pessoa não está neste caso.');

    expect(
      eventos(m.mesa.aplicar(m.ana, { type: 'chat.send', texto: 'Ouviu isso?', para: m.bia.id })),
    ).toMatchObject([{ type: 'chat.message', autorId: m.ana.id, para: m.bia.id, narracao: false }]);
  });
});
