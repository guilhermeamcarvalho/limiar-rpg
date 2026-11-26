// Regras puras das ferramentas de mesa (#79): medição de distância (1 quadrado = 1,5 m) e pulsos.
import type { Ponto } from './camera.ts';

/** Cada quadrado da grade equivale a 1,5 m (RF-15). */
export const METROS_POR_QUADRADO = 1.5;

/** Quanto tempo um pulso de "marcar ponto" fica visível no mapa para todos. */
export const DURACAO_DO_PULSO_MS = 2400;

export type ModoDoPalco = 'mover' | 'medir' | 'marcar';

export interface Medicao {
  origem: Ponto;
  destino: Ponto;
}

export interface PulsoNoMapa {
  seq: number;
  autorId: string;
  x: number;
  y: number;
}

function formatarNumero(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  return Number.isInteger(arredondado)
    ? String(arredondado)
    : arredondado.toFixed(1).replace('.', ',');
}

/** Distância em pixels, quadrados da grade e metros (1 quadrado = 1,5 m). */
export function medirDistancia(
  origem: Ponto,
  destino: Ponto,
  celula: number,
): { pixels: number; quadrados: number; metros: number } {
  const pixels = Math.hypot(destino.x - origem.x, destino.y - origem.y);
  const quadrados = celula > 0 ? pixels / celula : 0;
  return { pixels, quadrados, metros: quadrados * METROS_POR_QUADRADO };
}

/** Texto exibido sobre a régua: sempre em quadrados e metros (RF-38). */
export function formatarMedicao(origem: Ponto, destino: Ponto, celula: number): string {
  const { quadrados, metros } = medirDistancia(origem, destino, celula);
  const q = Math.round(quadrados * 10) / 10;
  const unidade = q === 1 ? 'quadrado' : 'quadrados';
  return `${formatarNumero(q)} ${unidade} · ${formatarNumero(metros)} m`;
}
