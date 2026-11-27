// Relógios de segmentos (2 a 12) e lista de segredos do Escudo (#93).
import { useState } from 'react';
import type { RelogioDoEscudo, SegredoDoEscudo } from '@membrana/shared';
import { Button, Field, Icon, Input, Modal, Select, Tag, Textarea } from '../../ui/index.ts';

function arcoSegmento(indice: number, total: number, raio: number, centro: number): string {
  const passo = (Math.PI * 2) / total;
  const inicio = -Math.PI / 2 + indice * passo;
  const fim = inicio + passo;
  const x1 = centro + raio * Math.cos(inicio);
  const y1 = centro + raio * Math.sin(inicio);
  const x2 = centro + raio * Math.cos(fim);
  const y2 = centro + raio * Math.sin(fim);
  const grande = passo > Math.PI ? 1 : 0;
  return `M ${String(centro)} ${String(centro)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${String(raio)} ${String(raio)} 0 ${String(grande)} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export function MostradorDoRelogio({
  segmentos,
  preenchidos,
  titulo,
}: {
  segmentos: number;
  preenchidos: number;
  titulo: string;
}) {
  const tamanho = 44;
  const centro = tamanho / 2;
  const raio = 19;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${String(tamanho)} ${String(tamanho)}`}
      className="escudo-relogio-svg"
      role="img"
      aria-label={`${titulo}: ${String(preenchidos)} de ${String(segmentos)}`}
    >
      {Array.from({ length: segmentos }, (_, i) => (
        <path
          key={i}
          d={arcoSegmento(i, segmentos, raio, centro)}
          className={i < preenchidos ? 'escudo-relogio-fatia on' : 'escudo-relogio-fatia'}
        />
      ))}
      <circle cx={centro} cy={centro} r={raio} className="escudo-relogio-aro" />
    </svg>
  );
}

