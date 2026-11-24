// O palco da mesa (Konva). Camadas de baixo para cima: mapa e grade, props, salas, névoa, pistas
// e tokens. Tudo em pixels do mapa; a câmera (posição e zoom) fica no Stage.
// Navegar: roda do mouse ou pinça para o zoom; botão do meio, espaço + arrasto ou dois dedos para
// arrastar o mapa. Um dedo fica livre para mover o token (#65).
// Desempenho no celular: as camadas não escutam clique (sem mapa de cliques para desenhar), a
// grade é um traço só e a densidade de pixels vai no máximo a 2.
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Stage } from 'react-konva';
import type { MapaNaMesa, VisaoDaMesa } from '@membrana/shared';
import { Icon } from '../ui/index.ts';
import { CamadaDoMapa } from './camadas/Mapa.tsx';
import { CamadaDaNevoa } from './camadas/Nevoa.tsx';
import {
  CamadaDePistas,
  CamadaDeProps,
  CamadaDeSalas,
  CamadaDeTokens,
} from './camadas/Elementos.tsx';
import {
  arrastar,
  centralizarEm,
  enquadrar,
  PASSO_DO_ZOOM,
  pinca,
  zoomNoPonto,
  type Camera,
  type Ponto,
  type Tamanho,
} from './camera.ts';

Konva.pixelRatio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);

export interface PalcoProps {
  visao: VisaoDaMesa & { mapa: MapaNaMesa };
  arrastando: Record<string, { x: number; y: number }>;
  /** Quem está olhando: o token dele ganha destaque e o botão "centralizar". */
  meuId: string;
  /** Uma imagem do computador solta sobre o mapa (RF-24), com o ponto do mapa onde caiu. */
  aoSoltarImagem?: (arquivo: File, ponto: Ponto) => void;
}

/** Os dois toques, na tela, relativos ao palco. */
function doisToques(evento: TouchEvent, palco: HTMLElement): [Ponto, Ponto] | null {
  const [a, b] = [evento.touches[0], evento.touches[1]];
  if (!a || !b) return null;
  const caixa = palco.getBoundingClientRect();
  return [
    { x: a.clientX - caixa.left, y: a.clientY - caixa.top },
    { x: b.clientX - caixa.left, y: b.clientY - caixa.top },
  ];
}

/** Tecla digitada num campo de texto não conta como atalho do mapa. */
const digitando = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement &&
  (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName));

