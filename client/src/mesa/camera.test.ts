import { describe, expect, it } from 'vitest';
import {
  arrastar,
  centralizarEm,
  enquadrar,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  paraOMapa,
  pinca,
  zoomNoPonto,
} from './camera.ts';

describe('câmera', () => {
  it('enquadrar: o mapa inteiro cabe e fica centralizado', () => {
    const camera = enquadrar({ largura: 4096, altura: 2048 }, { largura: 1048, altura: 800 });
    // 1000 px úteis de largura para 4096 px de mapa.
    expect(camera.escala).toBeCloseTo(1000 / 4096);
    expect(camera.x).toBeCloseTo(24);
    expect(camera.y).toBeCloseTo((800 - 2048 * camera.escala) / 2);
  });

  it('zoom no ponto: o ponto sob o mouse não sai do lugar', () => {
    const camera = { x: 100, y: 50, escala: 0.5 };
    const tela = { x: 400, y: 300 };
    const antes = paraOMapa(camera, tela);
    const depois = zoomNoPonto(camera, 1.5, tela);
    expect(depois.escala).toBe(1.5);
    const agora = paraOMapa(depois, tela);
    expect(agora.x).toBeCloseTo(antes.x);
    expect(agora.y).toBeCloseTo(antes.y);
  });

  it('o zoom tem limite nos dois sentidos', () => {
    const camera = { x: 0, y: 0, escala: 1 };
    expect(zoomNoPonto(camera, 100, { x: 0, y: 0 }).escala).toBe(ESCALA_MAXIMA);
    expect(zoomNoPonto(camera, 0, { x: 0, y: 0 }).escala).toBe(ESCALA_MINIMA);
    expect(enquadrar({ largura: 1, altura: 1 }, { largura: 5000, altura: 5000 }).escala).toBe(
      ESCALA_MAXIMA,
    );
  });

  it('centralizar no meu token: o ponto vai para o meio do palco, sem mudar o zoom', () => {
    const camera = centralizarEm(
      { x: 0, y: 0, escala: 2 },
      { x: 300, y: 200 },
      {
        largura: 800,
        altura: 600,
      },
    );
    expect(camera).toEqual({ escala: 2, x: 400 - 600, y: 300 - 400 });
  });

  it('pinça: abrir os dedos aproxima no ponto entre eles; mover os dois arrasta', () => {
    const camera = { x: 0, y: 0, escala: 1 };
    const aberta = pinca(
      camera,
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 50, y: 100 },
        { x: 250, y: 100 },
      ],
    );
    expect(aberta.escala).toBe(2);
    // O meio (150, 100) continua sobre o mesmo ponto do mapa.
    expect(paraOMapa(aberta, { x: 150, y: 100 })).toEqual({ x: 150, y: 100 });

    const arrastada = pinca(
      camera,
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 130, y: 140 },
        { x: 230, y: 140 },
      ],
    );
    expect(arrastada).toEqual(arrastar(camera, 30, 40));
  });
});
