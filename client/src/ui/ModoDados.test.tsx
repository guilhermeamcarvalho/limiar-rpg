import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModoDados } from './ModoDados.tsx';

afterEach(cleanup);

describe('ModoDados', () => {
  it('mostra "Dados virtuais / Dados físicos" com o atual marcado e troca', () => {
    const aoMudar = vi.fn();
    render(<ModoDados value="virtual" onChange={aoMudar} />);

    expect(screen.getByRole('group', { name: 'Como rolar os dados' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Dados virtuais' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Dados físicos' }));
    expect(aoMudar).toHaveBeenCalledWith('fisico');
  });

  it('caso só com dados virtuais: some, a menos que a ficha já esteja no físico', () => {
    const { rerender } = render(
      <ModoDados value="virtual" onChange={vi.fn()} permitirFisico={false} />,
    );
    expect(screen.queryByRole('group')).toBeNull();

    rerender(<ModoDados value="fisico" onChange={vi.fn()} permitirFisico={false} />);
    expect(screen.getByRole('group', { name: 'Como rolar os dados' })).toBeDefined();
  });
});
