// Envia uma imagem da mesa (a de um token ou a de um prop) e devolve o nome do arquivo, que vai no
// comando em seguida (`token.create`, `token.update`, `prop.create`).
import { LIMITE_DA_IMAGEM, type UsoDeImagemDaMesa } from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';

export type EnvioDeImagem =
  { ok: true; nome: string } | { ok: false; titulo: string; texto: string };

export async function enviarImagemDaMesa(
  campanhaId: string,
  arquivo: File,
  uso: UsoDeImagemDaMesa,
): Promise<EnvioDeImagem> {
  if (!arquivo.type.startsWith('image/')) {
    return { ok: false, titulo: 'Isso não é uma imagem', texto: 'Use um JPG, PNG ou WebP.' };
  }
  if (arquivo.size > LIMITE_DA_IMAGEM) {
    return {
      ok: false,
      titulo: 'Imagem grande demais',
      texto: 'A imagem passa de 5 MB. Diminua o tamanho e tente de novo.',
    };
  }
  const corpo = new FormData();
  corpo.append('uso', uso);
  corpo.append('arquivo', arquivo);
  try {
    const { nome } = await pedir<{ nome: string }>(
      `/api/campanhas/${encodeURIComponent(campanhaId)}/imagens`,
      { method: 'POST', body: corpo },
    );
    return { ok: true, nome };
  } catch (erro) {
    return {
      ok: false,
      titulo: 'Não deu para enviar a imagem',
      texto: erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.',
    };
  }
}

/** "retrato-do-vulto.png" → "retrato-do-vulto" (o nome do token criado pela imagem). */
export function nomeDoArquivoSemExtensao(arquivo: string, reserva = 'Token'): string {
  return (
    arquivo
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 60) || reserva
  );
}
