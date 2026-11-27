import { describe, expect, it } from 'vitest';
import { ALCANCE_DE_PISTA_EM_CELULAS, pertoDaPista } from './pistas.ts';

describe('pertoDaPista (#88)', () => {
  it('aceita o mesmo quadrado e os 8 quadrados adjacentes (até 1 célula)', () => {
    expect(ALCANCE_DE_PISTA_EM_CELULAS).toBe(1);
    const pista = { x: 100, y: 100 };
    expect(pertoDaPista({ x: 100, y: 100 }, pista, 50)).toBe(true);
    expect(pertoDaPista({ x: 150, y: 100 }, pista, 50)).toBe(true);
    expect(pertoDaPista({ x: 150, y: 150 }, pista, 50)).toBe(true);
    expect(pertoDaPista({ x: 50, y: 50 }, pista, 50)).toBe(true);
  });

  it('recusa quando está além de 1 célula', () => {
    const pista = { x: 100, y: 100 };
    expect(pertoDaPista({ x: 151, y: 100 }, pista, 50)).toBe(false);
    expect(pertoDaPista({ x: 100, y: 200 }, pista, 50)).toBe(false);
    expect(pertoDaPista({ x: 100, y: 100 }, pista, 0)).toBe(false);
  });

  it('leva em conta a borda de tokens maiores que 1×1', () => {
    const pista = { x: 100, y: 100 };
    // Token 2×2 tem meio quadrado extra de raio: alcança 75 px em célula de 50 px.
    expect(pertoDaPista({ x: 175, y: 100, tamanho: 2 }, pista, 50)).toBe(true);
    expect(pertoDaPista({ x: 176, y: 100, tamanho: 2 }, pista, 50)).toBe(false);
  });
});
