import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { EventoDaMesa, TokenNaMesa } from '@membrana/shared';
import { sessionLog } from '../db/schema.ts';
import { bancoDeTeste, casoDeTeste } from '../teste/apoio.ts';
import type { ResultadoDoComando } from './Mesa.ts';
import { Mesas } from './mesas.ts';

let fechar: (() => void) | undefined;
afterEach(() => {
  fechar?.();
  fechar = undefined;
});

function montar() {
  const { db, sqlite } = bancoDeTeste();
  fechar = () => {
    sqlite.close();
  };
  const pessoas = casoDeTeste({ db });
  const mesas = new Mesas(db);
  return { db, mesas, mesa: mesas.obter(pessoas.caso), ...pessoas };
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

const NEVOA_NO_CANTO = {
  type: 'fog.add',
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
    expect(motivo(m.mesa.aplicar(m.bia, { type: 'chat.send', texto: 'oi' }))).toBe(
      'Este comando ainda não está disponível na mesa.',
    );
  });

  it('eventos saem numerados em sequência, comando após comando', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    const seqs = [
      ...eventos(m.mesa.aplicar(m.bia, { type: 'token.move', tokenId: token.id, x: 10, y: 10 })),
      ...eventos(m.mesa.aplicar(m.ana, NEVOA_NO_CANTO)),
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

  it('o jogador não entra na névoa; o mestre põe o token onde quiser', () => {
    const m = montar();
    const token = criarToken(m, { personagemId: m.davi });
    eventos(m.mesa.aplicar(m.ana, NEVOA_NO_CANTO));

    const dentro = { type: 'token.move', tokenId: token.id, x: 600, y: 600 } as const;
    expect(motivo(m.mesa.aplicar(m.bia, dentro))).toBe('Não dá para entrar na névoa.');
    expect(motivo(m.mesa.aplicar(m.bia, { ...dentro, type: 'token.drag' }))).toBe(
      'Não dá para entrar na névoa.',
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

  it('com mapa ativo, posição fora dele é recusada', () => {
    const m = montar();
    const token = criarToken(m);
    // O comando que ativa o mapa chega com o #63; aqui o mapa entra direto no estado.
    m.mesa.estado.mapa = {
      id: 'map_1',
      imagem: 'x.webp',
      largura: 1000,
      altura: 800,
      grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
    };
    expect(
      motivo(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 1001, y: 10 })),
    ).toBe('Fora do mapa.');
    expect(
      eventos(m.mesa.aplicar(m.ana, { type: 'token.move', tokenId: token.id, x: 1000, y: 800 })),
    ).toHaveLength(1);
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

describe('props, névoa e rodada', () => {
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

  it('névoa: cobrir, revelar, remover uma área e limpar tudo', () => {
    const m = montar();
    expect(motivo(m.mesa.aplicar(m.bia, NEVOA_NO_CANTO))).toBe('Só o mestre mexe na névoa.');
    eventos(m.mesa.aplicar(m.ana, NEVOA_NO_CANTO));
    const [evento] = eventos(m.mesa.aplicar(m.ana, { ...NEVOA_NO_CANTO, type: 'fog.reveal' }));
    expect(evento).toMatchObject({
      type: 'fog.changed',
      nevoa: [{ modo: 'cobrir' }, { modo: 'revelar' }],
    });

    const id = m.mesa.estado.nevoa[0]?.id ?? '';
    eventos(m.mesa.aplicar(m.ana, { type: 'fog.remove', formaId: id }));
    expect(m.mesa.estado.nevoa.map((a) => a.modo)).toEqual(['revelar']);
    expect(motivo(m.mesa.aplicar(m.ana, { type: 'fog.remove', formaId: id }))).toBe(
      'Essa área da névoa não existe mais.',
    );
    eventos(m.mesa.aplicar(m.ana, { type: 'fog.remove', tudo: true }));
    expect(m.mesa.estado.nevoa).toEqual([]);
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
