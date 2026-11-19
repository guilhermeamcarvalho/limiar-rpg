// drizzle-kit: `pnpm db:generate` compara o schema com as migrações e gera a próxima.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  // Só para comandos que olham o banco de verdade (como `drizzle-kit studio`).
  dbCredentials: { url: process.env.DATABASE_PATH ?? '../data/limiar.db' },
});
