// GET /api/arquivos/:nome: entrega uma imagem enviada só a quem tem a ver com ela. Foto e token de
// personagem: vê o dono ou quem está num caso onde ele aparece. Mapa, token e prop da mesa: vê quem
// é do caso, inclusive o que ainda só está na mesa em memória. Para quem é de fora, 404, como se o
// arquivo não existisse.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { characters, maps, memberships, props, tokens } from '../../db/schema.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi } from '../erros.ts';
import { campanhasDo } from '../personagens/dados.ts';
import { NOME_DE_ARQUIVO } from './imagens.ts';

const ARQUIVO_NAO_ENCONTRADO = new ErroDaApi(
  404,
  'ARQUIVO_NAO_ENCONTRADO',
  'Não encontramos esta imagem.',
);

/** O nome é o hash do conteúdo: o arquivo nunca muda, então o navegador guarda por um ano. */
export const CACHE_DOS_ARQUIVOS = 'private, max-age=31536000, immutable';

/** Os casos onde o arquivo aparece como mapa, token ou prop: no banco ou na mesa em memória. */
function casosDaMesa(app: FastifyInstance, nome: string): string[] {
  const doMapa = app.db
    .select({ caso: maps.campaignId })
    .from(maps)
    .where(eq(maps.imagem, nome))
    .all();
  const deToken = app.db
    .select({ caso: maps.campaignId })
    .from(tokens)
    .innerJoin(maps, eq(maps.id, tokens.mapId))
    .where(eq(tokens.imagem, nome))
    .all();
  const deProp = app.db
    .select({ caso: maps.campaignId })
    .from(props)
    .innerJoin(maps, eq(maps.id, props.mapId))
    .where(eq(props.imagem, nome))
    .all();
  return [...doMapa, ...deToken, ...deProp].map((l) => l.caso).concat(app.mesas.casosQueUsam(nome));
}

/** Quem pode ver o arquivo: o dono de um personagem que o usa, ou alguém de um caso onde ele está. */
function podeVerArquivo(app: FastifyInstance, userId: string, nome: string): boolean {
  const usam = app.db
    .select()
    .from(characters)
    .where(or(eq(characters.foto, nome), eq(characters.tokenImg, nome)))
    .all();
  if (usam.some((p) => p.ownerId === userId)) return true;
  const casos = [
    ...new Set([...usam.flatMap((p) => campanhasDo(app.db, p)), ...casosDaMesa(app, nome)]),
  ];
  if (casos.length === 0) return false;
  const membro = app.db
    .select({ campaignId: memberships.campaignId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), inArray(memberships.campaignId, casos)))
    .get();
  return membro !== undefined;
}

export function rotasDeArquivos(app: FastifyInstance) {
  app.get<{ Params: { nome: string } }>('/arquivos/:nome', async (request, reply) => {
    const { nome } = request.params;
    if (!NOME_DE_ARQUIVO.test(nome)) throw ARQUIVO_NAO_ENCONTRADO;
    if (!podeVerArquivo(app, usuarioLogado(request).id, nome)) throw ARQUIVO_NAO_ENCONTRADO;

    let conteudo: Buffer;
    try {
      conteudo = await readFile(join(app.config.UPLOADS_DIR, nome));
    } catch {
      throw ARQUIVO_NAO_ENCONTRADO;
    }
    return reply.header('cache-control', CACHE_DOS_ARQUIVOS).type('image/webp').send(conteudo);
  });
}
