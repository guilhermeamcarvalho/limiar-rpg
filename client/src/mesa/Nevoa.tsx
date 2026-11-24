// Desenho da névoa pelo mestre (RF-22). Com a ferramenta aberta, uma camada por cima de tudo pega
// o mouse: no retângulo, arrastar desenha; no polígono, cada clique marca um canto e o polígono
// fecha no primeiro ponto, com dois cliques ou com Enter (Backspace desfaz o último canto, Esc
// cancela). A forma pronta vai para `aoDesenhar`; quem chama manda o comando e o servidor decide.
// Navegar continua igual: roda, botão do meio ou espaço + arrasto.
import { useEffect, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle, Layer, Line, Rect } from 'react-konva';
import { LIMITE_DO_MAPA, type FormaDaNevoa, type MapaNaMesa } from '@membrana/shared';
import type { Ponto } from './camera.ts';
import { cores } from './cores.ts';
import {
  cliqueNoPoligono,
  dentroDoMapa,
  digitando,
  poligonoDe,
  retanguloEntre,
} from './interacao.ts';

export type ModoDaNevoa = 'cobrir' | 'revelar';
export type TracoDaNevoa = FormaDaNevoa['tipo'];

/** O que a ferramenta da névoa está fazendo: cobrir ou revelar, com retângulo ou polígono. */
export interface PincelDaNevoa {
  modo: ModoDaNevoa;
  forma: TracoDaNevoa;
}

/** Raio, na tela, em que o clique "pega" o primeiro ponto do polígono. */
const RAIO_DO_PONTO_PX = 10;

/** Onde o mouse está, em pixels do mapa. */
function pontoDoMouse(e: KonvaEventObject<MouseEvent>): Ponto | null {
  return e.target.getStage()?.getRelativePointerPosition() ?? null;
}

export function CamadaDeDesenhoDaNevoa({
  pincel,
  mapa,
  escala,
  pausado,
  aoDesenhar,
}: {
  pincel: PincelDaNevoa;
  mapa: MapaNaMesa;
  /** Zoom da câmera: os traços e o raio do clique ficam do mesmo tamanho na tela. */
  escala: number;
  /** Navegando (espaço apertado): o botão esquerdo é do mapa, não do desenho. */
  pausado: boolean;
  aoDesenhar: (forma: FormaDaNevoa) => void;
}) {
  const c = cores();
  const [inicio, setInicio] = useState<Ponto | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [mouse, setMouse] = useState<Ponto | null>(null);

  // Trocou de traço (ou de modo): o desenho pela metade some.
  const [pincelAnterior, setPincelAnterior] = useState(pincel);
  if (pincelAnterior !== pincel) {
    setPincelAnterior(pincel);
    setInicio(null);
    setPontos([]);
  }

  function fecharPoligono(lista: Ponto[]) {
    const forma = poligonoDe(lista);
    setPontos([]);
    if (forma) aoDesenhar(forma);
  }

  // Teclado do polígono: Enter fecha, Backspace desfaz o último canto, Esc cancela.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (digitando(e.target)) return;
      if (e.key === 'Escape') {
        setInicio(null);
        setPontos([]);
      } else if (e.key === 'Enter' && pontos.length >= 3) {
        e.preventDefault();
        fecharPoligono(pontos);
      } else if (e.key === 'Backspace' && pontos.length > 0) {
        e.preventDefault();
        setPontos((lista) => lista.slice(0, -1));
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  });

  function aoApertar(e: KonvaEventObject<MouseEvent>) {
    if (pausado || e.evt.button !== 0 || pincel.forma !== 'retangulo') return;
    const ponto = pontoDoMouse(e);
    if (ponto) setInicio(dentroDoMapa(ponto, mapa));
  }

  function aoMover(e: KonvaEventObject<MouseEvent>) {
    const ponto = pontoDoMouse(e);
    if (ponto) setMouse(dentroDoMapa(ponto, mapa));
  }

  function aoSoltar(e: KonvaEventObject<MouseEvent>) {
    if (!inicio || e.evt.button !== 0) return;
    const ponto = pontoDoMouse(e);
    setInicio(null);
    const forma = ponto && retanguloEntre(inicio, ponto, mapa);
    if (forma) aoDesenhar(forma);
  }

  function aoClicar(e: KonvaEventObject<MouseEvent>) {
    if (pausado || e.evt.button !== 0 || pincel.forma !== 'poligono') return;
    const ponto = pontoDoMouse(e);
    if (!ponto) return;
    const clique = dentroDoMapa(ponto, mapa);
    const acao = cliqueNoPoligono(pontos, clique, RAIO_DO_PONTO_PX / escala);
    if (acao === 'fechar') fecharPoligono(pontos);
    else if (acao === 'acrescentar') setPontos([...pontos, clique]);
  }

  function aoClicarDuasVezes(e: KonvaEventObject<MouseEvent>) {
    if (pausado || pincel.forma !== 'poligono' || pontos.length < 3) return;
    e.cancelBubble = true;
    fecharPoligono(pontos);
  }

  const cor = pincel.modo === 'cobrir' ? c['red-hi'] : c.gold;
  const traco = 2 / escala;
  const tracejado = [8 / escala, 6 / escala];
  const rascunho = inicio && mouse ? retanguloEntre(inicio, mouse, mapa) : null;
  const linha = [...pontos, ...(mouse && pontos.length > 0 ? [mouse] : [])];

  return (
    <Layer>
      {/* Pega o mouse em todo o palco: tokens e props não recebem o clique enquanto desenha. */}
      <Rect
        x={-LIMITE_DO_MAPA}
        y={-LIMITE_DO_MAPA}
        width={LIMITE_DO_MAPA * 3}
        height={LIMITE_DO_MAPA * 3}
        fill="transparent"
        perfectDrawEnabled={false}
        onMouseDown={aoApertar}
        onMouseMove={aoMover}
        onMouseUp={aoSoltar}
        onClick={aoClicar}
        onDblClick={aoClicarDuasVezes}
        onMouseLeave={() => {
          setMouse(null);
        }}
      />
      {rascunho && (
        <Rect
          x={rascunho.x}
          y={rascunho.y}
          width={rascunho.largura}
          height={rascunho.altura}
          stroke={cor}
          strokeWidth={traco}
          dash={tracejado}
          fill={c['red-a40']}
          listening={false}
        />
      )}
      {linha.length > 1 && (
        <Line
          points={linha.flatMap((p) => [p.x, p.y])}
          stroke={cor}
          strokeWidth={traco}
          dash={tracejado}
          listening={false}
        />
      )}
      {pontos.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          // O primeiro ponto é maior: clicar nele fecha o polígono.
          radius={(i === 0 && pontos.length >= 3 ? RAIO_DO_PONTO_PX : 4) / escala}
          fill={i === 0 ? cor : c.white}
          stroke={cor}
          strokeWidth={traco}
          listening={false}
        />
      ))}
    </Layer>
  );
}
