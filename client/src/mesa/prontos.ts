// A arte pronta do app (props, modelos de NPC e mapas): ids no catálogo do shared, arquivos aqui
// no client (imagens-prontas.ts, gerado por design/prontos/gerar.mjs).
import { ehImagemPronta, urlDoArquivo } from '@membrana/shared';
import { IMAGENS_PRONTAS } from './imagens-prontas.ts';

/** Onde o navegador busca a imagem: o arquivo da arte pronta ou a rota de arquivos enviados. */
export function urlDaImagem(imagem: string): string {
  if (!ehImagemPronta(imagem)) return urlDoArquivo(imagem);
  // Todo id do catálogo tem arquivo (um teste confere); a reserva só evita quebrar a tela.
  return IMAGENS_PRONTAS[imagem] ?? urlDoArquivo(imagem);
}
