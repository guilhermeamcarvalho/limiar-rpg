// Editor único de pontos de interesse (#83): o mesmo componente roda na aba Guia da mesa e na
// página Escudo do mestre, ligado à tabela única `pois`. Editar aqui reflete na hora para todos.
import { useState } from 'react';
import {
  PERICIAS_OP2,
  type ComandoDaMesa,
  type InformacaoDoPoi,
  type PericiaDoPoi,
  type PoiNaMesa,
  type RespostaDoComando,
  type SalaNaMesa,
} from '@membrana/shared';
import type { Ponto } from '../mesa/camera.ts';
import {
  Button,
  Checkbox,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  Tag,
  Textarea,
  useToast,
} from '../ui/index.ts';
import '../pages/Escudo/escudo.css';

function CartaoDoPoi({
  poi,
  salas,
  aoExecutar,
}: {
  poi: PoiNaMesa;
  salas: readonly SalaNaMesa[];
  aoExecutar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(poi.nome);
  const [salaId, setSalaId] = useState(poi.salaId ?? '');
  const [descricao, setDescricao] = useState(poi.descricao);
  const [contextoMestre, setContextoMestre] = useState(poi.contextoMestre);
  const [novaPericia, setNovaPericia] = useState<string>(PERICIAS_OP2[0].id);
  const [novaDt, setNovaDt] = useState('7');
  const [novoNivel, setNovoNivel] = useState('7');
  const [novoTextoInfo, setNovoTextoInfo] = useState('');

  const [anterior, setAnterior] = useState(poi);
  if (anterior !== poi) {
    setAnterior(poi);
    setNome(poi.nome);
    setSalaId(poi.salaId ?? '');
    setDescricao(poi.descricao);
    setContextoMestre(poi.contextoMestre);
  }

  const descobertas = poi.informacoes.filter((i) => i.descoberta).length;
  const tudoDescoberto = poi.informacoes.length > 0 && descobertas === poi.informacoes.length;

  async function atualizar(
    campos: Omit<Extract<ComandoDaMesa, { type: 'poi.update' }>, 'type' | 'poiId'>,
  ) {
    const r = await aoExecutar({ type: 'poi.update', poiId: poi.id, ...campos });
    if (!r.ok)
      avisos.show({ type: 'err', title: 'Não deu para atualizar o ponto', text: r.motivo });
  }

  function salvarTexto() {
    const limpo = nome.trim();
    if (!limpo) return;
    const salaEscolhida = salaId || null;
    if (
      limpo === poi.nome &&
      salaEscolhida === poi.salaId &&
      descricao === poi.descricao &&
      contextoMestre === poi.contextoMestre
    ) {
      return;
    }
    void atualizar({
      nome: limpo,
      salaId: salaEscolhida,
      descricao,
      contextoMestre,
    });
  }

  function adicionarPericia() {
    const dt = Number.parseInt(novaDt, 10);
    if (!Number.isFinite(dt) || dt < 1 || dt > 30) return;
    const pericias: PericiaDoPoi[] = [...poi.pericias, { periciaId: novaPericia, dt }];
    void atualizar({ pericias });
  }

  function adicionarInfo() {
    const texto = novoTextoInfo.trim();
    const nivel = Number.parseInt(novoNivel, 10);
    if (!texto || !Number.isFinite(nivel) || nivel < 1 || nivel > 30) return;
    const informacoes: InformacaoDoPoi[] = [
      ...poi.informacoes,
      { id: `inf_${String(Date.now())}`, nivel, texto, descoberta: false },
    ];
    setNovoTextoInfo('');
    void atualizar({ informacoes });
  }

  function alternarDescoberta(infoId: string) {
    const informacoes = poi.informacoes.map((info) =>
      info.id === infoId ? { ...info, descoberta: !info.descoberta } : info,
    );
    void atualizar({ informacoes });
  }

  return (
    <div className="mesa-bloco card">
      <div className="row between" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Tag tone={tudoDescoberto ? 'green' : 'red'}>{poi.numero}</Tag>
          <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {poi.nome}
          </b>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {poi.informacoes.length > 0 && (
            <span className="small muted">
              {descobertas}/{poi.informacoes.length}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Editar ${poi.nome}`}
            aria-expanded={aberto}
            onClick={() => {
              setAberto((v) => !v);
            }}
          >
            {aberto ? 'Fechar' : 'Editar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="trash" size="sm" />}
            aria-label={`Remover ponto ${poi.nome}`}
            onClick={() => {
              void aoExecutar({ type: 'poi.delete', poiId: poi.id }).then((r) => {
                if (!r.ok)
                  avisos.show({ type: 'err', title: 'Não deu para remover', text: r.motivo });
              });
            }}
          />
        </div>
      </div>

      {aberto && (
        <div className="col" style={{ gap: 10 }}>
          <Field label="Nome do ponto">
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
              }}
              onBlur={salvarTexto}
            />
          </Field>
          <Field label="Sala">
            <Select
              value={salaId}
              onChange={(e) => {
                const v = e.target.value;
                setSalaId(v);
                void atualizar({ salaId: v || null });
              }}
            >
              <option value="">Sem sala definida</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição para cena">
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
              }}
              onBlur={salvarTexto}
            />
          </Field>
          <Field label="Contexto do mestre (secreto)">
            <Textarea
              placeholder="Só você vê este campo; nunca vai para os jogadores…"
              rows={2}
              value={contextoMestre}
              onChange={(e) => {
                setContextoMestre(e.target.value);
              }}
              onBlur={salvarTexto}
            />
          </Field>

          <div className="escudo-poi-bloco">
            <span className="lab">Perícias para investigar ({poi.pericias.length})</span>
            <span className="small muted">
              Quais testes os jogadores podem rolar neste ponto (ex.: Percepção DT 7).
            </span>
            {poi.pericias.length > 0 && (
              <div className="escudo-poi-lista">
                {poi.pericias.map((p, idx) => (
                  <div
                    key={`${p.periciaId}-${String(idx)}`}
                    className="escudo-poi-info row between"
                  >
                    <span className="small">
                      <b>{PERICIAS_OP2.find((x) => x.id === p.periciaId)?.nome ?? p.periciaId}</b>{' '}
                      <span className="muted">· DT {p.dt}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="close" size="sm" />}
                      aria-label="Remover perícia"
                      onClick={() => {
                        void atualizar({ pericias: poi.pericias.filter((_, i) => i !== idx) });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <form
              className="escudo-poi-form"
              onSubmit={(e) => {
                e.preventDefault();
                adicionarPericia();
              }}
            >
              <Field label="Perícia" className="escudo-poi-texto">
                <Select
                  value={novaPericia}
                  onChange={(e) => {
                    setNovaPericia(e.target.value);
                  }}
                >
                  {PERICIAS_OP2.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="DT" className="escudo-poi-dt">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={novaDt}
                  onChange={(e) => {
                    setNovaDt(e.target.value);
                  }}
                />
              </Field>
              <Button type="submit" size="sm">
                + Perícia
              </Button>
            </form>
          </div>

          <div className="escudo-poi-bloco">
            <span className="lab">Informações reveladas por DT ({poi.informacoes.length})</span>
            <span className="small muted">
              Os jogadores veem tarjas pretas até atingirem a DT mínima no teste. Marque a caixa
              para revelar ou ocultar na mão.
            </span>
            {poi.informacoes.length > 0 && (
              <div className="escudo-poi-lista">
                {poi.informacoes.map((info) => (
                  <div key={info.id} className="escudo-poi-info row between">
                    <div className="row grow" style={{ gap: 8, minWidth: 0 }}>
                      <Tag {...(info.descoberta && { tone: 'green' as const })}>
                        DT {info.nivel}
                      </Tag>
                      <Checkbox
                        label={
                          <span>
                            {info.texto}{' '}
                            <span className="small muted">
                              ({info.descoberta ? 'revelada' : 'oculta'})
                            </span>
                          </span>
                        }
                        checked={Boolean(info.descoberta)}
                        onChange={() => {
                          alternarDescoberta(info.id);
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="close" size="sm" />}
                      aria-label="Remover informação"
                      onClick={() => {
                        void atualizar({
                          informacoes: poi.informacoes.filter((i) => i.id !== info.id),
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <form
              className="escudo-poi-form"
              onSubmit={(e) => {
                e.preventDefault();
                adicionarInfo();
              }}
            >
              <Field label="DT mínima" className="escudo-poi-dt">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={novoNivel}
                  onChange={(e) => {
                    setNovoNivel(e.target.value);
                  }}
                />
              </Field>
              <Field label="O que descobrem" className="escudo-poi-texto">
                <Input
                  placeholder="Ex.: O gravador tem fita de 1998…"
                  value={novoTextoInfo}
                  onChange={(e) => {
                    setNovoTextoInfo(e.target.value);
                  }}
                />
              </Field>
              <Button type="submit" size="sm">
                + Info
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditorPoi({
  salas,
  pois,
  temMapa,
  aoExecutar,
  aoEscolherNoMapa,
  centroPadrao,
  criarEmModal = false,
}: {
  salas: readonly SalaNaMesa[];
  pois: readonly PoiNaMesa[];
  temMapa: boolean;
  aoExecutar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoEscolherNoMapa?: (aoClicar: (ponto: Ponto) => void) => void;
  centroPadrao?: Ponto;
  criarEmModal?: boolean;
}) {
  const avisos = useToast();
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [salaNova, setSalaNova] = useState('');
  const [descricaoNova, setDescricaoNova] = useState('');
  const [contextoNovo, setContextoNovo] = useState('');

  async function criarEm(ponto: Ponto) {
    const nome = nomeNovo.trim() || `Ponto ${String(pois.length + 1)}`;
    const r = await aoExecutar({
      type: 'poi.create',
      nome,
      ...(salaNova && { salaId: salaNova }),
      ...(descricaoNova.trim() && { descricao: descricaoNova.trim() }),
      ...(contextoNovo.trim() && { contextoMestre: contextoNovo.trim() }),
      x: ponto.x,
      y: ponto.y,
    });
    if (r.ok) {
      setNomeNovo('');
      setSalaNova('');
      setDescricaoNova('');
      setContextoNovo('');
      setModalAberto(false);
    } else {
      avisos.show({ type: 'err', title: 'Não deu para criar o ponto', text: r.motivo });
    }
  }

  const ordenados = [...pois].sort((a, b) => a.numero - b.numero);

  const formularioNovoPoi = (
    <div className="col" style={{ gap: 8 }}>
      <Field label="Nome do ponto de interesse">
        <Input
          placeholder="Ex.: Mesa de som, Armário…"
          value={nomeNovo}
          onChange={(e) => {
            setNomeNovo(e.target.value);
          }}
        />
      </Field>
      {criarEmModal && (
        <>
          <Field label="Sala">
            <Select
              value={salaNova}
              onChange={(e) => {
                setSalaNova(e.target.value);
              }}
            >
              <option value="">Sem sala definida</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição para cena">
            <Textarea
              rows={2}
              placeholder="O que aparece no cartão do ponto…"
              value={descricaoNova}
              onChange={(e) => {
                setDescricaoNova(e.target.value);
              }}
            />
          </Field>
          <Field label="Contexto do mestre (secreto)">
            <Textarea
              rows={2}
              placeholder="Só você lê este campo…"
              value={contextoNovo}
              onChange={(e) => {
                setContextoNovo(e.target.value);
              }}
            />
          </Field>
        </>
      )}
      <Button
        size="sm"
        variant="primary"
        icon={<Icon name="pin" size="sm" />}
        onClick={() => {
          if (aoEscolherNoMapa) {
            aoEscolherNoMapa((ponto) => {
              void criarEm(ponto);
            });
          } else {
            void criarEm(centroPadrao ?? { x: 200, y: 200 });
          }
        }}
      >
        {aoEscolherNoMapa ? 'Marcar novo ponto no mapa' : 'Adicionar ponto no mapa'}
      </Button>
    </div>
  );

  return (
    <div className="col" style={{ gap: 10 }}>
      {!temMapa ? (
        <p className="small muted">Ponha um mapa na mesa para criar pontos de interesse.</p>
      ) : criarEmModal ? (
        <>
          <div className="row">
            <Button
              size="sm"
              variant="primary"
              icon={<Icon name="plus" size="sm" />}
              onClick={() => {
                setModalAberto(true);
              }}
            >
              Adicionar ponto
            </Button>
          </div>
          <Modal
            open={modalAberto}
            onClose={() => {
              setModalAberto(false);
            }}
            title="Novo ponto de interesse"
          >
            {formularioNovoPoi}
          </Modal>
        </>
      ) : (
        formularioNovoPoi
      )}

      {ordenados.length === 0 ? (
        <p className="small muted">Nenhum ponto de interesse ainda.</p>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {ordenados.map((poi) => (
            <CartaoDoPoi key={poi.id} poi={poi} salas={salas} aoExecutar={aoExecutar} />
          ))}
        </div>
      )}
    </div>
  );
}
