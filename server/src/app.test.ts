import { afterAll, describe, expect, it } from 'vitest';
import { criarApp } from './app.ts';

describe('GET /api', () => {
  const app = criarApp();
  afterAll(() => app.close());

  it('responde com o nome do app', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ app: 'LIMIAR' });
  });
});
