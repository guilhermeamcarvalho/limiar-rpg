// Camadas que só mostram: salas (só o mestre recebe) e pistas. As ferramentas delas chegam na
// Fase 3. Tokens e props, que se arrastam, ficam em Tokens.tsx e Props.tsx.
import { memo } from 'react';
import { Circle, Group, Image, Layer, Line, Path, Rect, Text } from 'react-konva';
import type {
  PistaNaMesa,
  PistaParaJogador,
  PoiNaMesa,
  PoiParaJogador,
  SalaNaMesa,
} from '@membrana/shared';
import { cores } from '../cores.ts';
import { useImagem } from '../useImagem.ts';

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
            strokeWidth={1}
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

/* ---------- Pistas (#87, #88; artboards 10 e 11) ---------- */

const CAMINHO_ICONE_PISTA = 'M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h5';

function MarcadorDePista({
  pista,
  interativo,
  arrastavel,
  aoAbrirPista,
  aoMoverPista,
}: {
  pista: PistaNaMesa | PistaParaJogador;
  interativo: boolean;
  arrastavel: boolean;
  aoAbrirPista?: ((pistaId: string) => void) | undefined;
  aoMoverPista?: ((pistaId: string, ponto: { x: number; y: number }) => void) | undefined;
}) {
  const c = cores();
  const oculta = 'visivel' in pista && !pista.visivel;
  const anexo = 'imagem' in pista ? (pista.imagem ?? null) : null;
  const foto = useImagem(anexo);
  const tamanho = pista.tamanho ?? 1;

  return (
    <Group
      x={pista.x}
      y={pista.y}
      scaleX={tamanho}
      scaleY={tamanho}
      opacity={oculta ? 0.55 : 1}
      draggable={arrastavel}
      listening={interativo || arrastavel}
      onDragEnd={(e) => {
        if (!arrastavel) return;
        aoMoverPista?.(pista.id, { x: e.target.x(), y: e.target.y() });
      }}
      onClick={(e) => {
        if (!interativo) return;
        e.cancelBubble = true;
        aoAbrirPista?.(pista.id);
      }}
      onTap={(e) => {
        if (!interativo) return;
        e.cancelBubble = true;
        aoAbrirPista?.(pista.id);
      }}
    >
      {foto ? (
        <>
          <Image
            x={-18}
            y={-13.5}
            width={36}
            height={27}
            image={foto}
            shadowColor={c.black}
            shadowBlur={4}
            shadowOffsetY={2}
            shadowOpacity={0.45}
          />
          <Rect
            x={-18}
            y={-13.5}
            width={36}
            height={27}
            stroke={oculta ? c.gold : c.paper}
            strokeWidth={1}
            {...(oculta && { dash: [4, 3] })}
            listening={false}
          />
        </>
      ) : (
        <>
          {oculta && (
            <Rect
              x={-14}
              y={-16}
              width={28}
              height={32}
              stroke={c.gold}
              strokeWidth={1}
              dash={[4, 3]}
              listening={false}
            />
          )}
          <Rect
            x={-13}
            y={-15}
            width={26}
            height={30}
            fill={c.paper}
            shadowColor={c.black}
            shadowBlur={4}
            shadowOffsetY={2}
            shadowOpacity={0.45}
          />
          <Path
            x={-7.5}
            y={-7.5}
            scaleX={15 / 24}
            scaleY={15 / 24}
            data={CAMINHO_ICONE_PISTA}
            stroke={c.ink}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

export const CamadaDePistas = memo(function CamadaDePistas({
  pistas,
  mestre = false,
  bloqueado = false,
  aoAbrirPista,
  aoMoverPista,
}: {
  pistas: (PistaNaMesa | PistaParaJogador)[];
  mestre?: boolean;
  bloqueado?: boolean;
  aoAbrirPista?: (pistaId: string) => void;
  aoMoverPista?: (pistaId: string, ponto: { x: number; y: number }) => void;
}) {
  if (pistas.length === 0) return null;
  const interativo = Boolean(!bloqueado && aoAbrirPista);
  const arrastavel = Boolean(mestre && !bloqueado && aoMoverPista);
  return (
    <Layer listening={interativo || arrastavel}>
      {pistas.map((pista) => (
        <MarcadorDePista
          key={pista.id}
          pista={pista}
          interativo={interativo}
          arrastavel={arrastavel}
          aoAbrirPista={aoAbrirPista}
          aoMoverPista={aoMoverPista}
        />
      ))}
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
  mestre = false,
  bloqueado = false,
  aoAbrirPoi,
  aoMoverPoi,
}: {
  pois: (PoiNaMesa | PoiParaJogador)[];
  escala: number;
  mestre?: boolean;
  bloqueado?: boolean;
  aoAbrirPoi?: (poiId: string) => void;
  aoMoverPoi?: (poiId: string, ponto: { x: number; y: number }) => void;
}) {
  const c = cores();
  if (pois.length === 0) return null;
  const inv = 1 / Math.max(0.1, escala);
  const interativo = Boolean(!bloqueado && aoAbrirPoi);
  const arrastavel = Boolean(mestre && !bloqueado && aoMoverPoi);

  return (
    <Layer listening={interativo || arrastavel}>
      {pois.map((poi) => {
        const cor = poiTudoDescoberto(poi) ? c.green : c.red;
        return (
          <Group
            key={poi.id}
            x={poi.x}
            y={poi.y}
            scaleX={inv}
            scaleY={inv}
            draggable={arrastavel}
            listening={interativo || arrastavel}
            onDragEnd={(e) => {
              if (!arrastavel) return;
              aoMoverPoi?.(poi.id, { x: e.target.x(), y: e.target.y() });
            }}
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
            <Circle radius={13} fill={cor} stroke={c.bg} strokeWidth={1} />
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
