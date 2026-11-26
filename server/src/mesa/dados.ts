// Consultas da mesa ao vivo: o estado salvo, os mapas, o registro da sessão e os personagens.
// O mapa ativo (com tokens, props e breu) mora em `maps`, `tokens` e `props`; o resto do estado
// (rodada, trilha, salas, pistas...) em `table_states`. Os dois são gravados juntos.
import { and, asc, desc, eq, inArray, isNull, max, ne, or, sql } from 'drizzle-orm';
import {
  atributoDaPericia,
  esquemaFichaOp2,
  estadoVazioDaMesa,
  PERFIS_OP2,
  type AreaDoBreu,
  type EstadoDaMesa,
  type EventoDaMesa,
  type FichaOp2,
  type MapaNaMesa,
  type OrigemDoTeste,
  type PerfilOp2,
  type PericiaOp2,
  type PersonagemNaMesa,
  type PropNaMesa,
  type RegistroDeTeste,
  type TesteDaFicha,
  type TokenNaMesa,
} from '@membrana/shared';
import type { Banco } from '../db/index.ts';
import {
  campaigns,
  characters,
  gameSystems,
  maps,
  memberships,
  props,
  sessionLog,
  tableStates,
  testLog,
  tokens,
  users,
  type RestoDaMesa,
} from '../db/schema.ts';

export interface EstadoSalvo {
  campanhaId: string;
  estado: EstadoDaMesa;
  seq: number;
}

/** Um mapa com o que está sobre ele. */
export interface ConteudoDoMapa {
  mapa: MapaNaMesa;
  tokens: TokenNaMesa[];
  props: PropNaMesa[];
  breu: AreaDoBreu[];
}

type Transacao = Parameters<Parameters<Banco['transaction']>[0]>[0];

/** O mapa do caso com os tokens (e o dono de cada um), os props e o breu; ou nulo. */
export function lerMapa(db: Banco, campanhaId: string, mapaId: string): ConteudoDoMapa | null {
  const linha = db
    .select()
    .from(maps)
    .where(and(eq(maps.id, mapaId), eq(maps.campaignId, campanhaId)))
    .get();
  if (!linha) return null;
  const tokensDoMapa = db
    .select({
      id: tokens.id,
      nome: tokens.nome,
      imagem: tokens.imagem,
      x: tokens.x,
      y: tokens.y,
      tamanho: tokens.tamanho,
      oculto: tokens.oculto,
      personagemId: tokens.characterId,
      donoId: characters.ownerId,
    })
    .from(tokens)
    .leftJoin(characters, eq(characters.id, tokens.characterId))
    .where(eq(tokens.mapId, mapaId))
    .orderBy(sql`"tokens"."rowid"`)
    .all();
  const propsDoMapa = db
    .select({
      id: props.id,
      imagem: props.imagem,
      x: props.x,
      y: props.y,
      tamanho: props.tamanho,
      rotacao: props.rotacao,
      travado: props.travado,
      ordem: props.ordem,
    })
    .from(props)
    .where(eq(props.mapId, mapaId))
    .orderBy(asc(props.ordem), sql`"props"."rowid"`)
    .all();
  return {
    mapa: {
      id: linha.id,
      nome: linha.nome,
      imagem: linha.imagem,
      largura: linha.largura,
      altura: linha.altura,
      grade: linha.grade,
    },
    tokens: tokensDoMapa,
    props: propsDoMapa,
    breu: linha.breu,
  };
}

/** Tira do estado salvo o que é do mapa (um salvamento antigo podia trazer tokens soltos). */
function semOMapa(salvo: Partial<EstadoDaMesa>): Partial<RestoDaMesa> {
  const resto = { ...salvo };
  delete resto.mapa;
  delete resto.tokens;
  delete resto.props;
  delete resto.breu;
  return resto;
}

/** O que vai para `table_states`: campo a campo, para um campo novo no estado não ficar de fora. */
function restoDe(estado: EstadoDaMesa): RestoDaMesa {
  const { nevoa, salas, pistas, comAlguem, rodada, trilha, guia, escudo } = estado;
  return { nevoa, salas, pistas, comAlguem, rodada, trilha, guia, escudo };
}

