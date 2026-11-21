import { describe, expect, it } from 'vitest';
import { NOME_DO_APP, tituloDaPagina } from './index.ts';

describe('tituloDaPagina', () => {
  it('junta a página e o nome do app', () => {
    expect(tituloDaPagina('Casos')).toBe('Casos · MEMBRANA');
  });

  it('sem página, devolve só o nome do app', () => {
    expect(tituloDaPagina()).toBe(NOME_DO_APP);
  });
});
