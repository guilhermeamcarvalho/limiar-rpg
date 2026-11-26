// Segredo só escondido na tela não é segredo. Cada campo secreto do estado leva uma marca única;
// o teste serializa tudo o que o jogador recebe e procura cada marca: tem que dar zero.
// Feature nova com campo secreto? Acrescente a marca em SEGREDOS e o dado no estado abaixo.
import { describe, expect, it } from 'vitest';
import {
  estadoVazioDaMesa,
  type EstadoDaMesa,
  type EventoDaMesa,
  type PropNaMesa,
  type TokenNaMesa,
} from '@membrana/shared';
import { projetarEstado, projetarEventos, projetarRegistro, type Espectador } from './projecao.ts';

const SEGREDOS = {
  tokenOculto: 'SEGREDO-TOKEN-OCULTO',
  tokenNoBreu: 'SEGREDO-TOKEN-NO-BREU',
  propNoBreu: 'SEGREDO-PROP-NO-BREU',
  notaDaSala: 'SEGREDO-NOTA-DA-SALA',
  nomeDaSala: 'SEGREDO-NOME-DA-SALA',
  pistaNaoDescoberta: 'SEGREDO-PISTA-NAO-DESCOBERTA',
  textoNaoDescoberto: 'SEGREDO-TEXTO-NAO-DESCOBERTO',
  pistaOculta: 'SEGREDO-PISTA-OCULTA',
  notaDoMestre: 'SEGREDO-NOTA-DO-MESTRE',
  pistaDeOutro: 'SEGREDO-PISTA-DE-OUTRO',
  guia: 'SEGREDO-GUIA-DE-CENA',
  escudo: 'SEGREDO-ESCUDO',
  rolagemSecreta: 'SEGREDO-ROLAGEM',
  sussurro: 'SEGREDO-SUSSURRO',
  infoDeOutro: 'SEGREDO-INFO-DE-OUTRO',
} as const;

const ANA: Espectador = { id: 'usr_ana', papel: 'mestre', personagemId: null };
const BIA: Espectador = { id: 'usr_bia', papel: 'jogador', personagemId: 'chr_davi' };
const CAIO: Espectador = { id: 'usr_caio', papel: 'jogador', personagemId: 'chr_rita' };

const BREU = {
  id: 'nev_1',
  modo: 'cobrir' as const,
  forma: { tipo: 'retangulo' as const, x: 500, y: 500, largura: 200, altura: 200 },
};

const token = (campos: Partial<TokenNaMesa> & { id: string }): TokenNaMesa => ({
  nome: campos.id,
  imagem: null,
  x: 100,
  y: 100,
  tamanho: 1,
  oculto: false,
  personagemId: null,
  donoId: null,
  ...campos,
});

const prop = (campos: Partial<PropNaMesa> & { id: string }): PropNaMesa => ({
  imagem: 'caixao',
  x: 100,
  y: 100,
  tamanho: 1,
  rotacao: 0,
  travado: false,
  ordem: 0,
  ...campos,
});

