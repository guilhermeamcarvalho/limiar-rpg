// Tabelas do banco. Mudou algo aqui? Gere a migração com `pnpm db:generate` e versione no Git.
// Nunca altere o banco à mão.
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  DT_PADRAO,
  type Agenda,
  type ConfigDeSistema,
  type EstadoDaMesa,
  type EventoDaMesa,
  type Formato,
  type Tom,
} from '@membrana/shared';
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
    tom: text('tom').$type<Tom>().notNull().default('horror-investigativo'),
    formato: text('formato').$type<Formato>().notNull().default('campanha-curta'),
    nivelInicial: integer('nivel_inicial').notNull().default(1),
    dtPadrao: integer('dt_padrao').notNull().default(DT_PADRAO),
    /** O jogador pode rolar dados de verdade e informar o resultado. */
    dadosFisicos: integer('dados_fisicos', { mode: 'boolean' }).notNull().default(true),
    /** Os jogadores veem as fichas uns dos outros. */
    fichasVisiveis: integer('fichas_visiveis', { mode: 'boolean' }).notNull().default(false),
    /** Quando a mesa costuma se reunir ("toda sexta às 21h"); validado pelo schema do shared. */
    agenda: text('agenda', { mode: 'json' }).$type<Agenda>(),
    /** Preenchido quando o mestre encerra o caso. */
    encerradoEm: integer('encerrado_em', { mode: 'timestamp_ms' }),
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
    /** Personagem que a pessoa usa nesta campanha. Trocar aqui não mexe nas outras campanhas. */
    characterId: text('character_id').references(() => characters.id, { onDelete: 'set null' }),
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

/**
 * Personagens. A ficha é JSON com `versao`, validada pelo schema do sistema na entrada e na saída.
 * `campaign_id` é o caso a que o personagem pertence (nulo enquanto está só na lista do dono);
 * qual personagem cada pessoa usa em cada caso fica em `memberships.character_id`.
 */
export const characters = sqliteTable(
  'characters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('chr')),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    systemId: text('system_id')
      .notNull()
      .references(() => gameSystems.id),
    ficha: text('ficha', { mode: 'json' }).$type<unknown>().notNull(),
    /** Nome do arquivo em UPLOADS_DIR (hash do conteúdo). Os uploads chegam na Fase 2. */
    foto: text('foto'),
    tokenImg: text('token_img'),
    criadoEm: criadoEm(),
    atualizadoEm: integer('atualizado_em', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index('characters_owner').on(t.ownerId), index('characters_campaign').on(t.campaignId)],
);

/**
 * Testes de perícia feitos pela ficha: o histórico da aba Histórico. Provisória: na Fase 2 os
 * testes passam a ir para `session_log`, junto com os outros acontecimentos da mesa.
 * `registro` é o resultado como o shared o descreve (RegistroDeTeste, sem os ids e a data).
 */
export const testLog = sqliteTable(
  'test_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('tst')),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    /** O caso do personagem na hora do teste. */
    campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    /** Quem pediu o teste: o dono ou o mestre. */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    origem: text('origem', { enum: ['virtual', 'fisico'] }).notNull(),
    registro: text('registro', { mode: 'json' }).$type<unknown>().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('test_log_character').on(t.characterId, t.criadoEm),
    check('test_log_origem', sql`${t.origem} in ('virtual', 'fisico')`),
  ],
);

/**
 * O último estado de cada mesa ao vivo (tokens, props, névoa, rodada...), salvo no máximo 1 s
 * depois de uma mudança. Ao subir, o servidor carrega daqui; `seq` é o último número de evento.
 */
export const tableStates = sqliteTable('table_states', {
  campaignId: text('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  estado: text('estado', { mode: 'json' }).$type<EstadoDaMesa>().notNull(),
  seq: integer('seq').notNull(),
  atualizadoEm: integer('atualizado_em', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * Registro da sessão: os eventos importantes da mesa (rolagens, testes, pistas apresentadas,
 * conversa, mudança de rodada, de cena e de trilha), para a aba Acontecimentos e o resumo.
 * Guarda o evento inteiro; quem lê filtra pelo que cada pessoa pode ver.
 */
export const sessionLog = sqliteTable(
  'session_log',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    tipo: text('tipo').notNull(),
    dados: text('dados', { mode: 'json' }).$type<EventoDaMesa>().notNull(),
    em: integer('em', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.seq] })],
);
