/// <reference types="node" />
// Lê do disco: o Vitest entrega CSS vazio para imports `?raw`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');
const ler = (caminho: string) => readFileSync(join(SRC, caminho), 'utf8');

const tokensCss = ler('styles/tokens.css');
const indexHtml = ler('../index.html');

// Todo arquivo de código e de estilo do client, como texto.
const fontes = Object.fromEntries(
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((arquivo) => arquivo.replaceAll('\\', '/'))
    .filter((arquivo) => /\.(css|ts|tsx)$/.test(arquivo))
    .map((arquivo) => [arquivo, ler(arquivo)]),
);

const HEX = /#[0-9a-f]{3,8}\b/i;

function token(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(tokensCss);
  if (!achado?.[1]) throw new Error(`Token --${nome} não encontrado em tokens.css`);
  return achado[1];
}

/** Luminância relativa, como no WCAG 2. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return ((claro ?? 0) + 0.05) / ((escuro ?? 0) + 0.05);
}

describe('tokens.css', () => {
  it('é o único arquivo do client com cores hexadecimais', () => {
    const comHex = Object.entries(fontes)
      .filter(([arquivo]) => !arquivo.endsWith('/tokens.css') && !arquivo.endsWith('.test.ts'))
      .filter(([, texto]) => HEX.test(texto.replace(/&#\d+;/g, '')))
      .map(([arquivo]) => arquivo);

    expect(comHex).toEqual([]);
  });

  it.each([
    ['text', 'bg'],
    ['muted', 'bg'],
    ['muted', 'panel'],
    ['muted', 'panel-2'],
    ['red-soft', 'bg'],
    ['ink', 'paper'],
  ])('--%s sobre --%s passa 4,5:1', (frente, fundo) => {
    expect(contraste(token(frente), token(fundo))).toBeGreaterThanOrEqual(4.5);
  });

  it('carrega as quatro fontes com font-display: swap', () => {
    for (const familia of ['Oranienbaum', 'Mulish', 'Special+Elite', 'Courier+Prime']) {
      expect(indexHtml).toContain(`family=${familia}`);
    }
    expect(indexHtml).toContain('display=swap');
  });
});
