// Consultas da mesa ao vivo: o estado salvo, os mapas, o registro da sessão e os personagens.
// O mapa ativo (com tokens, props e breu) mora em `maps`, `tokens` e `props`; o resto do estado
// (rodada, trilha, salas, pistas...) em `table_states`. Os dois são gravados juntos.
import { and, asc, desc, eq, inArray, isNull, max, ne, notInArray, or, sql } from 'drizzle-orm';
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
  type PistaComAlguem,
  type PistaNaMesa,
  type PoiNaMesa,
  type PropNaMesa,
  type RegistroDeTeste,
  type SalaNaMesa,
  type TesteDaFicha,
  type TokenNaMesa,
} from '@membrana/shared';
import type { Banco } from '../db/index.ts';
import {
  campaigns,
  characters,
  clueHolders,
  clues,
  gameSystems,
  maps,
  memberships,
  poiChallenges,
  poiDiscoveries,
  pois,
  props,
  rooms,
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
  salas: SalaNaMesa[];
  pois: PoiNaMesa[];
  pistas: PistaNaMesa[];
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
  const salasDoMapa = db
    .select({
      id: rooms.id,
      nome: rooms.nome,
      area: rooms.area,
      notasMestre: rooms.notasMestre,
    })
    .from(rooms)
    .where(eq(rooms.mapId, mapaId))
    .orderBy(sql`"rooms"."rowid"`)
    .all();
  const poisDoMapa = db
    .select({
      id: pois.id,
      salaId: pois.roomId,
      numero: pois.numero,
      nome: pois.nome,
      descricao: pois.descricao,
      x: pois.x,
      y: pois.y,
      pericias: pois.pericias,
      informacoes: pois.informacoes,
      desafio: pois.desafio,
      contextoMestre: pois.contextoMestre,
    })
    .from(pois)
    .where(eq(pois.mapId, mapaId))
    .orderBy(asc(pois.numero), sql`"pois"."rowid"`)
    .all();
  const pistasDoMapa = db
    .select({
      id: clues.id,
      titulo: clues.titulo,
      texto: clues.texto,
      imagem: clues.imagem,
      tamanho: clues.tamanho,
      notaMestre: clues.notaMestre,
      x: clues.x,
      y: clues.y,
      visivel: clues.visivel,
      manterVisivel: clues.manterVisivel,
      descoberta: clues.descoberta,
    })
    .from(clues)
    .where(eq(clues.mapId, mapaId))
    .orderBy(sql`"clues"."rowid"`)
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
    salas: salasDoMapa,
    pois: poisDoMapa,
    pistas: pistasDoMapa,
  };
}

/** Tira do estado salvo o que é do mapa (um salvamento antigo podia trazer tokens soltos). */
function semOMapa(salvo: Partial<EstadoDaMesa>): Partial<RestoDaMesa> {
  const resto = { ...salvo };
  delete resto.mapa;
  delete resto.tokens;
  delete resto.props;
  delete resto.breu;
  delete resto.salas;
  delete resto.pois;
  delete resto.pistas;
  delete resto.comAlguem;
  return resto;
}

/** O que vai para `table_states`: campo a campo, para um campo novo no estado não ficar de fora. */
function restoDe(estado: EstadoDaMesa): RestoDaMesa {
  const { nevoa, rodada, combate = null, trilha, guia, escudo } = estado;
  return { nevoa, rodada, combate, trilha, guia, escudo };
}

