// Apoio para os testes do servidor: config válida e banco em memória já migrado.
import { fichaDoDavi, ID_OP2, type Rng } from '@membrana/shared';
import { criarApp } from '../app.ts';
import { carregarConfig } from '../config.ts';
import { abrirBanco, migrar, type Banco } from '../db/index.ts';
import { campaigns, characters, memberships, users } from '../db/schema.ts';
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
  opcoes: { discord?: ClienteDiscord | null; env?: NodeJS.ProcessEnv; sorteio?: Rng } = {},
) {
  const { db, sqlite } = bancoDeTeste();
  const app = await criarApp({
    config: carregarConfig({ ...ENV_DE_TESTE, ...opcoes.env }),
    db,
    logger: false,
    ...(opcoes.discord !== undefined && { discord: opcoes.discord }),
    ...(opcoes.sorteio && { sorteio: opcoes.sorteio }),
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

/**
 * Um caso pronto para a mesa: Ana mestra o Sinal; Bia joga com a Davi; Caio joga sem personagem;
 * Estranho não participa. Gravado direto no banco, sem passar pelas rotas.
 */
export function casoDeTeste(app: { db: Banco }) {
  const ana = pessoaLogada(app, 'Ana');
  const bia = pessoaLogada(app, 'Bia');
  const caio = pessoaLogada(app, 'Caio');
  const estranho = pessoaLogada(app, 'Estranho');
  const { id: caso } = app.db
    .insert(campaigns)
    .values({ nome: 'O Sinal de Santa Ermida', systemId: ID_OP2, criadoPor: ana.id })
    .returning({ id: campaigns.id })
    .get();
  const { id: davi } = app.db
    .insert(characters)
    .values({ ownerId: bia.id, campaignId: caso, systemId: ID_OP2, ficha: fichaDoDavi() })
    .returning({ id: characters.id })
    .get();
  app.db
    .insert(memberships)
    .values([
      { campaignId: caso, userId: ana.id, papel: 'mestre' },
      { campaignId: caso, userId: bia.id, papel: 'jogador', characterId: davi },
      { campaignId: caso, userId: caio.id, papel: 'jogador' },
    ])
    .run();
  return { caso, davi, ana, bia, caio, estranho };
}
