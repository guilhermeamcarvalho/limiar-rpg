import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, DURACAO_SUCESSO_MS } from './index.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Button', () => {
  it('ignora cliques enquanto carrega', () => {
    const aoClicar = vi.fn();
    render(
      <Button loading onClick={aoClicar}>
        Salvar
      </Button>,
    );
    const botao = screen.getByRole('button', { name: 'Salvar' });

    fireEvent.click(botao);
    fireEvent.click(botao);

    expect(aoClicar).not.toHaveBeenCalled();
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
  });

  it('volta a aceitar clique quando termina de carregar', () => {
    const aoClicar = vi.fn();
    const { rerender } = render(
      <Button loading onClick={aoClicar}>
        Salvar
      </Button>,
    );
    rerender(<Button onClick={aoClicar}>Salvar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it('fica verde por 2 s depois do sucesso e volta ao normal', () => {
    vi.useFakeTimers();
    const aoClicar = vi.fn();
    const { rerender } = render(<Button onClick={aoClicar}>Salvar</Button>);
    rerender(
      <Button success onClick={aoClicar}>
        Salvar
      </Button>,
    );

    const salvo = screen.getByRole('button', { name: 'Salvo' });
    expect(salvo.className).toContain('is-ok');
    fireEvent.click(salvo);
    expect(aoClicar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DURACAO_SUCESSO_MS);
    });

    expect(screen.getByRole('button', { name: 'Salvar' }).className).not.toContain('is-ok');
  });

  it('botão só com ícone tem nome para o leitor de tela', () => {
    render(<Button icon={<svg aria-hidden="true" />} aria-label="Configurações" />);

    expect(screen.getByRole('button', { name: 'Configurações' }).className).toContain('icon');
  });

  it('não envia formulário por engano: o tipo padrão é "button"', () => {
    render(<Button>Ok</Button>);

    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});
