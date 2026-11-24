import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAPAS_PRONTOS, NPCS_PRONTOS, PROPS_PRONTOS, urlDoArquivo } from '@membrana/shared';
import { IMAGENS_PRONTAS } from './imagens-prontas.ts';
import { filtrarProntos } from './painel/SeletorDePronto.tsx';
import { urlDaImagem } from './prontos.ts';

const PASTA = import.meta.dirname;
const imagens = (pasta: string) =>
  readdirSync(join(PASTA, pasta))
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/.webp$/, ''))
    .sort();

/** Largura e altura de um WebP, lidas do cabeçalho (VP8, VP8L ou VP8X). */
function medidasDoWebp(arquivo: Buffer): { largura: number; altura: number } {
  expect(arquivo.toString('ascii', 0, 4)).toBe('RIFF');
  expect(arquivo.toString('ascii', 8, 12)).toBe('WEBP');
  const tipo = arquivo.toString('ascii', 12, 16);
  if (tipo === 'VP8X') {
    return { largura: 1 + arquivo.readUIntLE(24, 3), altura: 1 + arquivo.readUIntLE(27, 3) };
  }
  if (tipo === 'VP8L') {
    const bits = arquivo.readUInt32LE(21);
    return { largura: 1 + (bits & 0x3fff), altura: 1 + ((bits >> 14) & 0x3fff) };
  }
  expect(tipo).toBe('VP8 ');
  return { largura: arquivo.readUInt16LE(26) & 0x3fff, altura: arquivo.readUInt16LE(28) & 0x3fff };
}

describe('arte pronta: catálogo e arquivos', () => {
  it('todo id do catálogo tem imagem, e toda imagem está no catálogo', () => {
    const ids = [...PROPS_PRONTOS, ...NPCS_PRONTOS, ...MAPAS_PRONTOS].map((i) => i.id).sort();
    expect(Object.keys(IMAGENS_PRONTAS).sort()).toEqual(ids);
    expect(imagens('props-prontos')).toEqual(PROPS_PRONTOS.map((p) => p.id.slice(7)).sort());
    expect(imagens('npcs-prontos')).toEqual(NPCS_PRONTOS.map((n) => n.id.slice(4)).sort());
    expect(imagens('mapas-prontos')).toEqual(MAPAS_PRONTOS.map((m) => m.id.slice(5)).sort());
  });

  it('a imagem de cada mapa tem o tamanho do catálogo (a grade bate com as salas)', () => {
    for (const m of MAPAS_PRONTOS) {
      const arquivo = readFileSync(join(PASTA, 'mapas-prontos', `${m.id.slice(5)}.webp`));
      expect(medidasDoWebp(arquivo), m.id).toEqual({ largura: m.largura, altura: m.altura });
    }
  });

  it('os retratos de NPC são quadrados e os props não passam de 1024 px', () => {
    for (const n of NPCS_PRONTOS) {
      const { largura, altura } = medidasDoWebp(
        readFileSync(join(PASTA, 'npcs-prontos', `${n.id.slice(4)}.webp`)),
      );
      expect(largura, n.id).toBe(altura);
    }
    for (const p of PROPS_PRONTOS) {
      const { largura, altura } = medidasDoWebp(
        readFileSync(join(PASTA, 'props-prontos', `${p.id.slice(7)}.webp`)),
      );
      expect(Math.max(largura, altura), p.id).toBeLessThanOrEqual(1024);
    }
  });

  it('urlDaImagem: o arquivo da arte pronta ou a rota de arquivos enviados', () => {
    expect(urlDaImagem('npc:cultista')).toBe(IMAGENS_PRONTAS['npc:cultista']);
    expect(urlDaImagem('mapa:radio')).toContain('radio');
    const enviado = `${'a'.repeat(64)}.webp`;
    expect(urlDaImagem(enviado)).toBe(urlDoArquivo(enviado));
  });
});

describe('filtrarProntos', () => {
  it('busca pelo nome sem ligar para acento e maiúscula; filtra pela categoria', () => {
    expect(filtrarProntos(PROPS_PRONTOS, 'CRANIO', null).map((p) => p.nome)).toEqual(['Crânio']);
    expect(filtrarProntos(PROPS_PRONTOS, 'mesa', null).map((p) => p.nome)).toEqual([
      'Mesa',
      'Mesa redonda',
    ]);
    const hospital = filtrarProntos(PROPS_PRONTOS, '', 'Hospital');
    expect(hospital.length).toBeGreaterThan(0);
    expect(hospital.every((p) => p.categoria === 'Hospital')).toBe(true);
    expect(filtrarProntos(NPCS_PRONTOS, 'sangue', 'Criaturas').map((n) => n.nome)).toEqual([
      'Zumbi de Sangue',
      'Abominação de Sangue',
    ]);
    expect(filtrarProntos(PROPS_PRONTOS, 'piano', null)).toEqual([]);
  });
});
