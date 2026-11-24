// Envio de imagens. Registrado com o prefixo /api; todas as rotas exigem login.
//   POST   /api/personagens/:id/imagem          foto ou token do personagem (multipart, até 5 MB)
//   DELETE /api/personagens/:id/imagem/:tipo    tira a foto ou o token
//   GET    /api/arquivos/:nome                  entrega a imagem a quem é do caso (arquivos.ts)
//   GET    /api/campanhas/:id/mapas              os mapas do caso (mestre; mapa.ts)
//   POST   /api/campanhas/:id/mapas              envia um mapa (multipart, até 20 MB)
//   POST   /api/campanhas/:id/mapas/prontos      põe um mapa pronto do site no caso
//   DELETE /api/campanhas/:id/mapas/:mapaId      apaga um mapa que não está na mesa
//   POST   /api/campanhas/:id/imagens            imagem de token solta sobre o mapa (RF-24)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import multipart from '@fastify/multipart';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  esquemaRecorte,
  LIMITE_DA_IMAGEM,
  TIPOS_DE_IMAGEM,
  type TipoDeImagem,
} from '@membrana/shared';
import { characters } from '../../db/schema.ts';
import { exigirLogin, usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi, validar } from '../erros.ts';
import {
  acessoAo,
  avisarMesa,
  campanhasDo,
  carregar,
  paraApi,
  PERSONAGEM_NAO_ENCONTRADO,
} from '../personagens/dados.ts';
import { rotasDeArquivos } from './arquivos.ts';
import { apagarSeLivre, converterImagem, salvarImagem } from './imagens.ts';
import { rotasDeMapas } from './mapa.ts';
import { lerMultipart } from './multipart.ts';

const COLUNA = { foto: 'foto', token: 'tokenImg' } as const satisfies Record<
  TipoDeImagem,
  'foto' | 'tokenImg'
>;

/** Os campos de texto que vêm junto do arquivo. */
const esquemaDoEnvio = z
  .object({
    tipo: z.enum(TIPOS_DE_IMAGEM, { error: 'Diga se é a foto ou o token.' }),
    /** JSON com o quadrado do token (`Recorte`). Sem ele, o token sai do centro. */
    recorte: z
      .string()
      .max(200)
      .transform((texto, ctx) => {
        try {
          return esquemaRecorte.parse(JSON.parse(texto));
        } catch {
          ctx.addIssue({ code: 'custom', message: 'O recorte do token veio estragado.' });
          return z.NEVER;
        }
      })
      .optional(),
    /** "sim": o token sai da foto que o personagem já tem ("Usar a foto"). */
    usarFoto: z.literal('sim').optional(),
  })
  .strict();

const MB = Math.round(LIMITE_DA_IMAGEM / (1024 * 1024));

const IMAGEM_GRANDE = new ErroDaApi(
  413,
  'IMAGEM_GRANDE',
  `A imagem passa de ${String(MB)} MB. Diminua o tamanho e tente de novo.`,
);

/** Lê o multipart: um arquivo (opcional, com "Usar a foto") e os campos de texto. */
async function lerEnvio(request: FastifyRequest) {
  const { arquivo, campos } = await lerMultipart(request, { grandeDemais: IMAGEM_GRANDE });
  return { arquivo, ...validar(esquemaDoEnvio, campos) };
}

/** O personagem, se quem pediu pode trocar as imagens dele (o dono ou o mestre do caso). */
function paraTrocar(app: FastifyInstance, request: FastifyRequest<{ Params: { id: string } }>) {
  const linha = carregar(app.db, request.params.id);
  const acesso = acessoAo(app.db, usuarioLogado(request), linha);
  if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
  if (!acesso.podeEditar) {
    throw new ErroDaApi(
      403,
      'SO_O_DONO_OU_MESTRE',
      'Só quem joga com este personagem ou o mestre do caso pode trocar a foto e o token.',
    );
  }
  return linha;
}

/** Grava a imagem nova (ou nenhuma) no personagem, apaga a antiga se ficou sem uso e avisa a mesa. */
async function trocarImagem(
  app: FastifyInstance,
  linha: ReturnType<typeof carregar>,
  tipo: TipoDeImagem,
  nome: string | null,
) {
  const coluna = COLUNA[tipo];
  const antiga = linha.personagem[coluna];
  app.db
    .update(characters)
    .set({ [coluna]: nome, atualizadoEm: new Date() })
    .where(eq(characters.id, linha.personagem.id))
    .run();
  if (antiga !== nome) {
    await apagarSeLivre(app.db, app.config.UPLOADS_DIR, antiga, (n) => app.mesas.usaArquivo(n));
  }
  avisarMesa(app, campanhasDo(app.db, linha.personagem), linha.personagem.id);
  return { personagem: paraApi(carregar(app.db, linha.personagem.id)) };
}

export const rotas: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', exigirLogin);
  await app.register(multipart, {
    limits: { fileSize: LIMITE_DA_IMAGEM, files: 1, fields: 5, parts: 6 },
  });

  app.post<{ Params: { id: string } }>('/personagens/:id/imagem', async (request) => {
    const linha = paraTrocar(app, request);
    const envio = await lerEnvio(request);

    let entrada = envio.arquivo;
    if (!entrada && envio.usarFoto && envio.tipo === 'token') {
      const foto = linha.personagem.foto;
      if (!foto) {
        throw new ErroDaApi(422, 'SEM_FOTO', 'Envie uma foto antes de usá-la para o token.');
      }
      entrada = await readFile(join(app.config.UPLOADS_DIR, foto)).catch(() => {
        throw new ErroDaApi(422, 'SEM_FOTO', 'A foto não está mais no servidor. Envie de novo.');
      });
    }
    if (!entrada || entrada.length === 0) {
      throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
        arquivo: 'Escolha uma imagem.',
      });
    }

    const imagem = await converterImagem(entrada, envio.tipo, envio.recorte);
    const nome = await salvarImagem(app.config.UPLOADS_DIR, imagem);
    return trocarImagem(app, linha, envio.tipo, nome);
  });

  app.delete<{ Params: { id: string; tipo: string } }>(
    '/personagens/:id/imagem/:tipo',
    async (request) => {
      const linha = paraTrocar(app, request);
      const { tipo } = validar(
        z.object({ tipo: z.enum(TIPOS_DE_IMAGEM, { error: 'Diga se é a foto ou o token.' }) }),
        { tipo: request.params.tipo },
      );
      return trocarImagem(app, linha, tipo, null);
    },
  );

  rotasDeMapas(app);
  rotasDeArquivos(app);
};
