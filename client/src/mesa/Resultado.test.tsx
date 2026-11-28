import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RegistroDeTeste } from '@membrana/shared';
import { Resultado } from './Resultado.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const REGISTRO: RegistroDeTeste = {
  id: 'tst_1',
  campanhaId: 'cmp_1',
  personagemId: 'chr_1',
  personagemNome: 'Davi',
  autor: { id: 'usr_1', nome: 'Gui' },
  periciaId: 'investigacao',
  atributo: 'intelecto',
  origem: 'virtual',
  impeto: false,
  resultado: {
    dados: [
      { papel: 'atributo', tipo: 'd6', valor: 5, descartado: false },
      { papel: 'pericia', tipo: 'd6', valor: 4, descartado: false },
    ],
    total: 9,
    dt: 10,
    ra: 5,
    rb: 4,
    veredito: 'falha',
    informado: true,
  },
  falhaCritica: null,
  efeitos: [],
  em: '2026-11-28T15:00:00.000Z',
};

describe('Resultado', () => {
  it('fecha automaticamente após o tempo limite', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();

    render(
      <Resultado
        registro={REGISTRO}
        papel="jogador"
        nomesDePersonagens={{ chr_1: 'Davi' }}
        aoFechar={aoFechar}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(aoFechar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('pausa o tempo limite enquanto o mouse estiver sobre o card', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();

    render(
      <Resultado
        registro={REGISTRO}
        papel="jogador"
        nomesDePersonagens={{ chr_1: 'Davi' }}
        aoFechar={aoFechar}
        tempoLimiteMs={5000}
      />,
    );

    const cartao = screen.getByRole('region', { name: 'Resultado do teste na mesa' });
    fireEvent.mouseEnter(cartao);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(aoFechar).not.toHaveBeenCalled();

    fireEvent.mouseLeave(cartao);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
