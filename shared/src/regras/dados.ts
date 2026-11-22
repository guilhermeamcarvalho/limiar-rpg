// Dados e sorteio, comuns a qualquer sistema. O sorteio é sempre injetado (`Rng`): o servidor usa
// o criptográfico, os testes usam uma semente fixa e o mesmo sorteio dá sempre o mesmo resultado.
import type { DADOS } from '../sistemas.ts';

export type Dado = (typeof DADOS)[number];

/** Faces de cada dado: d10 → 10. */
export function faces(dado: Dado): number {
  return Number(dado.slice(1));
}

/** Devolve um número em [0, 1), como Math.random. */
export type Rng = () => number;

/** Rola um dado: de 1 até o número de faces. */
export function rolar(dado: Dado, rng: Rng): number {
  return 1 + Math.floor(rng() * faces(dado));
}

/** Sorteio previsível (mulberry32): a mesma semente dá sempre a mesma sequência. Para testes. */
export function rngComSemente(semente: number): Rng {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O pedaço do Web Crypto que existe no navegador e no Node (o shared não carrega os tipos deles). */
interface WebCrypto {
  getRandomValues(array: Uint32Array): Uint32Array;
}

/** Sorteio criptográfico (crypto.getRandomValues), igual no navegador e no Node. */
export function rngCripto(): Rng {
  const { crypto } = globalThis as unknown as { crypto: WebCrypto };
  const buffer = new Uint32Array(1);
  return () => {
    const [valor] = crypto.getRandomValues(buffer);
    // O array tem sempre um elemento: o tipo é que não sabe disso.
    return (valor as number) / 4294967296;
  };
}

/**
 * Uma regra recusou o pedido. `campo` diz onde, no formato da API ("valores.1", "d4"), para a
 * tela mostrar a mensagem no lugar certo.
 */
export class ErroDeRegra extends Error {
  override name = 'ErroDeRegra';
  readonly campo: string;

  constructor(campo: string, mensagem: string) {
    super(mensagem);
    this.campo = campo;
  }
}
