// Camadas que só mostram: salas (só o mestre recebe) e pistas. As ferramentas delas chegam na
// Fase 3. Tokens e props, que se arrastam, ficam em Tokens.tsx e Props.tsx.
import { memo } from 'react';
import { Circle, Group, Layer, Line, Text } from 'react-konva';
import type { PistaNaMesa, PistaParaJogador, SalaNaMesa } from '@membrana/shared';
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
