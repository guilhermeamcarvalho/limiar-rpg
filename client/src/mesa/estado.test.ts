import { describe, expect, it } from 'vitest';
import type { EventoDaMesa, RegistroDeTeste, TokenNaMesa, VisaoDaMesa } from '@membrana/shared';
import {
  aplicarEvento,
  MESA_VAZIA,
  mesclarEventosRegistrados,
  type MesaNoCliente,
} from './estado.ts';

const token = (id: string, x = 10, y = 10): TokenNaMesa => ({
  id,
  nome: id,
  imagem: null,
  x,
  y,
  tamanho: 1,
  oculto: false,
  personagemId: null,
  donoId: null,
});

const visao = (campos: Partial<VisaoDaMesa> = {}): VisaoDaMesa => ({
  papel: 'jogador',
  mapa: {
    id: 'map_1',
    nome: 'Rádio',
    imagem: 'a.webp',
    largura: 1000,
    altura: 800,
    grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
  },
  tokens: [token('tok_1')],
  props: [],
  breu: [],
  nevoa: 0,
  pistas: [],
  inventario: [],
  rodada: { numero: 1 },
  trilha: null,
  ...campos,
});

const comEstado = (seq = 5): MesaNoCliente =>
  aplicarEvento(MESA_VAZIA, { type: 'mesa.estado', estado: visao(), seq });

const aplicar = (mesa: MesaNoCliente, ...eventos: EventoDaMesa[]) =>
  eventos.reduce(aplicarEvento, mesa);

