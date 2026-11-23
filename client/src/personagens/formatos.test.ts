import { describe, expect, it } from 'vitest';
import { fichaDoDavi } from '@membrana/shared';
import { linhaDaFicha, textoDeSalva } from './formatos.ts';

describe('linhaDaFicha', () => {
  it('junta ocupação, nível, idade e origem, pulando o que está vazio', () => {
    expect(linhaDaFicha(fichaDoDavi())).toBe('Mecânico · nível 2 · 34 anos · Santa Ermida');
    expect(linhaDaFicha({ ocupacao: ' ', nivel: 1, idade: null, origem: '' })).toBe('nível 1');
  });
});

describe('textoDeSalva', () => {
  const agora = new Date(2026, 10, 23, 15, 0).getTime();
  const antes = (ms: number) => textoDeSalva(agora - ms, agora);

  it('conta o tempo desde a última gravação', () => {
    expect(antes(0)).toBe('Salva agora');
    expect(antes(59_000)).toBe('Salva agora');
    expect(antes(2 * 60_000)).toBe('Salva há 2 min');
    expect(antes(3 * 3_600_000 + 5)).toBe('Salva há 3 h');
    expect(textoDeSalva(new Date(2026, 10, 12, 9).getTime(), agora)).toBe('Salva em 12/11');
  });

  it('relógio adiantado não vira tempo negativo', () => {
    expect(textoDeSalva(agora + 5000, agora)).toBe('Salva agora');
  });
});
