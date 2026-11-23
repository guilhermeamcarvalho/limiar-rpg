import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, MAX_AVISOS, Modal, ToastProvider, useToast } from './index.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ComModal() {
  const [aberto, setAberto] = useState(false);
  const fechar = () => {
    setAberto(false);
  };
  return (
    <>
      <Button
        onClick={() => {
          setAberto(true);
        }}
      >
        Abrir
      </Button>
      <Modal
        open={aberto}
        onClose={fechar}
        title="Teste"
        footer={<Button onClick={fechar}>Rolar</Button>}
      >
        <input aria-label="Dificuldade" />
      </Modal>
    </>
  );
}

function abrir() {
  render(<ComModal />);
  const gatilho = screen.getByRole('button', { name: 'Abrir' });
  gatilho.focus();
  fireEvent.click(gatilho);
  return gatilho;
}

describe('Modal', () => {
  it('leva o foco para dentro ao abrir', () => {
    abrir();

    const janela = screen.getByRole('dialog', { name: 'Teste' });
    expect(janela.getAttribute('aria-modal')).toBe('true');
    expect(janela.contains(document.activeElement)).toBe(true);
  });

  it('prende o foco: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao último', () => {
    abrir();
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    const rolar = screen.getByRole('button', { name: 'Rolar' });

    rolar.focus();
    fireEvent.keyDown(rolar, { key: 'Tab' });
    expect(document.activeElement).toBe(fechar);

    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(rolar);
  });

  it('fecha com Esc e devolve o foco a quem abriu', () => {
    const gatilho = abrir();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Dificuldade' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it('fecha ao clicar fora, no véu', () => {
    abrir();

    const janela = screen.getByRole('dialog');
    const veu = janela.parentElement;
    if (!veu) throw new Error('modal sem véu');
    fireEvent.mouseDown(veu);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function Disparador() {
  const avisos = useToast();
  return (
    <>
      <Button onClick={() => avisos.show({ title: `Aviso` })}>Info</Button>
      <Button onClick={() => avisos.show({ type: 'err', title: 'Falhou' })}>Erro</Button>
    </>
  );
}

describe('Toast', () => {
  it('mostra no máximo 3 avisos; o mais antigo sai', () => {
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Erro' }));
    for (let i = 0; i < MAX_AVISOS; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    }

    expect(screen.getAllByRole('status')).toHaveLength(MAX_AVISOS);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('erro usa role="alert" e some sozinho depois de um tempo', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Erro' }));
    expect(screen.getByRole('alert').textContent).toContain('Falhou');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pode ser dispensado pelo botão', () => {
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('com ação: o botão faz a ação e fecha o aviso', () => {
    const desfazer = vi.fn();
    function ComAcao() {
      const avisos = useToast();
      return (
        <Button
          onClick={() =>
            avisos.show({
              type: 'ok',
              title: 'Removido',
              action: { label: 'Desfazer', onClick: desfazer },
            })
          }
        >
          Remover
        </Button>
      );
    }
    render(
      <ToastProvider>
        <ComAcao />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(desfazer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
