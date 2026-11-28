// Painel esquerdo da mesa (#75 e #73): para o jogador, mostra PV, PD e Ímpeto do personagem em
// uso (atualizados em tempo real quando `character.changed` chega), os 3 testes rápidos e a Ordem
// da rodada. Para o mestre, mostra o resumo do grupo e a Ordem da rodada.
import { useState } from 'react';
import { Link } from 'react-router';
import {
  DT_PADRAO,
  PERICIAS_OP2,
  dadoEfetivo,
  faces,
  maximoDaBarraDePerfil,
  nomeDoAtributo,
  recursoDoPerfil,
  temImpeto,
  type CampanhaDetalhe,
  type ComandoDaMesa,
  type EstadoDaRodada,
  type EstadoDoCombate,
  type FichaOp2,
  type Membro,
  type Papel,
  type ParticipanteDoCombate,
  type PedidoDeTeste,
  type PericiaOp2,
  type Personagem,
  type PersonagemNaMesa,
  type PresencaNaMesa,
  type RelatoDeTesteOp2,
  type RespostaDoComando,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { iniciais, linkDaCampanha } from '../../casos/formatos.ts';
import {
  depoisDoTeste,
  NADA_ARMADO,
  previaDoTeste,
  type Armados,
} from '../../pages/Ficha/extras.ts';
import { NOME_DO_PERFIL, primeiroNome, TOM_DO_PERFIL } from '../../personagens/formatos.ts';
import { FichaCompleta } from '../../pages/Ficha/Ficha.tsx';
import {
  Async,
  Avatar,
  Button,
  cx,
  Die,
  Icon,
  Input,
  MAX_CAIXAS,
  Meter,
  Modal,
  ModalDadosFisicos,
  ModoDados,
  Skeleton,
  Tag,
  useCarga,
  useToast,
} from '../../ui/index.ts';

/** Escolhe as 3 perícias de maior dado efetivo na ficha para os testes rápidos. */
export function periciasRapidas(ficha: FichaOp2): (typeof PERICIAS_OP2)[number][] {
  return [...PERICIAS_OP2]
    .sort((a, b) => faces(dadoEfetivo(ficha, b.id)) - faces(dadoEfetivo(ficha, a.id)))
    .slice(0, 3);
}

export interface OrdemDaRodadaProps {
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
  online: readonly PresencaNaMesa[];
  rodada: EstadoDaRodada;
  rodadas: boolean;
  combate?: EstadoDoCombate | null;
  meuId?: string;
  meuPersonagemId?: string | null;
  enviar?: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

export function OrdemDaRodada({
  campanhaId,
  papel,
  membros,
  personagens,
  online,
  rodada,
  rodadas,
  combate = null,
  meuId = '',
  meuPersonagemId = null,
  enviar,
}: OrdemDaRodadaProps & { campanhaId?: string; papel?: Papel }) {
  const avisos = useToast();
  const [copiando, setCopiando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaInic, setNovaInic] = useState('10');

  async function cmdCombate(comando: ComandoDaMesa) {
    if (!enviar) return;
    const r = await enviar(comando);
    if (!r.ok) avisos.show({ type: 'err', title: 'Ação de combate recusada', text: r.motivo });
  }

  if (combate?.ativo) {
    const mestre = papel === 'mestre';
    const atual = combate.participantes[combate.turnoIndex] ?? null;
    const meuTurno =
      !mestre &&
      atual !== null &&
      (atual.donoId === meuId ||
        (meuPersonagemId !== null && atual.personagemId === meuPersonagemId));

    function mover(index: number, delta: number) {
      if (!combate) return;
      const destino = index + delta;
      if (destino < 0 || destino >= combate.participantes.length) return;
      const ids = combate.participantes.map((p) => p.id);
      const [item] = ids.splice(index, 1);
      if (item) ids.splice(destino, 0, item);
      void cmdCombate({ type: 'combat.reorder', ordem: ids });
    }

    function adicionarManual() {
      const nome = novoNome.trim();
      if (!nome) return;
      const inic = Number(novaInic);
      const novo: ParticipanteDoCombate = {
        id: `npc:${Date.now().toString(36)}`,
        tipo: 'npc',
        nome,
        tokenId: null,
        donoId: null,
        personagemId: null,
        iniciativa: Number.isInteger(inic) ? inic : 10,
        oculto: false,
        incapacitado: false,
        condicoes: [],
      };
      void cmdCombate({ type: 'combat.addParticipant', participante: novo });
      setNovoNome('');
      setAdicionando(false);
    }

    return (
      <div className="col jogador-secao">
        <div className="row between">
          <span className="lab red">Iniciativa · Rodada {combate.rodada}</span>
          {mestre && (
            <button
              type="button"
              className="btn ghost sm"
              title="Adicionar participante ao combate"
              onClick={() => {
                setAdicionando((v) => !v);
              }}
            >
              <Icon name="plus" size="sm" />
            </button>
          )}
        </div>

        {mestre && (
          <div className="row" style={{ gap: 6 }}>
            <Button
              size="sm"
              className="grow mesa-btn-secundario"
              onClick={() => void cmdCombate({ type: 'combat.prevTurn' })}
            >
              ← Anterior
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="grow"
              onClick={() => void cmdCombate({ type: 'combat.nextTurn' })}
            >
              Próximo →
            </Button>
          </div>
        )}

        {meuTurno && (
          <div className="combate-meu-turno" role="status">
            <span className="small">
              <b>É o seu turno!</b>
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void cmdCombate({ type: 'combat.finishTurn' })}
            >
              Encerrar turno
            </Button>
          </div>
        )}

        {mestre && adicionando && (
          <div className="col combate-add-form" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 6 }}>
              <Input
                placeholder="Nome do NPC…"
                value={novoNome}
                onChange={(e) => {
                  setNovoNome(e.target.value);
                }}
              />
              <Input
                type="number"
                value={novaInic}
                style={{ width: 62 }}
                aria-label="Iniciativa"
                onChange={(e) => {
                  setNovaInic(e.target.value);
                }}
              />
            </div>
            <div className="row end" style={{ gap: 6 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdicionando(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={adicionarManual}
                disabled={!novoNome.trim()}
              >
                Incluir
              </Button>
            </div>
          </div>
        )}

        <div className="list" role="list" aria-label="Ordem de iniciativa">
          {combate.participantes.map((p, idx) => {
            const ativo = idx === combate.turnoIndex;
            return (
              <div
                key={p.id}
                role="listitem"
                className={cx(
                  'li jogador-ordem-item combate-item',
                  ativo && 'on',
                  p.incapacitado && 'ausente',
                )}
              >
                <span className="combate-inic" title="Iniciativa">
                  {p.iniciativa}
                </span>
                <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nome}
                  </b>
                  {(p.oculto || p.incapacitado || p.condicoes.length > 0) && (
                    <span className="small muted">
                      {[
                        p.oculto ? 'oculto' : '',
                        p.incapacitado ? 'incapacitado' : '',
                        ...p.condicoes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
                {ativo && <Tag tone="red">Turno</Tag>}
                {mestre && (
                  <div className="row combate-acoes" style={{ gap: 2 }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Subir ${p.nome}`}
                      disabled={idx === 0}
                      onClick={() => {
                        mover(idx, -1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Descer ${p.nome}`}
                      disabled={idx === combate.participantes.length - 1}
                      onClick={() => {
                        mover(idx, 1);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title={p.oculto ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                      onClick={() =>
                        void cmdCombate({
                          type: 'combat.updateParticipant',
                          id: p.id,
                          oculto: !p.oculto,
                        })
                      }
                    >
                      <Icon name={p.oculto ? 'eyeoff' : 'eye'} size="sm" />
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title={p.incapacitado ? 'Reativar' : 'Marcar incapacitado'}
                      onClick={() =>
                        void cmdCombate({
                          type: 'combat.updateParticipant',
                          id: p.id,
                          incapacitado: !p.incapacitado,
                        })
                      }
                    >
                      <Icon name="shield" size="sm" />
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Remover ${p.nome}`}
                      onClick={() =>
                        void cmdCombate({ type: 'combat.removeParticipant', id: p.id })
                      }
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  async function copiarConvite() {
    if (!campanhaId || copiando) return;
    setCopiando(true);
    try {
      const r = await pedir<{ convite: { codigo: string } }>(
        `/api/campanhas/${encodeURIComponent(campanhaId)}/convites`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      const url = `${window.location.origin}/entrar/${r.convite.codigo}`;
      if (typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
      }
      setCopiado(true);
      avisos.show({ type: 'ok', title: 'Link de convite copiado', text: r.convite.codigo });
      setTimeout(() => {
        setCopiado(false);
      }, 2500);
    } catch {
      avisos.show({ type: 'err', title: 'Não foi possível gerar o convite' });
    } finally {
      setCopiando(false);
    }
  }

  const jogadores = membros.filter((m) => m.papel === 'jogador');
  if (jogadores.length === 0) {
    return (
      <div className="col jogador-secao">
        <span className="lab">Ordem da rodada</span>
        <p className="small muted">Ninguém do grupo entrou ainda.</p>
        {campanhaId && papel === 'mestre' && (
          <Button
            size="sm"
            className="mesa-btn-secundario"
            icon={<Icon name={copiado ? 'check' : 'copy'} size="sm" />}
            loading={copiando}
            onClick={() => {
              void copiarConvite();
            }}
          >
            {copiado ? 'Link copiado!' : 'Copiar link de convite'}
          </Button>
        )}
      </div>
    );
  }

  const onlineIds = new Set(online.map((p) => p.id));
  const agiramIds = new Set(rodada.agiram);
  const personagemPorDono = Object.fromEntries(personagens.map((p) => [p.donoId, p]));
  const primeiroAtivoId = rodadas
    ? (jogadores.find((j) => onlineIds.has(j.id) && !agiramIds.has(j.id))?.id ?? null)
    : null;

  return (
    <div className="col jogador-secao">
      <div className="row between">
        <span className="lab">Ordem da rodada</span>
        <span className="small muted tabular">
          {rodadas
            ? `${String(agiramIds.size)}/${String(jogadores.length)} agiram`
            : 'Ações livres'}
        </span>
      </div>
      <div className="list" role="list" aria-label="Ordem da rodada">
        {jogadores.map((j) => {
          const pers = personagemPorDono[j.id];
          const nome = pers ? primeiroNome(pers.nome) || pers.nome : j.nome;
          const tom = pers?.perfil ? TOM_DO_PERFIL[pers.perfil] : 'red';
          const presente = onlineIds.has(j.id);
          const agiu = rodadas && agiramIds.has(j.id);
          const agindo = rodadas && j.id === primeiroAtivoId;

          return (
            <div
              key={j.id}
              role="listitem"
              className={cx('li jogador-ordem-item', agindo && 'on', !presente && 'ausente')}
            >
              <Avatar initials={iniciais(nome) || '?'} name={nome} tone={tom} size="sm" />
              <b className="grow small">{nome}</b>
              {!presente ? (
                <span className="small muted">ausente</span>
              ) : agiu ? (
                <span className="small green jogador-agiu" aria-label="Já agiu">
                  <Icon name="check" size="sm" />
                </span>
              ) : agindo ? (
                <Tag tone="red">Agindo</Tag>
              ) : (
                <span className="small muted">{rodadas ? 'aguardando' : 'na mesa'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CartaoDoPersonagemProps {
  personagemId: string;
  versao: number;
  caso?: CampanhaDetalhe | null | undefined;
  dtPadrao: number;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoAbrirDadosAvulsos: () => void;
}

function RecursoInline({
  kind,
  nome,
  rotuloClasse,
  caixasClasse,
  valor,
  max,
  aoDefinir,
}: {
  kind: 'pv' | 'pd';
  nome: string;
  rotuloClasse: string;
  caixasClasse: string;
  valor: number;
  max: number;
  aoDefinir: (novo: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(String(valor));
  const atual = Math.min(Math.max(valor, 0), max);

  function confirmar() {
    setEditando(false);
    const n = Number(rascunho.trim());
    if (!Number.isFinite(n)) return;
    aoDefinir(Math.min(max, Math.max(0, Math.round(n))));
  }

  return (
    <div className="jogador-recurso">
      <div className="jogador-recurso-topo">
        <span className={rotuloClasse}>{nome}</span>
        <div className="jogador-recurso-ctrl">
          <button
            type="button"
            className="jogador-mini-btn"
            disabled={atual <= 0}
            aria-label={`Perder 1 ${nome}`}
            title={`Perder 1 ${nome}`}
            onClick={() => {
              aoDefinir(atual - 1);
            }}
          >
            −
          </button>
          {editando ? (
            <input
              type="number"
              className="jogador-recurso-input"
              min={0}
              max={max}
              autoFocus
              aria-label={`Valor de ${nome}`}
              value={rascunho}
              onChange={(e) => {
                setRascunho(e.target.value);
              }}
              onBlur={confirmar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar();
                else if (e.key === 'Escape') setEditando(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="jogador-recurso-valor"
              title={`Clique para editar ${nome}`}
              aria-label={`${nome}: ${String(atual)} de ${String(max)}`}
              onClick={() => {
                setRascunho(String(atual));
                setEditando(true);
              }}
            >
              {atual}/{max}
            </button>
          )}
          <button
            type="button"
            className="jogador-mini-btn"
            disabled={atual >= max}
            aria-label={`Recuperar 1 ${nome}`}
            title={`Recuperar 1 ${nome}`}
            onClick={() => {
              aoDefinir(atual + 1);
            }}
          >
            +
          </button>
        </div>
      </div>
      {max <= MAX_CAIXAS ? (
        <div
          className={caixasClasse}
          role="meter"
          aria-label={nome}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={atual}
        >
          {Array.from({ length: max }, (_, i) => (
            <i key={i} className={cx(i >= atual && 'o')} />
          ))}
        </div>
      ) : (
        <Meter value={atual} max={max} label={nome} kind={kind} />
      )}
    </div>
  );
}

function CartaoDoPersonagem({
  personagemId,
  versao,
  caso = null,
  dtPadrao,
  enviar,
  aoAbrirDadosAvulsos,
}: CartaoDoPersonagemProps) {
  const avisos = useToast();
  const [carregado, setCarregado] = useState<Personagem | null>(null);
  const [ultimoVisto, setUltimoVisto] = useState<Personagem | null>(null);
  const [personagemModal, setPersonagemModal] = useState<Personagem | null>(null);
  const [versaoLocal, setVersaoLocal] = useState(0);
  const url = `/api/personagens/${encodeURIComponent(personagemId)}`;
  const uso = useCarga(`${url}#${String(versao)}-${String(versaoLocal)}`, (signal) =>
    pedir<{ personagem: Personagem }>(url, { signal }).then((r) => r.personagem),
  );
  if (uso.carga.estado === 'pronto' && uso.carga.dados !== ultimoVisto) {
    setUltimoVisto(uso.carga.dados);
    setCarregado(uso.carga.dados);
  }
  const [armados, setArmados] = useState<Armados>(NADA_ARMADO);
  const [testando, setTestando] = useState(false);
  const [fisico, setFisico] = useState<PericiaOp2 | null>(null);
  const [erroFisico, setErroFisico] = useState<string | null>(null);

  async function definirRecurso(p: Personagem, campo: 'pv' | 'pd', valor: number) {
    const max = campo === 'pv' ? p.ficha.pvMax : p.ficha.pdMax;
    const proximo = Math.min(max, Math.max(0, valor));
    if (proximo === p.ficha[campo]) return;
    const fichaNova = { ...p.ficha, [campo]: proximo };
    setCarregado({ ...p, ficha: fichaNova });
    try {
      const { personagem: salvo } = await pedir<{ personagem: Personagem }>(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ficha: fichaNova }),
      });
      setCarregado(salvo);
    } catch (e) {
      setCarregado(p);
      avisos.show({
        type: 'err',
        title: `Não deu para alterar ${campo.toUpperCase()}`,
        text: e instanceof Error ? e.message : 'Tente novamente.',
      });
    }
  }

  async function trocarModo(p: Personagem, modoDados: 'virtual' | 'fisico') {
    if (p.ficha.modoDados === modoDados) return;
    const fichaNova = { ...p.ficha, modoDados };
    setCarregado({ ...p, ficha: fichaNova });
    try {
      const { personagem: salvo } = await pedir<{ personagem: Personagem }>(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ficha: fichaNova }),
      });
      setCarregado(salvo);
    } catch (e) {
      setCarregado(p);
      avisos.show({
        type: 'err',
        title: 'Não deu para mudar o modo dos dados',
        text: e instanceof Error ? e.message : 'Tente novamente.',
      });
    }
  }

  async function testarRapido(personagem: Personagem, periciaId: PericiaOp2) {
    if (testando) return;
    if (personagem.ficha.modoDados === 'fisico') {
      setErroFisico(null);
      setFisico(periciaId);
      return;
    }
    const { pedido } = previaDoTeste(personagem.ficha, periciaId, {
      dt: dtPadrao,
      ajuda: false,
      armados,
    });
    setTestando(true);
    try {
      const r = await enviar({ type: 'test.resolve', personagemId: personagem.id, ...pedido });
      if (!r.ok) {
        avisos.show({ type: 'err', title: 'Teste recusado', text: r.motivo });
        return;
      }
      setArmados((a) => depoisDoTeste(a, pedido));
    } finally {
      setTestando(false);
    }
  }

  async function informarRapido(
    personagem: Personagem,
    pedido: PedidoDeTeste,
    relato: RelatoDeTesteOp2,
  ) {
    if (testando) return;
    setErroFisico(null);
    setTestando(true);
    try {
      const r = await enviar({
        type: 'test.report',
        personagemId: personagem.id,
        ...pedido,
        ...relato,
      });
      if (!r.ok) {
        setErroFisico(r.motivo);
        return;
      }
      setArmados((a) => depoisDoTeste(a, pedido));
      setFisico(null);
    } finally {
      setTestando(false);
    }
  }

  function renderizarCartao(personagem: Personagem) {
    const { ficha } = personagem;
    const rapidas = periciasRapidas(ficha);
    const previaFisica =
      fisico === null
        ? null
        : previaDoTeste(ficha, fisico, { dt: dtPadrao, ajuda: false, armados });

    return (
      <div className="col jogador-ficha">
        <div className="row jogador-cabeca">
          <Avatar
            initials={iniciais(ficha.nome) || '?'}
            name={ficha.nome}
            tone={TOM_DO_PERFIL[ficha.perfil]}
            size="lg"
            src={personagem.foto ? `/api/arquivos/${personagem.foto}` : undefined}
          />
          <div className="col jogador-nome">
            <b className="h3">{primeiroNome(ficha.nome) || ficha.nome}</b>
            <span className="small muted">
              {NOME_DO_PERFIL[ficha.perfil]} · nível {ficha.nivel}
            </span>
          </div>
        </div>

        <div className="col" style={{ gap: 10 }}>
          <RecursoInline
            kind="pv"
            nome="PV"
            rotuloClasse="lab red"
            caixasClasse="boxes"
            valor={ficha.pv}
            max={ficha.pvMax}
            aoDefinir={(novo) => void definirRecurso(personagem, 'pv', novo)}
          />
          <RecursoInline
            kind="pd"
            nome="PD"
            rotuloClasse="lab pd"
            caixasClasse="boxes pd"
            valor={ficha.pd}
            max={ficha.pdMax}
            aoDefinir={(novo) => void definirRecurso(personagem, 'pd', novo)}
          />
        </div>

        {temImpeto(ficha) &&
          (() => {
            const rec = recursoDoPerfil(ficha.perfil);
            const maxImpeto = maximoDaBarraDePerfil(ficha);
            return (
              <div className="row between" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="lab gold tabular">
                    {rec.nome} {ficha.impeto}/{maxImpeto}
                  </span>
                  <div className="jogador-impeto-pontos" aria-hidden="true">
                    {Array.from({ length: maxImpeto }, (_, i) => (
                      <span
                        key={i}
                        className={cx('jogador-impeto-ponto', i < ficha.impeto && 'on')}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={armados.impeto ? 'primary' : 'secondary'}
                  disabled={ficha.impeto < 1}
                  aria-pressed={armados.impeto}
                  title={
                    ficha.impeto < 1
                      ? `Sem pontos de ${rec.nome} disponíveis`
                      : 'Armar +d4 no próximo teste'
                  }
                  onClick={() => {
                    setArmados((a) => ({ ...a, impeto: !a.impeto }));
                  }}
                >
                  {armados.impeto ? '+d4 armado' : 'Gastar 1 · +d4'}
                </Button>
              </div>
            );
          })()}

        <hr className="hr" />

        <ModoDados
          value={ficha.modoDados}
          permitirFisico={caso?.dadosFisicos !== false}
          onChange={(modo) => void trocarModo(personagem, modo)}
        />

        <span className="lab">Testes rápidos</span>
        <div className="col jogador-rapidos">
          {rapidas.map((p) => {
            const previa = previaDoTeste(ficha, p.id, {
              dt: dtPadrao,
              ajuda: false,
              armados,
            });
            const composicao = `${nomeDoAtributo(p.atributo)} (${previa.teste.atributo}) + ${p.nome} (${previa.teste.pericia})${previa.armados.length > 0 ? ' + bônus' : ''}`;
            return (
              <button
                key={p.id}
                type="button"
                className="dados-pericia"
                aria-label={`Teste rápido de ${p.nome}`}
                title={composicao}
                disabled={testando}
                onClick={() => void testarRapido(personagem, p.id)}
              >
                <span className="small">{p.nome}</span>
                <span className="row dados-pericia-dados">
                  <Die
                    type={previa.teste.atributo}
                    value={faces(previa.teste.atributo)}
                    role="atributo"
                  />
                  <Die
                    type={previa.teste.pericia}
                    value={faces(previa.teste.pericia)}
                    role="pericia"
                  />
                  {previa.armados.map((b, i) => (
                    <Die key={i} type={b.tipo} value={faces(b.tipo)} role="bonus" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="jogador-acoes-rodape">
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="dice" size="sm" />}
            aria-label="Teste livre ou dados avulsos"
            title="Teste livre ou dados avulsos"
            onClick={aoAbrirDadosAvulsos}
          >
            Dados avulsos
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="user" size="sm" />}
            aria-label="Abrir ficha completa"
            title="Abrir ficha completa"
            onClick={() => {
              setPersonagemModal(personagem);
            }}
          >
            Ficha completa
          </Button>
        </div>

        {previaFisica && fisico && (
          <ModalDadosFisicos
            key={fisico}
            ficha={ficha}
            pedido={{ ...previaFisica.pedido, dt: dtPadrao }}
            enviando={testando}
            erro={erroFisico}
            ocultarVeredito
            aoEnviar={(relato) => void informarRapido(personagem, previaFisica.pedido, relato)}
            aoCancelar={() => {
              setFisico(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {carregado ? (
        renderizarCartao(carregado)
      ) : (
        <Async
          uso={uso}
          falha="Sua ficha não carregou."
          esqueleto={
            <div className="col">
              <Skeleton />
              <Skeleton width="75%" />
            </div>
          }
        >
          {(personagem) => renderizarCartao(personagem)}
        </Async>
      )}
      <Modal
        open={personagemModal !== null}
        size="lg"
        title={personagemModal ? `Ficha · ${personagemModal.ficha.nome}` : 'Ficha'}
        onClose={() => {
          setPersonagemModal(null);
          setVersaoLocal((v) => v + 1);
        }}
      >
        {personagemModal && <FichaCompleta inicial={personagemModal} caso={caso} noModal />}
      </Modal>
    </>
  );
}

export interface PainelEsquerdoProps {
  campanhaId?: string;
  caso?: CampanhaDetalhe | null | undefined;
  papel: Papel;
  meuPersonagemId: string | null;
  versaoPersonagens: Readonly<Record<string, number>>;
  dtPadrao?: number | undefined;
  rodadas: boolean;
  rodada: EstadoDaRodada;
  combate?: EstadoDoCombate | null;
  meuId?: string;
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
  online: readonly PresencaNaMesa[];
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoAbrirDadosAvulsos: () => void;
}

export function Jogador({
  campanhaId,
  caso = null,
  papel,
  meuPersonagemId,
  versaoPersonagens,
  dtPadrao = DT_PADRAO,
  rodadas,
  rodada,
  combate = null,
  meuId = '',
  membros,
  personagens,
  online,
  enviar,
  aoAbrirDadosAvulsos,
}: PainelEsquerdoProps) {
  return (
    <div className="col jogador-painel">
      {papel === 'jogador' ? (
        meuPersonagemId ? (
          <CartaoDoPersonagem
            key={meuPersonagemId}
            personagemId={meuPersonagemId}
            versao={versaoPersonagens[meuPersonagemId] ?? 0}
            caso={caso}
            dtPadrao={dtPadrao}
            enviar={enviar}
            aoAbrirDadosAvulsos={aoAbrirDadosAvulsos}
          />
        ) : (
          <p className="small muted">
            Escolha um personagem em <Link to="/personagens">Personagens</Link> para ver PV, PD e
            testes rápidos aqui.
          </p>
        )
      ) : (
        <div className="col jogador-secao">
          <Button
            size="sm"
            className="mesa-btn-secundario"
            icon={<Icon name="dice" size="sm" />}
            onClick={aoAbrirDadosAvulsos}
          >
            Rolagem secreta ou testes
          </Button>
        </div>
      )}

      <hr className="hr" />

      <OrdemDaRodada
        {...(campanhaId && { campanhaId })}
        papel={papel}
        membros={membros}
        personagens={personagens}
        online={online}
        rodada={rodada}
        rodadas={rodadas}
        combate={combate}
        meuId={meuId}
        meuPersonagemId={meuPersonagemId}
        enviar={enviar}
      />

      {campanhaId && papel === 'mestre' && (
        <Link className="btn sm mesa-link-painel" to={linkDaCampanha(campanhaId, 'escudo')}>
          <Icon name="shield" size="sm" />
          Escudo do mestre
        </Link>
      )}
    </div>
  );
}
