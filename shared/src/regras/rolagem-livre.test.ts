import { describe, expect, it } from 'vitest';
import { rngComSemente } from './dados.ts';
import { lerExpressaoDeDados, rolarExpressao } from './rolagem-livre.ts';

describe('lerExpressaoDeDados', () => {
  it('entende dado sozinho, quantidade e modificador positivo ou negativo', () => {
    expect(lerExpressaoDeDados('d20')).toEqual({
      expressao: 'd20',
      quantidade: 1,
      faces: 20,
      modificador: 0,
    });
    expect(lerExpressaoDeDados(' 2D6 + 1 ')).toEqual({
      expressao: '2d6+1',
      quantidade: 2,
      faces: 6,
      modificador: 1,
    });
    expect(lerExpressaoDeDados('3d8−2')).toEqual({
      expressao: '3d8-2',
      quantidade: 3,
      faces: 8,
      modificador: -2,
    });
    expect(lerExpressaoDeDados('1d100+0')).toEqual({
      expressao: '1d100',
      quantidade: 1,
      faces: 100,
      modificador: 0,
    });
  });

  it('recusa expressão mal escrita ou fora dos limites com mensagem clara', () => {
    for (const ruim of ['', 'oi', '20', '2d', 'd', '2d6+', '2d6+1+2']) {
      expect(() => lerExpressaoDeDados(ruim)).toThrow(
        'Expressão inválida. Use algo como d20, 2d6 ou 2d6+1.',
      );
    }
    expect(() => lerExpressaoDeDados('0d6')).toThrow('Role de 1 a 20 dados por vez.');
    expect(() => lerExpressaoDeDados('21d6')).toThrow('Role de 1 a 20 dados por vez.');
    expect(() => lerExpressaoDeDados('1d1')).toThrow('O dado precisa ter entre 2 e 100 lados.');
    expect(() => lerExpressaoDeDados('1d101')).toThrow('O dado precisa ter entre 2 e 100 lados.');
    expect(() => lerExpressaoDeDados('1d20+100')).toThrow('O modificador vai de -99 a +99.');
  });
});

describe('rolarExpressao', () => {
  it('rola cada dado dentro das faces e aplica o modificador', () => {
    const rng = rngComSemente(7);
    const r = rolarExpressao('3d6+2', rng);
    expect(r.dados).toHaveLength(3);
    for (const v of r.dados) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(r.total).toBe(r.dados.reduce((a, b) => a + b, 0) + 2);
  });
});
