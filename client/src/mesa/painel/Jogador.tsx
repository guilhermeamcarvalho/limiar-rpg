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
  IMPETO_MAXIMO,
  temImpeto,
  type ComandoDaMesa,
  type EstadoDaRodada,
  type FichaOp2,
  type Membro,
  type Papel,
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
import {
  linkDaFicha,
  NOME_DO_PERFIL,
  primeiroNome,
  TOM_DO_PERFIL,
} from '../../personagens/formatos.ts';
import {
  Async,
  Avatar,
  Button,
  cx,
  Die,
  Icon,
  ModalDadosFisicos,
  ResourceBar,
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
}

export function OrdemDaRodada({
  membros,
  personagens,
  online,
  rodada,
  rodadas,
}: OrdemDaRodadaProps) {
  const jogadores = membros.filter((m) => m.papel === 'jogador');
  if (jogadores.length === 0) return null;

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
        {!rodadas && <span className="small muted">ações livres</span>}
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
  dtPadrao: number;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoAbrirDadosAvulsos: () => void;
}

function CartaoDoPersonagem({
  personagemId,
  versao,
  dtPadrao,
  enviar,
  aoAbrirDadosAvulsos,
}: CartaoDoPersonagemProps) {
  const avisos = useToast();
  const url = `/api/personagens/${encodeURIComponent(personagemId)}`;
  const uso = useCarga(`${url}#${String(versao)}`, (signal) =>
    pedir<{ personagem: Personagem }>(url, { signal }).then((r) => r.personagem),
  );
  const [armados, setArmados] = useState<Armados>(NADA_ARMADO);
  const [testando, setTestando] = useState(false);
  const [fisico, setFisico] = useState<PericiaOp2 | null>(null);
  const [erroFisico, setErroFisico] = useState<string | null>(null);

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

  return (
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
      {(personagem) => {
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

            <ResourceBar kind="pv" value={ficha.pv} max={ficha.pvMax} />
            <ResourceBar kind="pd" value={ficha.pd} max={ficha.pdMax} />

            {temImpeto(ficha) && (
              <div className="row between">
                <span className="lab gold">
                  Ímpeto {ficha.impeto}/{IMPETO_MAXIMO}
                </span>
                <Button
                  size="sm"
                  variant={armados.impeto ? 'primary' : 'secondary'}
                  disabled={ficha.impeto < 1}
                  aria-pressed={armados.impeto}
                  onClick={() => {
                    setArmados((a) => ({ ...a, impeto: !a.impeto }));
                  }}
                >
                  {armados.impeto ? '+d4 armado' : 'Gastar 1 · +d4'}
                </Button>
              </div>
            )}

            <hr className="hr" />

            <span className="lab">Testes rápidos</span>
            <div className="col jogador-rapidos">
              {rapidas.map((p) => {
                const previa = previaDoTeste(ficha, p.id, {
                  dt: dtPadrao,
                  ajuda: false,
                  armados,
                });
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="dados-pericia"
                    aria-label={`Teste rápido de ${p.nome}`}
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

            <Button size="sm" icon={<Icon name="dice" size="sm" />} onClick={aoAbrirDadosAvulsos}>
              Teste livre ou dados avulsos
            </Button>

            {previaFisica && fisico && (
              <ModalDadosFisicos
                key={fisico}
                ficha={ficha}
                pedido={{ ...previaFisica.pedido, dt: dtPadrao }}
                enviando={testando}
                erro={erroFisico}
                aoEnviar={(relato) => void informarRapido(personagem, previaFisica.pedido, relato)}
                aoCancelar={() => {
                  setFisico(null);
                }}
              />
            )}
          </div>
        );
      }}
    </Async>
  );
}

export interface PainelEsquerdoProps {
  campanhaId?: string;
  papel: Papel;
  meuPersonagemId: string | null;
  versaoPersonagens: Readonly<Record<string, number>>;
  dtPadrao?: number | undefined;
  rodadas: boolean;
  rodada: EstadoDaRodada;
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
  online: readonly PresencaNaMesa[];
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoAbrirDadosAvulsos: () => void;
}

export function Jogador({
  campanhaId,
  papel,
  meuPersonagemId,
  versaoPersonagens,
  dtPadrao = DT_PADRAO,
  rodadas,
  rodada,
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
            variant="ghost"
            icon={<Icon name="dice" size="sm" />}
            onClick={aoAbrirDadosAvulsos}
          >
            Rolagem secreta ou testes
          </Button>
        </div>
      )}

      <hr className="hr" />

      <OrdemDaRodada
        membros={membros}
        personagens={personagens}
        online={online}
        rodada={rodada}
        rodadas={rodadas}
      />

      {campanhaId && papel === 'mestre' && (
        <Link className="btn sm mesa-link-painel" to={linkDaCampanha(campanhaId, 'escudo')}>
          <Icon name="shield" size="sm" />
          Escudo do mestre
        </Link>
      )}
      {papel === 'jogador' && meuPersonagemId && (
        <Link className="btn sm mesa-link-painel" to={linkDaFicha(meuPersonagemId)}>
          <Icon name="user" size="sm" />
          Abrir ficha completa
        </Link>
      )}
    </div>
  );
}
