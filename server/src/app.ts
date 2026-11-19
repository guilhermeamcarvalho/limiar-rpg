import Fastify, { type FastifyServerOptions } from 'fastify';
import { NOME_DO_APP } from '@limiar/shared';

/** Monta o app sem abrir porta, para os testes usarem `app.inject`. */
export function criarApp(opcoes: FastifyServerOptions = {}) {
  const app = Fastify(opcoes);

  app.get('/api', () => ({ app: NOME_DO_APP }));

  return app;
}