export function lerEstadoSalvo(db: Banco, campanhaId: string): EstadoSalvo | null {
  const resto = db.select().from(tableStates).where(eq(tableStates.campaignId, campanhaId)).get();
  const ativo = db
    .select({ id: maps.id })
    .from(maps)
    .where(and(eq(maps.campaignId, campanhaId), eq(maps.ativo, true)))
    .get();
  if (!resto && !ativo) return null;
  const conteudo = ativo ? lerMapa(db, campanhaId, ativo.id) : null;
  return {
    campanhaId,
    estado: {
      ...estadoVazioDaMesa(),
      ...(resto && semOMapa(resto.estado)),
      mapa: conteudo?.mapa ?? null,
      tokens: conteudo?.tokens ?? [],
      props: conteudo?.props ?? [],
      breu: conteudo?.breu ?? [],
    },
    seq: resto?.seq ?? 0,
  };
}

/** O estado salvo de cada mesa de caso em curso: o que o servidor carrega ao subir. */
export function lerEstadosSalvos(db: Banco): EstadoSalvo[] {
  const comResto = db
    .select({ id: tableStates.campaignId })
    .from(tableStates)
    .innerJoin(campaigns, eq(campaigns.id, tableStates.campaignId))
    .where(isNull(campaigns.encerradoEm))
    .all();
  const comMapa = db
    .select({ id: maps.campaignId })
    .from(maps)
    .innerJoin(campaigns, eq(campaigns.id, maps.campaignId))
    .where(and(eq(maps.ativo, true), isNull(campaigns.encerradoEm)))
    .all();
  const ids = [...new Set([...comResto, ...comMapa].map((l) => l.id))];
  return ids.flatMap((id) => lerEstadoSalvo(db, id) ?? []);
}

/** Grava o breu, a grade, os tokens e os props do mapa (sem mexer em qual está ativo). */
function escreverMapa(tx: Transacao, estado: EstadoDaMesa) {
  const { mapa } = estado;
  if (!mapa) return;
  tx.update(maps).set({ grade: mapa.grade, breu: estado.breu }).where(eq(maps.id, mapa.id)).run();

  tx.delete(tokens).where(eq(tokens.mapId, mapa.id)).run();
  if (estado.tokens.length > 0) {
    // Personagem apagado no meio da sessão: o token fica, como NPC (como o `set null` do banco).
    const ids = estado.tokens.flatMap((t) => (t.personagemId ? [t.personagemId] : []));
    const existentes = new Set(
      ids.length === 0
        ? []
        : tx
            .select({ id: characters.id })
            .from(characters)
            .where(inArray(characters.id, ids))
            .all()
            .map((c) => c.id),
    );
    tx.insert(tokens)
      .values(
        estado.tokens.map((t) => ({
          id: t.id,
          mapId: mapa.id,
          characterId: t.personagemId && existentes.has(t.personagemId) ? t.personagemId : null,
          nome: t.nome,
          imagem: t.imagem,
          x: t.x,
          y: t.y,
          tamanho: t.tamanho,
          oculto: t.oculto,
        })),
      )
      .run();
  }

  tx.delete(props).where(eq(props.mapId, mapa.id)).run();
  if (estado.props.length > 0) {
    tx.insert(props)
      .values(estado.props.map((p) => ({ ...p, mapId: mapa.id })))
      .run();
  }
}

/** Grava o mapa de saída antes de uma troca de mapa: o novo vai ser lido do banco. */
export function gravarMapa(db: Banco, estado: EstadoDaMesa) {
  db.transaction((tx) => {
    escreverMapa(tx, estado);
  });
}

/** Grava a mesa inteira: o mapa ativo (e qual é ele) e o resto do estado. */
export function gravarEstado(
  db: Banco,
  campanhaId: string,
  estado: EstadoDaMesa,
  seq: number,
  agora = new Date(),
) {
  const resto = restoDe(estado);
  db.transaction((tx) => {
    escreverMapa(tx, estado);
    // Desliga os outros antes de ligar este: nunca há dois ativos (índice único no banco).
    const outros = estado.mapa
      ? and(eq(maps.campaignId, campanhaId), eq(maps.ativo, true), ne(maps.id, estado.mapa.id))
      : and(eq(maps.campaignId, campanhaId), eq(maps.ativo, true));
    tx.update(maps).set({ ativo: false }).where(outros).run();
    if (estado.mapa) tx.update(maps).set({ ativo: true }).where(eq(maps.id, estado.mapa.id)).run();

    tx.insert(tableStates)
      .values({ campaignId: campanhaId, estado: resto, seq, atualizadoEm: agora })
      .onConflictDoUpdate({
        target: tableStates.campaignId,
        set: { estado: resto, seq, atualizadoEm: agora },
      })
      .run();
  });
}

