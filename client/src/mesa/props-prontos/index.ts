// Os props prontos do app (RF-20): ilustrações vistas de cima, com transparência em volta. Vêm com
// o client (o Vite dá o endereço de cada arquivo); o servidor só guarda o id (`pronto:caixote`).
import { ehPropPronto, urlDoArquivo, type IdDePropPronto } from '@membrana/shared';
import caixote from './caixote.svg';
import contorno from './contorno.svg';
import mancha from './mancha.svg';
import papel from './papel.svg';
import radio from './radio.svg';

export const IMAGENS_DOS_PROPS_PRONTOS: Record<IdDePropPronto, string> = {
  'pronto:caixote': caixote,
  'pronto:contorno': contorno,
  'pronto:papel': papel,
  'pronto:mancha': mancha,
  'pronto:radio': radio,
};

/** Quantas células cada prop pronto ocupa ao ser posto na mesa (o mestre ajusta depois). */
export const TAMANHO_INICIAL: Record<IdDePropPronto, number> = {
  'pronto:caixote': 1,
  'pronto:contorno': 2,
  'pronto:papel': 1,
  'pronto:mancha': 1.5,
  'pronto:radio': 1,
};

/** Onde o navegador busca a imagem: o arquivo do prop pronto ou a rota de arquivos enviados. */
export function urlDaImagem(imagem: string): string {
  return ehPropPronto(imagem) ? IMAGENS_DOS_PROPS_PRONTOS[imagem] : urlDoArquivo(imagem);
}
