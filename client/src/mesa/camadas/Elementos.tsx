// Camadas do que fica sobre o mapa: props, salas (só o mestre), pistas e tokens. Por enquanto só
// mostram; arrastar e editar chegam com as ferramentas de cada um (tokens no #65, props no #67).
import { memo } from 'react';
import { Circle, Group, Image, Layer, Line, Text } from 'react-konva';
import type {
  PistaNaMesa,
  PistaParaJogador,
  PropNaMesa,
  SalaNaMesa,
  TokenNaMesa,
} from '@membrana/shared';
import { iniciais } from '../../casos/formatos.ts';
import { cores } from '../cores.ts';
import { useImagem } from '../useImagem.ts';

/* ---------- Props ---------- */

function PropKonva({ prop, celula }: { prop: PropNaMesa; celula: number }) {
  const imagem = useImagem(prop.imagem);
  if (!imagem) return null;
  const largura = prop.tamanho * celula;
  const altura = (largura * imagem.height) / Math.max(1, imagem.width);
  return (
    <Image
      image={imagem}
      x={prop.x}
      y={prop.y}
      width={largura}
      height={altura}
      offsetX={largura / 2}
      offsetY={altura / 2}
      rotation={prop.rotacao}
      perfectDrawEnabled={false}
    />
  );
}

export const CamadaDeProps = memo(function CamadaDeProps({
  props,
  celula,
}: {
  props: PropNaMesa[];
  celula: number;
}) {
  if (props.length === 0) return null;
  return (
    <Layer listening={false}>
      {props.map((p) => (
        <PropKonva key={p.id} prop={p} celula={celula} />
      ))}
    </Layer>
  );
});

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

/* ---------- Tokens ---------- */

function TokenKonva({
  token,
  celula,
  meu,
  posicao,
}: {
  token: TokenNaMesa;
  celula: number;
  meu: boolean;
  posicao: { x: number; y: number };
}) {
  const imagem = useImagem(token.imagem);
  const c = cores();
  const npc = token.personagemId === null;
  const raio = Math.max(4, (token.tamanho * celula) / 2 - 3);
  const anel = meu ? c['red-hi'] : npc ? c.npc : c.red;
  const lado = imagem ? Math.min(imagem.width, imagem.height) : 1;
  const escala = (raio * 2) / Math.max(1, lado);
  const fonte = Math.max(8, raio * 0.6);

  return (
    <Group x={posicao.x} y={posicao.y} opacity={token.oculto ? 0.5 : 1}>
      <Circle
        radius={raio}
        {...(imagem
          ? {
              fillPatternImage: imagem,
              fillPatternRepeat: 'no-repeat',
              fillPatternScale: { x: escala, y: escala },
              fillPatternOffset: { x: imagem.width / 2, y: imagem.height / 2 },
            }
          : { fill: npc ? c['av-npc'] : c['av-red'] })}
        stroke={anel}
        strokeWidth={meu ? 4 : 3}
        strokeScaleEnabled={false}
        // Oculto: o mestre vê com o contorno dourado tracejado.
        {...(token.oculto && { dash: [6, 4], stroke: c.gold })}
        perfectDrawEnabled={false}
      />
      {!imagem && (
        <Text
          text={iniciais(token.nome)}
          width={raio * 2}
          offsetX={raio}
          y={-fonte / 2}
          align="center"
          fontSize={fonte}
          fontStyle="bold"
          fill={c.white}
        />
      )}
    </Group>
  );
}

export const CamadaDeTokens = memo(function CamadaDeTokens({
  tokens,
  celula,
  meuId,
  arrastando,
}: {
  tokens: TokenNaMesa[];
  celula: number;
  meuId: string;
  arrastando: Record<string, { x: number; y: number }>;
}) {
  if (tokens.length === 0) return null;
  return (
    <Layer listening={false}>
      {tokens.map((t) => (
        <TokenKonva
          key={t.id}
          token={t}
          celula={celula}
          meu={t.donoId === meuId}
          posicao={arrastando[t.id] ?? t}
        />
      ))}
    </Layer>
  );
});
