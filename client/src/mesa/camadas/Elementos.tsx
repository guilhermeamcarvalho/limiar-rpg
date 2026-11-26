// Camadas que só mostram: salas (só o mestre recebe) e pistas. As ferramentas delas chegam na
// Fase 3. Tokens e props, que se arrastam, ficam em Tokens.tsx e Props.tsx.
import { memo } from 'react';
import { Circle, Group, Layer, Line, Text } from 'react-konva';
import type {
  PistaNaMesa,
  PistaParaJogador,
  PoiNaMesa,
  PoiParaJogador,
  SalaNaMesa,
} from '@membrana/shared';
import { cores } from '../cores.ts';

/* ---------- Salas (só o mestre recebe) ---------- */

export const CamadaDeSalas = memo(function CamadaDeSalas({ salas }: { salas: SalaNaMesa[] }) {
  const c = cores();
  if (salas.length === 0) return null;
  return (
    <Layer listening={false}>
      {salas.map((sala) => (
        <Group key={sala.id}>
          <Line
            points={sala.area.flatMap((p) => [p.x, p.y])}
            closed
            stroke={c['map-room']}
            strokeWidth={2}
            strokeScaleEnabled={false}
          />
          {sala.area[0] && (
            <Text
              x={sala.area[0].x + 8}
              y={sala.area[0].y + 8}
              text={sala.nome.toUpperCase()}
              fill={c.text}
              fontStyle="bold"
              fontSize={14}
            />
          )}
        </Group>
      ))}
    </Layer>
  );
});

/* ---------- Pistas ---------- */

export const CamadaDePistas = memo(function CamadaDePistas({
  pistas,
  celula,
}: {
  pistas: (PistaNaMesa | PistaParaJogador)[];
  celula: number;
}) {
  const c = cores();
  if (pistas.length === 0) return null;
  return (
    <Layer listening={false}>
      {pistas.map((pista) => {
        // Oculta: só o mestre recebe, e vê apagada.
        const oculta = 'visivel' in pista && !pista.visivel;
        return (
          <Circle
            key={pista.id}
            x={pista.x}
            y={pista.y}
            radius={celula * 0.3}
            fill={pista.descoberta ? c.gold : c.bg}
            stroke={c.gold}
            strokeWidth={2}
            strokeScaleEnabled={false}
            {...(!pista.descoberta && { dash: [6, 4] })}
            opacity={oculta ? 0.55 : 1}
          />
        );
      })}
    </Layer>
  );
});

/* ---------- Pontos de interesse (#83) ---------- */

function poiTudoDescoberto(poi: PoiNaMesa | PoiParaJogador): boolean {
  if ('tudoDescoberto' in poi) return poi.tudoDescoberto;
  return poi.informacoes.length > 0 && poi.informacoes.every((info) => info.descoberta === true);
}

export const CamadaDePois = memo(function CamadaDePois({
  pois,
  escala,
  bloqueado = false,
  aoAbrirPoi,
}: {
  pois: (PoiNaMesa | PoiParaJogador)[];
  escala: number;
  bloqueado?: boolean;
  aoAbrirPoi?: (poiId: string) => void;
}) {
  const c = cores();
  if (pois.length === 0) return null;
  const inv = 1 / Math.max(0.1, escala);
  const interativo = Boolean(!bloqueado && aoAbrirPoi);

  return (
    <Layer listening={interativo}>
      {pois.map((poi) => {
        const cor = poiTudoDescoberto(poi) ? c.green : c.red;
        return (
          <Group
            key={poi.id}
            x={poi.x}
            y={poi.y}
            scaleX={inv}
            scaleY={inv}
            listening={interativo}
            onClick={(e) => {
              if (!interativo) return;
              e.cancelBubble = true;
              aoAbrirPoi?.(poi.id);
            }}
            onTap={(e) => {
              if (!interativo) return;
              e.cancelBubble = true;
              aoAbrirPoi?.(poi.id);
            }}
          >
            <Circle radius={13} fill={cor} stroke={c.bg} strokeWidth={2} />
            <Text
              x={-13}
              y={-6}
              width={26}
              align="center"
              text={String(poi.numero)}
              fill={c.white}
              fontSize={12}
              fontStyle="bold"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
});