/** Uma mesa com um segredo de cada tipo. */
function mesaCheiaDeSegredos(): EstadoDaMesa {
  return {
    ...estadoVazioDaMesa(),
    breu: [BREU],
    tokens: [
      token({ id: 'tok_davi', personagemId: 'chr_davi', donoId: BIA.id }),
      token({ id: SEGREDOS.tokenOculto, nome: SEGREDOS.tokenOculto, oculto: true }),
      token({ id: SEGREDOS.tokenNoBreu, nome: SEGREDOS.tokenNoBreu, x: 600, y: 600 }),
      // O token da própria Bia, mesmo sob o breu, ela vê.
      token({ id: 'tok_bia_no_breu', personagemId: 'chr_davi', donoId: BIA.id, x: 650, y: 650 }),
    ],
    props: [prop({ id: 'prp_mesa' }), prop({ id: SEGREDOS.propNoBreu, x: 600, y: 600 })],
    salas: [
      { id: 'sala_1', nome: SEGREDOS.nomeDaSala, area: [], notasMestre: SEGREDOS.notaDaSala },
    ],
    pistas: [
      {
        id: 'pst_aberta',
        titulo: 'Carta rasgada',
        texto: 'Faltam as últimas linhas.',
        notaMestre: SEGREDOS.notaDoMestre,
        x: 10,
        y: 10,
        visivel: true,
        descoberta: true,
      },
      {
        id: 'pst_tarja',
        titulo: SEGREDOS.pistaNaoDescoberta,
        texto: SEGREDOS.textoNaoDescoberto,
        notaMestre: SEGREDOS.notaDoMestre,
        x: 20,
        y: 20,
        visivel: true,
        descoberta: false,
      },
      {
        id: SEGREDOS.pistaOculta,
        titulo: SEGREDOS.pistaOculta,
        texto: SEGREDOS.pistaOculta,
        notaMestre: SEGREDOS.notaDoMestre,
        x: 30,
        y: 30,
        visivel: false,
        descoberta: false,
      },
      {
        id: 'pst_do_caio',
        titulo: SEGREDOS.pistaDeOutro,
        texto: SEGREDOS.pistaDeOutro,
        notaMestre: SEGREDOS.notaDoMestre,
        x: 40,
        y: 40,
        visivel: false,
        descoberta: true,
      },
      {
        id: 'pst_da_bia',
        titulo: 'Chave pequena',
        texto: 'Tem um número gravado.',
        notaMestre: SEGREDOS.notaDoMestre,
        x: 50,
        y: 50,
        visivel: false,
        descoberta: true,
      },
    ],
    comAlguem: [
      { pistaId: 'pst_do_caio', personagemId: 'chr_rita', apresentada: false, em: 'x' },
      { pistaId: 'pst_da_bia', personagemId: 'chr_davi', apresentada: false, em: 'x' },
      { pistaId: 'pst_aberta', personagemId: 'chr_rita', apresentada: true, em: 'x' },
    ],
    guia: SEGREDOS.guia,
    escudo: SEGREDOS.escudo,
  };
}

/** Eventos de cada tipo que carregam segredo, como o servidor gera. */
function eventosComSegredos(estado: EstadoDaMesa): EventoDaMesa[] {
  return [
    { type: 'mesa.estado', estado: projetarEstado(ANA, estado), seq: 1 },
    { type: 'token.moved', tokenId: SEGREDOS.tokenOculto, x: 1, y: 1, seq: 2 },
    { type: 'token.dragging', tokenId: SEGREDOS.tokenNoBreu, x: 610, y: 610, seq: 3 },
    {
      type: 'token.changed',
      tokenId: SEGREDOS.tokenOculto,
      token: estado.tokens[1] ?? null,
      seq: 4,
    },
    {
      type: 'prop.changed',
      propId: SEGREDOS.propNoBreu,
      prop: estado.props[1] ?? null,
      seq: 4,
    },
    { type: 'prop.dragging', propId: SEGREDOS.propNoBreu, x: 620, y: 620, seq: 4 },
    {
      type: 'room.updated',
      salaId: 'sala_1',
      sala: estado.salas[0] ?? null,
      seq: 5,
    },
    {
      type: 'clue.changed',
      pistaId: 'pst_tarja',
      pista: estado.pistas[1] ?? null,
      seq: 6,
    },
    {
      type: 'clue.changed',
      pistaId: SEGREDOS.pistaOculta,
      pista: estado.pistas[2] ?? null,
      seq: 7,
    },
    {
      type: 'clue.received',
      item: {
        pistaId: 'pst_do_caio',
        personagemId: 'chr_rita',
        apresentada: false,
        em: 'x',
        titulo: SEGREDOS.pistaDeOutro,
        texto: SEGREDOS.pistaDeOutro,
      },
      seq: 8,
    },
    { type: 'clue.revoked', pistaId: SEGREDOS.pistaDeOutro, personagemId: 'chr_rita', seq: 9 },
    {
      type: 'dice.rolled',
      autorId: ANA.id,
      expressao: SEGREDOS.rolagemSecreta,
      dados: [6],
      total: 6,
      secreta: true,
      seq: 10,
    },
    {
      type: 'chat.message',
      id: 'msg_1',
      autorId: ANA.id,
      texto: SEGREDOS.sussurro,
      para: CAIO.id,
      narracao: false,
      em: 'x',
      seq: 11,
    },
    {
      type: 'poi.infoRevealed',
      poiId: 'poi_1',
      personagemIds: ['chr_rita'],
      texto: SEGREDOS.infoDeOutro,
      seq: 12,
    },
  ];
}

function vazados(recebido: unknown): string[] {
  const json = JSON.stringify(recebido);
  return Object.values(SEGREDOS).filter((s) => json.includes(s));
}

