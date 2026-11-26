// Salas desenhadas no mapa pelo mestre (#82): retângulo ou polígono, nome e notas exclusivas do
// mestre. A mesma lista alimenta "Cobrir/revelar por sala" no Breu e aparece no Escudo do mestre.
import { useEffect, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle, Layer, Line, Rect } from 'react-konva';
import {
  LIMITE_DO_MAPA,
  type ComandoDaMesa,
  type MapaNaMesa,
  type Ponto,
  type RespostaDoComando,
  type SalaNaMesa,
} from '@membrana/shared';
import { Button, Field, Icon, Input, Textarea, useToast } from '../ui/index.ts';
import { cores } from './cores.ts';
import {
  cliqueNoPoligono,
  dentroDoMapa,
  digitando,
  poligonoDe,
  retanguloEntre,
} from './interacao.ts';

export type TracoDaSala = 'retangulo' | 'poligono';

const RAIO_DO_PONTO_PX = 10;

function pontoDoMouse(e: KonvaEventObject<MouseEvent>): Ponto | null {
  return e.target.getStage()?.getRelativePointerPosition() ?? null;
}

export function CamadaDeDesenhoDaSala({
  traco,
  mapa,
  escala,
  pausado,
  aoDesenhar,
}: {
  traco: TracoDaSala;
  mapa: MapaNaMesa;
  escala: number;
  pausado: boolean;
  aoDesenhar: (area: Ponto[]) => void;
}) {
  const c = cores();
  const [inicio, setInicio] = useState<Ponto | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [mouse, setMouse] = useState<Ponto | null>(null);

  const [tracoAnterior, setTracoAnterior] = useState(traco);
  if (tracoAnterior !== traco) {
    setTracoAnterior(traco);
    setInicio(null);
    setPontos([]);
  }

  function fecharPoligono(lista: Ponto[]) {
    const forma = poligonoDe(lista);
    setPontos([]);
    if (forma && forma.tipo === 'poligono') aoDesenhar(forma.pontos);
  }

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
    if (pausado || e.evt.button !== 0 || traco !== 'retangulo') return;
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
    const ret = ponto && retanguloEntre(inicio, ponto, mapa);
    if (ret) {
      aoDesenhar([
        { x: ret.x, y: ret.y },
        { x: ret.x + ret.largura, y: ret.y },
        { x: ret.x + ret.largura, y: ret.y + ret.altura },
        { x: ret.x, y: ret.y + ret.altura },
      ]);
    }
  }

  function aoClicar(e: KonvaEventObject<MouseEvent>) {
    if (pausado || e.evt.button !== 0 || traco !== 'poligono') return;
    const ponto = pontoDoMouse(e);
    if (!ponto) return;
    const clique = dentroDoMapa(ponto, mapa);
    const acao = cliqueNoPoligono(pontos, clique, RAIO_DO_PONTO_PX / escala);
    if (acao === 'fechar') fecharPoligono(pontos);
    else if (acao === 'acrescentar') setPontos([...pontos, clique]);
  }

  function aoClicarDuasVezes(e: KonvaEventObject<MouseEvent>) {
    if (pausado || traco !== 'poligono' || pontos.length < 3) return;
    e.cancelBubble = true;
    fecharPoligono(pontos);
  }

  const espessura = 2 / escala;
  const tracejado = [8 / escala, 6 / escala];
  const rascunho = inicio && mouse ? retanguloEntre(inicio, mouse, mapa) : null;
  const linha = [...pontos, ...(mouse && pontos.length > 0 ? [mouse] : [])];

  return (
    <Layer>
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
          stroke={c.gold}
          strokeWidth={espessura}
          dash={tracejado}
          fill={c['red-a40']}
          listening={false}
        />
      )}
      {linha.length > 1 && (
        <Line
          points={linha.flatMap((p) => [p.x, p.y])}
          stroke={c.gold}
          strokeWidth={espessura}
          dash={tracejado}
          listening={false}
        />
      )}
      {pontos[0] && (
        <Circle
          x={pontos[0].x}
          y={pontos[0].y}
          radius={5 / escala}
          fill={c.gold}
          listening={false}
        />
      )}
    </Layer>
  );
}

