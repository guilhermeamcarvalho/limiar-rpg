import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dicas, ESPERA_DA_DICA_MS } from './Dicas.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function passarPor(el: Element) {
  fireEvent.pointerOver(el);
  act(() => {
    vi.advanceTimersByTime(ESPERA_DA_DICA_MS);
  });
}

describe('Dicas', () => {
  it('o title vira a dica do site depois da espera, e o do navegador some', () => {
    render(
      <>
        <button type="button" title="Sem caso, sem mesa">
          Mesa
        </button>
        <Dicas />
      </>,
    );
    const botao = screen.getByRole('button', { name: 'Mesa' });
    fireEvent.pointerOver(botao);
    expect(botao.hasAttribute('title')).toBe(false);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(ESPERA_DA_DICA_MS);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Sem caso, sem mesa');
    // A dica diz algo além do nome: o leitor de tela também lê.
    expect(botao.getAttribute('aria-describedby')).toBe('dica-do-site');
  });

  it('botão só de ícone continua com nome depois de perder o title', () => {
    render(
      <>
        <button type="button" title="Aproximar">
          +
        </button>
        <span title="Ver o mapa inteiro" />
        <Dicas />
      </>,
    );
    const vazio = document.querySelector('span');
    if (!vazio) throw new Error('sem span');
    passarPor(vazio);
    expect(vazio.getAttribute('aria-label')).toBe('Ver o mapa inteiro');
    // Com texto próprio, o nome continua sendo o texto.
    const botao = screen.getByRole('button', { name: '+' });
    passarPor(botao);
    expect(botao.hasAttribute('aria-label')).toBe(false);
  });

  it('sair de cima, apertar Esc ou clicar esconde', () => {
    render(
      <>
        <button type="button" title="Dica">
          A
        </button>
        <Dicas />
      </>,
    );
    const botao = screen.getByRole('button', { name: 'A' });
    passarPor(botao);
    expect(screen.getByRole('tooltip')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    passarPor(botao);
    fireEvent.pointerOut(botao, { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).toBeNull();

    passarPor(botao);
    fireEvent.pointerDown(botao);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('sair antes da espera não mostra nada', () => {
    render(
      <>
        <button type="button" title="Dica">
          A
        </button>
        <Dicas />
      </>,
    );
    const botao = screen.getByRole('button', { name: 'A' });
    fireEvent.pointerOver(botao);
    fireEvent.pointerOut(botao, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(ESPERA_DA_DICA_MS);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('o title mudou depois (o React pôs de novo): vale o novo', () => {
    const { rerender } = render(
      <>
        <button type="button" title="Antes">
          A
        </button>
        <Dicas />
      </>,
    );
    const botao = screen.getByRole('button', { name: 'A' });
    passarPor(botao);
    fireEvent.pointerOut(botao, { relatedTarget: document.body });
    rerender(
      <>
        <button type="button" title="Depois">
          A
        </button>
        <Dicas />
      </>,
    );
    passarPor(botao);
    expect(screen.getByRole('tooltip').textContent).toBe('Depois');
  });
});
