// Rolagem livre de dados na mesa (`dice.roll` / `/r 2d6+1`): analisa expressões simples como
// `d20`, `2d6+1` ou `3d8-2`, recusa o que fugir dos limites com mensagem clara em português e rola
// com o sorteio injetado (`Rng`).
import { ErroDeRegra, rolarFaces, type Rng } from './dados.ts';

export const MAX_DADOS_LIVRES = 20;
export const MIN_FACES_LIVRES = 2;
export const MAX_FACES_LIVRES = 100;
export const MAX_MODIFICADOR_LIVRE = 99;

const PADRAO_DE_EXPRESSAO = /^\s*(\d+)?\s*[dD]\s*(\d+)\s*(?:([+\-\u2212])\s*(\d+))?\s*$/;

export interface ExpressaoDeDados {
  /** A expressão limpa, como `d20`, `2d6+1` ou `3d8-2`. */
  expressao: string;
  quantidade: number;
  faces: number;
  modificador: number;
}

export interface ResultadoDeRolagemLivre extends ExpressaoDeDados {
  dados: number[];
  total: number;
}

const EXPRESSAO_INVALIDA = 'Expressão inválida. Use algo como d20, 2d6 ou 2d6+1.';

/** Lê e valida uma expressão simples de dados (`d20`, `2d6+1`, `3d8-2`). */
export function lerExpressaoDeDados(texto: string): ExpressaoDeDados {
  const partes = PADRAO_DE_EXPRESSAO.exec(texto);
  if (!partes) throw new ErroDeRegra('expressao', EXPRESSAO_INVALIDA);

  const [, qtdBruta, facesBruta = '', sinal, modBruto] = partes;
  const quantidade = qtdBruta === undefined ? 1 : Number(qtdBruta);
  const faces = Number(facesBruta);
  const valorMod = modBruto === undefined ? 0 : Number(modBruto);

  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_DADOS_LIVRES) {
    throw new ErroDeRegra('expressao', `Role de 1 a ${String(MAX_DADOS_LIVRES)} dados por vez.`);
  }
  if (!Number.isInteger(faces) || faces < MIN_FACES_LIVRES || faces > MAX_FACES_LIVRES) {
    throw new ErroDeRegra(
      'expressao',
      `O dado precisa ter entre ${String(MIN_FACES_LIVRES)} e ${String(MAX_FACES_LIVRES)} lados.`,
    );
  }
  if (!Number.isInteger(valorMod) || valorMod > MAX_MODIFICADOR_LIVRE) {
    throw new ErroDeRegra(
      'expressao',
      `O modificador vai de -${String(MAX_MODIFICADOR_LIVRE)} a +${String(MAX_MODIFICADOR_LIVRE)}.`,
    );
  }

  const modificador = sinal === '-' || sinal === '\u2212' ? -valorMod : valorMod;
  const prefixo = qtdBruta === undefined ? '' : String(quantidade);
  const sufixo =
    modificador > 0
      ? `+${String(modificador)}`
      : modificador < 0
        ? `-${String(Math.abs(modificador))}`
        : '';

  return {
    expressao: `${prefixo}d${String(faces)}${sufixo}`,
    quantidade,
    faces,
    modificador,
  };
}

/** Valida a expressão e rola cada dado com `rng`. */
export function rolarExpressao(texto: string, rng: Rng): ResultadoDeRolagemLivre {
  const lida = lerExpressaoDeDados(texto);
  const dados = Array.from({ length: lida.quantidade }, () => rolarFaces(lida.faces, rng));
  const soma = dados.reduce((acc, v) => acc + v, 0);
  return { ...lida, dados, total: soma + lida.modificador };
}
