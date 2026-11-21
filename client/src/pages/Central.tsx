// Central: artboards "02 · Central", "17 · Central carregando" e "Celular · 02".
// O caso em andamento, os convites, a agenda e a lista curta de casos e de sobreviventes.
// Cada bloco carrega e falha sozinho: se a agenda cair, o resto da página continua de pé.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { tituloDaPagina, type CampanhaNaLista, type ConvitePublico } from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import {
  PAPEL,
  agendaEmTexto,
  casoParaContinuar,
  etiquetaDoSistema,
  hora,
  linkDaCampanha,
  linkDoDossie,
  numeroDoCaso,
  quandoCurto,
  sessaoFutura,
} from '../casos/formatos.ts';
import { esquecerConvitePendente, useConvitesPendentes } from '../convites/pendentes.ts';
import {
  Async,
  Button,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  Tag,
  useCarga,
  useEnvio,
  useToast,
  type UsoDaCarga,
} from '../ui/index.ts';
import './central.css';

type Casos = UsoDaCarga<CampanhaNaLista[]>;

function saudacao(agora: Date): string {
  const h = agora.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "Quinta, 19 nov". */
function hoje(agora: Date): string {
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(agora).split('-')[0];
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(agora).replace('.', '');
  return `${(dia ?? '').charAt(0).toUpperCase()}${(dia ?? '').slice(1)}, ${String(agora.getDate())} ${mes}`;
}

/* ---------- Continuar investigação ---------- */

function ContinuarInvestigacao({ caso }: { caso: CampanhaNaLista }) {
  const papel = PAPEL[caso.papel];
  const mestra = caso.papel === 'mestre';
  const sessao = sessaoFutura(caso);
  const jogadores = caso.contagens.jogadores;
  return (
    <article className="card hl central-continuar" aria-labelledby="continuar-titulo">
      <div className="card-b">
        <div className="row wrapx">
          <Tag tone="red">Continuar investigação</Tag>
          <Tag tone={papel.tom}>{papel.voce}</Tag>
        </div>
        <h2 id="continuar-titulo" className="h1 central-continuar-titulo">
          {caso.nome}
        </h2>
        {caso.gancho && <p className="type central-gancho">{caso.gancho}</p>}
        <div className="row wrapx" style={{ gap: 24 }}>
          {!mestra && caso.mestre && (
            <div className="col" style={{ gap: 6 }}>
              <span className="lab">Mestre</span>
              <b>{caso.mestre.nome}</b>
            </div>
          )}
          <div className="col" style={{ gap: 6 }}>
            <span className="lab">Grupo</span>
            <b>
              {jogadores === 0
                ? 'Nenhum jogador ainda'
                : `${String(jogadores)} ${jogadores === 1 ? 'jogador' : 'jogadores'}`}
            </b>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="lab">Próxima sessão</span>
            <b>
              {sessao
                ? quandoCurto(sessao)
                : caso.agenda
                  ? agendaEmTexto(caso.agenda)
                  : 'A combinar'}
            </b>
          </div>
        </div>
        <div className="row wrapx">
          <Link className="btn red central-mesa" to={linkDaCampanha(caso.id, 'mesa')}>
            <Icon name="map" />
            {mestra ? 'Abrir mesa' : 'Entrar na mesa'}
          </Link>
          {mestra ? (
            <Link className="btn" to={linkDaCampanha(caso.id, 'escudo')}>
              <Icon name="shield" size="sm" />
              Escudo
            </Link>
          ) : (
            <Link className="btn" to={linkDaCampanha(caso.id, 'ficha')}>
              <Icon name="user" size="sm" />
              Ficha
            </Link>
          )}
          <Link className="btn ghost" to={linkDoDossie(caso.id)}>
            <Icon name="folder" size="sm" />
            Dossiê do caso
          </Link>
        </div>
      </div>
    </article>
  );
}

function EsqueletoDoInicio() {
  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="card col" style={{ padding: 28, gap: 18 }}>
        <div className="row">
          <Skeleton width="180px" />
          <Skeleton width="120px" />
        </div>
        <Skeleton variant="h" width="70%" />
        <Skeleton width="60%" />
        <Skeleton width="40%" />
      </div>
      <div className="g3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card central-caso">
            <Skeleton width="40%" />
            <Skeleton variant="h" />
            <Skeleton width="60%" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SemCasos() {
  return (
    <Card pad>
      <EmptyState
        icon={<Icon name="folder" size="xl" />}
        title="Nenhum caso ainda"
        action={
          <div className="row wrapx" style={{ justifyContent: 'center' }}>
            <Link className="btn red" to="/casos/novo">
              <Icon name="plus" size="sm" />
              Abrir novo caso
            </Link>
            <Link className="btn" to="/convite">
              <Icon name="key" size="sm" />
              Entrar com código
            </Link>
          </div>
        }
      >
        Abra um caso como mestre ou entre num pelo convite que o mestre mandou.
      </EmptyState>
    </Card>
  );
}

function CartaoDoCaso({ caso }: { caso: CampanhaNaLista }) {
  const papel = PAPEL[caso.papel];
  const sessao = sessaoFutura(caso);
  const jogadores = caso.contagens.jogadores;
  const detalhes = [
    `${String(jogadores)} ${jogadores === 1 ? 'jogador' : 'jogadores'}`,
    sessao && quandoCurto(sessao),
    caso.situacao === 'encerrado' && 'encerrado',
  ].filter(Boolean);
  return (
    <Link className="card central-caso" to={linkDoDossie(caso.id)}>
      <div className="row between">
        <span className={`lab ${papel.tom}`}>
          Nº {numeroDoCaso(caso.numero)} · {papel.rotulo}
        </span>
        <Tag {...(caso.sistema.tipo === 'inventado' && { tone: 'gold' as const })}>
          {etiquetaDoSistema(caso.sistema)}
        </Tag>
      </div>
      <b className="h3">{caso.nome}</b>
      <span className="small muted">{detalhes.join(' · ')}</span>
    </Link>
  );
}

function Inicio({ casos }: { casos: Casos }) {
  return (
    <Async
      uso={casos}
      falha="Os seus casos não carregaram."
      esqueleto={<EsqueletoDoInicio />}
      vazio={{ se: (lista) => lista.length === 0, mostrar: <SemCasos /> }}
    >
      {(lista) => {
        const continuar = casoParaContinuar(lista);
        return (
          <>
            {continuar ? (
              <ContinuarInvestigacao caso={continuar} />
            ) : (
              <Card pad>
                <EmptyState
                  icon={<Icon name="folder" size="xl" />}
                  title="Nenhum caso em curso"
                  action={
                    <Link className="btn red" to="/casos/novo">
                      <Icon name="plus" size="sm" />
                      Abrir novo caso
                    </Link>
                  }
                >
                  Todos os seus casos foram encerrados.
                </EmptyState>
              </Card>
            )}
            <section aria-labelledby="seus-casos">
              <div className="sect-h">
                <h2 id="seus-casos" className="h3">
                  Seus casos
                </h2>
                <Link className="btn ghost sm" to="/casos">
                  Ver todos
                </Link>
              </div>
              <div className="g3">
                {lista.slice(0, 3).map((caso) => (
                  <CartaoDoCaso key={caso.id} caso={caso} />
                ))}
              </div>
            </section>
          </>
        );
      }}
    </Async>
  );
}

/* ---------- Sobreviventes ---------- */

function Sobreviventes() {
  return (
    <section aria-labelledby="sobreviventes">
      <div className="sect-h">
        <h2 id="sobreviventes" className="h3">
          Seus sobreviventes
        </h2>
        <Link className="btn ghost sm" to="/personagens">
          Ver todos
        </Link>
      </div>
      <Card pad>
        <EmptyState icon={<Icon name="users" size="xl" />} title="Nenhum sobrevivente ainda">
          Os personagens que você criar aparecem aqui, com PV e PD.
        </EmptyState>
      </Card>
    </section>
  );
}

/* ---------- Convites ---------- */

/** Confere cada código guardado. Os que não valem mais (sumiram, expiraram, já entrou) somem da lista. */
async function conferirConvites(codigos: readonly string[], signal: AbortSignal) {
  const respostas = await Promise.allSettled(
    codigos.map((c) => pedir<{ convite: ConvitePublico }>(`/api/convites/${c}`, { signal })),
  );
  const validos: ConvitePublico[] = [];
  let falha: unknown = null;
  respostas.forEach((r, i) => {
    const codigo = codigos[i] ?? '';
    if (r.status === 'rejected') {
      if (r.reason instanceof ErroDaApi && r.reason.status === 404) esquecerConvitePendente(codigo);
      else falha ??= r.reason;
      return;
    }
    const { convite } = r.value;
    if (convite.estado === 'valido' && convite.jaParticipa !== true) validos.push(convite);
    else esquecerConvitePendente(codigo);
  });
  // Só falha o bloco se nenhum convite pôde ser conferido.
  if (falha !== null && validos.length === 0) {
    throw falha instanceof Error ? falha : new Error('Os convites não carregaram.');
  }
  return validos;
}

function ConviteNaLista({ convite, aoEntrar }: { convite: ConvitePublico; aoEntrar: () => void }) {
  const avisos = useToast();
  const aceite = useEnvio(async () => {
    try {
      await pedir(`/api/convites/${convite.codigo}/aceitar`, { method: 'POST' });
      esquecerConvitePendente(convite.codigo);
      avisos.show({ type: 'ok', title: 'Você entrou no caso', text: convite.campanha.nome });
      aoEntrar();
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.codigo === 'JA_PARTICIPA') {
        esquecerConvitePendente(convite.codigo);
        aoEntrar();
        return;
      }
      avisos.show({
        type: 'err',
        title: 'Não deu para aceitar o convite',
        text: erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.',
      });
    }
  });
  const vagas = `${String(convite.vagasRestantes)} ${convite.vagasRestantes === 1 ? 'vaga' : 'vagas'}`;
  const detalhes = [
    convite.mestre.nome,
    convite.proximaSessao && quandoCurto(convite.proximaSessao),
    vagas,
  ].filter(Boolean);
  return (
    <li className="li central-convite">
      <div>
        <b>{convite.campanha.nome}</b>
        <div className="small muted">{detalhes.join(' · ')}</div>
      </div>
      {convite.campanha.gancho && <p className="type small">“{convite.campanha.gancho}”</p>}
      <div className="row">
        <Button
          variant="primary"
          size="sm"
          icon={<Icon name="check" size="sm" />}
          loading={aceite.enviando}
          onClick={() => void aceite.enviar()}
        >
          Aceitar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={aceite.enviando}
          onClick={() => {
            esquecerConvitePendente(convite.codigo);
            avisos.show({ type: 'info', title: 'Convite recusado', text: convite.campanha.nome });
          }}
        >
          Recusar
        </Button>
      </div>
    </li>
  );
}

function ConvitesPendentes({ aoEntrar }: { aoEntrar: () => void }) {
  const codigos = useConvitesPendentes();
  const uso = useCarga(codigos.join(','), (signal) => conferirConvites(codigos, signal));
  const pronto = uso.carga.estado === 'pronto' ? uso.carga.dados : null;
  return (
    <section id="convites" className="card" aria-labelledby="convites-titulo">
      <div className="card-h">
        <h2 id="convites-titulo" className="lab">
          Convites
        </h2>
        {pronto && pronto.length > 0 && (
          <span className="cnt new">
            {pronto.length}
            <span className="sr-only"> esperando resposta</span>
          </span>
        )}
      </div>
      <div className="card-b">
        <Async
          uso={uso}
          falha="Os convites não carregaram."
          esqueleto={
            <div className="col">
              <Skeleton variant="h" />
              <Skeleton width="70%" />
            </div>
          }
          vazio={{
            se: (lista) => lista.length === 0,
            mostrar: (
              <div className="col" style={{ gap: 10 }}>
                <p className="small muted">Nenhum convite esperando resposta.</p>
                <div>
                  <Link className="btn sm" to="/convite">
                    <Icon name="key" size="sm" />
                    Entrar com código
                  </Link>
                </div>
              </div>
            ),
          }}
        >
          {(lista) => (
            <ul className="list lista-no-cartao">
              {lista.map((convite) => (
                <ConviteNaLista key={convite.codigo} convite={convite} aoEntrar={aoEntrar} />
              ))}
            </ul>
          )}
        </Async>
      </div>
    </section>
  );
}

/* ---------- Agenda ---------- */

function Agenda({ casos }: { casos: Casos }) {
  return (
    <section className="card" aria-labelledby="agenda-titulo">
      <div className="card-h">
        <h2 id="agenda-titulo" className="lab">
          Agenda
        </h2>
        <Icon name="cal" size="sm" />
      </div>
      <div className="card-b">
        <Async
          uso={casos}
          falha="A agenda não carregou."
          esqueleto={
            <div className="col">
              <Skeleton variant="h" />
              <Skeleton variant="h" />
            </div>
          }
        >
          {(lista) => {
            const marcadas = lista
              .filter((c) => c.situacao === 'em-curso' && sessaoFutura(c) !== null)
              .sort((a, b) => (a.proximaSessao ?? '').localeCompare(b.proximaSessao ?? ''));
            if (marcadas.length === 0) {
              return <p className="small muted">Nenhuma sessão marcada.</p>;
            }
            return (
              <ul className="list lista-no-cartao">
                {marcadas.map((caso) => {
                  const d = new Date(caso.proximaSessao ?? '');
                  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
                    .format(d)
                    .split('-')[0];
                  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
                    .format(d)
                    .replace('.', '');
                  return (
                    <li key={caso.id} className="li">
                      <div className="col central-dia">
                        <b className="h3">{d.getDate()}</b>
                        <span className="lab">{mes}</span>
                      </div>
                      <div className="grow">
                        <b>{caso.nome}</b>
                        <div className="small muted">
                          {(dia ?? '').charAt(0).toUpperCase()}
                          {(dia ?? '').slice(1)} · {hora(d)} ·{' '}
                          {caso.papel === 'mestre' ? (
                            <span className="gold">você mestra</span>
                          ) : (
                            'jogador'
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </Async>
      </div>
    </section>
  );
}

/* ---------- Página ---------- */

export function Central() {
  const { sessao } = useMe();
  const local = useLocation();
  const casos = useCarga('/api/campanhas', (signal) =>
    pedir<{ campanhas: CampanhaNaLista[] }>('/api/campanhas', { signal }).then((r) => r.campanhas),
  );

  useEffect(() => {
    document.title = tituloDaPagina('Central');
  }, []);

  // "Ver convites", das notificações, leva até o bloco.
  useEffect(() => {
    if (local.hash === '#convites') document.getElementById('convites')?.scrollIntoView();
  }, [local.hash]);

  if (sessao.estado !== 'logado') return null;
  const agora = new Date();

  return (
    <div className="wrap col central">
      <section className="row between wrapx" style={{ alignItems: 'flex-end' }}>
        <div className="col" style={{ gap: 6 }}>
          <span className="lab">{hoje(agora)}</span>
          <h1 className="h1">
            {saudacao(agora)}, <span className="red">{sessao.usuario.nome}</span>.
          </h1>
        </div>
        <div className="row wrapx">
          <Link className="btn" to="/personagens">
            <Icon name="user" size="sm" />
            Criar personagem
          </Link>
          <Link className="btn red" to="/casos/novo">
            <Icon name="plus" size="sm" />
            Abrir novo caso
          </Link>
        </div>
      </section>

      <div className="split">
        <div className="main col" style={{ gap: 24 }}>
          <Inicio casos={casos} />
          <Sobreviventes />
        </div>
        <aside className="side col" style={{ gap: 24 }} aria-label="Convites e agenda">
          <ConvitesPendentes aoEntrar={casos.recarregar} />
          <Agenda casos={casos} />
        </aside>
      </div>
    </div>
  );
}