export function Palco({ visao, arrastando, meuId, aoSoltarImagem }: PalcoProps) {
  const { mapa } = visao;
  const caixa = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState<Tamanho | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [espaco, setEspaco] = useState(false);
  const [arrastandoMapa, setArrastandoMapa] = useState(false);
  const ultimoPonto = useRef<Ponto | null>(null);
  const ultimosToques = useRef<[Ponto, Ponto] | null>(null);
  const stage = useRef<Konva.Stage>(null);

  // O palco ocupa o espaço que a página der, e acompanha quando ele muda.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => {
      setTamanho({ largura: el.clientWidth, altura: el.clientHeight });
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      observador.disconnect();
    };
  }, []);

  // Mapa novo (ou o primeiro): enquadra inteiro.
  const enquadradoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!tamanho || tamanho.largura === 0 || enquadradoPara.current === mapa.id) return;
    enquadradoPara.current = mapa.id;
    setCamera(enquadrar(mapa, tamanho));
  }, [mapa, tamanho]);

  // Espaço segurado: o arrasto com o botão esquerdo move o mapa.
  useEffect(() => {
    const apertou = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !digitando(e.target)) {
        e.preventDefault();
        setEspaco(true);
      }
    };
    const soltou = (e: KeyboardEvent) => {
      if (e.code === 'Space') setEspaco(false);
    };
    const parar = () => {
      ultimoPonto.current = null;
      setArrastandoMapa(false);
    };
    window.addEventListener('keydown', apertou);
    window.addEventListener('keyup', soltou);
    window.addEventListener('mouseup', parar);
    window.addEventListener('blur', parar);
    return () => {
      window.removeEventListener('keydown', apertou);
      window.removeEventListener('keyup', soltou);
      window.removeEventListener('mouseup', parar);
      window.removeEventListener('blur', parar);
    };
  }, []);

  const meio = useCallback(
    (): Ponto => ({ x: (tamanho?.largura ?? 0) / 2, y: (tamanho?.altura ?? 0) / 2 }),
    [tamanho],
  );
  const zoom = (fator: number) => {
    setCamera((c) => c && zoomNoPonto(c, c.escala * fator, meio()));
  };

  const meuToken = visao.tokens.find((t) => t.donoId === meuId);

  function aoRolar(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const ponto = e.target.getStage()?.getPointerPosition();
    if (!ponto) return;
    const fator = e.evt.deltaY > 0 ? 1 / PASSO_DO_ZOOM : PASSO_DO_ZOOM;
    setCamera((c) => c && zoomNoPonto(c, c.escala * fator, ponto));
  }

  function aoApertar(e: KonvaEventObject<MouseEvent>) {
    const botaoDoMeio = e.evt.button === 1;
    if (!botaoDoMeio && !(espaco && e.evt.button === 0)) return;
    e.evt.preventDefault();
    ultimoPonto.current = { x: e.evt.clientX, y: e.evt.clientY };
    setArrastandoMapa(true);
  }

  function aoMoverMouse(e: KonvaEventObject<MouseEvent>) {
    const antes = ultimoPonto.current;
    if (!antes) return;
    const agora = { x: e.evt.clientX, y: e.evt.clientY };
    ultimoPonto.current = agora;
    setCamera((c) => c && arrastar(c, agora.x - antes.x, agora.y - antes.y));
  }

  function aoTocar(e: KonvaEventObject<TouchEvent>) {
    if (!caixa.current) return;
    const toques = doisToques(e.evt, caixa.current);
    if (!toques) return;
    e.evt.preventDefault();
    const antes = ultimosToques.current;
    ultimosToques.current = toques;
    if (antes) setCamera((c) => c && pinca(c, antes, toques));
  }

  function aoSoltarDedo(e: KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) ultimosToques.current = null;
  }

  function aoArrastarArquivo(e: DragEvent<HTMLDivElement>) {
    if (!aoSoltarImagem || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function aoSoltarArquivo(e: DragEvent<HTMLDivElement>) {
    const arquivo = e.dataTransfer.files[0];
    const palco = stage.current;
    if (!aoSoltarImagem || !arquivo || !palco) return;
    e.preventDefault();
    palco.setPointersPositions(e.nativeEvent);
    const ponto = palco.getRelativePointerPosition();
    if (ponto) aoSoltarImagem(arquivo, ponto);
  }

  const mestre = visao.papel === 'mestre';
  const celula = mapa.grade.celula;

  return (
    <div
      ref={caixa}
      className="palco"
      data-arrastando={arrastandoMapa || undefined}
      data-espaco={espaco || undefined}
      onDragOver={aoArrastarArquivo}
      onDrop={aoSoltarArquivo}
    >
      {tamanho && camera && (
        <Stage
          ref={stage}
          width={tamanho.largura}
          height={tamanho.altura}
          x={camera.x}
          y={camera.y}
          scaleX={camera.escala}
          scaleY={camera.escala}
          onWheel={aoRolar}
          onMouseDown={aoApertar}
          onMouseMove={aoMoverMouse}
          onTouchStart={aoTocar}
          onTouchMove={aoTocar}
          onTouchEnd={aoSoltarDedo}
          onContextMenu={(e) => {
            e.evt.preventDefault();
          }}
        >
          <CamadaDoMapa mapa={mapa} />
          <CamadaDeProps props={visao.props} celula={celula} />
          {visao.salas && <CamadaDeSalas salas={visao.salas} />}
          <CamadaDaNevoa nevoa={visao.nevoa} mapa={mapa} mestre={mestre} />
          <CamadaDePistas pistas={visao.pistas} celula={celula} />
          <CamadaDeTokens
            tokens={visao.tokens}
            celula={celula}
            meuId={meuId}
            arrastando={arrastando}
          />
        </Stage>
      )}

      <div className="zoom" role="toolbar" aria-label="Zoom do mapa">
        <button
          type="button"
          className="tbtn"
          aria-label="Aproximar"
          title="Aproximar"
          onClick={() => {
            zoom(PASSO_DO_ZOOM);
          }}
        >
          <Icon name="plus" size="sm" />
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="Afastar"
          title="Afastar"
          onClick={() => {
            zoom(1 / PASSO_DO_ZOOM);
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="Ver o mapa inteiro"
          title="Ver o mapa inteiro"
          onClick={() => {
            if (tamanho) setCamera(enquadrar(mapa, tamanho));
          }}
        >
          <Icon name="map" size="sm" />
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="Centralizar no meu token"
          title={meuToken ? 'Centralizar no meu token' : 'Você não tem um token neste mapa'}
          disabled={!meuToken}
          onClick={() => {
            if (meuToken && tamanho) setCamera((c) => c && centralizarEm(c, meuToken, tamanho));
          }}
        >
          <Icon name="target" size="sm" />
        </button>
      </div>
    </div>
  );
}
