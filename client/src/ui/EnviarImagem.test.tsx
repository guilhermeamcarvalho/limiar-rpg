import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LIMITE_DA_IMAGEM, type Personagem } from '@membrana/shared';
import { json, personagem, servidor } from '../teste/apoio.tsx';
import { EnviarImagem, problemaDoArquivo, recorteDe } from './EnviarImagem.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FOTO = `${'f'.repeat(64)}.webp`;
const URL_DA_IMAGEM = '/api/personagens/chr_davi/imagem';

function arquivo(nome: string, tipo: string, tamanho = 10) {
  return new File([new Uint8Array(tamanho)], nome, { type: tipo });
}

function montar(campos: Partial<Personagem> = {}) {
  const aoTrocar = vi.fn();
  const davi = { id: 'chr_davi', foto: null, tokenImg: null, nome: 'Davi Rocha', ...campos };
  render(
    <EnviarImagem open personagem={davi} iniciais="DR" aoTrocar={aoTrocar} aoFechar={vi.fn()} />,
  );
  return { aoTrocar };
}

describe('problemaDoArquivo', () => {
  it('aceita JPG, PNG e WebP até 5 MB', () => {
    expect(problemaDoArquivo(arquivo('davi.jpg', 'image/jpeg'))).toBeNull();
    expect(problemaDoArquivo(arquivo('davi.webp', 'image/webp', LIMITE_DA_IMAGEM))).toBeNull();
  });

  it('recusa PDF, SVG e imagem grande, com mensagem', () => {
    expect(problemaDoArquivo(arquivo('ficha.pdf', 'application/pdf'))).toMatch(/não é uma imagem/);
    expect(problemaDoArquivo(arquivo('davi.svg', 'image/svg+xml'))).toMatch(/não é uma imagem/);
    expect(problemaDoArquivo(arquivo('davi.png', 'image/png', LIMITE_DA_IMAGEM + 1))).toBe(
      'A imagem passa de 5 MB. Diminua o tamanho e tente de novo.',
    );
  });
});

describe('recorteDe', () => {
  it('centro sem zoom numa imagem deitada: o quadrado do lado menor, no meio', () => {
    expect(recorteDe({ w: 800, h: 600 }, { zoom: 1, px: 0.5, py: 0.5 })).toEqual({
      x: 0.125,
      y: 0,
      lado: 1,
    });
  });

  it('com zoom 2, encostado no canto de baixo à direita', () => {
    expect(recorteDe({ w: 800, h: 600 }, { zoom: 2, px: 1, py: 1 })).toEqual({
      x: 500 / 800,
      y: 0.5,
      lado: 0.5,
    });
  });
});

describe('EnviarImagem', () => {
  it('escolher a foto envia o arquivo e devolve o personagem novo', async () => {
    const novo = personagem({ foto: FOTO });
    const chamadas = servidor({ [`POST ${URL_DA_IMAGEM}`]: json(200, { personagem: novo }) });
    const { aoTrocar } = montar();

    fireEvent.change(screen.getByLabelText('Arquivo da foto'), {
      target: { files: [arquivo('davi.jpg', 'image/jpeg')] },
    });

    await waitFor(() => {
      expect(aoTrocar).toHaveBeenCalledWith(novo);
    });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      tipo: 'foto',
      arquivo: { nome: 'davi.jpg', tipo: 'image/jpeg' },
    });
  });

  it('arquivo que não serve mostra o motivo e não envia', () => {
    const chamadas = servidor();
    montar();

    fireEvent.change(screen.getByLabelText('Arquivo da foto'), {
      target: { files: [arquivo('ficha.pdf', 'application/pdf')] },
    });

    expect(screen.getByRole('alert').textContent).toMatch(/não é uma imagem/);
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('o erro do servidor aparece (como o GIF animado)', async () => {
    servidor({
      [`POST ${URL_DA_IMAGEM}`]: json(415, {
        erro: { codigo: 'IMAGEM_ANIMADA', mensagem: 'Imagem animada não serve.' },
      }),
    });
    montar();

    fireEvent.change(screen.getByLabelText('Arquivo da foto'), {
      target: { files: [arquivo('davi.gif', 'image/gif')] },
    });

    expect(await screen.findByText('Imagem animada não serve.')).toBeDefined();
  });

  it('"Usar a foto" abre o recorte e salva o token a partir da foto', async () => {
    const chamadas = servidor({
      [`POST ${URL_DA_IMAGEM}`]: json(200, { personagem: personagem({ foto: FOTO }) }),
    });
    const { aoTrocar } = montar({ foto: FOTO });

    fireEvent.click(screen.getByRole('button', { name: 'Usar a foto' }));
    expect(screen.getByText(/Enquadre o rosto no círculo/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar token' }));

    await waitFor(() => {
      expect(aoTrocar).toHaveBeenCalled();
    });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      tipo: 'token',
      usarFoto: 'sim',
    });
  });

  it('sem foto, "Usar a foto" fica desligado; tirar a foto chama o DELETE', async () => {
    const chamadas = servidor({
      [`DELETE ${URL_DA_IMAGEM}/foto`]: json(200, { personagem: personagem() }),
    });
    montar({ foto: FOTO });

    fireEvent.click(screen.getByRole('button', { name: 'Tirar foto' }));
    await waitFor(() => {
      expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(true);
    });

    cleanup();
    montar();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Usar a foto' }).disabled).toBe(
      true,
    );
  });
});
