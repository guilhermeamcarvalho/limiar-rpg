// Lê um envio multipart: no máximo um arquivo e alguns campos de texto. Os limites do plugin (em
// index.ts) valem para todos; quem precisa de outro limite de arquivo (o mapa) passa o seu.
import type { FastifyRequest } from 'fastify';
import { ErroDaApi } from '../erros.ts';

export interface Envio {
  arquivo: Buffer | null;
  /** Como o arquivo se chamava no computador de quem enviou. */
  nomeOriginal: string | null;
  campos: Record<string, string>;
}

export async function lerMultipart(
  request: FastifyRequest,
  { tamanhoMaximo, grandeDemais }: { tamanhoMaximo?: number; grandeDemais: ErroDaApi },
): Promise<Envio> {
  const campos: Record<string, string> = {};
  let arquivo: Buffer | null = null;
  let nomeOriginal: string | null = null;
  try {
    const partes = request.parts(
      tamanhoMaximo === undefined ? undefined : { limits: { fileSize: tamanhoMaximo } },
    );
    for await (const parte of partes) {
      if (parte.type === 'file') {
        arquivo = await parte.toBuffer();
        nomeOriginal = parte.filename || null;
      } else {
        campos[parte.fieldname] = String(parte.value);
      }
    }
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === 'FST_REQ_FILE_TOO_LARGE') throw grandeDemais;
    if (codigo === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      throw new ErroDaApi(415, 'TIPO_NAO_ACEITO', 'Envie a imagem como formulário (multipart).');
    }
    if (
      codigo === 'FST_FILES_LIMIT' ||
      codigo === 'FST_FIELDS_LIMIT' ||
      codigo === 'FST_PARTS_LIMIT'
    ) {
      throw new ErroDaApi(413, 'ENVIO_GRANDE', 'Envie uma imagem por vez.');
    }
    throw e;
  }
  return { arquivo, nomeOriginal, campos };
}
