import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { criarApp, opcoesDoLogger } from './app.ts';
import { carregarConfig } from './config.ts';
import { ErroDaApi } from './http/erros.ts';
import { appDeTeste, bancoDeTeste, ENV_DE_TESTE } from './teste/apoio.ts';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Monta o app; `antes` registra rotas extras (só para o teste) antes de ficar pronto. */
async function montar(antes?: (app: FastifyInstance) => void) {
  app = await appDeTeste();
  antes?.(app);
  await app.ready();
  return app;
}

describe('GET /health', () => {
  it('responde 200 com ok e a versão', async () => {
    const resposta = await (await montar()).inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, versao: expect.any(String) as string });
  });

  it('manda os cabeçalhos de segurança do helmet', async () => {
    const resposta = await (await montar()).inject({ method: 'GET', url: '/health' });

    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['content-security-policy']).toBeDefined();
  });
});

describe('log', () => {
  it('nunca escreve senha, token nem cookie', async () => {
    const linhas: string[] = [];
    const config = carregarConfig({ ...ENV_DE_TESTE, NODE_ENV: 'production' });
    const { db, sqlite } = bancoDeTeste();
    app = await criarApp({
      config,
      db,
      logger: {
        ...(opcoesDoLogger(config) as object),
        stream: { write: (linha: string) => void linhas.push(linha) },
      },
    });
    app.addHook('onClose', () => {
      sqlite.close();
    });
    app.post('/api/entrar', (request) => {
      request.log.info({ corpo: request.body, cabecalhos: request.headers }, 'tentativa');
      return { ok: true };
    });

    await app.inject({
      method: 'POST',
      url: '/api/entrar',
      headers: { cookie: 'sessao=abc123', authorization: 'Bearer tok-secreto' },
      payload: { email: 'ana@exemplo.com', senha: 'minha-senha', token: 'tok-secreto' },
    });

    const log = linhas.join('');
    expect(log).toContain('tentativa');
    expect(log).toContain('ana@exemplo.com');
    expect(log).not.toContain('minha-senha');
    expect(log).not.toContain('tok-secreto');
    expect(log).not.toContain('abc123');
  });
});

describe('erros', () => {
  it('erro inesperado vira 500 sem vazar a mensagem nem a stack', async () => {
    const pronto = await montar((a) => {
      a.get('/api/quebra', () => {
        throw new Error('segredo interno: SELECT * FROM users');
      });
    });

    const resposta = await pronto.inject({ method: 'GET', url: '/api/quebra' });

    expect(resposta.statusCode).toBe(500);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
    });
    expect(resposta.body).not.toContain('segredo');
    expect(resposta.body).not.toContain('at ');
  });

  it('ErroDaApi vira a resposta com o status, o código e a mensagem dele', async () => {
    const pronto = await montar((a) => {
      a.get('/api/proibido', () => {
        throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre pode abrir o escudo.');
      });
    });

    const resposta = await pronto.inject({ method: 'GET', url: '/api/proibido' });

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'SO_O_MESTRE', mensagem: 'Só o mestre pode abrir o escudo.' },
    });
  });

  it('dados que não passam no schema viram 400 em português', async () => {
    const pronto = await montar((a) => {
      a.post(
        '/api/eco',
        {
          schema: {
            body: { type: 'object', required: ['nome'], properties: { nome: { type: 'string' } } },
          },
        },
        () => ({ ok: true }),
      );
    });

    const resposta = await pronto.inject({ method: 'POST', url: '/api/eco', payload: {} });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Alguns dados enviados não são válidos.' },
    });
  });

  it('rota inexistente responde 404 no mesmo formato', async () => {
    const resposta = await (await montar()).inject({ method: 'GET', url: '/api/nada' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Não encontramos o que você procurou.' },
    });
  });
});