function CartaoDaSala({
  sala,
  enviar,
}: {
  sala: SalaNaMesa;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [nome, setNome] = useState(sala.nome);
  const [notas, setNotas] = useState(sala.notasMestre);

  const [anterior, setAnterior] = useState(sala);
  if (anterior !== sala) {
    setAnterior(sala);
    setNome(sala.nome);
    setNotas(sala.notasMestre);
  }

  async function salvar() {
    const limpo = nome.trim();
    if (!limpo) return;
    if (limpo === sala.nome && notas === sala.notasMestre) return;
    const r = await enviar({
      type: 'room.update',
      salaId: sala.id,
      nome: limpo,
      notasMestre: notas,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para salvar a sala', text: r.motivo });
  }

  return (
    <div className="mesa-bloco card">
      <div className="row" style={{ gap: 6 }}>
        <Input
          aria-label={`Nome da sala ${sala.nome}`}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
          }}
          onBlur={() => {
            void salvar();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="trash" size="sm" />}
          aria-label={`Remover sala ${sala.nome}`}
          onClick={() => {
            void enviar({ type: 'room.delete', salaId: sala.id }).then((r) => {
              if (!r.ok)
                avisos.show({ type: 'err', title: 'Não deu para remover', text: r.motivo });
            });
          }}
        />
      </div>
      <Field label={`Notas do mestre · ${sala.nome}`}>
        <Textarea
          placeholder="Notas exclusivas do mestre (jogadores nunca veem)…"
          value={notas}
          rows={2}
          onChange={(e) => {
            setNotas(e.target.value);
          }}
          onBlur={() => {
            void salvar();
          }}
        />
      </Field>
    </div>
  );
}

export function FerramentaDeSalas({
  salas,
  traco,
  nomeNovaSala,
  aoMudarTraco,
  aoMudarNomeNovaSala,
  enviar,
}: {
  salas: readonly SalaNaMesa[];
  traco: TracoDaSala;
  nomeNovaSala: string;
  aoMudarTraco: (traco: TracoDaSala) => void;
  aoMudarNomeNovaSala: (nome: string) => void;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  return (
    <div className="col">
      <p className="small muted">
        Desenhe no mapa para demarcar uma sala. Só você vê os nomes, as notas e as áreas (usadas
        também em Breu → Cobrir/revelar por sala).
      </p>

      <Field label="Nome da próxima sala">
        <Input
          placeholder="Ex.: Recepção, Estúdio B…"
          value={nomeNovaSala}
          onChange={(e) => {
            aoMudarNomeNovaSala(e.target.value);
          }}
        />
      </Field>

      <div className="mesa-grupo">
        <span className="lab">Traço no mapa</span>
        <div className="row">
          <Button
            size="sm"
            variant={traco === 'retangulo' ? 'primary' : 'secondary'}
            aria-pressed={traco === 'retangulo'}
            onClick={() => {
              aoMudarTraco('retangulo');
            }}
          >
            Retângulo
          </Button>
          <Button
            size="sm"
            variant={traco === 'poligono' ? 'primary' : 'secondary'}
            aria-pressed={traco === 'poligono'}
            onClick={() => {
              aoMudarTraco('poligono');
            }}
          >
            Polígono
          </Button>
        </div>
      </div>

      <div className="mesa-grupo">
        <span className="lab">Salas neste mapa ({salas.length})</span>
        {salas.length === 0 ? (
          <p className="small muted">Nenhuma sala demarcada ainda.</p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {salas.map((sala) => (
              <CartaoDaSala key={sala.id} sala={sala} enviar={enviar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