export function PainelRelogiosESegredos({
  relogios,
  segredos,
  aoMudarRelogios,
  aoMudarSegredos,
}: {
  relogios: readonly RelogioDoEscudo[];
  segredos: readonly SegredoDoEscudo[];
  aoMudarRelogios: (proximos: RelogioDoEscudo[]) => void;
  aoMudarSegredos: (proximos: SegredoDoEscudo[]) => void;
}) {
  const [modalRelogio, setModalRelogio] = useState(false);
  const [tituloRelogio, setTituloRelogio] = useState('');
  const [segmentosRelogio, setSegmentosRelogio] = useState('6');

  const [modalSegredo, setModalSegredo] = useState(false);
  const [tituloSegredo, setTituloSegredo] = useState('');
  const [textoSegredo, setTextoSegredo] = useState('');
  const [abertoSegredoId, setAbertoSegredoId] = useState<string | null>(null);

  function criarRelogio() {
    const titulo = tituloRelogio.trim() || `Relógio ${String(relogios.length + 1)}`;
    const segmentos = Math.min(12, Math.max(2, Number(segmentosRelogio) || 6));
    aoMudarRelogios([
      ...relogios,
      {
        id: `rel_${Date.now().toString(36)}`,
        titulo,
        segmentos,
        preenchidos: 0,
      },
    ]);
    setTituloRelogio('');
    setSegmentosRelogio('6');
    setModalRelogio(false);
  }

  function ajustarRelogio(id: string, delta: number) {
    aoMudarRelogios(
      relogios.map((r) => {
        if (r.id !== id) return r;
        const preenchidos = Math.min(r.segmentos, Math.max(0, r.preenchidos + delta));
        return { ...r, preenchidos };
      }),
    );
  }

  function criarSegredo() {
    const titulo = tituloSegredo.trim() || `Segredo ${String(segredos.length + 1)}`;
    aoMudarSegredos([
      ...segredos,
      {
        id: `seg_${Date.now().toString(36)}`,
        titulo,
        texto: textoSegredo.trim(),
        reveladoNaSessao: null,
      },
    ]);
    setTituloSegredo('');
    setTextoSegredo('');
    setModalSegredo(false);
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="col" style={{ gap: 10 }}>
        <div className="row between" style={{ gap: 8 }}>
          <span className="lab">Relógios ({relogios.length})</span>
          <Button
            size="sm"
            variant="primary"
            icon={<Icon name="plus" size="sm" />}
            onClick={() => {
              setModalRelogio(true);
            }}
          >
            Adicionar relógio
          </Button>
        </div>

        {relogios.length === 0 ? (
          <p className="small muted">Nenhum relógio ativo.</p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {relogios.map((rel) => (
              <div key={rel.id} className="mesa-bloco card" style={{ padding: '10px 12px' }}>
                <div className="row between" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <MostradorDoRelogio
                      segmentos={rel.segmentos}
                      preenchidos={rel.preenchidos}
                      titulo={rel.titulo}
                    />
                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                      <b className="small">{rel.titulo}</b>
                      <span className="small muted">
                        {rel.preenchidos}/{rel.segmentos} segmentos
                      </span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Recuar ${rel.titulo}`}
                      disabled={rel.preenchidos <= 0}
                      onClick={() => {
                        ajustarRelogio(rel.id, -1);
                      }}
                    >
                      −
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Avançar ${rel.titulo}`}
                      disabled={rel.preenchidos >= rel.segmentos}
                      onClick={() => {
                        ajustarRelogio(rel.id, 1);
                      }}
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="trash" size="sm" />}
                      aria-label={`Remover relógio ${rel.titulo}`}
                      onClick={() => {
                        aoMudarRelogios(relogios.filter((r) => r.id !== rel.id));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col" style={{ gap: 10 }}>
        <div className="row between" style={{ gap: 8 }}>
          <span className="lab">Segredos ({segredos.length})</span>
          <Button
            size="sm"
            variant="primary"
            icon={<Icon name="plus" size="sm" />}
            onClick={() => {
              setModalSegredo(true);
            }}
          >
            Adicionar segredo
          </Button>
        </div>

        {segredos.length === 0 ? (
          <p className="small muted">Nenhum segredo anotado ainda.</p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {segredos.map((seg) => {
              const aberto = abertoSegredoId === seg.id;
              return (
                <div key={seg.id} className="mesa-bloco card" style={{ padding: '10px 12px' }}>
                  <div className="row between" style={{ gap: 8 }}>
                    <div className="row wrapx" style={{ gap: 6, minWidth: 0 }}>
                      <b className="small">{seg.titulo}</b>
                      {seg.reveladoNaSessao && (
                        <Tag tone="green">Revelado na sessão {seg.reveladoNaSessao}</Tag>
                      )}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Editar ${seg.titulo}`}
                        aria-expanded={aberto}
                        onClick={() => {
                          setAbertoSegredoId(aberto ? null : seg.id);
                        }}
                      >
                        {aberto ? 'Fechar' : 'Editar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Icon name="trash" size="sm" />}
                        aria-label={`Remover segredo ${seg.titulo}`}
                        onClick={() => {
                          aoMudarSegredos(segredos.filter((s) => s.id !== seg.id));
                        }}
                      />
                    </div>
                  </div>
                  {!aberto && seg.texto && (
                    <p className="small muted" style={{ marginTop: 4 }}>
                      {seg.texto}
                    </p>
                  )}
                  {aberto && (
                    <div className="col" style={{ gap: 8, marginTop: 8 }}>
                      <Field label="Título do segredo">
                        <Input
                          value={seg.titulo}
                          onChange={(e) => {
                            const titulo = e.target.value;
                            aoMudarSegredos(
                              segredos.map((s) => (s.id === seg.id ? { ...s, titulo } : s)),
                            );
                          }}
                        />
                      </Field>
                      <Field label="Detalhes">
                        <Textarea
                          rows={2}
                          value={seg.texto}
                          onChange={(e) => {
                            const texto = e.target.value;
                            aoMudarSegredos(
                              segredos.map((s) => (s.id === seg.id ? { ...s, texto } : s)),
                            );
                          }}
                        />
                      </Field>
                      <Field label="Revelado na sessão">
                        <Input
                          placeholder="Ex.: 3 (deixe vazio se ainda oculto)"
                          value={seg.reveladoNaSessao ?? ''}
                          onChange={(e) => {
                            const limpo = e.target.value.trim();
                            aoMudarSegredos(
                              segredos.map((s) =>
                                s.id === seg.id ? { ...s, reveladoNaSessao: limpo || null } : s,
                              ),
                            );
                          }}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalRelogio}
        title="Novo relógio"
        onClose={() => {
          setModalRelogio(false);
        }}
      >
        <div className="col" style={{ gap: 10 }}>
          <Field label="Título do relógio">
            <Input
              placeholder="Ex.: A Membrana afina, Chegada da polícia…"
              value={tituloRelogio}
              onChange={(e) => {
                setTituloRelogio(e.target.value);
              }}
            />
          </Field>
          <Field label="Segmentos">
            <Select
              value={segmentosRelogio}
              onChange={(e) => {
                setSegmentosRelogio(e.target.value);
              }}
            >
              {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                <option key={n} value={String(n)}>
                  {n} segmentos
                </option>
              ))}
            </Select>
          </Field>
          <div className="row">
            <Button size="sm" variant="primary" onClick={criarRelogio}>
              Criar relógio
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalSegredo}
        title="Novo segredo"
        onClose={() => {
          setModalSegredo(false);
        }}
      >
        <div className="col" style={{ gap: 10 }}>
          <Field label="Título do segredo">
            <Input
              placeholder="Ex.: O radialista já morreu há 20 anos"
              value={tituloSegredo}
              onChange={(e) => {
                setTituloSegredo(e.target.value);
              }}
            />
          </Field>
          <Field label="Detalhes para o mestre">
            <Textarea
              rows={3}
              placeholder="Como e quando isso pode vir à tona…"
              value={textoSegredo}
              onChange={(e) => {
                setTextoSegredo(e.target.value);
              }}
            />
          </Field>
          <div className="row">
            <Button size="sm" variant="primary" onClick={criarSegredo}>
              Adicionar segredo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
