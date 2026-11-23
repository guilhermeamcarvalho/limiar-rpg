// Consultas de personagem. As rotas decidem permissão com shared/permissoes.ts; aqui se lê, grava,
// valida a ficha e limpa os arquivos.
import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import {
  esquemaDaFicha,
  migrarFicha,
  podeEditarFicha,
  podeVerFicha,
  type CampanhaComMembros,
  type FichaOp2,
  type Personagem,
  type Quem,
} from '@membrana/shared';
import type { Banco } from '../../db/index.ts';
import { campaigns, characters, gameSystems, memberships } from '../../db/schema.ts';
import { membrosDe } from '../campanhas/dados.ts';
import { ErroDaApi, type ErrosPorCampo } from '../erros.ts';

/** 404, e não 403, para quem não tem nada com o personagem: nem fica sabendo que ele existe. */
export const PERSONAGEM_NAO_ENCONTRADO = new ErroDaApi(
  404,
  'PERSONAGEM_NAO_ENCONTRADO',
  'Não encontramos este personagem.',
);

export type TipoDeSistema = 'op2' | 'inventado';

/**
 * Valida a ficha com o schema do sistema. Ficha errada é 422, com cada campo como `ficha.pv`,
 * para a tela marcar o lugar certo.
 */
export function validarFicha(tipo: TipoDeSistema, ficha: unknown): FichaOp2 {
  const esquema = esquemaDaFicha(tipo);
  if (!esquema) {
    throw new ErroDaApi(
      422,
      'SISTEMA_SEM_FICHA',
      'Este sistema ainda não tem ficha. Por enquanto, só Ordem Paranormal II.',
    );
  }
  const resultado = esquema.safeParse(ficha);
  if (resultado.success) return resultado.data;
  const campos: ErrosPorCampo = {};
  for (const problema of resultado.error.issues) {
    const campo = ['ficha', ...problema.path].join('.');
    campos[campo] ??= problema.message;
  }
  throw new ErroDaApi(422, 'FICHA_INVALIDA', 'A ficha tem campos inválidos.', campos);
}

/** O personagem com o tipo do sistema, ou 404. */
export function carregar(db: Banco, id: string) {
  const linha = db
    .select({ personagem: characters, tipo: gameSystems.tipo })
    .from(characters)
    .innerJoin(gameSystems, eq(gameSystems.id, characters.systemId))
    .where(eq(characters.id, id))
    .get();
  if (!linha) throw PERSONAGEM_NAO_ENCONTRADO;
  return linha;
}

export type LinhaDePersonagem = ReturnType<typeof carregar>;

/** Para a resposta: a ficha guardada passa de novo pelo schema (validada também na saída). */
export function paraApi({ personagem: p, tipo }: LinhaDePersonagem): Personagem {
  if (tipo !== 'op2') throw new Error(`Sistema sem ficha: ${tipo}`);
  return {
    id: p.id,
    donoId: p.ownerId,
    campanhaId: p.campaignId,
    sistemaId: p.systemId,
    ficha: migrarFicha(p.ficha),
    foto: p.foto,
    tokenImg: p.tokenImg,
    criadoEm: p.criadoEm.toISOString(),
    atualizadoEm: p.atualizadoEm.toISOString(),
  };
}

export function listarDoDono(db: Banco, donoId: string): Personagem[] {
  return db
    .select({ personagem: characters, tipo: gameSystems.tipo })
    .from(characters)
    .innerJoin(gameSystems, eq(gameSystems.id, characters.systemId))
    .where(eq(characters.ownerId, donoId))
    .orderBy(characters.criadoEm)
    .all()
    .map(paraApi);
}

/**
 * O que quem pediu pode fazer com o personagem. `conhece` diz se ele pode saber que o personagem
 * existe: o dono e quem está no mesmo caso. Sem caso, só o dono.
 */
export function acessoAo(db: Banco, quem: Quem, { personagem }: LinhaDePersonagem) {
  const ehDono = quem?.id === personagem.ownerId;
  if (ehDono) return { conhece: true, podeVer: true, podeEditar: true, ehDono };
  if (!personagem.campaignId) {
    return { conhece: false, podeVer: false, podeEditar: false, ehDono };
  }

  const campanha = db
    .select({ fichasVisiveis: campaigns.fichasVisiveis })
    .from(campaigns)
    .where(eq(campaigns.id, personagem.campaignId))
    .get();
  const comMembros: CampanhaComMembros = {
    id: personagem.campaignId,
    membros: membrosDe(db, personagem.campaignId),
    fichasVisiveis: campanha?.fichasVisiveis ?? false,
  };
  const minimo = { donoId: personagem.ownerId, campanhaId: personagem.campaignId };
  return {
    conhece: comMembros.membros.some((m) => m.userId === quem?.id),
    podeVer: podeVerFicha(quem, minimo, comMembros),
    podeEditar: podeEditarFicha(quem, minimo, comMembros),
    ehDono,
  };
}

/** Os casos onde o personagem aparece: o dele e onde alguém o escolheu para jogar. */
export function campanhasDo(
  db: Pick<Banco, 'select'>,
  personagem: LinhaDePersonagem['personagem'],
) {
  const ids = new Set<string>();
  if (personagem.campaignId) ids.add(personagem.campaignId);
  const emUso = db
    .select({ campaignId: memberships.campaignId })
    .from(memberships)
    .where(eq(memberships.characterId, personagem.id))
    .all();
  for (const { campaignId } of emUso) ids.add(campaignId);
  return [...ids];
}

/**
 * Apaga do disco a foto e o token de um personagem removido. O nome é o hash do conteúdo, então a
 * mesma imagem pode servir a outro personagem: essa fica. Só o nome do arquivo é usado (nada de
 * `../`), e arquivo que já não existe não é erro.
 */
export async function apagarArquivos(
  db: Banco,
  pasta: string,
  removido: Pick<LinhaDePersonagem['personagem'], 'id' | 'foto' | 'tokenImg'>,
) {
  const nomes = [removido.foto, removido.tokenImg].filter((n): n is string => Boolean(n));
  if (nomes.length === 0) return;
  const emUso = db
    .select({ foto: characters.foto, tokenImg: characters.tokenImg })
    .from(characters)
    .where(
      and(
        ne(characters.id, removido.id),
        or(inArray(characters.foto, nomes), inArray(characters.tokenImg, nomes)),
      ),
    )
    .all()
    .flatMap((c) => [c.foto, c.tokenImg]);
  const livres = [...new Set(nomes)].filter((n) => !emUso.includes(n));
  await Promise.all(livres.map((n) => rm(join(pasta, basename(n)), { force: true })));
}
