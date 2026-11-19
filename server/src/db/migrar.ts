// `pnpm db:migrate`: cria o banco se não existir, aplica as migrações pendentes e roda o seed.
// É o que o deploy chama antes de reiniciar o serviço.
import { caminhoDoBanco } from '../config.ts';
import { abrirBanco, migrar } from './index.ts';
import { semear } from './seed.ts';

const caminho = caminhoDoBanco();
const { db, sqlite } = abrirBanco(caminho);
try {
  migrar(db);
  semear(db);
  console.log(`Banco pronto: ${caminho}`);
} finally {
  sqlite.close();
}