describe('o que o jogador recebe', () => {
  it('nenhum campo secreto aparece no estado do jogador', () => {
    expect(vazados(projetarEstado(BIA, mesaCheiaDeSegredos()))).toEqual([]);
  });

  it('nenhum campo secreto aparece nos eventos do jogador', () => {
    const estado = mesaCheiaDeSegredos();
    expect(vazados(projetarEventos(BIA, eventosComSegredos(estado), estado, estado))).toEqual([]);
  });

  it('o mestre recebe tudo', () => {
    const estado = mesaCheiaDeSegredos();
    const todos = Object.values(SEGREDOS).sort();
    const doEstado = vazados(projetarEstado(ANA, estado));
    const dosEventos = vazados(projetarEventos(ANA, eventosComSegredos(estado), estado, estado));
    expect([...new Set([...doEstado, ...dosEventos])].sort()).toEqual(todos);
    expect(projetarEventos(ANA, eventosComSegredos(estado), estado, estado)).toEqual(
      eventosComSegredos(estado),
    );
  });

  it('o jogador vê o que é dele e o que é do grupo', () => {
    const visao = projetarEstado(BIA, mesaCheiaDeSegredos());
    expect(visao.papel).toBe('jogador');
    expect(visao.tokens.map((t) => t.id)).toEqual(['tok_davi', 'tok_bia_no_breu']);
    expect(visao.props.map((p) => p.id)).toEqual(['prp_mesa']);
    expect(visao.breu).toEqual([BREU]);
    expect(visao.pistas).toEqual([
      {
        id: 'pst_aberta',
        x: 10,
        y: 10,
        descoberta: true,
        titulo: 'Carta rasgada',
        texto: 'Faltam as últimas linhas.',
      },
      { id: 'pst_tarja', x: 20, y: 20, descoberta: false },
    ]);
    expect(visao.inventario.map((i) => i.pistaId)).toEqual(['pst_da_bia', 'pst_aberta']);
    expect(visao).not.toHaveProperty('salas');
    expect(visao).not.toHaveProperty('guia');
    expect(visao).not.toHaveProperty('escudo');
  });

  it('a rolagem secreta e o sussurro chegam a quem rolou, a quem mandou e ao destinatário', () => {
    const estado = mesaCheiaDeSegredos();
    const eventos = eventosComSegredos(estado);
    const tipos = (quem: Espectador) =>
      projetarEventos(quem, eventos, estado, estado).map((e) => e.type);
    expect(tipos(CAIO)).toEqual(
      expect.arrayContaining(['clue.received', 'clue.revoked', 'chat.message', 'poi.infoRevealed']),
    );
    expect(tipos(CAIO)).not.toContain('dice.rolled');
    expect(tipos({ ...CAIO, id: ANA.id, papel: 'jogador' })).toContain('dice.rolled');
  });
});

describe('névoa da Membrana', () => {
  const comNevoa: EstadoDaMesa = {
    ...estadoVazioDaMesa(),
    nevoa: 70,
    tokens: [token({ id: 'tok_npc', x: 100, y: 100 })],
  };

  it('todos recebem o mesmo nível, no estado e no evento', () => {
    expect(projetarEstado(BIA, comNevoa).nevoa).toBe(70);
    expect(projetarEstado(ANA, comNevoa).nevoa).toBe(70);
    const mudou: EventoDaMesa[] = [{ type: 'mist.changed', nivel: 70, seq: 4 }];
    expect(projetarEventos(BIA, mudou, estadoVazioDaMesa(), comNevoa)).toEqual(mudou);
  });

  it('não esconde nada: o token à vista continua chegando', () => {
    expect(projetarEstado(BIA, comNevoa).tokens.map((t) => t.id)).toEqual(['tok_npc']);
  });
});