describe('aplicarEvento', () => {
  it('o estado completo substitui tudo, inclusive depois de uma queda com número menor', () => {
    const mesa = comEstado(40);
    const depoisDaQueda = aplicar(mesa, {
      type: 'mesa.estado',
      estado: visao({ tokens: [] }),
      seq: 12,
    });
    expect(depoisDaQueda.seq).toBe(12);
    expect(depoisDaQueda.visao?.tokens).toEqual([]);
  });

  it('evento atrasado (anterior ao estado completo) é ignorado', () => {
    const mesa = comEstado(10);
    expect(aplicar(mesa, { type: 'token.moved', tokenId: 'tok_1', x: 99, y: 99, seq: 9 })).toBe(
      mesa,
    );
  });

  it('movimento: arrasto provisório e posição final', () => {
    let mesa = comEstado();
    mesa = aplicar(mesa, { type: 'token.dragging', tokenId: 'tok_1', x: 50, y: 60, seq: 6 });
    expect(mesa.arrastando).toEqual({ tok_1: { x: 50, y: 60 } });
    expect(mesa.visao?.tokens[0]).toMatchObject({ x: 10, y: 10 });

    mesa = aplicar(mesa, { type: 'token.moved', tokenId: 'tok_1', x: 70, y: 80, seq: 7 });
    expect(mesa.arrastando).toEqual({});
    expect(mesa.visao?.tokens[0]).toMatchObject({ x: 70, y: 80 });
    expect(mesa.seq).toBe(7);
  });

  it('token criado, mudado e removido (ou que sumiu da vista)', () => {
    let mesa = comEstado();
    mesa = aplicar(mesa, {
      type: 'token.changed',
      tokenId: 'tok_2',
      token: token('tok_2'),
      seq: 6,
    });
    expect(mesa.visao?.tokens.map((t) => t.id)).toEqual(['tok_1', 'tok_2']);
    mesa = aplicar(mesa, {
      type: 'token.changed',
      tokenId: 'tok_2',
      token: { ...token('tok_2'), tamanho: 3 },
      seq: 7,
    });
    expect(mesa.visao?.tokens[1]?.tamanho).toBe(3);
    mesa = aplicar(mesa, { type: 'token.changed', tokenId: 'tok_1', token: null, seq: 8 });
    expect(mesa.visao?.tokens.map((t) => t.id)).toEqual(['tok_2']);
  });

  it('props ficam na ordem das camadas', () => {
    const prop = (id: string, ordem: number) => ({
      id,
      imagem: 'p.webp',
      x: 0,
      y: 0,
      tamanho: 1,
      rotacao: 0,
      travado: false,
      ordem,
    });
    const mesa = aplicar(
      comEstado(),
      { type: 'prop.changed', propId: 'p2', prop: prop('p2', 2), seq: 6 },
      { type: 'prop.changed', propId: 'p1', prop: prop('p1', 1), seq: 7 },
    );
    expect(mesa.visao?.props.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('breu, grade, rodada e presença', () => {
    const area = {
      id: 'nev_1',
      modo: 'cobrir' as const,
      forma: { tipo: 'retangulo' as const, x: 0, y: 0, largura: 5, altura: 5 },
    };
    const grade = { celula: 70, deslocamentoX: 3, deslocamentoY: 0 };
    const base = visao().mapa;
    if (!base) throw new Error('sem mapa');
    const mapa = { ...base, grade };
    const online = [{ id: 'usr_1', nome: 'Ana', papel: 'mestre' as const, personagemId: null }];
    const mesa = aplicar(
      comEstado(),
      { type: 'darkness.changed', breu: [area], seq: 6 },
      { type: 'map.changed', mapa, seq: 7 },
      { type: 'round.started', numero: 2, seq: 8 },
      { type: 'presence.changed', online, seq: 9 },
    );
    expect(mesa.visao?.breu).toEqual([area]);
    expect(mesa.visao?.mapa?.grade).toEqual(grade);
    expect(mesa.visao?.rodada).toEqual({ numero: 2 });
    expect(mesa.online).toEqual(online);
    expect(mesa.seq).toBe(9);
  });

  it('névoa da Membrana: o nível novo substitui o anterior', () => {
    const mesa = aplicar(
      comEstado(),
      { type: 'mist.changed', nivel: 30, seq: 6 },
      { type: 'mist.changed', nivel: 80, seq: 7 },
    );
    expect(mesa.visao?.nevoa).toBe(80);
    expect(mesa.seq).toBe(7);
  });

  it('presença chega mesmo antes do estado; o resto espera o estado', () => {
    const online = [{ id: 'usr_1', nome: 'Ana', papel: 'mestre' as const, personagemId: null }];
    const mesa = aplicar(
      MESA_VAZIA,
      { type: 'presence.changed', online, seq: 1 },
      { type: 'round.started', numero: 2, seq: 2 },
    );
    expect(mesa.online).toEqual(online);
    expect(mesa.visao).toBeNull();
  });
});

describe('props no arrasto', () => {
  it('o arrasto do mestre aparece para os outros e some quando o prop muda', () => {
    const prop = {
      id: 'prp_1',
      imagem: 'pronto:caixote',
      x: 10,
      y: 10,
      tamanho: 1,
      rotacao: 0,
      travado: false,
      ordem: 0,
    };
    let mesa = aplicar(comEstado(), { type: 'prop.changed', propId: 'prp_1', prop, seq: 6 });
    mesa = aplicar(mesa, { type: 'prop.dragging', propId: 'prp_1', x: 40, y: 50, seq: 7 });
    expect(mesa.arrastando).toEqual({ prp_1: { x: 40, y: 50 } });
    mesa = aplicar(mesa, {
      type: 'prop.changed',
      propId: 'prp_1',
      prop: { ...prop, x: 60, y: 70 },
      seq: 8,
    });
    expect(mesa.arrastando).toEqual({});
    expect(mesa.visao?.props[0]).toMatchObject({ x: 60, y: 70 });
  });
});

describe('registro, testes e deduplicação por seq', () => {
  const registroTeste: RegistroDeTeste = {
    id: 'tst_1',
    personagemId: 'chr_1',
    personagemNome: 'Davi',
    campanhaId: 'cmp_1',
    autor: { id: 'usr_1', nome: 'Bia' },
    periciaId: 'percepcao',
    atributo: 'mente',
    origem: 'virtual',
    resultado: {
      dados: [
        { tipo: 'd6', valor: 4, papel: 'atributo', descartado: false },
        { tipo: 'd6', valor: 5, papel: 'pericia', descartado: false },
      ],
      total: 9,
      dt: 7,
      ra: 5,
      rb: 4,
      veredito: 'sucesso',
      informado: false,
    },
    falhaCritica: null,
    efeitos: [],
    em: '2026-11-26T12:00:00.000Z',
  };

  it('une histórico HTTP e eventos ao vivo sem repetir nenhum seq', () => {
    const fala: EventoDaMesa = {
      type: 'chat.message',
      id: 'msg_1',
      autorId: 'usr_1',
      texto: 'Oi',
      para: null,
      narracao: false,
      em: '2026-11-26T12:00:00.000Z',
      seq: 3,
    };
    const rodada: EventoDaMesa = { type: 'round.started', numero: 2, seq: 4 };
    const movimento: EventoDaMesa = { type: 'token.moved', tokenId: 'tok_1', x: 1, y: 2, seq: 5 };

    const unidos = mesclarEventosRegistrados([fala, rodada], [rodada, movimento, fala]);
    expect(unidos.map((e) => e.seq)).toEqual([3, 4]);
  });

  it('guarda o último teste e incrementa a versão do personagem mudado', () => {
    let mesa = comEstado(2);
    mesa = aplicar(
      mesa,
      { type: 'test.resolved', registro: registroTeste, seq: 3 },
      {
        type: 'character.changed',
        campanhaId: 'cmp_1',
        personagemId: 'chr_1',
        removido: false,
        seq: 4,
      },
    );
    expect(mesa.ultimoTeste).toEqual({ seq: 3, registro: registroTeste });
    expect(mesa.versaoPersonagens).toEqual({ chr_1: 1 });
    expect(mesa.eventos.map((e) => e.type)).toEqual(['test.resolved']);
  });
});
