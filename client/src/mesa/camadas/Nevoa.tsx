// Camada da névoa (RF-23). As áreas se desenham na ordem: "cobrir" pinta, "revelar" apaga o que
// estava embaixo nesta camada. O jogador vê preto; o mestre vê através, hachurado em vermelho.
import { memo, useMemo } from 'react';
import { Layer, Line, Rect } from 'react-konva';
import type { AreaDaNevoa, FormaDaNevoa, MapaNaMesa } from '@membrana/shared';
import { cores } from '../cores.ts';

/** Ladrilho de listras diagonais, repetido sobre a névoa na visão do mestre. */
function criarHachura(cor: string): HTMLCanvasElement | null {
  const lado = 12;
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, lado);
  ctx.lineTo(lado, 0);
  ctx.moveTo(-lado / 2, lado / 2);
  ctx.lineTo(lado / 2, -lado / 2);
  ctx.moveTo(lado / 2, lado * 1.5);
  ctx.lineTo(lado * 1.5, lado / 2);
  ctx.stroke();
  return canvas;
}

function Forma({ forma, revelar, cor }: { forma: FormaDaNevoa; revelar: boolean; cor: string }) {
  const comum = {
    fill: cor,
    globalCompositeOperation: revelar ? ('destination-out' as const) : ('source-over' as const),
    perfectDrawEnabled: false,
  };
  if (forma.tipo === 'retangulo') {
    return <Rect x={forma.x} y={forma.y} width={forma.largura} height={forma.altura} {...comum} />;
  }
  return <Line points={forma.pontos.flatMap((p) => [p.x, p.y])} closed {...comum} />;
}

export const CamadaDaNevoa = memo(function CamadaDaNevoa({
  nevoa,
  mapa,
  mestre,
}: {
  nevoa: AreaDaNevoa[];
  mapa: MapaNaMesa;
  mestre: boolean;
}) {
  const c = cores();
  const hachura = useMemo(() => (mestre ? criarHachura(c['red-a40']) : null), [mestre, c]);
  if (nevoa.length === 0) return null;
  return (
    <Layer listening={false} opacity={mestre ? 0.55 : 1}>
      {nevoa.map((area) => (
        <Forma
          key={area.id}
          forma={area.forma}
          revelar={area.modo === 'revelar'}
          cor={c['map-fog']}
        />
      ))}
      {hachura && (
        <Rect
          width={mapa.largura}
          height={mapa.altura}
          fillPatternImage={hachura as unknown as HTMLImageElement}
          globalCompositeOperation="source-atop"
          perfectDrawEnabled={false}
        />
      )}
    </Layer>
  );
});
