// O palco da mesa (Konva). Camadas de baixo para cima: mapa e grade, props, salas, breu, pistas
// e tokens. Tudo em pixels do mapa; a câmera (posição e zoom) fica no Stage.
// Navegar: roda do mouse ou pinça para o zoom; botão do meio, espaço + arrasto ou dois dedos para
// arrastar o mapa. Um dedo (ou o botão esquerdo) arrasta token e prop.
// Clicar num token ou prop seleciona e mostra a barra dele; as setas movem o token uma célula;
// Esc tira a seleção. Com a ferramenta do breu aberta, o botão esquerdo desenha (Breu.tsx).
// Desempenho no celular: as camadas estáticas não escutam clique, a grade é um
// traço só e a densidade de pixels vai no máximo a 2.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Stage } from 'react-konva';
import type {
  ComandoDaMesa,
  FormaDoBreu,
  MapaNaMesa,
  RespostaDoComando,
  VisaoDaMesa,
} from '@membrana/shared';
import { Icon, useToast } from '../ui/index.ts';
import { BarraDoProp, BarraDoToken } from './Barras.tsx';
import { CamadaDoMapa } from './camadas/Mapa.tsx';
import { CamadaDoBreu } from './camadas/Breu.tsx';
import { CamadaDePistas, CamadaDeSalas } from './camadas/Elementos.tsx';
import {
  arrastar,
  centralizarEm,
  enquadrar,
  paraOMapa,
  PASSO_DO_ZOOM,
  pinca,
  zoomNoPonto,
  type Camera,
  type Ponto,
  type Tamanho,
} from './camera.ts';
import { dentroDoMapa, destinoDaSeta, digitando, podeArrastar } from './interacao.ts';
import { CamadaDeDesenhoDoBreu, type PincelDoBreu } from './Breu.tsx';
import { CamadaDeProps } from './Props.tsx';
import { CamadaDeTokens, raioDoToken } from './Tokens.tsx';

Konva.pixelRatio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);

export type Selecao = { tipo: 'token' | 'prop'; id: string } | null;

