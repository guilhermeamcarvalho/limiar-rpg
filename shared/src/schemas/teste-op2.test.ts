import { describe, expect, it } from 'vitest';
import { esquemaPedidoDeTeste } from './teste-op2.ts';

describe('esquemaPedidoDeTeste', () => {
  it('aceita só a perícia, ou com DT, Ajuda, Ímpeto e habilidades', () => {
    expect(esquemaPedidoDeTeste.parse({ periciaId: 'maquinas' })).toEqual({
      periciaId: 'maquinas',
    });
    expect(
      esquemaPedidoDeTeste.safeParse({
        periciaId: 'crime',
        dt: 12,
        ajuda: true,
        impeto: true,
        habilidades: ['gambiarra'],
      }).success,
    ).toBe(true);
  });

  it('recusa perícia desconhecida, DT fora de 1 a 99 e campo a mais', () => {
    const semPericia = esquemaPedidoDeTeste.safeParse({ periciaId: 'voar' });
    expect(semPericia.error?.issues[0]?.message).toBe('Escolha uma das perícias da ficha.');
    expect(esquemaPedidoDeTeste.safeParse({ periciaId: 'luta', dt: 0 }).success).toBe(false);
    expect(esquemaPedidoDeTeste.safeParse({ periciaId: 'luta', dt: 7.5 }).success).toBe(false);
    expect(esquemaPedidoDeTeste.safeParse({ periciaId: 'luta', total: 20 }).success).toBe(false);
  });
});
