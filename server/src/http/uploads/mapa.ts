// Mapas do caso (RF-14), enviados ou prontos, e as imagens da mesa (token, RF-24; prop, RF-20).
// Registradas pelo plugin de uploads (index.ts), com o prefixo /api e login exigido.
// Trocar o mapa da mesa não passa por aqui: é o comando `map.activate`, para todos ao mesmo tempo.
import { basename, extname } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ehMapaPronto,
  GRADE_PADRAO,
  MAPAS_PRONTOS,
  LIMITE_DA_IMAGEM,
  LIMITE_DO_MAPA_ENVIADO,
  podeConduzirMesa,
  USOS_DE_IMAGEM_DA_MESA,
  type MapaDoCaso,
} from '@membrana/shared';
import { maps, props, tokens } from '../../db/schema.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { campanhaVisivel } from '../campanhas/dados.ts';
import { ErroDaApi, validar } from '../erros.ts';
import {
  apagarSeLivre,
  converterImagem,
  converterMapa,
  converterProp,
  salvarImagem,
} from './imagens.ts';
import { lerMultipart } from './multipart.ts';

type PedidoDoCaso = FastifyRequest<{ Params: { id: string } }>;

const MB = (bytes: number) => String(Math.round(bytes / (1024 * 1024)));

/** O texto do aviso do artboard Componentes. */
const MAPA_GRANDE = new ErroDaApi(
  413,
  'MAPA_GRANDE',
  `Mapa acima de ${MB(LIMITE_DO_MAPA_ENVIADO)} MB. Reduza para 4096 px.`,
);
const IMAGEM_GRANDE = new ErroDaApi(
  413,
  'IMAGEM_GRANDE',
  `A imagem passa de ${MB(LIMITE_DA_IMAGEM)} MB. Diminua o tamanho e tente de novo.`,
);
const SO_O_MESTRE = new ErroDaApi(
  403,
  'SO_O_MESTRE',
  'Só o mestre deste caso pode mexer nos mapas.',
);
const MAPA_NAO_ENCONTRADO = new ErroDaApi(404, 'MAPA_NAO_ENCONTRADO', 'Não encontramos este mapa.');
const SEM_ARQUIVO = new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
  arquivo: 'Escolha uma imagem.',
});

const esquemaDoMapa = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, { error: 'Dê um nome ao mapa.' })
      .max(60, { error: 'No máximo 60 caracteres.' })
      .optional(),
  })
  .strict();

const esquemaDoMapaPronto = z
  .object({ id: z.string({ error: 'Escolha um dos mapas prontos.' }).max(60) })
  .strict();

const esquemaDaImagem = z
  .object({ uso: z.enum(USOS_DE_IMAGEM_DA_MESA, { error: 'Diga para que é a imagem.' }) })
  .strict();

/** "porao-da-radio.jpg" → "porao-da-radio". Sem nome, "Mapa sem nome". */
function nomeDoArquivo(original: string | null): string {
  const nome = original ? basename(original, extname(original)).trim().slice(0, 60) : '';
  return nome || 'Mapa sem nome';
}

