// Apoio para os testes do servidor: config válida e banco em memória já migrado.
import { criarApp } from '../app.ts';
import { carregarConfig } from '../config.ts';
import { abrirBanco, migrar, type Banco } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { criarSessao } from '../http/auth/sessao.ts';
import { semear } from '../db/seed.ts';
import type { ClienteDiscord } from '../http/auth/discord.ts';

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

export async function appDeTeste(
  opcoes: { discord?: ClienteDiscord | null; env?: NodeJS.ProcessEnv } = {},
) {
  const { db, sqlite } = bancoDeTeste();
  const app = await criarApp({
    config: carregarConfig({ ...ENV_DE_TESTE, ...opcoes.env }),
    db,
    logger: false,
    ...(opcoes.discord !== undefined && { discord: opcoes.discord }),
  });
  app.addHook('onClose', () => {
    sqlite.close();
  });
  return app;
}

/** Cria uma pessoa e uma sessão para ela; devolve o id e o cookie para usar no `inject`. */
export function pessoaLogada(app: { db: Banco }, nome: string) {
  const { id } = app.db.insert(users).values({ nome }).returning({ id: users.id }).get();
  return { id, nome, cookies: { membrana_sessao: criarSessao(app.db, id, false) } };
}
