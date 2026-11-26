// Cartão flutuante do ponto de interesse (artboard 10 · Mesa, #84, #85, #86):
// mostra Investigar (1 ação), Examinar (−1 PD se não achar nada novo), Interagir (texto livre) e
// Desafio de acesso (tentativas e travamento), sempre com o custo visível antes de clicar.
// Informações ainda não descobertas aparecem como tarjas pretas; recém-descobertas ganham destaque.
import { useState } from 'react';
import {
  PERICIAS_OP2,
  type ComandoDaMesa,
  type Papel,
  type PoiNaMesa,
  type PoiParaJogador,
  type RespostaDoComando,
} from '@membrana/shared';
import { Button, cx, Icon, Input, Select, Tag, useToast } from '../ui/index.ts';

const rotuloPericia = (id: string) => PERICIAS_OP2.find((p) => p.id === id)?.nome ?? id;

const ROTULO_DESAFIO: Record<string, string> = {
  destrancar: 'Destrancar',
  arrombar: 'Arrombar',
  hack: 'Hack social',
  alcancar: 'Alcançar',
};

export function CartaoPoi({
  poi,
  papel,
  meuPersonagemId,
  novasInfoIds,
  enviar,
  aoFechar,
}: {
  poi: PoiNaMesa | PoiParaJogador;
  papel: Papel;
  meuPersonagemId: string | null;
  novasInfoIds: readonly string[];
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoFechar: () => void;
}) {
  const avisos = useToast();
  const [pericia, setPericia] = useState(poi.pericias[0]?.periciaId ?? 'percepcao');
  const [interagindo, setInteragindo] = useState(false);
  const [textoInteracao, setTextoInteracao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mestre = papel === 'mestre';
  const estadoDesafio = poi.estadoDesafio ?? null;
  const travado = Boolean(estadoDesafio?.travado);
  const periciaNome = rotuloPericia(pericia);
  const dtPrincipal = poi.pericias.find((p) => p.periciaId === pericia)?.dt ?? poi.pericias[0]?.dt;
  const ocultas = poi.informacoes.filter((i) => !i.descoberta).length;

  async function disparar(comando: ComandoDaMesa) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await enviar(comando);
      if (!r.ok) avisos.show({ type: 'warn', title: 'Não deu', text: r.motivo });
      return r.ok;
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="card cartao-poi"
      role="dialog"
      aria-label={`Ponto ${String(poi.numero)}: ${poi.nome}`}
    >
      <div className="cartao-poi-topo">
        <Tag tone={ocultas === 0 && poi.informacoes.length > 0 ? 'green' : 'red'}>{poi.numero}</Tag>
        <div className="grow col" style={{ gap: 2 }}>
          <b className="cartao-poi-titulo">{poi.nome}</b>
          {poi.descricao && <p className="doc small cartao-poi-desc">{poi.descricao}</p>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="close" size="sm" />}
          aria-label="Fechar ponto de interesse"
          onClick={aoFechar}
        />
      </div>

      <div className="col cartao-poi-corpo">
        {travado && (
          <div className="row between cartao-poi-travado" role="status">
            <span className="small">
              Ponto travado ({estadoDesafio?.tentativasUsadas}/{estadoDesafio?.tentativasMaximas}{' '}
              tentativas).
            </span>
            {mestre && (
              <Button
                size="sm"
                onClick={() =>
                  void disparar({ type: 'poi.investigate', poiId: poi.id, modo: 'liberar' })
                }
              >
                Liberar ponto
              </Button>
            )}
          </div>
        )}

        {poi.pericias.length > 1 && (
          <Select
            aria-label="Perícia para investigar"
            value={pericia}
            onChange={(e) => {
              setPericia(e.target.value);
            }}
          >
            {poi.pericias.map((p) => (
              <option key={p.periciaId} value={p.periciaId}>
                {rotuloPericia(p.periciaId)} · DT {p.dt}
              </option>
            ))}
          </Select>
        )}

        <div className="col" style={{ gap: 8 }}>
          <button
            type="button"
            className="opt red"
            disabled={enviando || travado}
            onClick={() =>
              void disparar({
                type: 'poi.investigate',
                poiId: poi.id,
                modo: 'investigar',
                periciaId: pericia,
                ...(meuPersonagemId && { personagemId: meuPersonagemId }),
              })
            }
          >
            <b>Investigar</b>
            <span>
              {periciaNome}
              {dtPrincipal ? ` · DT ${String(dtPrincipal)}` : ''} · gasta sua ação da rodada
            </span>
          </button>

          <button
            type="button"
            className="opt"
            disabled={enviando || travado}
            onClick={() =>
              void disparar({
                type: 'poi.investigate',
                poiId: poi.id,
                modo: 'examinar',
                periciaId: pericia,
                ...(meuPersonagemId && { personagemId: meuPersonagemId }),
              })
            }
          >
            <b>Examinar</b>
            <span>{periciaNome} · custa 1 PD se não houver nada novo</span>
          </button>

          <button
            type="button"
            className="opt"
            disabled={enviando || travado}
            onClick={() => {
              setInteragindo((v) => !v);
            }}
          >
            <b>Interagir</b>
            <span>Descreva a ação; o mestre decide o teste</span>
          </button>

          {interagindo && (
            <form
              className="row"
              style={{ gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                const limpo = textoInteracao.trim();
                if (!limpo) return;
                void disparar({
                  type: 'poi.investigate',
                  poiId: poi.id,
                  modo: 'interagir',
                  texto: limpo,
                }).then((ok) => {
                  if (ok) {
                    setTextoInteracao('');
                    setInteragindo(false);
                  }
                });
              }}
            >
              <Input
                aria-label="Descrever interação"
                placeholder="Ex.: Forço a gaveta com o pé de cabra…"
                value={textoInteracao}
                onChange={(e) => {
                  setTextoInteracao(e.target.value);
                }}
              />
              <Button type="submit" size="sm" variant="primary" disabled={enviando}>
                Enviar
              </Button>
            </form>
          )}

          {poi.desafio && (
            <button
              type="button"
              className="opt"
              disabled={enviando || travado || Boolean(estadoDesafio?.resolvido)}
              onClick={() =>
                void disparar({
                  type: 'poi.investigate',
                  poiId: poi.id,
                  modo: 'desafio',
                  periciaId: pericia,
                  ...(meuPersonagemId && { personagemId: meuPersonagemId }),
                })
              }
            >
              <b>{ROTULO_DESAFIO[poi.desafio.tipo] ?? poi.desafio.tipo}</b>
              <span>
                {estadoDesafio?.resolvido
                  ? 'Resolvido'
                  : `${poi.desafio.dt ? `DT ${String(poi.desafio.dt)} · ` : ''}${
                      poi.desafio.tipo === 'arrombar' ? '−1 PV por tentativa · ' : ''
                    }${String(estadoDesafio?.tentativasUsadas ?? 0)}/${String(
                      estadoDesafio?.tentativasMaximas ?? 4,
                    )} tentativas`}
              </span>
            </button>
          )}
        </div>

        {poi.informacoes.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <div className="row small muted">
              <Icon name="lock" size="sm" />
              <span>
                {ocultas > 0
                  ? `${String(ocultas)} ${ocultas === 1 ? 'informação ainda escondida' : 'informações ainda escondidas'}`
                  : 'Todas as informações descobertas'}
              </span>
            </div>
            {poi.informacoes.map((info) =>
              info.descoberta ? (
                <div
                  key={info.id}
                  className={cx('poi-info', novasInfoIds.includes(info.id) && 'destaque')}
                >
                  <span className="small muted">DT {info.nivel} · </span>
                  <span className="small">{info.texto}</span>
                </div>
              ) : (
                <div key={info.id} className="poi-tarja" aria-label="Informação oculta">
                  <Icon name="lock" size="sm" />
                  <span className="small">DT {info.nivel} · informação escondida</span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