export function registrarEventos(db: Banco, campanhaId: string, eventos: readonly EventoDaMesa[]) {
  if (eventos.length === 0) return;
  db.insert(sessionLog)
    .values(eventos.map((e) => ({ campaignId: campanhaId, seq: e.seq, tipo: e.type, dados: e })))
    .run();
}

/**
 * O maior número já gravado no registro. O registro é gravado na hora e o estado só um segundo
 * depois: depois de uma queda, a sequência continua daqui para não repetir número.
 */
export function ultimoSeqRegistrado(db: Banco, campanhaId: string): number {
  const linha = db
    .select({ seq: max(sessionLog.seq) })
    .from(sessionLog)
    .where(eq(sessionLog.campaignId, campanhaId))
    .get();
  return linha?.seq ?? 0;
}

/** O dono do personagem, se ele for deste caso: do caso, ou escolhido por alguém para jogar nele. */
export function donoDoPersonagemNoCaso(
  db: Banco,
  campanhaId: string,
  personagemId: string,
): { donoId: string } | null {
  const linha = db
    .selectDistinct({ donoId: characters.ownerId })
    .from(characters)
    .leftJoin(
      memberships,
      and(eq(memberships.characterId, characters.id), eq(memberships.campaignId, campanhaId)),
    )
    .where(
      and(
        eq(characters.id, personagemId),
        or(eq(characters.campaignId, campanhaId), eq(memberships.campaignId, campanhaId)),
      ),
    )
    .get();
  return linha ?? null;
}

/** Um personagem que o grupo usa no caso, com o que o token dele precisa. */
export interface PersonagemDoGrupo {
  personagemId: string;
  donoId: string;
  nome: string;
  /** O token do personagem (`<hash>.webp`), se ele tiver um. */
  imagem: string | null;
}

/** Os personagens que os jogadores escolheram para jogar neste caso, por nome. */
export function personagensDoGrupo(db: Banco, campanhaId: string): PersonagemDoGrupo[] {
  return db
    .select({
      personagemId: characters.id,
      donoId: characters.ownerId,
      nome: sql<string>`coalesce(json_extract(${characters.ficha}, '$.nome'), 'Sem nome')`,
      imagem: characters.tokenImg,
    })
    .from(memberships)
    .innerJoin(characters, eq(characters.id, memberships.characterId))
    .where(and(eq(memberships.campaignId, campanhaId), eq(memberships.papel, 'jogador')))
    .orderBy(sql`json_extract(${characters.ficha}, '$.nome')`)
    .all();
}

export const LIMITE_DO_REGISTRO_DA_SESSAO = 500;

/** Os últimos eventos gravados em `session_log`, em ordem crescente de `seq`. */
export function lerRegistroDaSessao(
  db: Banco,
  campanhaId: string,
  limite = LIMITE_DO_REGISTRO_DA_SESSAO,
): EventoDaMesa[] {
  return db
    .select({ dados: sessionLog.dados })
    .from(sessionLog)
    .where(eq(sessionLog.campaignId, campanhaId))
    .orderBy(desc(sessionLog.seq))
    .limit(limite)
    .all()
    .reverse()
    .map((l) => l.dados);
}

const PERFIS_VALIDOS: ReadonlySet<string> = new Set(PERFIS_OP2);

