// Tabelas da Fase 0. Mudou algo aqui? Gere a migração com `pnpm db:generate` e versione no Git.
// Nunca altere o banco à mão.
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ConfigDeSistema } from '@limiar/shared';
import { novoId } from './ids.ts';

const criadoEm = () =>
  integer('criado_em', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => novoId('usr')),
  nome: text('nome').notNull(),
  /** Nulo para quem só entra pelo Discord e não informou e-mail. */
  email: text('email').unique(),
  criadoEm: criadoEm(),
});

/**
 * Cada forma de entrar numa conta. A mesma pessoa pode ter e-mail e Discord.
 * provedor `email`: id_externo é o e-mail em minúsculas e senha_hash é o Argon2.
 * provedor `discord`: id_externo é o id do Discord e senha_hash fica nulo.
 */
export const identities = sqliteTable(
  'identities',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provedor: text('provedor', { enum: ['email', 'discord'] }).notNull(),
    idExterno: text('id_externo').notNull(),
    senhaHash: text('senha_hash'),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.provedor, t.idExterno] }),
    index('identities_user').on(t.userId),
    check('identities_provedor', sql`${t.provedor} in ('email', 'discord')`),
  ],
);

/** Ordem Paranormal II e cada RPG inventado do grupo. O config é validado pelo schema do shared. */
export const gameSystems = sqliteTable(
  'game_systems',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('sys')),
    nome: text('nome').notNull(),
    tipo: text('tipo', { enum: ['op2', 'inventado'] }).notNull(),
    config: text('config', { mode: 'json' }).$type<ConfigDeSistema>().notNull(),
  },
  (t) => [check('game_systems_tipo', sql`${t.tipo} in ('op2', 'inventado')`)],
);

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('cmp')),
    systemId: text('system_id')
      .notNull()
      .references(() => gameSystems.id),
    nome: text('nome').notNull(),
    /** A frase que abre o caso, mostrada no cartão. */
    gancho: text('gancho'),
    /** Mesa em rodadas: uma ação por vez. */
    rodadas: integer('rodadas', { mode: 'boolean' }).notNull().default(true),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: criadoEm(),
  },
  (t) => [index('campaigns_system').on(t.systemId)],
);

/** Quem está em qual campanha e com que papel. Mestre numa, jogador noutra. */
export const memberships = sqliteTable(
  'memberships',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    papel: text('papel', { enum: ['mestre', 'jogador'] }).notNull(),
    /** Personagem que a pessoa usa nesta campanha. A tabela de personagens vem na Fase 1. */
    characterId: text('character_id'),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.userId] }),
    index('memberships_user').on(t.userId),
    check('memberships_papel', sql`${t.papel} in ('mestre', 'jogador')`),
  ],
);
