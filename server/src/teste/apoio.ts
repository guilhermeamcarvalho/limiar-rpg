// Apoio para os testes do servidor: config válida e banco em memória já migrado.
import { criarApp } from '../app.ts';
import { carregarConfig } from '../config.ts';
import { abrirBanco, migrar } from '../db/index.ts';
import { semear } from '../db/seed.ts';

export const ENV_DE_TESTE = {
  NODE_ENV: 'test',
  BASE_URL: 'http://localhost:5173',
  SESSION_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
};

export function bancoDeTeste() {
  const banco = abrirBanco(':memory:');
  migrar(banco.db);
  semear(banco.db);
  return banco;
}

export async function appDeTeste() {
  const { db, sqlite } = bancoDeTeste();
  const app = await criarApp({ config: carregarConfig(ENV_DE_TESTE), db });
  app.addHook('onClose', () => {
    sqlite.close();
  });
  return app;
}