export interface PalcoProps {
  visao: VisaoDaMesa & { mapa: MapaNaMesa };
  arrastando: Record<string, { x: number; y: number }>;
  /** Quem está olhando: o token dele ganha destaque e o botão "centralizar". */
  meuId: string;
  /** Nome de cada pessoa do caso, para dizer de quem é cada token. */
  nomes: Readonly<Record<string, string>>;
  campanhaId: string;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  /** O ponto do mapa no meio da tela, atualizado a cada movimento (onde os painéis põem coisas). */
  centroRef?: RefObject<Ponto | null>;
  /** Escolhendo um ponto (como em "Trazer o grupo"): o próximo clique no mapa responde aqui. */
  aoEscolherPonto?: ((ponto: Ponto) => void) | null;
  /** Uma imagem do computador solta sobre o mapa (RF-24), com o ponto do mapa onde caiu. */
  aoSoltarImagem?: (arquivo: File, ponto: Ponto) => void;
  /** Ferramenta do breu aberta (só o mestre): o botão esquerdo desenha com este pincel. */
  pincelDoBreu?: PincelDoBreu | null;
  /** A forma que o mestre acabou de desenhar, para cobrir ou revelar conforme o pincel. */
  aoDesenharBreu?: (forma: FormaDoBreu) => void;
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

/** Altura da barra do item, para ela ficar acima dele sem cobrir. */
const ALTURA_DA_BARRA = 52;

export function Palco({
  visao,
  arrastando,
  meuId,
  nomes,
  campanhaId,
  enviar,
  centroRef,
  aoEscolherPonto,
  aoSoltarImagem,
  pincelDoBreu,
  aoDesenharBreu,
}: PalcoProps) {
  const { mapa } = visao;
  const avisos = useToast();
  const caixa = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState<Tamanho | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [espaco, setEspaco] = useState(false);
  const [arrastandoMapa, setArrastandoMapa] = useState(false);
  const [selecao, setSelecao] = useState<Selecao>(null);
  const ultimoPonto = useRef<Ponto | null>(null);
  const ultimosToques = useRef<[Ponto, Ponto] | null>(null);
  const cancelarArrasto = useRef(false);
  /** O toque ou clique começou no vazio (fora de token e prop): só esse tira a seleção. */
  const comecouNoVazio = useRef(false);
  const stage = useRef<Konva.Stage>(null);
  const mestre = visao.papel === 'mestre';
  const escolhendo = Boolean(aoEscolherPonto);
  const pincel = mestre && !escolhendo && aoDesenharBreu ? (pincelDoBreu ?? null) : null;
  const bloqueado = espaco || escolhendo || pincel !== null;

  // Começou a desenhar o breu: a seleção sai (a barra do item ficaria no caminho).
  const [pincelAberto, setPincelAberto] = useState(pincel !== null);
  if (pincelAberto !== (pincel !== null)) {
    setPincelAberto(pincel !== null);
    if (pincel) setSelecao(null);
  }

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

  // Mapa novo (ou o primeiro): enquadra inteiro e esquece a seleção do anterior.
  const enquadradoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!tamanho || tamanho.largura === 0 || enquadradoPara.current === mapa.id) return;
    enquadradoPara.current = mapa.id;
    setCamera(enquadrar(mapa, tamanho));
    setSelecao(null);
  }, [mapa, tamanho]);

  const meio = useCallback(
    (): Ponto => ({ x: (tamanho?.largura ?? 0) / 2, y: (tamanho?.altura ?? 0) / 2 }),
    [tamanho],
  );

  // O meio da tela, em pixels do mapa: onde o mestre põe um NPC ou um prop novo.
  useEffect(() => {
    if (centroRef && camera) centroRef.current = dentroDoMapa(paraOMapa(camera, meio()), mapa);
  }, [centroRef, camera, meio, mapa]);

  // O que foi selecionado e saiu do mapa (removido, ou sumiu no breu) deixa de estar selecionado.
  const tokenEscolhido =
    selecao?.tipo === 'token' ? visao.tokens.find((t) => t.id === selecao.id) : undefined;
  const propEscolhido =
    selecao?.tipo === 'prop' && mestre ? visao.props.find((p) => p.id === selecao.id) : undefined;
  const meuToken = visao.tokens.find((t) => t.donoId === meuId);

  // Teclado: espaço navega, setas movem uma célula, Esc tira a seleção (e cancela a escolha).
  // O evento lê sempre o estado atual (a seleção, o mapa) sem refazer os ouvintes da janela.
  const aoApertarTecla = useEffectEvent((e: KeyboardEvent) => {
    if (digitando(e.target)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setEspaco(true);
      return;
    }
    if (e.key === 'Escape') {
      setSelecao(null);
      return;
    }
    // O token escolhido; sem escolha, o jogador move o próprio.
    const alvo = tokenEscolhido ?? (mestre ? undefined : meuToken);
    if (!alvo || !podeArrastar(alvo, meuId, mestre) || escolhendo) return;
    const destino = destinoDaSeta(e.key, alvo, mapa.grade.celula);
    if (!destino) return;
    e.preventDefault();
    void enviar({ type: 'token.move', tokenId: alvo.id, ...dentroDoMapa(destino, mapa) }).then(
      (r) => {
        if (!r.ok) avisos.show({ type: 'warn', title: r.motivo });
      },
    );
  });
  useEffect(() => {
    const apertou = (e: KeyboardEvent) => {
      aoApertarTecla(e);
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

  const zoom = (fator: number) => {
    setCamera((c) => c && zoomNoPonto(c, c.escala * fator, meio()));
  };

  const recusado = useCallback(
    (motivo: string) => {
      avisos.show({ type: 'warn', title: motivo });
    },
    [avisos],
  );
  const selecionarToken = useCallback((id: string) => {
    setSelecao({ tipo: 'token', id });
  }, []);
  const selecionarProp = useCallback((id: string) => {
    setSelecao({ tipo: 'prop', id });
  }, []);

  function aoRolar(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const ponto = e.target.getStage()?.getPointerPosition();
    if (!ponto) return;
    const fator = e.evt.deltaY > 0 ? 1 / PASSO_DO_ZOOM : PASSO_DO_ZOOM;
    setCamera((c) => c && zoomNoPonto(c, c.escala * fator, ponto));
  }

  function aoApertar(e: KonvaEventObject<MouseEvent>) {
    comecouNoVazio.current = e.target === e.target.getStage();
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

  /** Clique no vazio tira a seleção; escolhendo um ponto, o clique (em qualquer lugar) é a escolha. */
  function aoClicar(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (aoEscolherPonto) {
      const ponto = e.target.getStage()?.getRelativePointerPosition();
      if (ponto) aoEscolherPonto(dentroDoMapa(ponto, mapa));
      return;
    }
    // Apertar num item e soltar no vazio (como ao tentar arrastar um prop travado) não conta.
    if (e.target === e.target.getStage() && comecouNoVazio.current) setSelecao(null);
  }

  function aoTocar(e: KonvaEventObject<TouchEvent>) {
    if (e.type === 'touchstart' && e.evt.touches.length === 1) {
      comecouNoVazio.current = e.target === e.target.getStage();
    }
    if (!caixa.current) return;
    const toques = doisToques(e.evt, caixa.current);
    if (!toques) return;
    e.evt.preventDefault();
    // Dois dedos são do mapa: um arrasto de token ou prop em curso é cancelado e o item volta.
    const palco = e.target.getStage();
    palco
      ?.find((no: Konva.Node) => no.isDragging())
      .forEach((no) => {
        cancelarArrasto.current = true;
        no.stopDrag();
      });
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

  /** Onde a barra do item fica na tela: centrada sobre ele, sem sair do palco. */
  function posicaoDaBarra(ponto: Ponto, raio: number) {
    if (!camera || !tamanho) return { display: 'none' };
    const x = camera.x + ponto.x * camera.escala;
    const topo = camera.y + (ponto.y - raio) * camera.escala - ALTURA_DA_BARRA;
    return {
      left: Math.min(tamanho.largura - 8, Math.max(8, x)),
      top: Math.min(tamanho.altura - ALTURA_DA_BARRA, Math.max(8, topo)),
    };
  }

  const celula = mapa.grade.celula;
  const podeEditarToken =
    tokenEscolhido &&
    (mestre || (tokenEscolhido.donoId !== null && tokenEscolhido.donoId === meuId));

  return (
    <div
      ref={caixa}
      className="palco"
      data-arrastando={arrastandoMapa || undefined}
      data-espaco={espaco || undefined}
      data-escolhendo={escolhendo || undefined}
      data-desenhando={(pincel && !espaco) || undefined}
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
          onClick={aoClicar}
          onTap={aoClicar}
          onTouchStart={aoTocar}
          onTouchMove={aoTocar}
          onTouchEnd={aoSoltarDedo}
          onContextMenu={(e) => {
            e.evt.preventDefault();
          }}
        >
          <CamadaDoMapa mapa={mapa} />
          <CamadaDeProps
            props={visao.props}
            mapa={mapa}
            mestre={mestre}
            arrastando={arrastando}
            bloqueado={bloqueado}
            selecionado={selecao?.tipo === 'prop' ? selecao.id : null}
            aoSelecionar={selecionarProp}
            enviar={enviar}
            aoRecusar={recusado}
            cancelarArrasto={cancelarArrasto}
          />
          {visao.salas && <CamadaDeSalas salas={visao.salas} />}
          <CamadaDoBreu breu={visao.breu} mapa={mapa} mestre={mestre} />
          <CamadaDePistas pistas={visao.pistas} celula={celula} />
          <CamadaDeTokens
            tokens={visao.tokens}
            mapa={mapa}
            meuId={meuId}
            mestre={mestre}
            nomes={nomes}
            arrastando={arrastando}
            escala={camera.escala}
            bloqueado={bloqueado}
            selecionado={selecao?.tipo === 'token' ? selecao.id : null}
            aoSelecionar={selecionarToken}
            enviar={enviar}
            aoRecusar={recusado}
            cancelarArrasto={cancelarArrasto}
          />
          {pincel && aoDesenharBreu && (
            <CamadaDeDesenhoDoBreu
              pincel={pincel}
              mapa={mapa}
              escala={camera.escala}
              pausado={espaco}
              aoDesenhar={aoDesenharBreu}
            />
          )}
        </Stage>
      )}

      {podeEditarToken && !escolhendo && (
        <BarraDoToken
          key={tokenEscolhido.id}
          token={tokenEscolhido}
          mestre={mestre}
          campanhaId={campanhaId}
          enviar={enviar}
          estilo={posicaoDaBarra(
            arrastando[tokenEscolhido.id] ?? tokenEscolhido,
            raioDoToken(tokenEscolhido, celula),
          )}
        />
      )}
      {propEscolhido && !escolhendo && (
        <BarraDoProp
          key={propEscolhido.id}
          prop={propEscolhido}
          props={visao.props}
          mapa={mapa}
          enviar={enviar}
          estilo={posicaoDaBarra(
            arrastando[propEscolhido.id] ?? propEscolhido,
            (propEscolhido.tamanho * celula) / 2,
          )}
          aoRemover={() => {
            setSelecao(null);
          }}
        />
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
