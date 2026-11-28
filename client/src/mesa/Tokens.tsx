// Camada dos tokens (RF-16 a RF-18). O jogador arrasta o próprio token; o mestre, qualquer um.
// Durante o arrasto, a posição vai no máximo 20 vezes por segundo (`token.drag`, não grava); ao
// soltar, vai o `token.move` e o servidor decide. Recusado (como dentro do breu), o token volta
// ao lugar e o motivo aparece. Passar o mouse mostra o nome e de quem é.
import { useMemo, useState, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle, Group, Label, Layer, Tag, Text, type KonvaNodeEvents } from 'react-konva';
import type { ComandoDaMesa, MapaNaMesa, RespostaDoComando, TokenNaMesa } from '@membrana/shared';
import { iniciais } from '../casos/formatos.ts';
import { cores } from './cores.ts';
import { criarLimitador, dentroDoMapa, podeArrastar, rotuloDoToken } from './interacao.ts';
import { useImagem } from './useImagem.ts';

export const raioDoToken = (token: TokenNaMesa, celula: number) =>
  Math.max(4, (token.tamanho * celula) / 2 - 3);

function TokenKonva({
  token,
  celula,
  meu,
  selecionado,
  noTurno,
  posicao,
  arrastavel,
  eventos,
}: {
  token: TokenNaMesa;
  celula: number;
  meu: boolean;
  selecionado: boolean;
  noTurno: boolean;
  posicao: { x: number; y: number };
  arrastavel: boolean;
  eventos: KonvaNodeEvents;
}) {
  const imagem = useImagem(token.imagem);
  const c = cores();
  const npc = token.personagemId === null;
  const raio = raioDoToken(token, celula);
  const anel = meu ? c['red-hi'] : npc ? c.npc : c.red;
  const lado = imagem ? Math.min(imagem.width, imagem.height) : 1;
  const escala = (raio * 2) / Math.max(1, lado);
  const fonte = Math.max(8, raio * 0.6);

  return (
    <Group
      x={posicao.x}
      y={posicao.y}
      draggable={arrastavel}
      opacity={token.oculto ? 0.5 : 1}
      {...eventos}
    >
      {noTurno && (
        <Circle
          radius={raio + 7}
          stroke={c.gold}
          strokeWidth={2.5}
          opacity={0.9}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      {selecionado && (
        <Circle
          radius={raio + 4}
          stroke={c['red-hi']}
          strokeWidth={1.5}
          dash={[6, 4]}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
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
        strokeWidth={meu ? 2 : 1.5}
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
          listening={false}
        />
      )}
    </Group>
  );
}

export interface CamadaDeTokensProps {
  tokens: TokenNaMesa[];
  mapa: MapaNaMesa;
  meuId: string;
  mestre: boolean;
  /** Nome de cada pessoa do caso, para dizer de quem é o token. */
  nomes: Readonly<Record<string, string>>;
  /** Posições provisórias de quem está arrastando agora (outras pessoas). */
  arrastando: Record<string, { x: number; y: number }>;
  /** Zoom atual: o rótulo fica do mesmo tamanho na tela em qualquer zoom. */
  escala: number;
  /** Navegando o mapa (espaço segurado) ou escolhendo um ponto: nada se arrasta. */
  bloqueado: boolean;
  selecionado: string | null;
  turnoTokenId?: string | null;
  aoSelecionar: (id: string) => void;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoRecusar: (motivo: string) => void;
  /** Ligado pela pinça: o arrasto em curso é cancelado e o token volta. */
  cancelarArrasto: RefObject<boolean>;
}

export function CamadaDeTokens({
  tokens,
  mapa,
  meuId,
  mestre,
  nomes,
  arrastando,
  escala,
  bloqueado,
  selecionado,
  turnoTokenId = null,
  aoSelecionar,
  enviar,
  aoRecusar,
  cancelarArrasto,
}: CamadaDeTokensProps) {
  const [sobre, setSobre] = useState<string | null>(null);
  const podeMandar = useMemo(() => criarLimitador(), []);
  const c = cores();
  const celula = mapa.grade.celula;
  const emFoco = tokens.find((t) => t.id === sobre);

  const cursor = (e: KonvaEventObject<Event>, valor: string) => {
    const palco = e.target.getStage();
    if (palco) palco.container().style.cursor = valor;
  };

  if (tokens.length === 0) return null;
  return (
    <Layer>
      {tokens.map((token) => {
        const arrastavel = !bloqueado && podeArrastar(token, meuId, mestre);
        const voltar = (no: Konva.Node) => {
          no.position({ x: token.x, y: token.y });
        };
        return (
          <TokenKonva
            key={token.id}
            token={token}
            celula={celula}
            meu={token.donoId === meuId}
            selecionado={selecionado === token.id}
            noTurno={turnoTokenId === token.id}
            posicao={arrastando[token.id] ?? token}
            arrastavel={arrastavel}
            eventos={{
              onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
                setSobre(token.id);
                cursor(e, arrastavel ? 'grab' : 'default');
              },
              onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
                setSobre(null);
                cursor(e, '');
              },
              onClick: () => {
                if (!bloqueado) aoSelecionar(token.id);
              },
              onTap: () => {
                if (bloqueado) return;
                aoSelecionar(token.id);
                // No celular não há "passar o mouse": o toque mostra de quem é.
                setSobre(token.id);
              },
              onDragStart: () => {
                cancelarArrasto.current = false;
                aoSelecionar(token.id);
                setSobre(null);
              },
              onDragMove: (e: KonvaEventObject<DragEvent>) => {
                if (!podeMandar(performance.now())) return;
                const ponto = dentroDoMapa(e.target.position(), mapa);
                void enviar({ type: 'token.drag', tokenId: token.id, ...ponto });
              },
              onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                const no = e.target;
                if (cancelarArrasto.current) {
                  cancelarArrasto.current = false;
                  voltar(no);
                  return;
                }
                const destino = dentroDoMapa(no.position(), mapa);
                no.position(destino);
                void enviar({ type: 'token.move', tokenId: token.id, ...destino }).then((r) => {
                  if (r.ok) return;
                  voltar(no);
                  aoRecusar(r.motivo);
                });
              },
            }}
          />
        );
      })}
      {emFoco && (
        <Label
          x={(arrastando[emFoco.id] ?? emFoco).x}
          y={(arrastando[emFoco.id] ?? emFoco).y - raioDoToken(emFoco, celula) - 6}
          scaleX={1 / escala}
          scaleY={1 / escala}
          listening={false}
        >
          <Tag
            fill={c.bg}
            stroke={c['map-wall']}
            pointerDirection="down"
            pointerWidth={10}
            pointerHeight={6}
            cornerRadius={2}
          />
          <Text
            text={rotuloDoToken(emFoco, nomes, meuId)}
            fontSize={13}
            fontStyle="bold"
            padding={6}
            fill={c.text}
          />
        </Label>
      )}
    </Layer>
  );
}
