import { describe, expect, it } from 'vitest';
import { ErroDeRegra } from '../dados.ts';
import { fichaDoDavi } from './exemplos.ts';
import { aplicarFalhaCritica, TABELA_FALHA_CRITICA } from './falha-critica.ts';
import { dadoEfetivo } from './passos.ts';

function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return e;
    throw e;
  }
  throw new Error('não lançou');
}

describe('tabela da falha crítica (d8)', () => {
  it('tem os 8 efeitos das regras, na ordem', () => {
    expect(TABELA_FALHA_CRITICA.map((l) => l.nome)).toEqual([
      'Vexame',
      'Machucado',
      'Desatenção',
      'Irritação',
      'Acidente',
      'Frustração',
      'Perda',
      'Sem efeito',
    ]);
  });

  it('1 · Vexame: a ficha não muda', () => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), 1);
    expect(ficha).toEqual(fichaDoDavi());
    expect(efeito.nome).toBe('Vexame');
  });

  it.each([
    [2, 'fisico', 'Machucado', 'd8', 'd6'],
    [3, 'mente', 'Desatenção', 'd6', 'd4'],
    [4, 'emocao', 'Irritação', 'd6', 'd4'],
  ] as const)('%i · %s desce um passo até o fim da cena', (d8, atributo, nome, antes, depois) => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), d8);
    expect(dadoEfetivo(fichaDoDavi(), atributo)).toBe(antes);
    expect(dadoEfetivo(ficha, atributo)).toBe(depois);
    expect(ficha.modificadores).toEqual([
      { alvo: atributo, passos: -1, origem: `${nome} (falha crítica)`, duracao: 'cena' },
    ]);
    expect(efeito.nome).toBe(nome);
  });

  it('5 · Acidente: perde d4 PV', () => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), 5, { d4: 3 });
    expect(ficha.pv).toBe(9);
    expect(efeito.descricao).toBe('Perde 3 PV.');
  });

  it('6 · Frustração: perde d4 PD', () => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), 6, { d4: 4 });
    expect(ficha.pd).toBe(6);
    expect(efeito.descricao).toBe('Perde 4 PD.');
  });

  it('PV e PD não ficam negativos', () => {
    const fraco = { ...fichaDoDavi(), pv: 2, pd: 1 };
    expect(aplicarFalhaCritica(fraco, 5, { d4: 4 }).ficha.pv).toBe(0);
    expect(aplicarFalhaCritica(fraco, 6, { d4: 4 }).ficha.pd).toBe(0);
  });

  it('Acidente e Frustração sem d4 são recusados; d4 fora de 1 a 4 também', () => {
    expect(erroDe(() => aplicarFalhaCritica(fichaDoDavi(), 5)).campo).toBe('d4');
    expect(erroDe(() => aplicarFalhaCritica(fichaDoDavi(), 6)).message).toBe(
      'Este efeito pede o d4: role e informe o valor.',
    );
    expect(erroDe(() => aplicarFalhaCritica(fichaDoDavi(), 5, { d4: 5 })).message).toBe(
      'O d4 vai de 1 a 4.',
    );
  });

  it('7 · Perda: o item escolhido sai da ficha', () => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), 7, { itemId: 'lanterna' });
    expect(ficha.itens.map((i) => i.id)).toEqual(['kit', 'radio', 'canivete']);
    expect(efeito.descricao).toBe('Perde Lanterna.');
  });

  it('7 · Perda: com itens, é preciso dizer qual; sem itens, nada a perder', () => {
    expect(erroDe(() => aplicarFalhaCritica(fichaDoDavi(), 7)).campo).toBe('itemId');
    expect(erroDe(() => aplicarFalhaCritica(fichaDoDavi(), 7, { itemId: 'nada' })).campo).toBe(
      'itemId',
    );
    const semItens = { ...fichaDoDavi(), itens: [] };
    const r = aplicarFalhaCritica(semItens, 7);
    expect(r.ficha).toEqual(semItens);
    expect(r.efeito.descricao).toBe('Perderia um item, mas não carrega nenhum.');
  });

  it('8 · Sem efeito', () => {
    const { ficha, efeito } = aplicarFalhaCritica(fichaDoDavi(), 8);
    expect(ficha).toEqual(fichaDoDavi());
    expect(efeito.descricao).toBe('Nada acontece.');
  });

  it('d8 fora de 1 a 8 é recusado, no campo d8', () => {
    for (const d8 of [0, 9, 2.5]) {
      const e = erroDe(() => aplicarFalhaCritica(fichaDoDavi(), d8));
      expect([e.campo, e.message]).toEqual(['d8', 'O d8 vai de 1 a 8.']);
    }
  });

  it('a ficha original nunca muda (devolve uma nova)', () => {
    const original = fichaDoDavi();
    aplicarFalhaCritica(original, 2);
    aplicarFalhaCritica(original, 5, { d4: 4 });
    aplicarFalhaCritica(original, 7, { itemId: 'kit' });
    expect(original).toEqual(fichaDoDavi());
  });
});
