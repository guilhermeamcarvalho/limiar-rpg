// Consultas de campanha. As rotas decidem permissão com shared/permissoes.ts; aqui só se lê e grava.
import { and, count, desc, eq, max, sql } from 'drizzle-orm';
import type {
  CampanhaComMembros,
  CampanhaNaLista,
  ConviteDoMestre,
  Membro,
  Papel,
  Quem,
} from '@limiar/shared';
import { podeVerCampanha } from '@limiar/shared';
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

export function listarDoUsuario(db: Banco, userId: string): CampanhaNaLista[] {
  const contagem = contagemDeJogadores(db);
  return db
    .select({
      id: campaigns.id,
      numero: campaigns.numero,
      nome: campaigns.nome,
      gancho: campaigns.gancho,
      papel: memberships.papel,
      sistema: { id: gameSystems.id, nome: gameSystems.nome, tipo: gameSystems.tipo },
      proximaSessao: campaigns.proximaSessao,
      jogadores: sql<number>`coalesce(${contagem.jogadores}, 0)`,
    })
    .from(memberships)
    .innerJoin(campaigns, eq(campaigns.id, memberships.campaignId))
    .innerJoin(gameSystems, eq(gameSystems.id, campaigns.systemId))
    .leftJoin(contagem, eq(contagem.campaignId, campaigns.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(campaigns.criadoEm))
    .all()
    .map(({ jogadores, proximaSessao, ...resto }) => ({
      ...resto,
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

export function detalhar(db: Banco, id: string, papel: Papel) {
  const contagem = contagemDeJogadores(db);
  const linha = db
    .select({
      id: campaigns.id,
      numero: campaigns.numero,
      nome: campaigns.nome,
      gancho: campaigns.gancho,
      rodadas: campaigns.rodadas,
      sistema: { id: gameSystems.id, nome: gameSystems.nome, tipo: gameSystems.tipo },
      proximaSessao: campaigns.proximaSessao,
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

  const { jogadores, proximaSessao, ...resto } = linha;
  return {
    ...resto,
    papel,
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
