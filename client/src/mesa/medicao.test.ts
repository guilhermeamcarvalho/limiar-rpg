import { describe, expect, it } from 'vitest';
import { formatarMedicao, medirDistancia } from './medicao.ts';

describe('medicao na mesa', () => {
  it('calcula distância em pixels, quadrados e metros (1 quadrado = 1,5 m)', () => {
    expect(medirDistancia({ x: 0, y: 0 }, { x: 150, y: 200 }, 50)).toEqual({
      pixels: 250,
      quadrados: 5,
      metros: 7.5,
    });
    expect(medirDistancia({ x: 10, y: 10 }, { x: 60, y: 10 }, 0)).toEqual({
      pixels: 50,
      quadrados: 0,
      metros: 0,
    });
  });

  it('formata quadrados e metros em português com vírgula decimal', () => {
    expect(formatarMedicao({ x: 0, y: 0 }, { x: 0, y: 0 }, 50)).toBe('0 quadrados · 0 m');
    expect(formatarMedicao({ x: 0, y: 0 }, { x: 50, y: 0 }, 50)).toBe('1 quadrado · 1,5 m');
    expect(formatarMedicao({ x: 0, y: 0 }, { x: 125, y: 0 }, 50)).toBe('2,5 quadrados · 3,8 m');
    expect(formatarMedicao({ x: 0, y: 0 }, { x: 150, y: 200 }, 50)).toBe('5 quadrados · 7,5 m');
  });
});