/** O caso, se quem pediu participa dele (senão, 404). */
function casoDe(app: FastifyInstance, request: PedidoDoCaso) {
  const usuario = usuarioLogado(request);
  const { comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
  return { usuario, comMembros };
}

function exigirMestre(app: FastifyInstance, request: PedidoDoCaso) {
  const { usuario, comMembros } = casoDe(app, request);
  if (!podeConduzirMesa(usuario, comMembros)) throw SO_O_MESTRE;
}

/** O mapa que está na mesa agora: o da mesa em memória vale mais que o banco (salvo até 1 s depois). */
function idDoMapaNaMesa(app: FastifyInstance, campanhaId: string): string | null | undefined {
  const mesa = app.mesas.existente(campanhaId);
  return mesa ? (mesa.estado.mapa?.id ?? null) : undefined;
}

function paraApi(linha: typeof maps.$inferSelect, naMesa: string | null | undefined): MapaDoCaso {
  return {
    id: linha.id,
    nome: linha.nome,
    imagem: linha.imagem,
    largura: linha.largura,
    altura: linha.altura,
    grade: linha.grade,
    ativo: naMesa === undefined ? linha.ativo : naMesa === linha.id,
    criadoEm: linha.criadoEm.toISOString(),
  };
}

export function rotasDeMapas(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/campanhas/:id/mapas', (request) => {
    exigirMestre(app, request);
    const campanhaId = request.params.id;
    const naMesa = idDoMapaNaMesa(app, campanhaId);
    const linhas = app.db
      .select()
      .from(maps)
      .where(eq(maps.campaignId, campanhaId))
      .orderBy(desc(maps.criadoEm), desc(maps.id))
      .all();
    return { mapas: linhas.map((l) => paraApi(l, naMesa)) };
  });

  // Mapa pronto do site (RF-14): entra no caso com a grade que bate com o desenho. Usar o mesmo
  // pronto de novo devolve o que o caso já tem (com os tokens, props e breu dele).
  app.post<{ Params: { id: string } }>('/campanhas/:id/mapas/prontos', (request, reply) => {
    exigirMestre(app, request);
    const { id } = validar(esquemaDoMapaPronto, request.body ?? {});
    const pronto = ehMapaPronto(id) ? MAPAS_PRONTOS.find((m) => m.id === id) : undefined;
    if (!pronto) {
      throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
        id: 'Escolha um dos mapas prontos.',
      });
    }
    const campanhaId = request.params.id;
    const naMesa = idDoMapaNaMesa(app, campanhaId);
    const existente = app.db
      .select()
      .from(maps)
      .where(and(eq(maps.campaignId, campanhaId), eq(maps.imagem, pronto.id)))
      .get();
    if (existente) return reply.status(200).send({ mapa: paraApi(existente, naMesa) });
    const linha = app.db
      .insert(maps)
      .values({
        campaignId: campanhaId,
        nome: pronto.nome,
        imagem: pronto.id,
        largura: pronto.largura,
        altura: pronto.altura,
        grade: { ...GRADE_PADRAO, celula: pronto.celula },
      })
      .returning()
      .get();
    return reply.status(201).send({ mapa: paraApi(linha, naMesa) });
  });

  app.post<{ Params: { id: string } }>('/campanhas/:id/mapas', async (request, reply) => {
    exigirMestre(app, request);
    const envio = await lerMultipart(request, {
      tamanhoMaximo: LIMITE_DO_MAPA_ENVIADO,
      grandeDemais: MAPA_GRANDE,
    });
    const { nome } = validar(esquemaDoMapa, envio.campos);
    if (!envio.arquivo || envio.arquivo.length === 0) throw SEM_ARQUIVO;

    const { imagem, largura, altura } = await converterMapa(envio.arquivo);
    const arquivo = await salvarImagem(app.config.UPLOADS_DIR, imagem);
    const linha = app.db
      .insert(maps)
      .values({
        campaignId: request.params.id,
        nome: nome ?? nomeDoArquivo(envio.nomeOriginal),
        imagem: arquivo,
        largura,
        altura,
        grade: GRADE_PADRAO,
      })
      .returning()
      .get();
    return reply.status(201).send({ mapa: paraApi(linha, idDoMapaNaMesa(app, request.params.id)) });
  });

  app.delete<{ Params: { id: string; mapaId: string } }>(
    '/campanhas/:id/mapas/:mapaId',
    async (request, reply) => {
      exigirMestre(app, request);
      const { id: campanhaId, mapaId } = request.params;
      const linha = app.db
        .select()
        .from(maps)
        .where(and(eq(maps.id, mapaId), eq(maps.campaignId, campanhaId)))
        .get();
      if (!linha) throw MAPA_NAO_ENCONTRADO;
      const naMesa = idDoMapaNaMesa(app, campanhaId);
      if (naMesa === undefined ? linha.ativo : naMesa === linha.id) {
        throw new ErroDaApi(
          409,
          'MAPA_NA_MESA',
          'Este mapa está na mesa. Troque de mapa antes de apagá-lo.',
        );
      }

      // Tokens e props saem junto (cascata no banco); as imagens, se nada mais usar.
      const imagens = new Set([
        linha.imagem,
        ...app.db
          .select({ imagem: tokens.imagem })
          .from(tokens)
          .where(eq(tokens.mapId, mapaId))
          .all()
          .flatMap((t) => (t.imagem ? [t.imagem] : [])),
        ...app.db
          .select({ imagem: props.imagem })
          .from(props)
          .where(eq(props.mapId, mapaId))
          .all()
          .map((p) => p.imagem),
      ]);
      app.db.delete(maps).where(eq(maps.id, mapaId)).run();
      for (const imagem of imagens) {
        await apagarSeLivre(app.db, app.config.UPLOADS_DIR, imagem, (n) => app.mesas.usaArquivo(n));
      }
      return reply.status(204).send();
    },
  );

  // Imagens da mesa. Token (RF-24): quem soltou manda em seguida o `token.create` (mestre) ou o
  // `token.update` do próprio token (jogador). Prop (RF-20): só o mestre; depois, o `prop.create`.
  app.post<{ Params: { id: string } }>('/campanhas/:id/imagens', async (request, reply) => {
    const { usuario, comMembros } = casoDe(app, request);
    const envio = await lerMultipart(request, { grandeDemais: IMAGEM_GRANDE });
    const { uso } = validar(esquemaDaImagem, envio.campos);
    if (uso === 'prop' && !podeConduzirMesa(usuario, comMembros)) {
      throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre põe props na mesa.');
    }
    if (!envio.arquivo || envio.arquivo.length === 0) throw SEM_ARQUIVO;
    const imagem =
      uso === 'prop'
        ? await converterProp(envio.arquivo)
        : await converterImagem(envio.arquivo, 'token');
    const nome = await salvarImagem(app.config.UPLOADS_DIR, imagem);
    return reply.status(201).send({ nome });
  });
}
