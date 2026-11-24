// Camada dos props (RF-20, RF-21). Todos veem; só o mestre seleciona, arrasta, redimensiona e
// gira (o giro encaixa de 45 em 45 graus perto deles, livre fora disso). Travado, o prop não sai do
// lugar. Como no token, o arrasto vai no máximo 20 vezes por segundo e só o soltar grava.
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Image, Layer, Transformer, type KonvaNodeEvents } from 'react-konva';
import type { ComandoDaMesa, MapaNaMesa, PropNaMesa, RespostaDoComando } from '@membrana/shared';
import { cores } from './cores.ts';
import { criarLimitador, dentroDoMapa, rotacaoNormal, tamanhoDoProp } from './interacao.ts';
import { useImagem } from './useImagem.ts';

/** Largura e altura do prop: `tamanho` células de largura, na proporção da imagem. */
export function medidasDoProp(prop: PropNaMesa, celula: number, imagem: HTMLImageElement) {
  const largura = prop.tamanho * celula;
  return { largura, altura: (largura * imagem.height) / Math.max(1, imagem.width) };
}

function PropKonva({
  prop,
  celula,
  posicao,
  arrastavel,
  eventos,
}: {
  prop: PropNaMesa;
  celula: number;
  posicao: { x: number; y: number };
  arrastavel: boolean;
  eventos: KonvaNodeEvents;
}) {
  const imagem = useImagem(prop.imagem);
  if (!imagem) return null;
  const { largura, altura } = medidasDoProp(prop, celula, imagem);
  return (
    <Image
      id={prop.id}
      image={imagem}
      x={posicao.x}
      y={posicao.y}
      width={largura}
      height={altura}
      offsetX={largura / 2}
      offsetY={altura / 2}
      rotation={prop.rotacao}
      draggable={arrastavel}
      perfectDrawEnabled={false}
      {...eventos}
    />
  );
}

const GIROS = [0, 45, 90, 135, 180, 225, 270, 315];

export interface CamadaDePropsProps {
  props: PropNaMesa[];
  mapa: MapaNaMesa;
  /** Só o mestre mexe; para o jogador, a camada nem escuta clique. */
  mestre: boolean;
  arrastando: Record<string, { x: number; y: number }>;
  bloqueado: boolean;
  selecionado: string | null;
  aoSelecionar: (id: string) => void;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoRecusar: (motivo: string) => void;
  cancelarArrasto: RefObject<boolean>;
}

export function CamadaDeProps({
  props,
  mapa,
  mestre,
  arrastando,
  bloqueado,
  selecionado,
  aoSelecionar,
  enviar,
  aoRecusar,
  cancelarArrasto,
}: CamadaDePropsProps) {
  const camada = useRef<Konva.Layer>(null);
  const alcas = useRef<Konva.Transformer>(null);
  const podeMandar = useMemo(() => criarLimitador(), []);
  const c = cores();
  const celula = mapa.grade.celula;
  const escolhido = mestre ? props.find((p) => p.id === selecionado) : undefined;
  const comAlcas = escolhido && !escolhido.travado && !bloqueado ? escolhido : undefined;

  // As alças de redimensionar e girar ficam no prop escolhido (destravado).
  useEffect(() => {
    const transformador = alcas.current;
    if (!transformador) return;
    const no = comAlcas ? camada.current?.findOne(`#${comAlcas.id}`) : undefined;
    transformador.nodes(no ? [no] : []);
    transformador.getLayer()?.batchDraw();
  });

  if (props.length === 0) return null;
  return (
    <Layer ref={camada} listening={mestre}>
      {props.map((prop) => {
        const arrastavel = mestre && !prop.travado && !bloqueado;
        const voltar = (no: Konva.Node) => {
          no.position({ x: prop.x, y: prop.y });
          no.rotation(prop.rotacao);
          no.scale({ x: 1, y: 1 });
        };
        return (
          <PropKonva
            key={prop.id}
            prop={prop}
            celula={celula}
            posicao={arrastando[prop.id] ?? prop}
            arrastavel={arrastavel}
            eventos={{
              onClick: () => {
                if (mestre && !bloqueado) aoSelecionar(prop.id);
              },
              onTap: () => {
                if (mestre && !bloqueado) aoSelecionar(prop.id);
              },
              onDragStart: () => {
                cancelarArrasto.current = false;
                aoSelecionar(prop.id);
              },
              onDragMove: (e: KonvaEventObject<DragEvent>) => {
                if (!podeMandar(performance.now())) return;
                const ponto = dentroDoMapa(e.target.position(), mapa);
                void enviar({ type: 'prop.drag', propId: prop.id, ...ponto });
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
                void enviar({ type: 'prop.update', propId: prop.id, ...destino }).then((r) => {
                  if (r.ok) return;
                  voltar(no);
                  aoRecusar(r.motivo);
                });
              },
              onTransformEnd: (e: KonvaEventObject<Event>) => {
                const no = e.target;
                const escala = no.scaleX();
                // A escala vira tamanho: o nó volta à escala 1 já com a medida nova.
                no.scale({ x: 1, y: 1 });
                no.width(no.width() * Math.abs(escala));
                no.height(no.height() * Math.abs(escala));
                no.offset({ x: no.width() / 2, y: no.height() / 2 });
                const destino = dentroDoMapa(no.position(), mapa);
                void enviar({
                  type: 'prop.update',
                  propId: prop.id,
                  ...destino,
                  tamanho: tamanhoDoProp(prop.tamanho, escala),
                  rotacao: rotacaoNormal(no.rotation()),
                }).then((r) => {
                  if (r.ok) return;
                  voltar(no);
                  aoRecusar(r.motivo);
                });
              },
            }}
          />
        );
      })}
      {mestre && (
        <Transformer
          ref={alcas}
          keepRatio
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          rotationSnaps={GIROS}
          rotationSnapTolerance={6}
          borderStroke={c['red-hi']}
          anchorStroke={c['red-hi']}
          anchorFill={c.bg}
          anchorSize={10}
          boundBoxFunc={(antes, depois) =>
            // Nem sumir de tão pequeno, nem passar de 20 células.
            depois.width < 8 || depois.width > celula * 20 ? antes : depois
          }
        />
      )}
    </Layer>
  );
}
