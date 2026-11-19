import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

export const PASTA_DAS_MIGRACOES = join(import.meta.dirname, 'migrations');

/**
 * Abre (ou cria) o banco num arquivo só.
 * - WAL: leituras e escritas não se bloqueiam, e o backup copia com o app rodando.
 * - foreign_keys: o SQLite só respeita as chaves estrangeiras se pedir.
 * - busy_timeout: espera até 5 s por um bloqueio em vez de falhar na hora.
 */
export function abrirBanco(caminho: string) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const sqlite = new Database(caminho);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export type Banco = ReturnType<typeof abrirBanco>['db'];

/** Aplica as migrações que ainda não rodaram neste banco. */
export function migrar(db: Banco) {
  migrate(db, { migrationsFolder: PASTA_DAS_MIGRACOES });
}

export { schema };
