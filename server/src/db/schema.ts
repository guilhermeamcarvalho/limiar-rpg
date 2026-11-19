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

/**
 * Sessões de login. O cookie leva um token aleatório de 32 bytes; aqui fica só o SHA-256 dele,
 * então quem ler o banco não consegue entrar como ninguém.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 (hex) do token que está no cookie. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiraEm: integer('expira_em', { mode: 'timestamp_ms' }).notNull(),
    /** "Manter conectado": cookie de 30 dias, renovado com o uso. */
    manter: integer('manter', { mode: 'boolean' }).notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [index('sessions_user').on(t.userId)],
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
    /** "Caso nº 017": sequência do servidor inteiro, dada na criação. */
    numero: integer('numero').unique(),
    nome: text('nome').notNull(),
    /** A frase que abre o caso, mostrada no cartão. */
    gancho: text('gancho'),
    /** Mesa em rodadas: uma ação por vez. */
    rodadas: integer('rodadas', { mode: 'boolean' }).notNull().default(true),
    /** Data e hora da próxima sessão, se já marcada. */
    proximaSessao: integer('proxima_sessao', { mode: 'timestamp_ms' }),
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
    /** Convite usado para entrar (nulo para o mestre): o mestre vê quem ocupou cada vaga. */
    inviteId: text('invite_id').references(() => invites.id, { onDelete: 'set null' }),
    entrouEm: integer('entrou_em', { mode: 'timestamp_ms' }),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.userId] }),
    index('memberships_user').on(t.userId),
    check('memberships_papel', sql`${t.papel} in ('mestre', 'jogador')`),
  ],
);

/** Convite para entrar como jogador: link /c/ERMIDA-3H33 ou só o código. */
export const invites = sqliteTable(
  'invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('inv')),
    /** Palavra do nome do caso + 4 caracteres, em maiúsculas: ERMIDA-3H33. */
    codigo: text('codigo').notNull().unique(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    vagas: integer('vagas').notNull(),
    usados: integer('usados').notNull().default(0),
    expiraEm: integer('expira_em', { mode: 'timestamp_ms' }).notNull(),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('invites_campaign').on(t.campaignId),
    check('invites_vagas', sql`${t.usados} >= 0 and ${t.usados} <= ${t.vagas}`),
  ],
);
