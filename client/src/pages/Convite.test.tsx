import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ConvitePublico } from '@limiar/shared';
import { Rotas } from '../App.tsx';
import { SessaoProvider } from '../auth/sessao.tsx';
import { ToastProvider } from '../ui/index.ts';
import { quandoFoiMarcada } from './Convite.tsx';

const CONVITE: ConvitePublico = {
  codigo: 'ERMIDA-3H33',
  estado: 'valido',
  vagasRestantes: 3,
  campanha: { id: 'cmp_1', numero: 17, nome: 'O Sinal de Santa Ermida', gancho: null },
  mestre: { nome: 'Helena Duarte' },
  sistema: { nome: 'Ordem Paranormal II' },
  proximaSessao: null,
  jaParticipa: false,
};

/** Servidor falso. `logado` diz se /api/me responde com alguém. */
function servidor({
  logado = false,
  convite = CONVITE,
}: { logado?: boolean; convite?: ConvitePublico | null } = {}) {
  const chamadas: string[] = [];
  const json = (status: number, corpo: unknown) =>
    Promise.resolve(new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/me') {
      return logado
        ? json(200, { usuario: { id: 'usr_2', nome: 'Marta', email: null } })
        : json(401, { erro: { codigo: 'NAO_AUTENTICADO' } });
    }
    if (url === '/api/auth/opcoes') return json(200, { discord: true });
    if (url === '/api/campanhas') return json(200, { campanhas: [] });
    if (url.endsWith('/aceitar')) return json(200, { campanha: { id: 'cmp_1' } });
    if (url.startsWith('/api/convites/ERMIDA-3H33') && convite) return json(200, { convite });
    if (url.startsWith('/api/convites/')) {
      return json(404, {
        erro: {
          codigo: 'CONVITE_NAO_ENCONTRADO',
          mensagem: 'Código não encontrado. Confira com o mestre.',
          campos: { codigo: 'Código não encontrado. Confira com o mestre.' },
        },
      });
    }
    return json(404, {});
  });
  return chamadas;
}

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('cartão do convite', () => {
  it('mostra caso, número, mestre, sistema e vagas', async () => {
    servidor();
    abrir('/c/ermida-3h33');

    expect(await screen.findByRole('heading', { name: 'O Sinal de Santa Ermida' })).toBeDefined();
    expect(screen.getByText(/caso nº 017/)).toBeDefined();
    expect(screen.getByText(/Mestre: Helena Duarte · Ordem Paranormal II/)).toBeDefined();
    expect(screen.getByText('3 vagas')).toBeDefined();
  });

  it('código que não existe mostra o erro', async () => {
    servidor();
    abrir('/c/NADA-AAAA');

    expect(
      await screen.findByText('Código não encontrado. Confira com o mestre.', {
        selector: '.banner *',
      }),
    ).toBeDefined();
  });

  it('convite expirado diz o que fazer e não oferece aceitar', async () => {
    servidor({ logado: true, convite: { ...CONVITE, estado: 'expirado' } });
    abrir('/c/ERMIDA-3H33');

    expect(await screen.findByText('Este convite expirou. Peça um novo ao mestre.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).toBeNull();
  });
});

describe('sem login', () => {
  it('oferece Discord e e-mail, e o Discord volta para aceitar', async () => {
    servidor();
    abrir('/c/ERMIDA-3H33');

    expect(await screen.findByRole('heading', { name: 'Entrar para aceitar' })).toBeDefined();
    const discord = screen.getByRole('link', { name: /Entrar com Discord/ });
    const destino = new URL(discord.getAttribute('href') ?? '', 'http://x');
    expect(destino.searchParams.get('voltar')).toBe('/c/ERMIDA-3H33?aceitar=1');
    expect(screen.getAllByRole('button', { name: 'Entrar com e-mail' }).length).toBeGreaterThan(0);
  });
});

describe('com login', () => {
  it('aceitar leva à Central, que já lista os casos', async () => {
    const chamadas = servidor({ logado: true });
    abrir('/c/ERMIDA-3H33');

    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite' }));

    await waitFor(() => {
      expect(screen.getByTestId('endereco').textContent).toBe('/');
    });
    expect(chamadas).toContain('POST /api/convites/ERMIDA-3H33/aceitar');
    expect(await screen.findByText('Você entrou no caso')).toBeDefined();
    expect(chamadas).toContain('GET /api/campanhas');
  });

  it('voltando do login com ?aceitar=1, aceita sozinho e uma vez só', async () => {
    const chamadas = servidor({ logado: true });
    abrir('/c/ERMIDA-3H33?aceitar=1');

    await waitFor(() => {
      expect(screen.getByTestId('endereco').textContent).toBe('/');
    });
    expect(chamadas.filter((c) => c.endsWith('/aceitar'))).toHaveLength(1);
  });

  it('quem já participa vê o atalho para a Central, sem aceitar de novo', async () => {
    servidor({ logado: true, convite: { ...CONVITE, jaParticipa: true } });
    abrir('/c/ERMIDA-3H33');

    expect(await screen.findByRole('heading', { name: 'Você já está neste caso' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).toBeNull();
  });
});

describe('caixa do código', () => {
  it('confere enquanto digita: código válido mostra o nome do caso', async () => {
    servidor();
    abrir('/convite');

    fireEvent.change(await screen.findByLabelText(/só um código/), {
      target: { value: 'ermida-3h33' },
    });

    expect(await screen.findByText(/Código válido para O Sinal de Santa Ermida/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    await waitFor(() => {
      expect(screen.getByTestId('endereco').textContent).toBe('/c/ERMIDA-3H33');
    });
  });

  it('código inválido mostra o erro no campo', async () => {
    servidor();
    abrir('/convite');
    const campo = await screen.findByLabelText(/só um código/);

    fireEvent.change(campo, { target: { value: 'NADA-AAAA' } });

    await waitFor(() => {
      expect(campo.getAttribute('aria-invalid')).toBe('true');
    });
    expect(
      document.getElementById(campo.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('Código não encontrado');
    expect(screen.getByRole('button', { name: 'Validar' }).hasAttribute('disabled')).toBe(true);
  });

  it('formato errado avisa sem perguntar ao servidor', async () => {
    const chamadas = servidor();
    abrir('/convite');
    const campo = await screen.findByLabelText(/só um código/);

    fireEvent.change(campo, { target: { value: 'ERMIDA3H33XX' } });

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(chamadas.some((c) => c.includes('/api/convites/'))).toBe(false);
  });
});

describe('quandoFoiMarcada', () => {
  it('escreve como no cartão: dia da semana, data e hora', () => {
    expect(quandoFoiMarcada(new Date(2026, 10, 20, 21, 0).toISOString())).toBe(
      'sexta, 20/11, às 21h',
    );
    expect(quandoFoiMarcada(new Date(2026, 10, 21, 19, 30).toISOString())).toBe(
      'sábado, 21/11, às 19h30',
    );
  });
});
