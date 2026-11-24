import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ComandoDaMesa,
  MapaNaMesa,
  PropNaMesa,
  RespostaDoComando,
  TokenNaMesa,
} from '@membrana/shared';
import { json, servidor } from '../teste/apoio.tsx';
import { ToastProvider } from '../ui/index.ts';
import { BarraDoProp, BarraDoToken, nomeDoProp } from './Barras.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MAPA: MapaNaMesa = {
  id: 'map_1',
  nome: 'Rádio',
  imagem: 'a.webp',
  largura: 1000,
  altura: 800,
  grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
};

const token = (campos: Partial<TokenNaMesa> = {}): TokenNaMesa => ({
  id: 'tok_1',
  nome: 'Davi',
  imagem: null,
  x: 100,
  y: 100,
  tamanho: 1,
  oculto: false,
  personagemId: 'chr_1',
  donoId: 'usr_1',
  ...campos,
});

const prop = (campos: Partial<PropNaMesa> = {}): PropNaMesa => ({
  id: 'prp_1',
  imagem: 'pronto:caixote',
  x: 980,
  y: 100,
  tamanho: 1,
  rotacao: 315,
  travado: false,
  ordem: 2,
  ...campos,
});

function comEnvio(resposta: RespostaDoComando = { ok: true }) {
  const comandos: ComandoDaMesa[] = [];
  const enviar = (c: ComandoDaMesa) => {
    comandos.push(c);
    return Promise.resolve(resposta);
  };
  return { comandos, enviar };
}

function barraDoToken(
  t: TokenNaMesa,
  mestre: boolean,
  enviar: ReturnType<typeof comEnvio>['enviar'],
) {
  return (
    <ToastProvider>
      <BarraDoToken token={t} mestre={mestre} campanhaId="cmp_1" enviar={enviar} estilo={{}} />
    </ToastProvider>
  );
}

describe('barra do token', () => {
  it('o dono troca o tamanho, mas não oculta nem remove', () => {
    const { comandos, enviar } = comEnvio();
    render(barraDoToken(token(), false, enviar));
    fireEvent.click(screen.getByRole('button', { name: 'Tamanho 2 por 2' }));
    // O tamanho atual não manda nada.
    fireEvent.click(screen.getByRole('button', { name: 'Tamanho 1 por 1' }));
    expect(comandos).toEqual([{ type: 'token.update', tokenId: 'tok_1', tamanho: 2 }]);
    expect(screen.queryByRole('button', { name: /Ocultar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull();
  });

  it('o mestre oculta, revela e remove', () => {
    const { comandos, enviar } = comEnvio();
    const { rerender } = render(barraDoToken(token(), true, enviar));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar dos jogadores' }));
    rerender(barraDoToken(token({ oculto: true }), true, enviar));
    fireEvent.click(screen.getByRole('button', { name: 'Revelar para os jogadores' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(comandos).toEqual([
      { type: 'token.update', tokenId: 'tok_1', oculto: true },
      { type: 'token.update', tokenId: 'tok_1', oculto: false },
      { type: 'token.delete', tokenId: 'tok_1' },
    ]);
  });

  it('trocar a imagem envia o arquivo e usa o nome que o servidor devolveu', async () => {
    const nome = `${'c'.repeat(64)}.webp`;
    const chamadas = servidor({ 'POST /api/campanhas/cmp_1/imagens': json(201, { nome }) });
    const { comandos, enviar } = comEnvio();
    render(barraDoToken(token(), false, enviar));
    fireEvent.change(screen.getByLabelText('Nova imagem do token'), {
      target: { files: [new File(['x'], 'eu.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(comandos).toEqual([{ type: 'token.update', tokenId: 'tok_1', imagem: nome }]);
    });
    expect(chamadas[0]?.corpo).toEqual({
      uso: 'token',
      arquivo: { nome: 'eu.png', tipo: 'image/png' },
    });
  });

  it('recusa do servidor vira aviso', async () => {
    const { enviar } = comEnvio({ ok: false, motivo: 'Só o mestre pode mudar este token.' });
    render(barraDoToken(token(), false, enviar));
    fireEvent.click(screen.getByRole('button', { name: 'Tamanho 3 por 3' }));
    expect(await screen.findByText('Só o mestre pode mudar este token.')).toBeDefined();
  });
});

describe('barra do prop', () => {
  function abrirBarra(p = prop()) {
    const envio = comEnvio();
    const aoRemover = vi.fn();
    render(
      <ToastProvider>
        <BarraDoProp
          prop={p}
          props={[p, prop({ id: 'prp_2', ordem: 7 })]}
          mapa={MAPA}
          enviar={envio.enviar}
          estilo={{}}
          aoRemover={aoRemover}
        />
      </ToastProvider>,
    );
    return { ...envio, aoRemover };
  }

  it('girar, travar e trazer à frente', () => {
    const { comandos } = abrirBarra();
    fireEvent.click(screen.getByRole('button', { name: 'Girar 45 graus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Travar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trazer à frente' }));
    expect(comandos).toEqual([
      { type: 'prop.update', propId: 'prp_1', rotacao: 0 },
      { type: 'prop.update', propId: 'prp_1', travado: true },
      { type: 'prop.update', propId: 'prp_1', ordem: 8 },
    ]);
  });

  it('duplicar põe uma cópia uma célula ao lado, sem sair do mapa', () => {
    const { comandos } = abrirBarra();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    expect(comandos).toEqual([
      { type: 'prop.create', imagem: 'pronto:caixote', x: 1000, y: 150, tamanho: 1, rotacao: 315 },
    ]);
  });

  it('travado mostra "Destravar"; remover tira a seleção', async () => {
    const { comandos, aoRemover } = abrirBarra(prop({ travado: true }));
    expect(screen.getByRole('button', { name: 'Destravar' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => {
      expect(aoRemover).toHaveBeenCalled();
    });
    expect(comandos).toEqual([{ type: 'prop.delete', propId: 'prp_1' }]);
  });

  it('o nome do prop pronto; imagem enviada aparece como "Imagem"', () => {
    expect(nomeDoProp(prop())).toBe('Caixote');
    expect(nomeDoProp(prop({ imagem: `${'a'.repeat(64)}.webp` }))).toBe('Imagem');
  });
});
