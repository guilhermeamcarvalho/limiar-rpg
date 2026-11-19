import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import estaticos from '@fastify/static';
import pacote from '../package.json' with { type: 'json' };
import type { Config } from './config.ts';
import type { Banco } from './db/index.ts';
import { NAO_ENCONTRADO, registrarTratadorDeErros } from './http/erros.ts';
import { rotas as rotasDeAuth } from './http/auth/index.ts';
import { rotas as rotasDeCampanhas } from './http/campanhas/index.ts';
import { rotas as rotasDePersonagens } from './http/personagens/index.ts';
import { rotas as rotasDeUploads } from './http/uploads/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Banco;
  }
}

/** Build do client: em produção, o mesmo processo serve as páginas e a API. */
const PASTA_DO_CLIENT = join(import.meta.dirname, '../../client/dist');

/** Nunca vão para o log: senha, cookie e token, onde quer que apareçam. */
const CAMPOS_SECRETOS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.headers.cookie',
  '*.headers.authorization',
  '*.cookie',
  '*.authorization',
  '*["set-cookie"]',
  '*.senha',
  '*.password',
  '*.token',
  '*.sessao',
];

export function opcoesDoLogger(config: Config): NonNullable<FastifyServerOptions['logger']> {
  if (config.NODE_ENV === 'test') return false;
  const nivel = config.LOG_LEVEL ?? (config.NODE_ENV === 'production' ? 'info' : 'debug');
  return {
    level: nivel,
    redact: { paths: CAMPOS_SECRETOS, censor: '[oculto]' },
    // No dev, log legível; em produção, JSON de uma linha para o journald.
    ...(config.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
    }),
  };
}

export interface DependenciasDoApp {
  config: Config;
  db: Banco;
  /** Sobrescreve o logger padrão (os testes passam `false`). */
  logger?: FastifyServerOptions['logger'];
}

/** Monta o app sem abrir porta, para os testes usarem `app.inject`. */
export async function criarApp({ config, db, logger }: DependenciasDoApp) {
  const opcoes: FastifyServerOptions = {
    logger: logger ?? opcoesDoLogger(config),
    // Atrás do Caddy: o IP real vem no X-Forwarded-For.
    trustProxy: config.NODE_ENV === 'production',
  };
  const app = Fastify(opcoes);

  app.decorate('config', config);
  app.decorate('db', db);
  registrarTratadorDeErros(app);

  await app.register(helmet);
  await app.register(cookie, { secret: config.SESSION_SECRET });
  // Limite geral contra abuso; o login tem um limite próprio, bem mais curto (#14).
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/health', () => ({ ok: true, versao: pacote.version }));

  await app.register(rotasDeAuth, { prefix: '/api/auth' });
  await app.register(rotasDeCampanhas, { prefix: '/api/campanhas' });
  await app.register(rotasDePersonagens, { prefix: '/api/personagens' });
  await app.register(rotasDeUploads, { prefix: '/api/uploads' });

  const servirClient = config.NODE_ENV === 'production' && existsSync(PASTA_DO_CLIENT);
  if (servirClient) await app.register(estaticos, { root: PASTA_DO_CLIENT, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    // Rota do app (como /casos/123) recarregada no navegador: entrega o index.html e o React decide.
    const ehPagina = request.method === 'GET' && !request.url.startsWith('/api/');
    if (servirClient && ehPagina) return reply.sendFile('index.html');
    return reply.status(404).send(NAO_ENCONTRADO);
  });

  return app;
}
