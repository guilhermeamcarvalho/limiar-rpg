import { describe, expect, it } from 'vitest';
import { esquemaPedidoDeTeste, esquemaTesteInformado } from './teste-op2.ts';

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

describe('esquemaTesteInformado', () => {
  const base = { periciaId: 'maquinas' };
  const aceita = (corpo: object) => esquemaTesteInformado.safeParse({ ...base, ...corpo });

  it('aceita os valores dos dados ou só o veredito, com o d8 e o d4 da falha crítica', () => {
    expect(
      aceita({ impeto: true, resultado: { modo: 'dados', valores: [5, 12, 3] } }).success,
    ).toBe(true);
    expect(
      aceita({
        resultado: { modo: 'veredito', veredito: 'falhaCritica' },
        falhaCritica: { d8: 5, d4: 3 },
      }).success,
    ).toBe(true);
  });

  it('recusa modo desconhecido, mais de 4 dados, número quebrado e campo a mais', () => {
    expect(aceita({ resultado: { modo: 'adivinhar' } }).success).toBe(false);
    expect(
      aceita({ resultado: { modo: 'dados', valores: [1, 2, 3, 4, 5] } }).error?.issues[0]?.message,
    ).toBe('No máximo 4 dados.');
    expect(aceita({ resultado: { modo: 'dados', valores: [1.5, 2] } }).success).toBe(false);
    expect(aceita({ resultado: { modo: 'veredito', veredito: 'sucesso', total: 3 } }).success).toBe(
      false,
    );
    expect(
      aceita({ resultado: { modo: 'veredito', veredito: 'sucesso' }, jeito: 'dados' }).success,
    ).toBe(false);
  });
});
