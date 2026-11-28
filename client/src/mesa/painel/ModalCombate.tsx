// Modal rápido para o mestre iniciar o combate:
// Inclui apenas personagens de jogadores com ficha e ameaças/NPCs do mestre que tenham ficha montada no Escudo.
// Todos rolam Físico + Acrobacia da própria ficha.
import { useEffect, useRef, useState } from 'react';
import {
  dadoEfetivo,
  esquemaNotasDoEscudo,
  rolar,
  type ComandoDaMesa,
  type Dado,
  type Membro,
  type ParticipanteDoCombate,
  type Personagem,
  type PersonagemNaMesa,
  type RespostaDoComando,
  type TokenNaMesa,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { Button, Checkbox, Icon, Modal, cx } from '../../ui/index.ts';

interface LinhaInicial extends Omit<ParticipanteDoCombate, 'iniciativa'> {
  iniciativa: number | null;
  incluido: boolean;
  dadoA: Dado;
  dadoB: Dado;
  rolagemDetalhe: string | null;
}

function rolarPar(a: Dado, b: Dado): { total: number; detalhe: string } {
  const va = rolar(a, Math.random);
  const vb = rolar(b, Math.random);
  return { total: va + vb, detalhe: `${String(va)} + ${String(vb)}` };
}

function lerAmeacasComFicha(escudoJson: string | null | undefined) {
  if (!escudoJson) return [];
  try {
    const parsed = esquemaNotasDoEscudo.safeParse(JSON.parse(escudoJson));
    if (!parsed.success) return [];
    return parsed.data.ameacas.filter((a) => a.ficha != null);
  } catch {
    return [];
  }
}

function montarLinhasIniciais(
  tokens: readonly TokenNaMesa[],
  _membros: readonly Membro[],
  _personagens: readonly PersonagemNaMesa[],
  escudoJson: string | null | undefined,
  meuId: string,
): LinhaInicial[] {
  const linhas: LinhaInicial[] = [];
  const personagensJaIncluidos = new Set<string>();

  // 1. Personagens com ficha que estão na cena (jogadores ou personagens do mestre)
  for (const t of tokens) {
    if (!t.personagemId) continue;
    personagensJaIncluidos.add(t.personagemId);
    const ehDoMestre = t.donoId === meuId || t.donoId === null;
    linhas.push({
      id: `tok:${t.id}`,
      tipo: ehDoMestre ? 'npc' : 'jogador',
      nome: t.nome,
      tokenId: t.id,
      donoId: t.donoId,
      personagemId: t.personagemId,
      iniciativa: null,
      oculto: t.oculto,
      incapacitado: false,
      condicoes: [],
      incluido: true,
      dadoA: 'd6',
      dadoB: 'd6',
      rolagemDetalhe: null,
    });
  }

  // 2. Ameaças/NPCs do mestre com ficha montada no Escudo que estão na cena (token no mapa atual)
  for (const a of lerAmeacasComFicha(escudoJson)) {
    if (!a.ficha) continue;
    const tokenCorrespondente = tokens.find(
      (t) => !t.personagemId && t.nome.trim().toLowerCase() === a.titulo.trim().toLowerCase(),
    );
    if (!tokenCorrespondente) continue;
    linhas.push({
      id: `esc:${a.id}`,
      tipo: 'npc',
      nome: a.titulo,
      tokenId: tokenCorrespondente.id,
      donoId: null,
      personagemId: null,
      iniciativa: null,
      oculto: tokenCorrespondente.oculto,
      incapacitado: false,
      condicoes: [],
      incluido: true,
      dadoA: a.ficha.fisico,
      dadoB: a.ficha.acrobacia,
      rolagemDetalhe: null,
    });
  }

  return linhas;
}

export function ModalCombate({
  open,
  onClose,
  tokens,
  membros,
  personagens,
  escudo = null,
  meuId = '',
  enviar,
  aoFalhar,
}: {
  open: boolean;
  onClose: () => void;
  tokens: readonly TokenNaMesa[];
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
  escudo?: string | null;
  meuId?: string;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoFalhar: (motivo: string) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaInicial[]>([]);
  const [enviando, setEnviando] = useState(false);
  const dadosRef = useRef({ tokens, membros, personagens, escudo, meuId });
  useEffect(() => {
    dadosRef.current = { tokens, membros, personagens, escudo, meuId };
  }, [tokens, membros, personagens, escudo, meuId]);

  useEffect(() => {
    if (!open) return;
    const { tokens: t, membros: m, personagens: p, escudo: esc, meuId: mId } = dadosRef.current;
    const iniciais = montarLinhasIniciais(t, m, p, esc, mId);
    setLinhas(iniciais);

    const idsPersonagens = [
      ...new Set(iniciais.map((l) => l.personagemId).filter((id): id is string => id !== null)),
    ];
    if (idsPersonagens.length === 0) return;

    let ativo = true;
    const controller = new AbortController();
    void Promise.allSettled(
      idsPersonagens.map((id) =>
        pedir<{ personagem: Personagem }>(`/api/personagens/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        }).then((r) => r.personagem),
      ),
    ).then((resultados) => {
      if (!ativo) return;
      const porId = new Map<string, Personagem>();
      for (const res of resultados) {
        if (res.status === 'fulfilled') porId.set(res.value.id, res.value);
      }
      if (porId.size === 0) return;
      setLinhas((prev) =>
        prev.map((l) => {
          const pers = l.personagemId ? porId.get(l.personagemId) : undefined;
          if (!pers) return l;
          return {
            ...l,
            dadoA: dadoEfetivo(pers.ficha, 'fisico'),
            dadoB: dadoEfetivo(pers.ficha, 'acrobacia'),
          };
        }),
      );
    });

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [open]);

  function rolarTodas() {
    setLinhas((prev) =>
      prev
        .map((l) => {
          if (!l.incluido) return l;
          const { total, detalhe } = rolarPar(l.dadoA, l.dadoB);
          return { ...l, iniciativa: total, rolagemDetalhe: detalhe };
        })
        .sort((a, b) => (b.iniciativa ?? -999) - (a.iniciativa ?? -999)),
    );
  }

  function rolarLinha(id: string) {
    setLinhas((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const { total, detalhe } = rolarPar(item.dadoA, item.dadoB);
        return { ...item, iniciativa: total, rolagemDetalhe: detalhe };
      }),
    );
  }

  function ajustarLinha(id: string, delta: number) {
    setLinhas((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, iniciativa: (item.iniciativa ?? 0) + delta, rolagemDetalhe: null }
          : item,
      ),
    );
  }

  async function confirmar() {
    const selecionados: ParticipanteDoCombate[] = linhas
      .filter((l) => l.incluido)
      .map((l) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { incluido, iniciativa, dadoA, dadoB, rolagemDetalhe, ...p } = l;
        return {
          ...p,
          iniciativa: iniciativa ?? rolarPar(dadoA, dadoB).total,
        };
      })
      .sort((a, b) => b.iniciativa - a.iniciativa);
    if (selecionados.length === 0) return;
    setEnviando(true);
    const r = await enviar({ type: 'combat.start', participantes: selecionados });
    setEnviando(false);
    if (!r.ok) {
      aoFalhar(r.motivo);
      return;
    }
    onClose();
  }

  const selecionadosCount = linhas.filter((l) => l.incluido).length;
  const todosRolados = linhas.filter((l) => l.incluido).every((l) => l.iniciativa !== null);

  return (
    <Modal open={open} onClose={onClose} title="Iniciar combate">
      <div className="col" style={{ gap: 14 }}>
        <div className="row between wrapx" style={{ gap: 8 }}>
          <p className="small muted">
            Entram apenas personagens e ameaças com ficha montada (<b>Físico + Acrobacia</b>).
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="dice" size="sm" />}
            disabled={selecionadosCount === 0}
            onClick={rolarTodas}
          >
            {todosRolados ? 'Rolar novamente' : 'Rolar iniciativas'}
          </Button>
        </div>

        <div className="col" style={{ gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {linhas.length === 0 ? (
            <p className="small muted">
              Nenhum personagem ou ameaça com ficha está na cena (mapa atual). Coloque os tokens no
              mapa e monte as fichas das ameaças no Escudo do mestre.
            </p>
          ) : (
            <div className="row between" style={{ padding: '0 8px' }}>
              <span className="lab">Participante e dados</span>
              <span className="lab">Iniciativa</span>
            </div>
          )}
          {linhas.map((l) => (
            <div
              key={l.id}
              className={cx('row between combate-modal-linha', !l.incluido && 'inativo')}
            >
              <div className="col" style={{ gap: 2, minWidth: 0 }}>
                <Checkbox
                  label={`${l.nome}${l.tipo === 'npc' ? ' (Escudo)' : ''}`}
                  checked={l.incluido}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLinhas((prev) =>
                      prev.map((item) =>
                        item.id === l.id ? { ...item, incluido: checked } : item,
                      ),
                    );
                  }}
                />
                <span className="small muted" style={{ paddingLeft: 24 }}>
                  Físico {l.dadoA} + Acrobacia {l.dadoB}
                  {l.rolagemDetalhe ? ` (${l.rolagemDetalhe})` : ''}
                </span>
              </div>

              <div className="row" style={{ gap: 6 }}>
                {l.tipo === 'npc' && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={l.oculto ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                    aria-pressed={l.oculto}
                    title={l.oculto ? 'Oculto dos jogadores' : 'Visível para todos'}
                    onClick={() => {
                      setLinhas((prev) =>
                        prev.map((item) =>
                          item.id === l.id ? { ...item, oculto: !item.oculto } : item,
                        ),
                      );
                    }}
                  >
                    <Icon name={l.oculto ? 'eyeoff' : 'eye'} size="sm" />
                  </button>
                )}

                {l.iniciativa === null ? (
                  <div
                    className="combate-stepper"
                    role="group"
                    aria-label={`Iniciativa de ${l.nome}`}
                  >
                    <span className="combate-valor vazio" title="Aguardando rolagem">
                      —
                    </span>
                    <button
                      type="button"
                      className="combate-step-btn"
                      title={`Rolar ${l.dadoA} + ${l.dadoB} para ${l.nome}`}
                      aria-label={`Rolar iniciativa de ${l.nome}`}
                      disabled={!l.incluido}
                      onClick={() => {
                        rolarLinha(l.id);
                      }}
                    >
                      <Icon name="dice" size="sm" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="combate-stepper"
                    role="group"
                    aria-label={`Iniciativa de ${l.nome}`}
                  >
                    <button
                      type="button"
                      className="combate-step-btn"
                      aria-label={`Diminuir iniciativa de ${l.nome}`}
                      disabled={!l.incluido}
                      onClick={() => {
                        ajustarLinha(l.id, -1);
                      }}
                    >
                      −
                    </button>
                    <span className="combate-valor" title="Iniciativa">
                      {l.iniciativa}
                    </span>
                    <button
                      type="button"
                      className="combate-step-btn"
                      aria-label={`Aumentar iniciativa de ${l.nome}`}
                      disabled={!l.incluido}
                      onClick={() => {
                        ajustarLinha(l.id, 1);
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="combate-step-btn"
                      title={`Rolar novamente (${l.dadoA} + ${l.dadoB})`}
                      aria-label={`Rolar novamente iniciativa de ${l.nome}`}
                      disabled={!l.incluido}
                      onClick={() => {
                        rolarLinha(l.id);
                      }}
                    >
                      <Icon name="dice" size="sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="row end" style={{ gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={enviando}
            disabled={selecionadosCount === 0}
            onClick={() => void confirmar()}
          >
            {todosRolados
              ? `Confirmar e iniciar (${String(selecionadosCount)})`
              : `Rolar faltantes e iniciar (${String(selecionadosCount)})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
