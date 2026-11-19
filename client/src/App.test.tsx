import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { Rotas } from './App.tsx';
import { SessaoProvider } from './auth/sessao.tsx';
import { ToastProvider } from './ui/index.ts';

const MARTA = { id: 'usr_1', nome: 'Marta', email: 'marta@exemplo.com' };

/** Servidor falso: responde /api/me conforme `logado` e registra as chamadas. */
function servidor(logado: boolean) {
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (status: number, corpo: unknown) =>
      Promise.resolve(new Response(JSON.stringify(corpo), { status }));
    if (url === '/api/me') {
      return logado
        ? json(200, { usuario: MARTA })
        : json(401, { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre.' } });
    }
    if (url === '/api/auth/opcoes') return json(200, { discord: true });
    if (url === '/api/auth/sair') return Promise.resolve(new Response(null, { status: 204 }));
    return json(404, {});
  });
  return chamadas;
}

/** Mostra a URL atual, para conferir os redirecionamentos. */
function Endereco() {
  const local = useLocation();
  return <output data-testid="endereco">{`${local.pathname}${local.search}`}</output>;
}

function abrir(caminho: string) {
  render(
    <ToastProvider>
      <SessaoProvider>
        <MemoryRouter initialEntries={[caminho]}>
          <Rotas />
          <Endereco />
        </MemoryRouter>
      </SessaoProvider>
    </ToastProvider>,
  );
}

const endereco = () => screen.getByTestId('endereco').textContent;

beforeEach(() => {
  document.title = '';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('sem sessão, a Central manda para /entrar', async () => {
    servidor(false);
    abrir('/');

    await waitFor(() => {
      expect(endereco()).toBe('/entrar');
    });
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeDefined();
  });

  it('lembra a página de origem em ?voltar e a passa para o Discord', async () => {
    servidor(false);
    // A Central é, por enquanto, a única rota protegida; a query prova que ela vai inteira.
    abrir('/?aba=x');

    await waitFor(() => {
      expect(endereco()).toBe('/entrar?voltar=%2F%3Faba%3Dx');
    });
    const link = screen.getByRole('link', { name: /Entrar com Discord/ });
    const destino = new URL(link.getAttribute('href') ?? '', 'http://x');
    expect(destino.pathname).toBe('/api/auth/discord');
    expect(destino.searchParams.get('voltar')).toBe('/?aba=x');
    expect(destino.searchParams.get('manter')).toBe('1');
  });

  it('"manter conectado" desmarcado tira o manter=1 do link', async () => {
    servidor(false);
    abrir('/entrar');

    const caixa = await screen.findByRole('checkbox', { name: /Manter conectado/ });
    fireEvent.click(caixa);

    const link = screen.getByRole('link', { name: /Entrar com Discord/ });
    expect(link.getAttribute('href')).not.toContain('manter');
  });

  it('?voltar para outro site é ignorado', async () => {
    servidor(false);
    abrir('/entrar?voltar=//malicioso.com');

    const link = await screen.findByRole('link', { name: /Entrar com Discord/ });
    expect(new URL(link.getAttribute('href') ?? '', 'http://x').searchParams.get('voltar')).toBe(
      '/',
    );
  });

  it('mostra o erro que o servidor mandou em ?erro', async () => {
    servidor(false);
    abrir('/entrar?erro=estado-invalido');

    expect((await screen.findByRole('alert')).textContent).toContain('O login expirou');
  });

  it('com sessão, a Central mostra quem entrou', async () => {
    servidor(true);
    abrir('/');

    expect(await screen.findByRole('heading', { name: 'Olá, Marta' })).toBeDefined();
    expect(document.title).toBe('Central · LIMIAR');
  });

  it('já logado, /entrar volta para a página pedida', async () => {
    servidor(true);
    abrir('/entrar?voltar=/');

    await waitFor(() => {
      expect(endereco()).toBe('/');
    });
  });

  it('sair chama o servidor e volta para /entrar', async () => {
    const chamadas = servidor(true);
    abrir('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    await waitFor(() => {
      expect(endereco()).toBe('/entrar');
    });
    expect(chamadas).toContain('POST /api/auth/sair');
  });
});
