// Regras compartilhadas de alcance para interagir com pistas visíveis no mapa (#88, RF-43).
import type { Ponto } from '../schemas/mesa.ts';

/** O token precisa estar a até 1 célula da pista para guardá-la (#88). */
export const ALCANCE_DE_PISTA_EM_CELULAS = 1;

/**
 * Confere se o token está perto o suficiente da pista (até 1 célula na grade, contando
 * vizinhança ortogonal e diagonal, além da borda de tokens maiores que 1×1).
 */
export function pertoDaPista(
  token: { x: number; y: number; tamanho?: number },
  pista: Ponto,
  celula: number,
): boolean {
  if (celula <= 0) return false;
  const tamanho = Math.max(1, token.tamanho ?? 1);
  const alcance = celula * (ALCANCE_DE_PISTA_EM_CELULAS + (tamanho - 1) * 0.5);
  return Math.max(Math.abs(token.x - pista.x), Math.abs(token.y - pista.y)) <= alcance;
}
