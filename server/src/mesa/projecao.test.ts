// Segredo só escondido na tela não é segredo. Cada campo secreto do estado leva uma marca única;
// o teste serializa tudo o que o jogador recebe e procura cada marca: tem que dar zero.
// Feature nova com campo secreto? Acrescente a marca em SEGREDOS e o dado no estado abaixo.
import { describe, expect, it } from 'vitest';
import {
  estadoVazioDaMesa,
  type EstadoDaMesa,
  type EventoDaMesa,
  type TokenNaMesa,
} from '@membrana/shared';
import { projetarEstado, projetarEventos, type Espectador } from './projecao.ts';

const SEGREDOS = {
  tokenOculto: 'SEGREDO-TOKEN-OCULTO',
  tokenNaNevoa: 'SEGREDO-TOKEN-NA-NEVOA',
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

const NEVOA = {
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

/** Uma mesa com um segredo de cada tipo. */
function mesaCheiaDeSegredos(): EstadoDaMesa {
  return {
    ...estadoVazioDaMesa(),
    nevoa: [NEVOA],
    tokens: [
      token({ id: 'tok_davi', personagemId: 'chr_davi', donoId: BIA.id }),
      token({ id: SEGREDOS.tokenOculto, nome: SEGREDOS.tokenOculto, oculto: true }),
      token({ id: SEGREDOS.tokenNaNevoa, nome: SEGREDOS.tokenNaNevoa, x: 600, y: 600 }),
      // O token da própria Bia, mesmo sob a névoa, ela vê.
      token({ id: 'tok_bia_na_nevoa', personagemId: 'chr_davi', donoId: BIA.id, x: 650, y: 650 }),
    ],
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
    { type: 'token.dragging', tokenId: SEGREDOS.tokenNaNevoa, x: 610, y: 610, seq: 3 },
    {
      type: 'token.changed',
      tokenId: SEGREDOS.tokenOculto,
      token: estado.tokens[1] ?? null,
      seq: 4,
    },
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
    expect(visao.tokens.map((t) => t.id)).toEqual(['tok_davi', 'tok_bia_na_nevoa']);
    expect(visao.nevoa).toEqual([NEVOA]);
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

describe('tokens que entram e saem da vista', () => {
  const comNpc = (x: number, y: number): EstadoDaMesa => ({
    ...estadoVazioDaMesa(),
    nevoa: [NEVOA],
    tokens: [token({ id: 'tok_npc', x, y })],
  });

  it('NPC que sai da névoa chega inteiro; que entra, some', () => {
    const naNevoa = comNpc(600, 600);
    const aVista = comNpc(100, 100);
    const moveu = (x: number, y: number): EventoDaMesa[] => [
      { type: 'token.moved', tokenId: 'tok_npc', x, y, seq: 7 },
    ];

    expect(projetarEventos(BIA, moveu(100, 100), naNevoa, aVista)).toEqual([
      { type: 'token.changed', tokenId: 'tok_npc', token: aVista.tokens[0], seq: 7 },
    ]);
    expect(projetarEventos(BIA, moveu(600, 600), aVista, naNevoa)).toEqual([
      { type: 'token.changed', tokenId: 'tok_npc', token: null, seq: 7 },
    ]);
    expect(projetarEventos(BIA, moveu(120, 120), aVista, comNpc(120, 120))).toEqual(
      moveu(120, 120),
    );
    expect(projetarEventos(BIA, moveu(610, 610), naNevoa, comNpc(610, 610))).toEqual([]);
  });

  it('névoa nova esconde e revela tokens com o mesmo número de sequência', () => {
    const semNevoa: EstadoDaMesa = { ...comNpc(600, 600), nevoa: [] };
    const comNevoa = comNpc(600, 600);
    const mudou = (estado: EstadoDaMesa): EventoDaMesa[] => [
      { type: 'fog.changed', nevoa: estado.nevoa, seq: 9 },
    ];

    expect(projetarEventos(BIA, mudou(comNevoa), semNevoa, comNevoa)).toEqual([
      ...mudou(comNevoa),
      { type: 'token.changed', tokenId: 'tok_npc', token: null, seq: 9 },
    ]);
    expect(projetarEventos(BIA, mudou(semNevoa), comNevoa, semNevoa)).toEqual([
      ...mudou(semNevoa),
      { type: 'token.changed', tokenId: 'tok_npc', token: semNevoa.tokens[0], seq: 9 },
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
