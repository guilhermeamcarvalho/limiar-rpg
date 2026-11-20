import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { Rotas } from '../App.tsx';
import { SessaoProvider } from '../auth/sessao.tsx';
import { ToastProvider } from '../ui/index.ts';

type Resposta = { status: number; corpo?: unknown } | 'sem-rede';

/** Servidor falso: cada rota responde com o que o teste mandar, em fila. */
function servidor(rotas: Record<string, Resposta[]>) {
  const chamadas: { url: string; corpo: unknown }[] = [];
  let logado = false;
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    chamadas.push({
      url,
      corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url === '/api/me') {
      return Promise.resolve(
        logado
          ? new Response(JSON.stringify({ usuario: { id: 'usr_1', nome: 'Marta', email: null } }))
          : new Response(JSON.stringify({ erro: { codigo: 'NAO_AUTENTICADO' } }), { status: 401 }),
      );
    }
    if (url === '/api/auth/opcoes') return Promise.resolve(new Response('{"discord":true}'));
    const fila = rotas[url];
    const proxima = fila && fila.length > 1 ? fila.shift() : fila?.[0];
    if (!proxima) return Promise.resolve(new Response('{}', { status: 404 }));
    if (proxima === 'sem-rede') return Promise.reject(new TypeError('Failed to fetch'));
    if (proxima.status < 300) logado = true;
    return Promise.resolve(
      new Response(JSON.stringify(proxima.corpo ?? {}), { status: proxima.status }),
    );
  });
  return chamadas;
}

function Endereco() {
  const local = useLocation();
  return <output data-testid="endereco">{local.pathname}</output>;
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

const digitar = (rotulo: string | RegExp, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Entrar', () => {
  it('o foco começa no primeiro campo', async () => {
    servidor({});
    abrir('/entrar');

    const email = await screen.findByLabelText('E-mail');
    expect(document.activeElement).toBe(email);
  });

  it('entra com e-mail e senha e vai para a Central', async () => {
    const chamadas = servidor({ '/api/auth/entrar': [{ status: 200, corpo: {} }] });
    abrir('/entrar');

    digitar('E-mail', 'marta@exemplo.com');
    digitar('Senha', 'mare-de-concreto');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marta\.$/ }),
    ).toBeDefined();
    expect(chamadas.find((c) => c.url === '/api/auth/entrar')?.corpo).toEqual({
      email: 'marta@exemplo.com',
      senha: 'mare-de-concreto',
      manter: true,
    });
  });

  it('erro de credencial mostra o aviso com o limite de tentativas', async () => {
    servidor({
      '/api/auth/entrar': [
        {
          status: 401,
          corpo: { erro: { codigo: 'CREDENCIAIS', mensagem: 'E-mail ou senha não conferem.' } },
        },
      ],
    });
    abrir('/entrar');

    digitar('E-mail', 'marta@exemplo.com');
    digitar('Senha', 'errada');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('E-mail ou senha não conferem.');
    expect(aviso.textContent).toContain('Depois de 5 tentativas, espere 1 minuto.');
  });

  it('erro de rede mostra o aviso com "tentar de novo", que reenvia', async () => {
    servidor({ '/api/auth/entrar': ['sem-rede', { status: 200, corpo: {} }] });
    abrir('/entrar');

    digitar('E-mail', 'marta@exemplo.com');
    digitar('Senha', 'mare-de-concreto');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Sem conexão');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(
      await screen.findByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marta\.$/ }),
    ).toBeDefined();
  });

  it('mostrar senha troca o campo para texto', async () => {
    servidor({});
    abrir('/entrar');

    const senha = await screen.findByLabelText('Senha');
    expect(senha.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha.getAttribute('type')).toBe('text');
  });

  it('"Esqueci a senha" explica que o mestre redefine', async () => {
    servidor({});
    abrir('/entrar');

    fireEvent.click(await screen.findByRole('button', { name: /Esqueci/ }));

    expect(screen.getByText(/Peça ao mestre/)).toBeDefined();
  });

  it('leva para Criar conta', async () => {
    servidor({});
    abrir('/entrar');

    fireEvent.click(await screen.findByRole('link', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(screen.getByTestId('endereco').textContent).toBe('/criar-conta');
    });
  });
});

describe('Criar conta', () => {
  async function preencher(senha = 'mare-de-concreto-7') {
    digitar('Nome que aparece na mesa', 'Marta Quintela');
    digitar('E-mail', 'marta@exemplo.com');
    digitar('Senha', senha);
    await Promise.resolve();
  }

  it('o foco começa no nome', async () => {
    servidor({});
    abrir('/criar-conta');

    const nome = await screen.findByLabelText('Nome que aparece na mesa');
    expect(document.activeElement).toBe(nome);
  });

  it('o botão só libera com senha de 10+ e o aceite', async () => {
    servidor({});
    abrir('/criar-conta');
    const botao = await screen.findByRole('button', { name: 'Criar conta' });

    await preencher('curta');
    expect(botao.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Senha fraca: use pelo menos 10 caracteres/)).toBeDefined();

    digitar('Senha', 'mare-de-concreto-7');
    expect(botao.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Senha boa')).toBeDefined();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(botao.hasAttribute('disabled')).toBe(false);
  });

  it('e-mail já usado mostra o erro no campo e-mail', async () => {
    servidor({
      '/api/auth/cadastro': [
        {
          status: 409,
          corpo: {
            erro: {
              codigo: 'EMAIL_EM_USO',
              mensagem: 'Este e-mail já tem conta.',
              campos: { email: 'Este e-mail já tem conta. Entre com ele ou com o Discord.' },
            },
          },
        },
      ],
    });
    abrir('/criar-conta');
    await screen.findByLabelText('E-mail');
    await preencher();
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    const email = screen.getByLabelText('E-mail');
    await waitFor(() => {
      expect(email.getAttribute('aria-invalid')).toBe('true');
    });
    const descricao = document.getElementById(email.getAttribute('aria-describedby') ?? '');
    expect(descricao?.textContent).toContain('Este e-mail já tem conta');
  });

  it('cadastro certo entra direto na Central', async () => {
    const chamadas = servidor({ '/api/auth/cadastro': [{ status: 201, corpo: {} }] });
    abrir('/criar-conta');
    await screen.findByLabelText('E-mail');
    await preencher();
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(
      await screen.findByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marta\.$/ }),
    ).toBeDefined();
    expect(chamadas.find((c) => c.url === '/api/auth/cadastro')?.corpo).toMatchObject({
      nome: 'Marta Quintela',
      aceite: true,
    });
  });
});