describe('tokens que entram e saem da vista', () => {
  const comNpc = (x: number, y: number): EstadoDaMesa => ({
    ...estadoVazioDaMesa(),
    breu: [BREU],
    tokens: [token({ id: 'tok_npc', x, y })],
  });

  it('NPC que sai do breu chega inteiro; que entra, some', () => {
    const noBreu = comNpc(600, 600);
    const aVista = comNpc(100, 100);
    const moveu = (x: number, y: number): EventoDaMesa[] => [
      { type: 'token.moved', tokenId: 'tok_npc', x, y, seq: 7 },
    ];

    expect(projetarEventos(BIA, moveu(100, 100), noBreu, aVista)).toEqual([
      { type: 'token.changed', tokenId: 'tok_npc', token: aVista.tokens[0], seq: 7 },
    ]);
    expect(projetarEventos(BIA, moveu(600, 600), aVista, noBreu)).toEqual([
      { type: 'token.changed', tokenId: 'tok_npc', token: null, seq: 7 },
    ]);
    expect(projetarEventos(BIA, moveu(120, 120), aVista, comNpc(120, 120))).toEqual(
      moveu(120, 120),
    );
    expect(projetarEventos(BIA, moveu(610, 610), noBreu, comNpc(610, 610))).toEqual([]);
  });

  it('breu novo esconde e revela tokens com o mesmo número de sequência', () => {
    const semBreu: EstadoDaMesa = { ...comNpc(600, 600), breu: [] };
    const comBreu = comNpc(600, 600);
    const mudou = (estado: EstadoDaMesa): EventoDaMesa[] => [
      { type: 'darkness.changed', breu: estado.breu, seq: 9 },
    ];

    expect(projetarEventos(BIA, mudou(comBreu), semBreu, comBreu)).toEqual([
      ...mudou(comBreu),
      { type: 'token.changed', tokenId: 'tok_npc', token: null, seq: 9 },
    ]);
    expect(projetarEventos(BIA, mudou(semBreu), comBreu, semBreu)).toEqual([
      ...mudou(semBreu),
      { type: 'token.changed', tokenId: 'tok_npc', token: semBreu.tokens[0], seq: 9 },
    ]);
  });

  it('token ocultado pelo mestre some da vista do jogador', () => {
    const visivel = comNpc(100, 100);
    const oculto: EstadoDaMesa = {
      ...visivel,
      tokens: [token({ id: 'tok_npc', oculto: true })],
    };
    const evento: EventoDaMesa = {
      type: 'token.changed',
      tokenId: 'tok_npc',
      token: oculto.tokens[0] ?? null,
      seq: 3,
    };
    expect(projetarEventos(BIA, [evento], visivel, oculto)).toEqual([{ ...evento, token: null }]);
    // Já estava fora da vista: nada a mandar.
    expect(projetarEventos(BIA, [evento], oculto, oculto)).toEqual([]);
  });

  it('pista que deixa de ser visível vira null; que nunca foi, não chega', () => {
    const base = mesaCheiaDeSegredos();
    const escondida: EstadoDaMesa = {
      ...base,
      pistas: base.pistas.map((p) => (p.id === 'pst_aberta' ? { ...p, visivel: false } : p)),
    };
    const evento: EventoDaMesa = {
      type: 'clue.changed',
      pistaId: 'pst_aberta',
      pista: escondida.pistas[0] ?? null,
      seq: 4,
    };
    expect(projetarEventos(BIA, [evento], base, escondida)).toEqual([{ ...evento, pista: null }]);
  });
});

describe('troca de mapa', () => {
  it('cada um recebe o mapa novo inteiro, do jeito que pode ver, com o mesmo número', () => {
    const antes = estadoVazioDaMesa();
    const mapa = {
      id: 'map_2',
      nome: 'Porão',
      imagem: `${'a'.repeat(64)}.webp`,
      largura: 800,
      altura: 600,
      grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
    };
    const depois: EstadoDaMesa = {
      ...antes,
      mapa,
      tokens: [token({ id: 'tok_npc' }), token({ id: SEGREDOS.tokenOculto, oculto: true })],
    };
    const trocou: EventoDaMesa[] = [{ type: 'map.activated', mapa, seq: 5 }];

    const paraBia = projetarEventos(BIA, trocou, antes, depois);
    expect(paraBia).toEqual([
      { type: 'map.activated', mapa, seq: 5 },
      { type: 'mesa.estado', estado: projetarEstado(BIA, depois), seq: 5 },
    ]);
    expect(vazados(paraBia)).toEqual([]);

    const paraAna = projetarEventos(ANA, trocou, antes, depois);
    expect(paraAna[1]).toEqual({
      type: 'mesa.estado',
      estado: projetarEstado(ANA, depois),
      seq: 5,
    });
    expect(vazados(paraAna)).toEqual([SEGREDOS.tokenOculto]);
  });

  it('a grade nova vai para todos como está', () => {
    const estado = mesaCheiaDeSegredos();
    const evento: EventoDaMesa = {
      type: 'map.changed',
      mapa: {
        id: 'map_1',
        nome: 'Rádio',
        imagem: 'x',
        largura: 1,
        altura: 1,
        grade: { celula: 70, deslocamentoX: 0, deslocamentoY: 0 },
      },
      seq: 2,
    };
    expect(projetarEventos(BIA, [evento], estado, estado)).toEqual([evento]);
  });
});

