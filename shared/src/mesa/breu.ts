// Breu: as áreas se empilham na ordem em que foram desenhadas. Para saber se um ponto está
// coberto, vale a última área que o contém: "cobrir" esconde, "revelar" mostra. Sem nenhuma, o
// ponto está à vista. O servidor usa para recusar movimento e para não mandar o que está no escuro;
// o cliente, para desenhar e avisar antes de mandar.
import type { AreaDoBreu, FormaDoBreu, Ponto } from '../schemas/mesa.ts';

/** Ponto dentro (ou na borda) da forma. */
export function formaContem(forma: FormaDoBreu, { x, y }: Ponto): boolean {
  if (forma.tipo === 'retangulo') {
    return (
      x >= forma.x && x <= forma.x + forma.largura && y >= forma.y && y <= forma.y + forma.altura
    );
  }
  // Raio para a direita: dentro se cruza a borda um número ímpar de vezes.
  const { pontos } = forma;
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const a = pontos[i];
    const b = pontos[j];
    if (!a || !b) continue;
    if (naBorda(a, b, x, y)) return true;
    const cruza = a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** O ponto está no segmento de `a` a `b`. */
function naBorda(a: Ponto, b: Ponto, x: number, y: number): boolean {
  const cruzado = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
  if (Math.abs(cruzado) > 1e-9) return false;
  return (
    x >= Math.min(a.x, b.x) &&
    x <= Math.max(a.x, b.x) &&
    y >= Math.min(a.y, b.y) &&
    y <= Math.max(a.y, b.y)
  );
}

/** O ponto está coberto pelo breu. */
export function sobBreu(breu: readonly AreaDoBreu[], ponto: Ponto): boolean {
  for (let i = breu.length - 1; i >= 0; i--) {
    const area = breu[i];
    if (area && formaContem(area.forma, ponto)) return area.modo === 'cobrir';
  }
  return false;
}

/**
 * A forma cobre o mapa inteiro. Assim "cobrir tudo" (e revelar tudo) troca a lista em vez de
 * empilhar: o que estava embaixo não conta mais.
 */
export function cobreOMapa(forma: FormaDoBreu, mapa: { largura: number; altura: number }): boolean {
  const cantos: Ponto[] = [
    { x: 0, y: 0 },
    { x: mapa.largura, y: 0 },
    { x: 0, y: mapa.altura },
    { x: mapa.largura, y: mapa.altura },
  ];
  // Um polígono pode conter os quatro cantos e ainda ter um entalhe; só o retângulo vale.
  return forma.tipo === 'retangulo' && cantos.every((c) => formaContem(forma, c));
}
