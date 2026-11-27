// Tabelas do banco. Mudou algo aqui? Gere a migração com `pnpm db:generate` e versione no Git.
// Nunca altere o banco à mão.
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import {
  DT_PADRAO,
  type Agenda,
  type AreaDoBreu,
  type ConfigDeSistema,
  type DesafioDoPoi,
  type EstadoDaMesa,
  type EstadoDoDesafio,
  type EventoDaMesa,
  type Formato,
  type GradeDoMapa,
  type InformacaoDoPoi,
  type NotasDoEscudo,
  type PericiaDoPoi,
  type Ponto,
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
 * Mapas do caso. Só um fica ativo por vez (é o que está na mesa). O breu é do mapa; tokens e
 * props também, em tabelas próprias: apagar o mapa apaga os dois.
 */
export const maps = sqliteTable(
  'maps',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('map')),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    /** Arquivo em UPLOADS_DIR (`<hash>.webp`), já com no máximo 4096 px no lado maior. */
    imagem: text('imagem').notNull(),
    largura: integer('largura').notNull(),
    altura: integer('altura').notNull(),
    grade: text('grade', { mode: 'json' }).$type<GradeDoMapa>().notNull(),
    breu: text('breu', { mode: 'json' })
      .$type<AreaDoBreu[]>()
      .notNull()
      .default(sql`'[]'`),
    ativo: integer('ativo', { mode: 'boolean' }).notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('maps_campaign').on(t.campaignId),
    // Nunca dois mapas ativos no mesmo caso.
    uniqueIndex('maps_um_ativo')
      .on(t.campaignId)
      .where(sql`${t.ativo} = 1`),
  ],
);

/** Tokens de cada mapa. `x` e `y` são o centro, em pixels do mapa. Sem personagem, é um NPC. */
export const tokens = sqliteTable(
  'tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('tok')),
    mapId: text('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    /** Apagar o personagem deixa o token no mapa, como NPC. */
    characterId: text('character_id').references(() => characters.id, { onDelete: 'set null' }),
    nome: text('nome').notNull(),
    imagem: text('imagem'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    tamanho: integer('tamanho').notNull().default(1),
    oculto: integer('oculto', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('tokens_map').on(t.mapId)],
);

/** Props (imagens sobre o mapa). `tamanho` em células, `rotacao` em graus, `ordem` = camada. */
export const props = sqliteTable(
  'props',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('prp')),
    mapId: text('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    imagem: text('imagem').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    tamanho: real('tamanho').notNull().default(1),
    rotacao: real('rotacao').notNull().default(0),
    travado: integer('travado', { mode: 'boolean' }).notNull().default(false),
    ordem: integer('ordem').notNull().default(0),
  },
  (t) => [index('props_map').on(t.mapId)],
);

/** Salas desenhadas sobre o mapa (só o mestre vê, #82). */
export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('rom')),
    mapId: text('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    area: text('area', { mode: 'json' }).$type<Ponto[]>().notNull(),
    notasMestre: text('notas_mestre').notNull().default(''),
  },
  (t) => [index('rooms_map').on(t.mapId)],
);

/** Pontos de interesse (tabela única na mesa e no escudo, #83). */
export const pois = sqliteTable(
  'pois',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('poi')),
    mapId: text('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    numero: integer('numero').notNull(),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull().default(''),
    x: real('x').notNull(),
    y: real('y').notNull(),
    pericias: text('pericias', { mode: 'json' })
      .$type<PericiaDoPoi[]>()
      .notNull()
      .default(sql`'[]'`),
    informacoes: text('informacoes', { mode: 'json' })
      .$type<InformacaoDoPoi[]>()
      .notNull()
      .default(sql`'[]'`),
    desafio: text('desafio', { mode: 'json' }).$type<DesafioDoPoi>(),
    contextoMestre: text('contexto_mestre').notNull().default(''),
  },
  (t) => [index('pois_map').on(t.mapId)],
);

/** Descobertas salvas por campanha (#86): o que o grupo já revelou de cada ponto de interesse. */
export const poiDiscoveries = sqliteTable(
  'poi_discoveries',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    poiId: text('poi_id')
      .notNull()
      .references(() => pois.id, { onDelete: 'cascade' }),
    infoId: text('info_id').notNull(),
    por: text('por').references(() => users.id, { onDelete: 'set null' }),
    em: integer('em', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.poiId, t.infoId] })],
);

/** Estado dos desafios de acesso por campanha (#84): tentativas, progresso e se está travado. */
export const poiChallenges = sqliteTable(
  'poi_challenges',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    poiId: text('poi_id')
      .notNull()
      .references(() => pois.id, { onDelete: 'cascade' }),
    estado: text('estado', { mode: 'json' }).$type<EstadoDoDesafio>().notNull(),
    atualizadoEm: integer('atualizado_em', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.poiId] })],
);

/** Pistas colocadas no mapa pelo mestre (#87). */
export const clues = sqliteTable(
  'clues',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => novoId('pst')),
    mapId: text('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    titulo: text('titulo').notNull(),
    texto: text('texto').notNull().default(''),
    imagem: text('imagem'),
    tamanho: real('tamanho').notNull().default(1),
    notaMestre: text('nota_mestre').notNull().default(''),
    x: real('x').notNull(),
    y: real('y').notNull(),
    visivel: integer('visivel', { mode: 'boolean' }).notNull().default(false),
    manterVisivel: integer('manter_visivel', { mode: 'boolean' }).notNull().default(false),
    descoberta: integer('descoberta', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('clues_map').on(t.mapId)],
);

/** Quem tem cada pista no inventário e se já foi apresentada ao grupo (#87, #89). */
export const clueHolders = sqliteTable(
  'clue_holders',
  {
    clueId: text('clue_id')
      .notNull()
      .references(() => clues.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    apresentada: integer('apresentada', { mode: 'boolean' }).notNull().default(false),
    em: text('em').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.clueId, t.characterId] }),
    index('clue_holders_character').on(t.characterId),
  ],
);

/** O que a mesa guarda além do mapa ativo e das pistas (estes ficam em tabelas próprias). */
export type RestoDaMesa = Omit<
  EstadoDaMesa,
  'mapa' | 'tokens' | 'props' | 'breu' | 'salas' | 'pois' | 'pistas' | 'comAlguem'
>;

/**
 * O resto do estado de cada mesa ao vivo (rodada, trilha, salas, pistas...), salvo junto com o
 * mapa ativo no máximo 1 s depois de uma mudança. `seq` é o último número de evento.
 */
export const tableStates = sqliteTable('table_states', {
  campaignId: text('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  estado: text('estado', { mode: 'json' }).$type<RestoDaMesa>().notNull(),
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

/** Notas, ameaças, relógios e segredos do Escudo do mestre (#92, #93). Só o mestre lê e edita. */
export const gmNotes = sqliteTable('gm_notes', {
  campaignId: text('campaign_id')
    .primaryKey()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  notas: text('notas', { mode: 'json' }).$type<NotasDoEscudo>().notNull(),
  atualizadoEm: integer('atualizado_em', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});
