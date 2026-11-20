// Configuração do servidor, lida das variáveis de ambiente e validada antes de subir.
// Faltou ou está errada? O servidor nem sobe, e a mensagem diz qual variável e por quê.
import { join } from 'node:path';
import { z } from 'zod';

/** Raiz do repositório: os caminhos padrão (data/) ficam relativos a ela, não à pasta atual. */
const RAIZ = join(import.meta.dirname, '../..');

const ambiente = z.enum(['development', 'production', 'test']).default('development');

const esquema = z
  .object({
    NODE_ENV: ambiente,
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('127.0.0.1'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    BASE_URL: z.url({ error: 'precisa ser uma URL, como http://localhost:5173' }),
    SESSION_SECRET: z
      .string({ error: 'obrigatória' })
      .min(32, { error: 'precisa ter pelo menos 32 caracteres' }),
    DATABASE_PATH: z.string().min(1).default(join(RAIZ, 'data/limiar.db')),
    UPLOADS_DIR: z.string().min(1).default(join(RAIZ, 'data/uploads')),
    DISCORD_CLIENT_ID: z.string().min(1).optional(),
    DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
    /** Sem ela, nenhum erro sai do servidor (#29). */
    SENTRY_DSN: z.url({ error: 'precisa ser a URL do DSN que o Sentry mostra' }).optional(),
    /** DSN do projeto do navegador: entra no build e libera o envio na CSP (connect-src). */
    SENTRY_DSN_CLIENT: z.url({ error: 'precisa ser a URL do DSN que o Sentry mostra' }).optional(),
    /** Escrita pelo deploy (o commit publicado); sem ela, vale a versão do package.json. */
    LIMIAR_VERSAO: z.string().min(1).optional(),
  })
  .refine((c) => Boolean(c.DISCORD_CLIENT_ID) === Boolean(c.DISCORD_CLIENT_SECRET), {
    error: 'DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET vão juntas: preencha as duas ou nenhuma',
    path: ['DISCORD_CLIENT_ID'],
  });

export type Config = z.infer<typeof esquema>;

export class ErroDeConfig extends Error {
  override name = 'ErroDeConfig';
}

/** Lê e valida a configuração. Lança `ErroDeConfig` listando cada problema. */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Variável vazia ("PORT=") conta como ausente, para valer o padrão ou acusar a falta.
  const preenchidas = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const resultado = esquema.safeParse(preenchidas);
  if (resultado.success) return resultado.data;

  const linhas = resultado.error.issues.map((problema) => {
    const nome = problema.path.join('.') || '(geral)';
    const motivo = problema.code === 'invalid_type' && problema.input === undefined;
    return `  - ${nome}: ${motivo ? 'obrigatória e não foi definida' : problema.message}`;
  });
  throw new ErroDeConfig(
    `Configuração inválida; o servidor não vai subir.\n${linhas.join('\n')}\n` +
      'Veja server/.env.example para o que cada variável faz.',
  );
}

/** Só o caminho do banco: o script de migração não precisa do resto. */
export function caminhoDoBanco(env: NodeJS.ProcessEnv = process.env): string {
  return env.DATABASE_PATH || join(RAIZ, 'data/limiar.db');
}