/** Quem guarda cada pista no caso (`clue_holders`), já com título, texto e imagem para sobreviver à troca de mapa. */
export function lerPosseDasPistas(db: Banco, campanhaId: string): PistaComAlguem[] {
  return db
    .select({
      pistaId: clueHolders.clueId,
      personagemId: clueHolders.characterId,
      apresentada: clueHolders.apresentada,
      em: clueHolders.em,
      titulo: clues.titulo,
      texto: clues.texto,
      imagem: clues.imagem,
    })
    .from(clueHolders)
    .innerJoin(clues, eq(clues.id, clueHolders.clueId))
    .innerJoin(maps, eq(maps.id, clues.mapId))
    .where(eq(maps.campaignId, campanhaId))
    .orderBy(sql`"clue_holders"."rowid"`)
    .all();
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
  const descobertas = db
    .select({ poiId: poiDiscoveries.poiId, infoId: poiDiscoveries.infoId })
    .from(poiDiscoveries)
    .where(eq(poiDiscoveries.campaignId, campanhaId))
    .all();
  const desafiosSalvos = db
    .select({ poiId: poiChallenges.poiId, estado: poiChallenges.estado })
    .from(poiChallenges)
    .where(eq(poiChallenges.campaignId, campanhaId))
    .all();
  const infosPorPoi = new Map<string, Set<string>>();
  for (const d of descobertas) {
    const conjunto = infosPorPoi.get(d.poiId) ?? new Set<string>();
    conjunto.add(d.infoId);
    infosPorPoi.set(d.poiId, conjunto);
  }
  const desafioPorPoi = new Map(desafiosSalvos.map((d) => [d.poiId, d.estado]));
  const poisComEstado = (conteudo?.pois ?? []).map((p) => {
    const reveladas = infosPorPoi.get(p.id);
    const estadoDesafio = desafioPorPoi.get(p.id);
    return {
      ...p,
      ...(reveladas && {
        informacoes: p.informacoes.map((info) =>
          reveladas.has(info.id) ? { ...info, descoberta: true } : info,
        ),
      }),
      ...(estadoDesafio !== undefined && { estadoDesafio }),
    };
  });
  return {
    campanhaId,
    estado: {
      ...estadoVazioDaMesa(),
      ...(resto && semOMapa(resto.estado)),
      mapa: conteudo?.mapa ?? null,
      tokens: conteudo?.tokens ?? [],
      props: conteudo?.props ?? [],
      breu: conteudo?.breu ?? [],
      salas: conteudo?.salas ?? [],
      pois: poisComEstado,
      pistas: conteudo?.pistas ?? [],
      comAlguem: lerPosseDasPistas(db, campanhaId),
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

  tx.delete(pois).where(eq(pois.mapId, mapa.id)).run();
  tx.delete(rooms).where(eq(rooms.mapId, mapa.id)).run();
  if (estado.salas.length > 0) {
    tx.insert(rooms)
      .values(
        estado.salas.map((s) => ({
          id: s.id,
          mapId: mapa.id,
          nome: s.nome,
          area: s.area,
          notasMestre: s.notasMestre,
        })),
      )
      .run();
  }
  if (estado.pois.length > 0) {
    const idsDeSalas = new Set(estado.salas.map((s) => s.id));
    tx.insert(pois)
      .values(
        estado.pois.map((p) => ({
          id: p.id,
          mapId: mapa.id,
          roomId: p.salaId && idsDeSalas.has(p.salaId) ? p.salaId : null,
          numero: p.numero,
          nome: p.nome,
          descricao: p.descricao,
          x: p.x,
          y: p.y,
          pericias: p.pericias,
          informacoes: p.informacoes,
          desafio: p.desafio,
          contextoMestre: p.contextoMestre,
        })),
      )
      .run();
  }

  // Atualiza `clues` sem apagar as que continuam existindo: assim `ON DELETE CASCADE` só roda
  // para pistas realmente excluídas e não apaga `clue_holders` por acidente.
  if (estado.pistas.length === 0) {
    tx.delete(clues).where(eq(clues.mapId, mapa.id)).run();
  } else {
    const idsDePistas = estado.pistas.map((p) => p.id);
    tx.delete(clues)
      .where(and(eq(clues.mapId, mapa.id), notInArray(clues.id, idsDePistas)))
      .run();
    for (const p of estado.pistas) {
      tx.insert(clues)
        .values({
          id: p.id,
          mapId: mapa.id,
          titulo: p.titulo,
          texto: p.texto,
          imagem: p.imagem ?? null,
          tamanho: p.tamanho ?? 1,
          notaMestre: p.notaMestre,
          x: p.x,
          y: p.y,
          visivel: p.visivel,
          manterVisivel: p.manterVisivel ?? false,
          descoberta: p.descoberta,
        })
        .onConflictDoUpdate({
          target: clues.id,
          set: {
            mapId: mapa.id,
            titulo: p.titulo,
            texto: p.texto,
            imagem: p.imagem ?? null,
            tamanho: p.tamanho ?? 1,
            notaMestre: p.notaMestre,
            x: p.x,
            y: p.y,
            visivel: p.visivel,
            manterVisivel: p.manterVisivel ?? false,
            descoberta: p.descoberta,
          },
        })
        .run();
    }
  }
}

function escreverPosseDasPistas(
  tx: Transacao,
  campanhaId: string,
  comAlguem: readonly PistaComAlguem[],
) {
  const pistasDoCaso = new Set(
    tx
      .select({ id: clues.id })
      .from(clues)
      .innerJoin(maps, eq(maps.id, clues.mapId))
      .where(eq(maps.campaignId, campanhaId))
      .all()
      .map((c) => c.id),
  );
  if (pistasDoCaso.size === 0) return;
  const todasIds = [...pistasDoCaso];
  tx.delete(clueHolders).where(inArray(clueHolders.clueId, todasIds)).run();
  if (comAlguem.length === 0) return;
  const charIds = [...new Set(comAlguem.map((c) => c.personagemId))];
  const personagensExistentes = new Set(
    tx
      .select({ id: characters.id })
      .from(characters)
      .where(inArray(characters.id, charIds))
      .all()
      .map((c) => c.id),
  );
  const validas = comAlguem.filter(
    (c) => pistasDoCaso.has(c.pistaId) && personagensExistentes.has(c.personagemId),
  );
  if (validas.length > 0) {
    tx.insert(clueHolders)
      .values(
        validas.map((c) => ({
          clueId: c.pistaId,
          characterId: c.personagemId,
          apresentada: c.apresentada,
          em: c.em,
        })),
      )
      .run();
  }
}

/** Grava o mapa de saída antes de uma troca de mapa: o novo vai ser lido do banco. */
export function gravarMapa(db: Banco, estado: EstadoDaMesa) {
  db.transaction((tx) => {
    escreverMapa(tx, estado);
    if (estado.mapa) {
      const linha = tx
        .select({ campaignId: maps.campaignId })
        .from(maps)
        .where(eq(maps.id, estado.mapa.id))
        .get();
      if (linha) escreverPosseDasPistas(tx, linha.campaignId, estado.comAlguem);
    }
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
    escreverPosseDasPistas(tx, campanhaId, estado.comAlguem);
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

    for (const p of estado.pois) {
      for (const info of p.informacoes) {
        if (!info.descoberta) continue;
        tx.insert(poiDiscoveries)
          .values({ campaignId: campanhaId, poiId: p.id, infoId: info.id, em: agora })
          .onConflictDoNothing()
          .run();
      }
      if (p.estadoDesafio) {
        tx.insert(poiChallenges)
          .values({
            campaignId: campanhaId,
            poiId: p.id,
            estado: p.estadoDesafio,
            atualizadoEm: agora,
          })
          .onConflictDoUpdate({
            target: [poiChallenges.campaignId, poiChallenges.poiId],
            set: { estado: p.estadoDesafio, atualizadoEm: agora },
          })
          .run();
      }
    }
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

/** Se o caso limita a uma ação importante por rodada (`campaigns.rodadas`). */
export function casoUsaRodadas(db: Pick<Banco, 'select'>, campaignId: string): boolean {
  const linha = db
    .select({ rodadas: campaigns.rodadas })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .get();
  return linha?.rodadas ?? true;
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

/** Desconta ou soma PV/PD direto na ficha do personagem (ex.: Examinar −1 PD ou Arrombar −1 PV). */
export function ajustarRecursoDaFicha(
  db: Banco,
  personagemId: string,
  campo: 'pv' | 'pd',
  delta: number,
) {
  const linha = db
    .select({ ficha: characters.ficha })
    .from(characters)
    .where(eq(characters.id, personagemId))
    .get();
  if (!linha) return;
  const ficha = esquemaFichaOp2.parse(linha.ficha);
  const atual = ficha[campo];
  const proximo = Math.max(0, atual + delta);
  if (proximo === atual) return;
  const fichaNova: FichaOp2 = { ...ficha, [campo]: proximo };
  db.update(characters)
    .set({ ficha: fichaNova, atualizadoEm: new Date() })
    .where(eq(characters.id, personagemId))
    .run();
}
