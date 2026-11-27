import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RegistroDeTeste } from '@membrana/shared';
import { RevelacaoDoDado, revelacaoDaRolagem, revelacaoDoTeste } from './RevelacaoDoDado.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const registro = (origem: 'virtual' | 'fisico' = 'virtual'): RegistroDeTeste => ({
  id: 'tst_1',
  personagemId: 'chr_1',
  personagemNome: 'Davi',
  campanhaId: 'cmp_1',
  autor: { id: 'usr_1', nome: 'Bia' },
  periciaId: 'luta',
  atributo: 'fisico',
  origem,
  resultado: {
    dados: [
      { tipo: 'd6', valor: 2, papel: 'atributo', descartado: false },
      { tipo: 'd4', valor: 1, papel: 'pericia', descartado: false },
    ],
    total: 3,
    dt: 7,
    ra: 2,
    rb: 1,
    veredito: 'falha',
    informado: origem === 'fisico',
  },
  falhaCritica: null,
  efeitos: [],
  em: '2026-11-27T12:00:00.000Z',
});

describe('RevelacaoDoDado', () => {
  it('gira, para no total e anuncia o veredito com a DT', () => {
    render(<RevelacaoDoDado revelacao={revelacaoDoTeste(registro())} aoFechar={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(status.textContent).toBe('Luta · Físico: 3, Falha contra DT 7');
    expect(screen.getByText('Falha')).toBeDefined();
    expect(screen.getByText('DT 7')).toBeDefined();
    expect(screen.getByRole('img', { name: 'd4 de perícia: 1', hidden: true })).toBeDefined();
  });

  it('dados físicos aparecem direto, sem giro', () => {
    render(<RevelacaoDoDado revelacao={revelacaoDoTeste(registro('fisico'))} aoFechar={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Luta · Físico: 3, Falha contra DT 7');
  });

  it('rolagem livre mostra o total e cada dado, sem veredito', () => {
    const revelacao = revelacaoDaRolagem({
      chave: 1,
      expressao: '2d6+1',
      dados: [3, 5],
      total: 9,
    });
    render(<RevelacaoDoDado revelacao={revelacao} aoFechar={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByRole('status').textContent).toBe('2d6+1: 9');
    expect(screen.getByRole('img', { name: 'd6 de atributo: 5', hidden: true })).toBeDefined();
    expect(screen.queryByText(/DT/)).toBeNull();
  });

  it('some sozinho depois de alguns segundos, e antes com Esc ou um clique', () => {
    const aoFechar = vi.fn();
    const { unmount } = render(
      <RevelacaoDoDado revelacao={revelacaoDoTeste(registro())} aoFechar={aoFechar} />,
    );
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(aoFechar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4600);
    });
    expect(aoFechar).toHaveBeenCalledTimes(1);
    unmount();

    const porTecla = vi.fn();
    render(<RevelacaoDoDado revelacao={revelacaoDoTeste(registro())} aoFechar={porTecla} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(porTecla).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Clique ou Esc para fechar'));
    expect(porTecla).toHaveBeenCalledTimes(2);
  });
});
