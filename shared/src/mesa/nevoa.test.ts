import { describe, expect, it } from 'vitest';
import type { AreaDaNevoa, FormaDaNevoa } from '../schemas/mesa.ts';
import { formaContem, sobNevoa } from './nevoa.ts';

const quadrado: FormaDaNevoa = { tipo: 'retangulo', x: 100, y: 100, largura: 200, altura: 100 };
/** Um "L": o canto de cima à direita fica de fora. */
const ele: FormaDaNevoa = {
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

describe('sobNevoa', () => {
  const cobrir = (id: string, forma: FormaDaNevoa): AreaDaNevoa => ({ id, modo: 'cobrir', forma });
  const revelar = (id: string, forma: FormaDaNevoa): AreaDaNevoa => ({
    id,
    modo: 'revelar',
    forma,
  });
  const tudo: FormaDaNevoa = { tipo: 'retangulo', x: 0, y: 0, largura: 1000, altura: 1000 };

  it('sem névoa, tudo à vista', () => {
    expect(sobNevoa([], { x: 10, y: 10 })).toBe(false);
  });

  it('a última área que contém o ponto decide', () => {
    const nevoa = [cobrir('n1', tudo), revelar('n2', quadrado)];
    expect(sobNevoa(nevoa, { x: 150, y: 150 })).toBe(false);
    expect(sobNevoa(nevoa, { x: 500, y: 500 })).toBe(true);
    expect(sobNevoa([...nevoa, cobrir('n3', quadrado)], { x: 150, y: 150 })).toBe(true);
  });

  it('fora de todas as áreas, à vista', () => {
    expect(sobNevoa([cobrir('n1', quadrado)], { x: 900, y: 900 })).toBe(false);
  });
});
