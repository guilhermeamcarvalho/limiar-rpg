import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { appDeTeste } from './teste/apoio.ts';
import { anonimizarUrl } from '@limiar/shared';
import { limparEvento, limparRastro } from './observabilidade.ts';

describe('o que vai para o Sentry', () => {
  it('a URL perde a query e os códigos de convite', () => {
    expect(anonimizarUrl('/c/ERMIDA-3H33?aceitar=1')).toBe('/c/:codigo');
    expect(anonimizarUrl('https://limiar.app/api/convites/ERMIDA-3H33/aceitar')).toBe(
      'https://limiar.app/api/convites/:codigo/aceitar',
    );
    expect(anonimizarUrl('/api/campanhas/cmp_1?x=marta@exemplo.com')).toBe('/api/campanhas/cmp_1');
  });

  it('o evento sai sem usuário, cookie, corpo, query e cabeçalhos que identificam', () => {
    const evento: ErrorEvent = {
      type: undefined,
      server_name: 'vps-do-guilherme',
      user: { id: 'usr_1', email: 'marta@exemplo.com', ip_address: '200.1.2.3' },
      request: {
        url: '/c/ERMIDA-3H33?voltar=/casos',
        method: 'GET',
        cookies: { limiar_sessao: 'segredo' },
        data: { senha: 'mare-de-concreto' },
        query_string: 'voltar=/casos',
        headers: {
          cookie: 'limiar_sessao=segredo',
          authorization: 'Bearer x',
          'x-forwarded-for': '200.1.2.3',
          'User-Agent': 'Firefox',
        },
      },
      breadcrumbs: [
        {
          category: 'http',
          data: {
            url: '/api/convites/ERMIDA-3H33?x=1',
            method: 'GET',
            status_code: 200,
            corpo: 'x',
          },
        },
      ],
    };

    const limpo = limparEvento(evento);

    expect(limpo.user).toBeUndefined();
    expect(limpo.server_name).toBeUndefined();
    expect(limpo.request).toEqual({
      url: '/c/:codigo',
      method: 'GET',
      headers: { 'User-Agent': 'Firefox' },
    });
    expect(limpo.breadcrumbs?.[0]?.data).toEqual({
      url: '/api/convites/:codigo',
      method: 'GET',
      status_code: 200,
    });
  });

  it('rastro sem dados passa como está', () => {
    expect(limparRastro({ message: 'oi' })).toEqual({ message: 'oi' });
  });
});

describe('/health', () => {
  it('mostra a versão publicada pelo deploy quando ela existe', async () => {
    const app = await appDeTeste({ env: { LIMIAR_VERSAO: '0.0.0+abc1234' } });
    const r = await app.inject({ method: 'GET', url: '/health' });
    await app.close();
    expect(r.json()).toEqual({ ok: true, versao: '0.0.0+abc1234' });
  });
});

describe('CSP e o Sentry do navegador', () => {
  it('com SENTRY_DSN_CLIENT, o connect-src libera só a origem do Sentry', async () => {
    const app = await appDeTeste({
      env: { SENTRY_DSN_CLIENT: 'https://chave@o123.ingest.us.sentry.io/456' },
    });
    const r = await app.inject({ method: 'GET', url: '/health' });
    await app.close();
    expect(r.headers['content-security-policy']).toContain(
      "connect-src 'self' https://o123.ingest.us.sentry.io",
    );
  });

  it('sem ele, o connect-src fica só no próprio site', async () => {
    const app = await appDeTeste();
    const r = await app.inject({ method: 'GET', url: '/health' });
    await app.close();
    expect(r.headers['content-security-policy']).toMatch(/connect-src 'self'(;|$)/);
  });
});