/** Personagens ligados ao caso (em uso ou criados nele), para identificar autores e avatares. */
export function personagensNaMesa(db: Banco, campanhaId: string): PersonagemNaMesa[] {
  return db
    .selectDistinct({
      id: characters.id,
      donoId: characters.ownerId,
      nome: sql<string>`coalesce(json_extract(${characters.ficha}, '$.nome'), 'Sem nome')`,
      perfilBruto: sql<string | null>`json_extract(${characters.ficha}, '$.perfil')`,
    })
    .from(characters)
    .leftJoin(
      memberships,
      and(eq(memberships.characterId, characters.id), eq(memberships.campaignId, campanhaId)),
    )
    .where(or(eq(characters.campaignId, campanhaId), eq(memberships.campaignId, campanhaId)))
    .orderBy(sql`json_extract(${characters.ficha}, '$.nome')`)
    .all()
    .map(({ perfilBruto, ...resto }) => ({
      ...resto,
      perfil: perfilBruto && PERFIS_VALIDOS.has(perfilBruto) ? (perfilBruto as PerfilOp2) : null,
    }));
}

export interface FichaNoCaso {
  personagemId: string;
  donoId: string;
  /** O caso salvo no próprio personagem (pode ser nulo se veio da lista do dono). */
  campanhaDoPersonagem: string | null;
  tipo: 'op2' | 'inventado';
  ficha: unknown;
  dtPadrao: number;
  dadosFisicos: boolean;
}

/** O personagem e as regras do caso para rodar um teste pela mesa; nulo se não for deste caso. */
export function lerFichaNoCaso(
  db: Banco,
  campanhaId: string,
  personagemId: string,
): FichaNoCaso | null {
  const caso = db
    .select({ dtPadrao: campaigns.dtPadrao, dadosFisicos: campaigns.dadosFisicos })
    .from(campaigns)
    .where(eq(campaigns.id, campanhaId))
    .get();
  if (!caso) return null;
  const linha = db
    .selectDistinct({
      personagemId: characters.id,
      donoId: characters.ownerId,
      campanhaDoPersonagem: characters.campaignId,
      tipo: gameSystems.tipo,
      ficha: characters.ficha,
    })
    .from(characters)
    .innerJoin(gameSystems, eq(gameSystems.id, characters.systemId))
    .leftJoin(
      memberships,
      and(eq(memberships.characterId, characters.id), eq(memberships.campaignId, campanhaId)),
    )
    .where(
      and(
        eq(characters.id, personagemId),
        or(eq(characters.campaignId, campanhaId), eq(memberships.campaignId, campanhaId)),
      ),
    )
    .get();
  if (!linha) return null;
  return { ...linha, ...caso };
}

export interface EntradaDeTesteDaMesa {
  personagemId: string;
  autorId: string;
  origem: OrigemDoTeste;
  periciaId: PericiaOp2;
  teste: TesteDaFicha;
}

/** Grava a ficha atualizada e o histórico em `test_log` numa transação só, devolvendo o registro. */
export function gravarTesteDaMesa(
  db: Banco,
  campanhaId: string,
  entrada: EntradaDeTesteDaMesa,
): RegistroDeTeste {
  const fichaNova: FichaOp2 = esquemaFichaOp2.parse(entrada.teste.ficha);
  const autorLinha = db
    .select({ id: users.id, nome: users.nome })
    .from(users)
    .where(eq(users.id, entrada.autorId))
    .get();
  const registro = {
    periciaId: entrada.periciaId,
    atributo: atributoDaPericia(entrada.periciaId),
    resultado: entrada.teste.resultado,
    falhaCritica: entrada.teste.falhaCritica,
    efeitos: entrada.teste.efeitos,
  };
  const gravado = db.transaction((tx) => {
    tx.update(characters)
      .set({ ficha: fichaNova, atualizadoEm: new Date() })
      .where(eq(characters.id, entrada.personagemId))
      .run();
    return tx
      .insert(testLog)
      .values({
        characterId: entrada.personagemId,
        campaignId: campanhaId,
        userId: autorLinha ? autorLinha.id : null,
        origem: entrada.origem,
        registro,
      })
      .returning({ id: testLog.id, criadoEm: testLog.criadoEm })
      .get();
  });
  return {
    id: gravado.id,
    personagemId: entrada.personagemId,
    personagemNome: fichaNova.nome,
    campanhaId,
    autor: autorLinha ? { id: autorLinha.id, nome: autorLinha.nome } : null,
    origem: entrada.origem,
    ...registro,
    em: gravado.criadoEm.toISOString(),
  };
}
