// Camadas visuais das ferramentas de mesa (#79): régua local de medição e pulsos de "marcar ponto".
import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Circle, Group, Label, Layer, Line, Tag, Text } from 'react-konva';
import { cores } from '../cores.ts';
import { formatarMedicao, type Medicao, type PulsoNoMapa } from '../medicao.ts';

function PulsoAnimado({
  pulso,
  escala,
  autor,
}: {
  pulso: PulsoNoMapa;
  escala: number;
  autor: string | undefined;
}) {
  const anelExterno = useRef<Konva.Circle>(null);
  const c = cores();
  const inv = 1 / Math.max(0.1, escala);

  useEffect(() => {
    const no = anelExterno.current;
    const camada = no?.getLayer();
    if (!no || !camada) return;
    const anim = new Konva.Animation((quadro) => {
      const ciclo = (quadro.time % 900) / 900;
      no.scaleX(1 + ciclo * 1.4);
      no.scaleY(1 + ciclo * 1.4);
      no.opacity(1 - ciclo * 0.85);
    }, camada);
    anim.start();
    return () => {
      anim.stop();
    };
  }, []);

  return (
    <Group x={pulso.x} y={pulso.y} scaleX={inv} scaleY={inv} listening={false}>
      <Circle ref={anelExterno} radius={16} stroke={c.gold} strokeWidth={2.5} listening={false} />
      <Circle
        radius={10}
        stroke={c['red-hi']}
        strokeWidth={2}
        fill="rgba(194, 65, 43, 0.28)"
        listening={false}
      />
      <Circle radius={4} fill={c['red-hi']} listening={false} />
      {autor && (
        <Label y={-22} listening={false}>
          <Tag
            fill={c.bg}
            stroke={c['red-hi']}
            strokeWidth={1}
            cornerRadius={4}
            pointerDirection="down"
            pointerWidth={6}
            pointerHeight={4}
          />
          <Text text={autor} fontSize={11} fontStyle="bold" fill={c.text} padding={4} />
        </Label>
      )}
    </Group>
  );
}

export function CamadaDeMedicao({
  medicao,
  celula,
  escala,
}: {
  medicao: Medicao | null;
  celula: number;
  escala: number;
}) {
  const c = cores();
  if (!medicao) return null;

  const { origem, destino } = medicao;
  const inv = 1 / Math.max(0.1, escala);
  const texto = formatarMedicao(origem, destino, celula);
  const meioX = (origem.x + destino.x) / 2;
  const meioY = (origem.y + destino.y) / 2;

  return (
    <Layer listening={false}>
      <Line
        points={[origem.x, origem.y, destino.x, destino.y]}
        stroke={c.gold}
        strokeWidth={2.5 * inv}
        dash={[8 * inv, 6 * inv]}
        lineCap="round"
        listening={false}
      />
      <Circle radius={4 * inv} x={origem.x} y={origem.y} fill={c.gold} listening={false} />
      <Circle radius={4 * inv} x={destino.x} y={destino.y} fill={c.gold} listening={false} />
      <Label x={meioX} y={meioY - 12 * inv} scaleX={inv} scaleY={inv} listening={false}>
        <Tag
          fill={c.bg}
          stroke={c.gold}
          strokeWidth={1}
          cornerRadius={4}
          pointerDirection="down"
          pointerWidth={8}
          pointerHeight={5}
        />
        <Text text={texto} fontSize={12} fontStyle="bold" fill={c.text} padding={5} />
      </Label>
    </Layer>
  );
}

export function CamadaDePulsos({
  pulsos,
  escala,
  nomes,
}: {
  pulsos: readonly PulsoNoMapa[];
  escala: number;
  nomes: Readonly<Record<string, string>>;
}) {
  if (pulsos.length === 0) return null;

  return (
    <Layer listening={false}>
      {pulsos.map((pulso) => (
        <PulsoAnimado key={pulso.seq} pulso={pulso} escala={escala} autor={nomes[pulso.autorId]} />
      ))}
    </Layer>
  );
}
