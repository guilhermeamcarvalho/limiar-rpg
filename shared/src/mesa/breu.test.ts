import { describe, expect, it } from 'vitest';
import type { AreaDoBreu, FormaDoBreu } from '../schemas/mesa.ts';
import { cobreOMapa, formaContem, sobBreu } from './breu.ts';

const quadrado: FormaDoBreu = { tipo: 'retangulo', x: 100, y: 100, largura: 200, altura: 100 };
/** Um "L": o canto de cima à direita fica de fora. */
const ele: FormaDoBreu = {
  tipo: 'poligono',
  pontos: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ],
};

describe('formaContem', () => {
  it('retângulo: dentro, na borda e fora', () => {
    expect(formaContem(quadrado, { x: 150, y: 150 })).toBe(true);
    expect(formaContem(quadrado, { x: 100, y: 100 })).toBe(true);
    expect(formaContem(quadrado, { x: 300, y: 200 })).toBe(true);
    expect(formaContem(quadrado, { x: 99, y: 150 })).toBe(false);
    expect(formaContem(quadrado, { x: 150, y: 201 })).toBe(false);
  });

  it('polígono côncavo: dentro do L e fora do recorte', () => {
    expect(formaContem(ele, { x: 50, y: 50 })).toBe(true);
    expect(formaContem(ele, { x: 150, y: 150 })).toBe(true);
    expect(formaContem(ele, { x: 150, y: 50 })).toBe(false);
    expect(formaContem(ele, { x: 250, y: 150 })).toBe(false);
  });

  it('polígono: vértice e borda contam como dentro', () => {
    expect(formaContem(ele, { x: 0, y: 0 })).toBe(true);
    expect(formaContem(ele, { x: 100, y: 50 })).toBe(true);
    expect(formaContem(ele, { x: 150, y: 100 })).toBe(true);
  });
});

describe('sobBreu', () => {
  const cobrir = (id: string, forma: FormaDoBreu): AreaDoBreu => ({ id, modo: 'cobrir', forma });
  const revelar = (id: string, forma: FormaDoBreu): AreaDoBreu => ({
    id,
    modo: 'revelar',
    forma,
  });
  const tudo: FormaDoBreu = { tipo: 'retangulo', x: 0, y: 0, largura: 1000, altura: 1000 };

  it('sem breu, tudo à vista', () => {
    expect(sobBreu([], { x: 10, y: 10 })).toBe(false);
  });

  it('a última área que contém o ponto decide', () => {
    const breu = [cobrir('n1', tudo), revelar('n2', quadrado)];
    expect(sobBreu(breu, { x: 150, y: 150 })).toBe(false);
    expect(sobBreu(breu, { x: 500, y: 500 })).toBe(true);
    expect(sobBreu([...breu, cobrir('n3', quadrado)], { x: 150, y: 150 })).toBe(true);
  });

  it('fora de todas as áreas, à vista', () => {
    expect(sobBreu([cobrir('n1', quadrado)], { x: 900, y: 900 })).toBe(false);
  });
});

describe('cobreOMapa', () => {
  const mapa = { largura: 300, altura: 200 };
  it('só o retângulo que pega os quatro cantos', () => {
    expect(cobreOMapa({ tipo: 'retangulo', x: 0, y: 0, largura: 300, altura: 200 }, mapa)).toBe(
      true,
    );
    expect(cobreOMapa({ tipo: 'retangulo', x: 0, y: 0, largura: 400, altura: 400 }, mapa)).toBe(
      true,
    );
    expect(cobreOMapa(quadrado, mapa)).toBe(false);
    const todo: FormaDoBreu = {
      tipo: 'poligono',
      pontos: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 200 },
        { x: 0, y: 200 },
      ],
    };
    expect(cobreOMapa(todo, mapa)).toBe(false);
  });
});
