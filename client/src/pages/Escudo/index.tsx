// /campanhas/:id/escudo (artboard "13 · Sala do mestre", #82, #83): só o mestre vê.
// Lê e edita a mesma tabela de salas e pontos de interesse da mesa ao vivo.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { io, type Socket } from 'socket.io-client';
import {
  modeloPadraoDoEscudo,
  tituloDaPagina,
  type ComandoDaMesa,
  type EventosDoCliente,
  type EventosDoServidor,
  type ItemDoInventario,
  type MapaNaMesa,
  type NotasDoEscudo,
  type PersonagemNaMesa,
  type PistaNaMesa,
  type PoiNaMesa,
  type RespostaDoComando,
  type SalaNaMesa,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { linkDaCampanha } from '../../casos/formatos.ts';
import { FerramentaDePistas } from '../../mesa/painel/Pistas.tsx';
import { EditorPoi } from '../../mestre/EditorPoi.tsx';
import { MiniMapaSeletor } from '../../mestre/MiniMapaSeletor.tsx';
import {
  Async,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  Skeleton,
  Tag,
  Textarea,
  useCarga,
  useToast,
} from '../../ui/index.ts';
import { BlocosEditaveis } from './BlocosEditaveis.tsx';
import { PainelRelogiosESegredos } from './Relogio.tsx';
import './escudo.css';

interface DadosDoEscudo {
  campanha: { id: string; nome: string };
  mapa: MapaNaMesa | null;
  salas: SalaNaMesa[];
  pois: PoiNaMesa[];
  pistas?: PistaNaMesa[];
  inventario?: ItemDoInventario[];
  personagens?: PersonagemNaMesa[];
  notas?: NotasDoEscudo;
}

function SalaNoEscudo({
  sala,
  qtdPois,
  aoExecutar,
}: {
  sala: SalaNaMesa;
  qtdPois: number;
  aoExecutar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(sala.nome);
  const [notas, setNotas] = useState(sala.notasMestre);
  const [salvando, setSalvando] = useState(false);
  const [salvoAgora, setSalvoAgora] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const [anterior, setAnterior] = useState(sala);
  if (anterior !== sala) {
    setAnterior(sala);
    setNome(sala.nome);
    setNotas(sala.notasMestre);
    setConfirmandoRemocao(false);
  }

  const limpo = nome.trim();
  const sujo = limpo !== '' && (limpo !== sala.nome || notas !== sala.notasMestre);

  async function salvar() {
    if (!limpo || salvando) return;
    if (limpo === sala.nome && notas === sala.notasMestre) return;
    setSalvando(true);
    try {
      const r = await aoExecutar({
        type: 'room.update',
        salaId: sala.id,
        nome: limpo,
        notasMestre: notas,
      });
      if (!r.ok) {
        avisos.show({ type: 'err', title: 'Não deu para salvar a sala', text: r.motivo });
        return;
      }
      setSalvoAgora(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mesa-bloco card" style={{ padding: '10px 12px' }}>
      <div className="row between" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Icon name="door" size="sm" />
          <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sala.nome}
          </b>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {qtdPois > 0 && (
            <span className="small muted">
              {qtdPois === 1 ? '1 POI' : `${String(qtdPois)} POIs`}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Editar ${sala.nome}`}
            aria-expanded={aberto}
            onClick={() => {
              setAberto((v) => !v);
            }}
          >
            {aberto ? 'Fechar' : 'Editar'}
          </Button>
          {confirmandoRemocao ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  void aoExecutar({ type: 'room.delete', salaId: sala.id });
                }}
              >
                Remover
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmandoRemocao(false);
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={<Icon name="trash" size="sm" />}
              aria-label={`Remover sala ${sala.nome}`}
              onClick={() => {
                setConfirmandoRemocao(true);
              }}
            />
          )}
        </div>
      </div>

      {aberto && (
        <div className="col" style={{ gap: 8, marginTop: 8 }}>
          <Field label="Nome da sala">
            <Input
              aria-label={`Nome da sala ${sala.nome}`}
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setSalvoAgora(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void salvar();
                }
              }}
              onBlur={() => {
                void salvar();
              }}
            />
          </Field>
          <Field label="Notas secretas">
            <Textarea
              placeholder="O que só você precisa lembrar sobre esta área…"
              rows={3}
              value={notas}
              onChange={(e) => {
                setNotas(e.target.value);
                setSalvoAgora(false);
              }}
              onBlur={() => {
                void salvar();
              }}
            />
          </Field>
          <div className="row between" style={{ gap: 8 }}>
            {sujo ? (
              <Button
                size="sm"
                variant="primary"
                loading={salvando}
                onClick={() => {
                  void salvar();
                }}
              >
                Salvar
              </Button>
            ) : salvoAgora ? (
              <span className="small muted" role="status">
                Salvo
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function areaRetangular(
  centro: { x: number; y: number },
  mapa: MapaNaMesa | null,
): { x: number; y: number }[] {
  const largura = mapa?.largura ?? 800;
  const altura = mapa?.altura ?? 600;
  const meiaLargura = Math.max(40, Math.round(largura * 0.12));
  const meiaAltura = Math.max(40, Math.round(altura * 0.12));
  const x1 = Math.max(0, Math.round(centro.x - meiaLargura));
  const y1 = Math.max(0, Math.round(centro.y - meiaAltura));
  const x2 = Math.min(largura, Math.round(centro.x + meiaLargura));
  const y2 = Math.min(altura, Math.round(centro.y + meiaAltura));
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function PainelDeSalas({
  salas,
  pois,
  mapa,
  aoExecutar,
}: {
  salas: readonly SalaNaMesa[];
  pois: readonly PoiNaMesa[];
  mapa: MapaNaMesa | null;
  aoExecutar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [notasNovas, setNotasNovas] = useState('');
  const [criando, setCriando] = useState(false);
  const [pontoModal, setPontoModal] = useState<{ x: number; y: number }>({
    x: mapa ? mapa.largura / 2 : 200,
    y: mapa ? mapa.altura / 2 : 200,
  });

  async function criar() {
    if (criando) return;
    const nome = nomeNovo.trim() || `Sala ${String(salas.length + 1)}`;
    setCriando(true);
    try {
      const r = await aoExecutar({
        type: 'room.create',
        nome,
        area: areaRetangular(pontoModal, mapa),
        ...(notasNovas.trim() && { notasMestre: notasNovas.trim() }),
      });
      if (!r.ok) {
        avisos.show({ type: 'err', title: 'Não deu para criar a sala', text: r.motivo });
        return;
      }
      setNomeNovo('');
      setNotasNovas('');
      setModalAberto(false);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="small muted">
        Áreas demarcadas no mapa. Só você vê os contornos e as notas de cada sala.
      </p>

      <div>
        <Button
          size="sm"
          variant="primary"
          icon={<Icon name="door" size="sm" />}
          onClick={() => {
            setModalAberto(true);
          }}
        >
          Adicionar sala
        </Button>
      </div>

      <Modal
        open={modalAberto}
        title="Nova sala"
        onClose={() => {
          setModalAberto(false);
        }}
      >
        <div className="col" style={{ gap: 10 }}>
          <Field label="Nome da nova sala">
            <Input
              placeholder="Ex.: Cabine de som, Porão…"
              value={nomeNovo}
              onChange={(e) => {
                setNomeNovo(e.target.value);
              }}
            />
          </Field>
          {mapa && (
            <MiniMapaSeletor
              mapa={mapa}
              ponto={pontoModal}
              aoMudar={setPontoModal}
              rotulo="Posição da sala no mapa"
            />
          )}
          <Field label="Notas secretas">
            <Textarea
              rows={3}
              placeholder="O que só você precisa lembrar sobre esta área…"
              value={notasNovas}
              onChange={(e) => {
                setNotasNovas(e.target.value);
              }}
            />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button
              size="sm"
              variant="primary"
              icon={<Icon name="door" size="sm" />}
              loading={criando}
              onClick={() => {
                void criar();
              }}
            >
              Adicionar sala no mapa
            </Button>
          </div>
        </div>
      </Modal>

      {salas.length === 0 ? (
        <EmptyState icon={<Icon name="door" size="xl" />} title="Nenhuma sala ainda">
          Adicione uma sala aqui ou use a ferramenta Salas (S) na mesa para demarcar no mapa.
        </EmptyState>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {salas.map((sala) => (
            <SalaNoEscudo
              key={sala.id}
              sala={sala}
              qtdPois={pois.filter((p) => p.salaId === sala.id).length}
              aoExecutar={aoExecutar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SecaoEscudo({
  id,
  titulo,
  abertaPorPadrao = true,
  children,
}: {
  id: string;
  titulo: string;
  abertaPorPadrao?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(abertaPorPadrao);
  return (
    <section className="col escudo-coluna" aria-labelledby={id}>
      <button
        type="button"
        id={id}
        className="escudo-faixa escudo-toggle"
        aria-expanded={aberta}
        onClick={() => {
          setAberta((v) => !v);
        }}
      >
        <span>{titulo}</span>
        <Icon name={aberta ? 'down' : 'next'} size="sm" />
      </button>
      {aberta && children}
    </section>
  );
}

export function Escudo() {
  const { id = '' } = useParams();
  const avisos = useToast();
  const [atual, setAtual] = useState<DadosDoEscudo | null>(null);
  const [virado, setVirado] = useState(false);
  const [situacaoNotas, setSituacaoNotas] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso');
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  const uso = useCarga(`/api/campanhas/${id}/escudo`, (signal) =>
    pedir<DadosDoEscudo>(`/api/campanhas/${encodeURIComponent(id)}/escudo`, { signal }),
  );

  const dados = atual ?? (uso.carga.estado === 'pronto' ? uso.carga.dados : null);
  const cargaRef = useRef(uso.carga);
  useEffect(() => {
    cargaRef.current = uso.carga;
  }, [uso.carga]);

  useEffect(() => {
    document.title = tituloDaPagina(dados ? `Escudo · ${dados.campanha.nome}` : 'Escudo');
  }, [dados]);

  // Sincronização em tempo real: mantém o Escudo atualizado quando a Mesa sofre alterações.
  useEffect(() => {
    if (!id) return;
    const baseDe = (prev: DadosDoEscudo | null) =>
      prev ?? (cargaRef.current.estado === 'pronto' ? cargaRef.current.dados : null);
    const socket: Socket<EventosDoServidor, EventosDoCliente> = io({ auth: { campanhaId: id } });
    socket.on('evt', (evento) => {
      if (evento.type === 'mesa.estado' && evento.estado.papel === 'mestre') {
        setAtual((prev) => {
          const base = baseDe(prev);
          if (!base) return null;
          return {
            ...base,
            mapa: evento.estado.mapa,
            salas: evento.estado.salas ?? base.salas,
            pois: evento.estado.pois.filter((p): p is PoiNaMesa => 'contextoMestre' in p),
            pistas: evento.estado.pistas.filter((p): p is PistaNaMesa => 'notaMestre' in p),
            inventario: evento.estado.inventario,
          };
        });
      } else if (evento.type === 'clue.changed') {
        const { pistaId, pista } = evento;
        setAtual((prev) => {
          const base = baseDe(prev);
          if (!base) return null;
          const atuais = base.pistas ?? [];
          if (!pista) return { ...base, pistas: atuais.filter((p) => p.id !== pistaId) };
          if (!('notaMestre' in pista)) return base;
          const existe = atuais.some((p) => p.id === pistaId);
          return {
            ...base,
            pistas: existe ? atuais.map((p) => (p.id === pistaId ? pista : p)) : [...atuais, pista],
          };
        });
      } else if (evento.type === 'poi.changed') {
        const { poiId, poi } = evento;
        setAtual((prev) => {
          const base = baseDe(prev);
          if (!base) return null;
          if (!poi) return { ...base, pois: base.pois.filter((p) => p.id !== poiId) };
          if (!('contextoMestre' in poi)) return base;
          const existe = base.pois.some((p) => p.id === poiId);
          return {
            ...base,
            pois: existe ? base.pois.map((p) => (p.id === poiId ? poi : p)) : [...base.pois, poi],
          };
        });
      } else if (evento.type === 'clue.received' || evento.type === 'clue.presented') {
        const { item } = evento;
        setAtual((prev) => {
          const base = baseDe(prev);
          if (!base) return null;
          const inv = base.inventario ?? [];
          const existe = inv.some(
            (i) => i.pistaId === item.pistaId && i.personagemId === item.personagemId,
          );
          return {
            ...base,
            inventario: existe
              ? inv.map((i) =>
                  i.pistaId === item.pistaId && i.personagemId === item.personagemId ? item : i,
                )
              : [...inv, item],
          };
        });
      } else if (evento.type === 'clue.revoked') {
        setAtual((prev) => {
          const base = baseDe(prev);
          if (!base) return null;
          return {
            ...base,
            inventario: (base.inventario ?? []).filter(
              (i) => !(i.pistaId === evento.pistaId && i.personagemId === evento.personagemId),
            ),
          };
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [id]);

  async function executar(comando: ComandoDaMesa): Promise<RespostaDoComando> {
    try {
      const resposta = await pedir<{
        mapa: MapaNaMesa | null;
        salas: SalaNaMesa[];
        pois: PoiNaMesa[];
        pistas?: PistaNaMesa[];
        inventario?: ItemDoInventario[];
      }>(`/api/campanhas/${encodeURIComponent(id)}/escudo/comandos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(comando),
      });
      setAtual((prev) => {
        const base = prev ?? (uso.carga.estado === 'pronto' ? uso.carga.dados : null);
        return base ? { ...base, ...resposta } : null;
      });
      return { ok: true };
    } catch (erro) {
      return {
        ok: false,
        motivo: erro instanceof ErroDaApi ? erro.message : 'Não deu para salvar.',
      };
    }
  }

  async function salvarNotas(proximas: NotasDoEscudo) {
    setAtual((prev) => {
      const base = prev ?? (uso.carga.estado === 'pronto' ? uso.carga.dados : null);
      return base ? { ...base, notas: proximas } : null;
    });
    setSituacaoNotas('salvando');
    try {
      await pedir<{ notas: NotasDoEscudo }>(
        `/api/campanhas/${encodeURIComponent(id)}/escudo/notas`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(proximas),
        },
      );
      setSituacaoNotas('salvo');
    } catch (erro) {
      setSituacaoNotas('ocioso');
      avisos.show({
        type: 'err',
        title: 'Não deu para salvar as notas do escudo',
        text: erro instanceof ErroDaApi ? erro.message : 'Tente novamente.',
      });
    }
  }

  return (
    <div className="wrap col escudo">
      <Async uso={uso} falha="O escudo não abriu." esqueleto={<Skeleton />}>
        {(carregado) => {
          const escudo = atual ?? carregado;
          const notas = escudo.notas ?? modeloPadraoDoEscudo();
          return (
            <div className="col" style={{ gap: 24 }}>
              <div className="row between wrapx" style={{ alignItems: 'flex-end', gap: 12 }}>
                <div className="col" style={{ gap: 6 }}>
                  <div className="row wrapx" style={{ gap: 8 }}>
                    <Tag tone="gold">Só você vê esta página</Tag>
                    {situacaoNotas === 'salvando' && (
                      <span className="small muted" role="status">
                        Salvando…
                      </span>
                    )}
                    {situacaoNotas === 'salvo' && (
                      <span className="small muted" role="status">
                        Salvo
                      </span>
                    )}
                  </div>
                  <h1 className="h1">Escudo do mestre</h1>
                  <p className="muted">
                    Salas e pontos de interesse ligados à mesa ao vivo. Editar aqui atualiza a mesa
                    na hora; notas e contexto nunca vão para os jogadores.
                  </p>
                </div>
                <div className="row wrapx" style={{ gap: 8 }}>
                  <Button
                    size="sm"
                    variant={virado ? 'primary' : 'ghost'}
                    aria-pressed={virado}
                    icon={<Icon name={virado ? 'eye' : 'eyeoff'} size="sm" />}
                    onClick={() => {
                      setVirado((v) => !v);
                    }}
                  >
                    {virado ? 'Desvirar escudo' : 'Virar o escudo'}
                  </Button>
                  {!virado &&
                    (confirmarRestaurar ? (
                      <div className="row" style={{ gap: 4 }}>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setConfirmarRestaurar(false);
                            void salvarNotas(modeloPadraoDoEscudo());
                          }}
                        >
                          Confirmar restauração
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmarRestaurar(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmarRestaurar(true);
                        }}
                      >
                        Restaurar modelo
                      </Button>
                    ))}
                  <Link className="btn red" to={linkDaCampanha(id, 'mesa')}>
                    <Icon name="map" size="sm" />
                    Abrir mesa
                  </Link>
                </div>
              </div>

              {virado ? (
                <div className="col" style={{ gap: 16 }}>
                  <div className="banner">
                    <Icon name="eyeoff" size="sm" />
                    <span>
                      Escudo virado: salas, pistas, ameaças, relógios e segredos estão ocultos.
                    </span>
                  </div>
                  <SecaoEscudo id="escudo-regras" titulo="Regras na mão">
                    <div className="card col escudo-bloco">
                      <span className="lab">Dificuldade (DT)</span>
                      <div className="kv">
                        <span>Fácil</span>
                        <b>5</b>
                      </div>
                      <div className="kv">
                        <span>Padrão</span>
                        <b>7</b>
                      </div>
                      <div className="kv">
                        <span>Difícil</span>
                        <b>10</b>
                      </div>
                      <div className="kv">
                        <span>Muito difícil</span>
                        <b>13</b>
                      </div>
                    </div>
                  </SecaoEscudo>
                </div>
              ) : (
                <div className="escudo-grade">
                  <SecaoEscudo id="escudo-salas" titulo={`Salas (${String(escudo.salas.length)})`}>
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <PainelDeSalas
                        salas={escudo.salas}
                        pois={escudo.pois}
                        mapa={escudo.mapa}
                        aoExecutar={executar}
                      />
                    </div>
                  </SecaoEscudo>

                  <SecaoEscudo
                    id="escudo-pistas"
                    titulo={`Pistas (${String((escudo.pistas ?? []).length)})`}
                  >
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <FerramentaDePistas
                        campanhaId={id}
                        pistas={escudo.pistas ?? []}
                        inventario={escudo.inventario ?? []}
                        personagens={escudo.personagens ?? []}
                        temMapa={Boolean(escudo.mapa)}
                        mapa={escudo.mapa}
                        enviar={executar}
                        criarEmModal
                        centroPadrao={
                          escudo.mapa
                            ? { x: escudo.mapa.largura / 2, y: escudo.mapa.altura / 2 }
                            : { x: 200, y: 200 }
                        }
                      />
                    </div>
                  </SecaoEscudo>

                  <SecaoEscudo
                    id="escudo-pois"
                    titulo={`Pontos de interesse (${String(escudo.pois.length)})`}
                  >
                    <p className="small muted">
                      Lugares clicáveis no mapa. Cada ponto pode pedir perícias e liberar
                      informações conforme a DT alcançada.
                    </p>
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <EditorPoi
                        salas={escudo.salas}
                        pois={escudo.pois}
                        temMapa={Boolean(escudo.mapa)}
                        mapa={escudo.mapa}
                        aoExecutar={executar}
                        criarEmModal
                        centroPadrao={
                          escudo.mapa
                            ? { x: escudo.mapa.largura / 2, y: escudo.mapa.altura / 2 }
                            : { x: 200, y: 200 }
                        }
                      />
                    </div>
                  </SecaoEscudo>

                  <SecaoEscudo
                    id="escudo-ameacas"
                    titulo={`Ameaças e NPCs (${String(notas.ameacas.length)})`}
                  >
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <BlocosEditaveis
                        blocos={notas.ameacas}
                        rotuloAdicionar="Adicionar ameaça ou NPC"
                        tituloModal="Nova ameaça ou NPC"
                        placeholderTitulo="Ex.: Vulto na estática, Delegado…"
                        placeholderTexto="Comportamento, gatilhos e notas rápidas…"
                        vazio="Nenhuma ameaça ou NPC anotado ainda."
                        aoMudar={(ameacas) => {
                          void salvarNotas({ ...notas, ameacas });
                        }}
                      />
                    </div>
                  </SecaoEscudo>

                  <SecaoEscudo id="escudo-segredos" titulo="Segredos e relógios">
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <PainelRelogiosESegredos
                        relogios={notas.relogios}
                        segredos={notas.segredos}
                        aoMudarRelogios={(relogios) => {
                          void salvarNotas({ ...notas, relogios });
                        }}
                        aoMudarSegredos={(segredos) => {
                          void salvarNotas({ ...notas, segredos });
                        }}
                      />
                    </div>
                  </SecaoEscudo>

                  <SecaoEscudo id="escudo-regras" titulo="Regras na mão">
                    <div className="card col escudo-bloco">
                      <span className="lab">Dificuldade (DT)</span>
                      <div className="kv">
                        <span>Fácil</span>
                        <b>5</b>
                      </div>
                      <div className="kv">
                        <span>Padrão</span>
                        <b>7</b>
                      </div>
                      <div className="kv">
                        <span>Difícil</span>
                        <b>10</b>
                      </div>
                      <div className="kv">
                        <span>Muito difícil</span>
                        <b>13</b>
                      </div>
                    </div>
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <BlocosEditaveis
                        blocos={notas.regras}
                        rotuloAdicionar="Adicionar regra"
                        tituloModal="Nova regra na mão"
                        placeholderTitulo="Ex.: Dano por queda, Furtividade…"
                        placeholderTexto="Resumo rápido para consulta durante a sessão…"
                        vazio="Nenhum bloco de regra extra."
                        aoMudar={(regras) => {
                          void salvarNotas({ ...notas, regras });
                        }}
                      />
                    </div>
                  </SecaoEscudo>
                </div>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
