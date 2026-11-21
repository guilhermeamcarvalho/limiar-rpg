import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { iniciarObservabilidade, limparEvento, limparRastro } from './observabilidade.ts';

describe('o que o navegador manda ao Sentry', () => {
  it('sem DSN (dev e testes), não liga', () => {
    expect(iniciarObservabilidade(undefined)).toBe(false);
  });

  it('tira usuário, cabeçalhos e o código de convite da URL', () => {
    const evento: ErrorEvent = {
      type: undefined,
      user: { id: 'usr_1', email: 'marta@exemplo.com' },
      request: {
        url: 'https://membrana.app/c/ERMIDA-3H33?aceitar=1',
        headers: { 'User-Agent': 'Firefox', Referer: 'https://membrana.app/c/ERMIDA-3H33' },
      },
      breadcrumbs: [
        { category: 'console', message: 'senha: mare-de-concreto' },
        { category: 'ui.input', message: 'input[type=email]' },
        { category: 'navigation', data: { from: '/convite?codigo=X', to: '/c/ERMIDA-3H33' } },
        {
          category: 'fetch',
          data: {
            url: '/api/convites/ERMIDA-3H33/aceitar',
            method: 'POST',
            status_code: 409,
            corpo: 1,
          },
        },
      ],
    };

    const limpo = limparEvento(evento);

    expect(limpo.user).toBeUndefined();
    expect(limpo.request).toEqual({ url: 'https://membrana.app/c/:codigo' });
    expect(limpo.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/convite', to: '/c/:codigo' } },
      {
        category: 'fetch',
        data: { url: '/api/convites/:codigo/aceitar', method: 'POST', status_code: 409 },
      },
    ]);
  });

  it('descarta rastros do console e do que se digita', () => {
    expect(limparRastro({ category: 'console', message: 'x' })).toBeNull();
    expect(limparRastro({ category: 'ui.click', message: 'button.btn' })).toEqual({
      category: 'ui.click',
      message: 'button.btn',
    });
  });
});
