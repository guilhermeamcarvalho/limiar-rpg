// As cores do canvas vêm dos mesmos tokens do CSS (client/src/styles/tokens.css, carregado pelo
// main.tsx): o Konva desenha fora do CSS, então lê as variáveis uma vez. Cor nenhuma mora aqui.

const NOMES = [
  'map-floor',
  'map-wall',
  'map-room',
  'map-grid',
  'map-darkness',
  'red-a40',
  'red-hi',
  'red',
  'gold',
  'green',
  'npc',
  'av-red',
  'av-npc',
  'bg',
  'text',
  'white',
] as const;

export type NomeDaCor = (typeof NOMES)[number];

let lidas: Record<NomeDaCor, string> | null = null;

export function cores(): Record<NomeDaCor, string> {
  if (lidas) return lidas;
  const estilo = getComputedStyle(document.documentElement);
  const valores = Object.fromEntries(
    NOMES.map((nome) => [nome, estilo.getPropertyValue(`--${nome}`).trim()]),
  ) as Record<NomeDaCor, string>;
  // Só guarda quando os tokens já estão na página (sem eles, tenta de novo na próxima vez).
  if (valores.bg) lidas = valores;
  return valores;
}