describe('props que entram e saem da vista', () => {
  const comProp = (x: number, y: number, breu = [BREU]): EstadoDaMesa => ({
    ...estadoVazioDaMesa(),
    breu,
    props: [prop({ id: 'prp_1', x, y })],
  });
  const mudou = (estado: EstadoDaMesa): EventoDaMesa[] => [
    { type: 'prop.changed', propId: 'prp_1', prop: estado.props[0] ?? null, seq: 5 },
  ];

  it('prop posto no breu não chega; que sai dele, chega inteiro; que entra, some', () => {
    const noBreu = comProp(600, 600);
    const aVista = comProp(100, 100);
    expect(projetarEventos(BIA, mudou(noBreu), estadoVazioDaMesa(), noBreu)).toEqual([]);
    expect(projetarEventos(BIA, mudou(aVista), noBreu, aVista)).toEqual(mudou(aVista));
    expect(projetarEventos(BIA, mudou(noBreu), aVista, noBreu)).toEqual([
      { type: 'prop.changed', propId: 'prp_1', prop: null, seq: 5 },
    ]);
    // Removido sob o breu: o jogador nem sabia dele.
    const removido: EventoDaMesa[] = [
      { type: 'prop.changed', propId: 'prp_1', prop: null, seq: 5 },
    ];
    expect(projetarEventos(BIA, removido, noBreu, { ...noBreu, props: [] })).toEqual([]);
    expect(projetarEventos(ANA, mudou(noBreu), aVista, noBreu)).toEqual(mudou(noBreu));
  });

  it('o arrasto só chega enquanto o prop está à vista', () => {
    const aVista = comProp(100, 100);
    const arrasto = (x: number, y: number): EventoDaMesa[] => [
      { type: 'prop.dragging', propId: 'prp_1', x, y, seq: 6 },
    ];
    expect(projetarEventos(BIA, arrasto(120, 120), aVista, aVista)).toEqual(arrasto(120, 120));
    expect(projetarEventos(BIA, arrasto(600, 600), aVista, aVista)).toEqual([]);
    const noBreu = comProp(600, 600);
    expect(projetarEventos(BIA, arrasto(100, 100), noBreu, noBreu)).toEqual([]);
  });

  it('breu novo esconde e revela props com o mesmo número de sequência', () => {
    const semBreu = comProp(600, 600, []);
    const comBreu = comProp(600, 600);
    const darkness = (estado: EstadoDaMesa): EventoDaMesa[] => [
      { type: 'darkness.changed', breu: estado.breu, seq: 9 },
    ];
    expect(projetarEventos(BIA, darkness(comBreu), semBreu, comBreu)).toEqual([
      ...darkness(comBreu),
      { type: 'prop.changed', propId: 'prp_1', prop: null, seq: 9 },
    ]);
    expect(projetarEventos(BIA, darkness(semBreu), comBreu, semBreu)).toEqual([
      ...darkness(semBreu),
      { type: 'prop.changed', propId: 'prp_1', prop: semBreu.props[0], seq: 9 },
    ]);
  });
});

describe('projetarRegistro (session_log)', () => {
  it('não vaza rolagem secreta nem sussurro alheio ao carregar o registro da sessão', () => {
    const estado = mesaCheiaDeSegredos();
    const gravados: EventoDaMesa[] = [
      ...eventosComSegredos(estado),
      { type: 'round.started', numero: 2, seq: 13 },
    ];
    expect(vazados(projetarRegistro(BIA, gravados))).toEqual([]);
    expect(projetarRegistro(BIA, gravados).map((e) => e.type)).toEqual(['round.started']);
    expect(projetarRegistro(CAIO, gravados).map((e) => e.type)).toEqual([
      'chat.message',
      'round.started',
    ]);
    expect(projetarRegistro(ANA, gravados)).toEqual(gravados);
  });

  it('board.pinged chega para mestre e jogadores', () => {
    const estado = mesaCheiaDeSegredos();
    const pulso: EventoDaMesa = {
      type: 'board.pinged',
      autorId: BIA.id,
      x: 150,
      y: 220,
      seq: 14,
    };
    expect(projetarEventos(ANA, [pulso], estado, estado)).toEqual([pulso]);
    expect(projetarEventos(BIA, [pulso], estado, estado)).toEqual([pulso]);
  });
});
