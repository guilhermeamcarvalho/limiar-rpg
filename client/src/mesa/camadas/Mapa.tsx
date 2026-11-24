// Camada do mapa: a imagem e a grade. Estática: não escuta clique e só redesenha quando o mapa ou
// a grade mudam. A grade é um caminho só (um traço para todas as linhas), barato até no celular.
import { memo } from 'react';
import { Image, Layer, Rect, Shape } from 'react-konva';
import type { MapaNaMesa } from '@membrana/shared';
import { cores } from '../cores.ts';
import { useImagem } from '../useImagem.ts';

/** As linhas da grade: de `inicio` até `fim`, de `passo` em `passo`. */
export function linhasDaGrade(inicio: number, passo: number, fim: number): number[] {
  if (passo <= 0) return [];
  const linhas: number[] = [];
  for (let p = ((inicio % passo) + passo) % passo; p <= fim; p += passo) linhas.push(p);
  return linhas;
}

export const CamadaDoMapa = memo(function CamadaDoMapa({ mapa }: { mapa: MapaNaMesa }) {
  const imagem = useImagem(mapa.imagem);
  const c = cores();
  const { largura, altura, grade } = mapa;
  const colunas = linhasDaGrade(grade.deslocamentoX, grade.celula, largura);
  const linhas = linhasDaGrade(grade.deslocamentoY, grade.celula, altura);

  return (
    <Layer listening={false}>
      <Rect
        width={largura}
        height={altura}
        fill={c['map-floor']}
        stroke={c['map-wall']}
        strokeWidth={6}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
      />
      {imagem && (
        <Image image={imagem} width={largura} height={altura} perfectDrawEnabled={false} />
      )}
      <Shape
        stroke={c['map-grid']}
        strokeWidth={1}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
        sceneFunc={(ctx, forma) => {
          ctx.beginPath();
          for (const x of colunas) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, altura);
          }
          for (const y of linhas) {
            ctx.moveTo(0, y);
            ctx.lineTo(largura, y);
          }
          ctx.strokeShape(forma);
        }}
      />
    </Layer>
  );
});
