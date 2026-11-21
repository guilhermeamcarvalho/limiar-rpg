// Consultas de campanha. As rotas decidem permissão com shared/permissoes.ts; aqui só se lê e grava.
import { and, count, desc, eq, inArray, max, sql } from 'drizzle-orm';
import type {
  CampanhaComMembros,
  CampanhaDetalhe,
  CampanhaNaLista,
  ConviteDoMestre,
  Membro,
  Papel,
  Quem,
  SituacaoDoCaso,
} from '@membrana/shared';
import { podeVerCampanha } from '@membrana/shared';
import type { Banco } from '../../db/index.ts';
import { campaigns, gameSystems, invites, memberships, users } from '../../db/schema.ts';
import { ErroDaApi } from '../erros.ts';

/** 404, e não 403: quem não participa nem fica sabendo que o caso existe. */
export const CASO_NAO_ENCONTRADO = new ErroDaApi(
  404,
  'CASO_NAO_ENCONTRADO',
  'Não encontramos este caso.',
);

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Quantos jogadores (não conta o mestre) cada campanha tem. */
function contagemDeJogadores(db: Banco) {
  return db
    .select({ campaignId: memberships.campaignId, jogadores: count().as('jogadores') })
    .from(memberships)
    .where(eq(memberships.papel, 'jogador'))
    .groupBy(memberships.campaignId)
    .as('contagem');
}

const situacao = (encerradoEm: Date | null): SituacaoDoCaso =>
  encerradoEm ? 'encerrado' : 'em-curso';

/** O mestre de cada campanha da lista, numa consulta só. */
function mestresDe(db: Banco, ids: string[]) {
  if (ids.length === 0) return new Map<string, { id: string; nome: string }>();
  const linhas = db
    .select({ campaignId: memberships.campaignId, id: users.id, nome: users.nome })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(inArray(memberships.campaignId, ids), eq(memberships.papel, 'mestre')))
    .all();
  return new Map(linhas.map(({ campaignId, ...mestre }) => [campaignId, mestre]));
}

export function listarDoUsuario(db: Banco, userId: string): CampanhaNaLista[] {
  const contagem = contagemDeJogadores(db);
  const linhas = db
    .select({
      id: campaigns.id,
      numero: campaigns.numero,
      nome: campaigns.nome,
      gancho: campaigns.gancho,
      papel: memberships.papel,
      sistema: { id: gameSystems.id, nome: gameSystems.nome, tipo: gameSystems.tipo },
      agenda: campaigns.agenda,
      proximaSessao: campaigns.proximaSessao,
      encerradoEm: campaigns.encerradoEm,
      jogadores: sql<number>`coalesce(${contagem.jogadores}, 0)`,
    })
    .from(memberships)
    .innerJoin(campaigns, eq(campaigns.id, memberships.campaignId))
    .innerJoin(gameSystems, eq(gameSystems.id, campaigns.systemId))
    .leftJoin(contagem, eq(contagem.campaignId, campaigns.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(campaigns.criadoEm), desc(campaigns.numero))
    .all();
  const mestres = mestresDe(
    db,
    linhas.map((l) => l.id),
  );
  return linhas.map(({ jogadores, proximaSessao, encerradoEm, ...resto }) => ({
    ...resto,
    mestre: mestres.get(resto.id) ?? null,
    situacao: situacao(encerradoEm),
    proximaSessao: iso(proximaSessao),
    contagens: { jogadores },
  }));
}

/** Os membros, no formato que as funções de permissão entendem. */
export function membrosDe(db: Banco, campaignId: string): CampanhaComMembros['membros'] {
  return db
    .select({ userId: memberships.userId, papel: memberships.papel })
    .from(memberships)
    .where(eq(memberships.campaignId, campaignId))
    .all();
}

/**
 * Carrega a campanha para quem pediu. Quem não participa recebe 404.
 * Devolve também a forma que as permissões usam, para a rota decidir o resto.
 */
export function campanhaVisivel(db: Banco, id: string, quem: Quem) {
  const campanha = db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!campanha) throw CASO_NAO_ENCONTRADO;
  const comMembros: CampanhaComMembros = { id, membros: membrosDe(db, id) };
  if (!podeVerCampanha(quem, comMembros)) throw CASO_NAO_ENCONTRADO;
  return { campanha, comMembros };
}

export function detalhar(db: Banco, id: string, papel: Papel): CampanhaDetalhe {
  const contagem = contagemDeJogadores(db);
  const linha = db
    .select({
      id: campaigns.id,
      numero: campaigns.numero,
      nome: campaigns.nome,
      gancho: campaigns.gancho,
      tom: campaigns.tom,
      formato: campaigns.formato,
      nivelInicial: campaigns.nivelInicial,
      dtPadrao: campaigns.dtPadrao,
      rodadas: campaigns.rodadas,
      dadosFisicos: campaigns.dadosFisicos,
      fichasVisiveis: campaigns.fichasVisiveis,
      sistema: { id: gameSystems.id, nome: gameSystems.nome, tipo: gameSystems.tipo },
      agenda: campaigns.agenda,
      proximaSessao: campaigns.proximaSessao,
      encerradoEm: campaigns.encerradoEm,
      jogadores: sql<number>`coalesce(${contagem.jogadores}, 0)`,
    })
    .from(campaigns)
    .innerJoin(gameSystems, eq(gameSystems.id, campaigns.systemId))
    .leftJoin(contagem, eq(contagem.campaignId, campaigns.id))
    .where(eq(campaigns.id, id))
    .get();
  if (!linha) throw CASO_NAO_ENCONTRADO;

  const membros: Membro[] = db
    .select({ id: users.id, nome: users.nome, papel: memberships.papel })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.campaignId, id))
    .orderBy(sql`${memberships.papel} = 'jogador'`, users.nome)
    .all();

  const { jogadores, proximaSessao, encerradoEm, ...resto } = linha;
  const mestre = membros.find((m) => m.papel === 'mestre');
  return {
    ...resto,
    papel,
    mestre: mestre ? { id: mestre.id, nome: mestre.nome } : null,
    situacao: situacao(encerradoEm),
    proximaSessao: iso(proximaSessao),
    contagens: { jogadores },
    membros,
  };
}

/** Os convites da campanha, com quem entrou por cada um. Só para o mestre. */
export function convitesDoMestre(
  db: Banco,
  campaignId: string,
  agora = Date.now(),
): ConviteDoMestre[] {
  const lista = db
    .select()
    .from(invites)
    .where(eq(invites.campaignId, campaignId))
    .orderBy(desc(invites.criadoEm))
    .all();
  const entradas = db
    .select({
      inviteId: memberships.inviteId,
      id: users.id,
      nome: users.nome,
      entrouEm: memberships.entrouEm,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.campaignId, campaignId), sql`${memberships.inviteId} is not null`))
    .orderBy(memberships.entrouEm)
    .all();

  return lista.map((c) => ({
    codigo: c.codigo,
    vagas: c.vagas,
    usados: c.usados,
    expiraEm: c.expiraEm.toISOString(),
    expirado: c.expiraEm.getTime() <= agora,
    entraram: entradas
      .filter((e) => e.inviteId === c.id)
      .map((e) => ({ id: e.id, nome: e.nome, entrouEm: iso(e.entrouEm) })),
  }));
}

/** Próximo número de caso ("caso nº 018"). Chame dentro da transação que cria a campanha. */
export function proximoNumero(db: Pick<Banco, 'select'>): number {
  const atual = db
    .select({ maior: max(campaigns.numero) })
    .from(campaigns)
    .get();
  return (atual?.maior ?? 0) + 1;
}
