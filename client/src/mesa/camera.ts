// A câmera do palco: onde o mapa está e com que zoom. Pura, sem Konva: o palco só aplica.
// Um ponto do mapa (mx, my) aparece na tela em (x + mx * escala, y + my * escala).

export interface Camera {
  x: number;
  y: number;
  escala: number;
}

export interface Tamanho {
  largura: number;
  altura: number;
}

export interface Ponto {
  x: number;
  y: number;
}

export const ESCALA_MINIMA = 0.05;
export const ESCALA_MAXIMA = 4;
/** Cada passo da roda ou dos botões de zoom. */
export const PASSO_DO_ZOOM = 1.2;
/** Folga em volta do mapa ao enquadrar. */
const MARGEM = 24;

export const limitarEscala = (escala: number) =>
  Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, escala));

/** O mapa inteiro visível e centralizado no palco. */
export function enquadrar(mapa: Tamanho, palco: Tamanho): Camera {
  const util = {
    largura: Math.max(1, palco.largura - MARGEM * 2),
    altura: Math.max(1, palco.altura - MARGEM * 2),
  };
  const escala = limitarEscala(
    Math.min(util.largura / Math.max(1, mapa.largura), util.altura / Math.max(1, mapa.altura)),
  );
  return {
    escala,
    x: (palco.largura - mapa.largura * escala) / 2,
    y: (palco.altura - mapa.altura * escala) / 2,
  };
}

/** Zoom mantendo parado o ponto da tela sob o mouse (ou entre os dedos). */
export function zoomNoPonto(camera: Camera, escalaNova: number, pontoNaTela: Ponto): Camera {
  const escala = limitarEscala(escalaNova);
  const noMapa = paraOMapa(camera, pontoNaTela);
  return {
    escala,
    x: pontoNaTela.x - noMapa.x * escala,
    y: pontoNaTela.y - noMapa.y * escala,
  };
}

/** Centro da caixa envolvente de uma lista de pontos (ex.: área de uma sala). */
export function centroDaArea(area: readonly Ponto[]): Ponto | null {
  if (area.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of area) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** Ponto da tela → ponto do mapa. */
export function paraOMapa(camera: Camera, pontoNaTela: Ponto): Ponto {
  return {
    x: (pontoNaTela.x - camera.x) / camera.escala,
    y: (pontoNaTela.y - camera.y) / camera.escala,
  };
}

/** Põe o ponto do mapa no meio do palco, sem mudar o zoom. */
export function centralizarEm(camera: Camera, pontoNoMapa: Ponto, palco: Tamanho): Camera {
  return {
    escala: camera.escala,
    x: palco.largura / 2 - pontoNoMapa.x * camera.escala,
    y: palco.altura / 2 - pontoNoMapa.y * camera.escala,
  };
}

export function arrastar(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
const meio = (a: Ponto, b: Ponto): Ponto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Pinça com dois dedos: o zoom acompanha a abertura dos dedos e o mapa acompanha o ponto entre
 * eles (assim os dois dedos também arrastam).
 */
export function pinca(camera: Camera, antes: [Ponto, Ponto], agora: [Ponto, Ponto]): Camera {
  const abertura = distancia(...agora) / Math.max(1, distancia(...antes));
  const centroAntes = meio(...antes);
  const centroAgora = meio(...agora);
  const comZoom = zoomNoPonto(camera, camera.escala * abertura, centroAntes);
  return arrastar(comZoom, centroAgora.x - centroAntes.x, centroAgora.y - centroAntes.y);
}
