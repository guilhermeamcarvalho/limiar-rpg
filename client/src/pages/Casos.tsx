// Casos: artboards "03 · Casos" e "Celular · 03" (RF-03).
// Lista com filtro por sistema, chips e busca à esquerda; o dossiê do caso aberto à direita.
// O caso aberto fica na URL (/casos/:id) e os filtros também (?sistema=ordem&q=...), então
// voltar, recarregar e mandar o link mantêm o que a pessoa estava vendo.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  FORMATOS,
  TONS,
  tituloDaPagina,
  type CampanhaDetalhe,
  type CampanhaNaLista,
  type ConviteDoMestre,
  type SituacaoDoCaso,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import {
  PAPEL,
  agendaEmTexto,
  linkDaCampanha,
  linkDoDossie,
  numeroDoCaso,
  paraBusca,
  quandoCurto,
  sessaoFutura,
} from '../casos/formatos.ts';
import {
  Async,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Paper,
  Segmented,
  Skeleton,
  Tag,
  cx,
  useCarga,
  useEnvio,
  useToast,
  type UsoDaCarga,
} from '../ui/index.ts';
import './casos.css';

/* ---------- Filtros ---------- */

export type FiltroDeSistema = 'todos' | 'ordem' | 'inventados';

export interface Filtros {
  sistema: FiltroDeSistema;
  situacao: SituacaoDoCaso | null;
  soMestre: boolean;
  busca: string;
}

function lerFiltros(params: URLSearchParams): Filtros {
  const sistema = params.get('sistema');
  const situacao = params.get('situacao');
  return {
    sistema: sistema === 'ordem' || sistema === 'inventados' ? sistema : 'todos',
    situacao: situacao === 'em-curso' || situacao === 'encerrado' ? situacao : null,
    soMestre: params.get('papel') === 'mestre',
    busca: params.get('q') ?? '',
  };
}

const doSistema = (caso: CampanhaNaLista, sistema: FiltroDeSistema) =>
  sistema === 'todos' ||
  (sistema === 'ordem' ? caso.sistema.tipo === 'op2' : caso.sistema.tipo === 'inventado');

/** Chips e busca, sem o filtro de sistema: é sobre isto que as abas contam. */
function pelosChipsEBusca(lista: readonly CampanhaNaLista[], f: Omit<Filtros, 'sistema'>) {
  const termo = paraBusca(f.busca);
  return lista.filter(
    (c) =>
      (f.situacao === null || c.situacao === f.situacao) &&
      (!f.soMestre || c.papel === 'mestre') &&
      (termo === '' ||
        paraBusca(c.nome).includes(termo) ||
        paraBusca(c.mestre?.nome ?? '').includes(termo)),
  );
}

/** Sistema, chips e busca, tudo junto. A busca olha o nome do caso e o do mestre. */
export function filtrarCasos(lista: readonly CampanhaNaLista[], filtros: Filtros) {
  return pelosChipsEBusca(lista, filtros).filter((c) => doSistema(c, filtros.sistema));
}

const ROTULO_DA_SITUACAO = { 'em-curso': 'Em curso', encerrado: 'Encerrado' } as const;

/* ---------- Lista ---------- */

function ItemDaLista({
  caso,
  aberto,
  busca,
}: {
  caso: CampanhaNaLista;
  aberto: boolean;
  busca: string;
}) {
  const papel = PAPEL[caso.papel];
  return (
    <Link
      className={cx('li casos-item', aberto && 'on', caso.situacao === 'encerrado' && 'encerrado')}
      to={{ pathname: linkDoDossie(caso.id), search: busca }}
      aria-current={aberto ? 'page' : undefined}
    >
      <Icon name="folder" {...(aberto && { className: papel.tom })} />
      <div className="grow">
        <span className={`lab ${papel.tom}`}>
          Nº {numeroDoCaso(caso.numero)} · {papel.rotulo}
        </span>
        <b className="h3">{caso.nome}</b>
        <span className="small muted">
          {ROTULO_DA_SITUACAO[caso.situacao]} ·{' '}
          {caso.sistema.tipo === 'op2' ? 'Ordem' : caso.sistema.nome}
        </span>
      </div>
    </Link>
  );
}

function Lista({
  casos,
  idAberto,
  filtros,
  mudar,
}: {
  casos: CampanhaNaLista[];
  idAberto: string | undefined;
  filtros: Filtros;
  mudar: (m: Partial<Filtros>) => void;
}) {
  const [params] = useSearchParams();
  const semSistema = pelosChipsEBusca(casos, filtros);
  const visiveis = semSistema.filter((c) => doSistema(c, filtros.sistema));
  const conta = (s: FiltroDeSistema) => semSistema.filter((c) => doSistema(c, s)).length;
  const chip = (rotulo: string, ligado: boolean, alternar: () => void) => (
    <button type="button" className="chip" aria-pressed={ligado} onClick={alternar}>
      {rotulo}
    </button>
  );
  const busca = params.toString() ? `?${params.toString()}` : '';
  const algumFiltro =
    filtros.sistema !== 'todos' || filtros.situacao !== null || filtros.soMestre || filtros.busca;

  return (
    <aside className="col casos-lado" aria-label="Lista de casos">
      <Segmented
        label="Filtrar por sistema"
        value={filtros.sistema}
        onChange={(sistema) => {
          mudar({ sistema });
        }}
        options={[
          { value: 'todos', label: `Todos ${String(conta('todos'))}` },
          { value: 'ordem', label: `Ordem ${String(conta('ordem'))}` },
          { value: 'inventados', label: `Inventados ${String(conta('inventados'))}` },
        ]}
      />
      <div className="casos-filtros" role="group" aria-label="Filtrar casos">
        {chip('Em curso', filtros.situacao === 'em-curso', () => {
          mudar({ situacao: filtros.situacao === 'em-curso' ? null : 'em-curso' });
        })}
        {chip('Mestre', filtros.soMestre, () => {
          mudar({ soMestre: !filtros.soMestre });
        })}
        {chip('Encerrados', filtros.situacao === 'encerrado', () => {
          mudar({ situacao: filtros.situacao === 'encerrado' ? null : 'encerrado' });
        })}
      </div>
      {visiveis.length > 0 ? (
        <nav className="card list" aria-label="Casos">
          {visiveis.map((caso) => (
            <ItemDaLista key={caso.id} caso={caso} aberto={caso.id === idAberto} busca={busca} />
          ))}
        </nav>
      ) : (
        <Card pad>
          <EmptyState
            icon={<Icon name="search" size="xl" />}
            title="Nenhum caso encontrado"
            action={
              algumFiltro && (
                <Button
                  size="sm"
                  onClick={() => {
                    mudar({ sistema: 'todos', situacao: null, soMestre: false, busca: '' });
                  }}
                >
                  Limpar filtros
                </Button>
              )
            }
          >
            {filtros.busca
              ? `Nada com “${filtros.busca}” no nome do caso ou do mestre.`
              : 'Nenhum caso com estes filtros.'}
          </EmptyState>
        </Card>
      )}
    </aside>
  );
}

/* ---------- Dossiê ---------- */

const linkDoConvite = (codigo: string) => `${window.location.origin}/c/${codigo}`;

function ConvitesDoCaso({
  uso,
  caso,
}: {
  uso: UsoDaCarga<CampanhaDetalhe>;
  caso: CampanhaDetalhe;
}) {
  const avisos = useToast();
  const convites = caso.convites ?? [];
  const gerar = useEnvio(async () => {
    try {
      const r = await pedir<{ convite: ConviteDoMestre }>(`/api/campanhas/${caso.id}/convites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      uso.mudar((c) => ({ ...c, convites: [r.convite, ...(c.convites ?? [])] }));
      avisos.show({ type: 'ok', title: 'Convite criado', text: r.convite.codigo });
    } catch (erro) {
      avisos.show({
        type: 'err',
        title: 'Não deu para criar o convite',
        text: erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.',
      });
    }
  });

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(linkDoConvite(codigo));
      avisos.show({ type: 'ok', title: 'Link copiado', text: 'Mande para o grupo.' });
    } catch {
      avisos.show({ type: 'warn', title: 'Não deu para copiar', text: linkDoConvite(codigo) });
    }
  }

  return (
    <section className="col dossie-secao" aria-labelledby="dossie-convites">
      <div className="row between">
        <h3 id="dossie-convites" className="lab">
          Convites
        </h3>
        <Button
          size="sm"
          className="no-papel"
          icon={<Icon name="plus" size="sm" />}
          loading={gerar.enviando}
          onClick={() => void gerar.enviar()}
        >
          Gerar convite
        </Button>
      </div>
      {convites.length === 0 ? (
        <p className="doc small dossie-texto">
          Nenhum convite ainda. Gere um e mande o link ou o código para o grupo.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {convites.map((c) => {
            const restam = Math.max(0, c.vagas - c.usados);
            const estado = c.expirado
              ? 'Expirado'
              : restam === 0
                ? 'Vagas esgotadas'
                : `${String(restam)} de ${String(c.vagas)} ${c.vagas === 1 ? 'vaga' : 'vagas'} · expira ${quandoCurto(c.expiraEm)}`;
            return (
              <li key={c.codigo} className="dossie-convite">
                <b className="type dossie-codigo">{c.codigo}</b>
                <span className="small grow dossie-texto">
                  {estado}
                  {c.entraram.length > 0 &&
                    ` · entraram: ${c.entraram.map((e) => e.nome).join(', ')}`}
                </span>
                {!c.expirado && restam > 0 && (
                  <Button
                    size="sm"
                    className="no-papel"
                    icon={<Icon name="copy" size="sm" />}
                    onClick={() => void copiar(c.codigo)}
                  >
                    Copiar link
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EncerrarCaso({ uso, caso }: { uso: UsoDaCarga<CampanhaDetalhe>; caso: CampanhaDetalhe }) {
  const avisos = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const encerrar = caso.situacao === 'em-curso';
  const envio = useEnvio(async () => {
    try {
      const r = await pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${caso.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encerrado: encerrar }),
      });
      uso.mudar(() => r.campanha);
      setConfirmando(false);
      avisos.show({ type: 'ok', title: encerrar ? 'Caso encerrado' : 'Caso reaberto' });
    } catch (erro) {
      avisos.show({
        type: 'err',
        title: encerrar ? 'Não deu para encerrar o caso' : 'Não deu para reabrir o caso',
        text: erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.',
      });
    }
  });
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="no-papel"
        onClick={() => {
          if (encerrar) setConfirmando(true);
          else void envio.enviar();
        }}
        loading={!encerrar && envio.enviando}
      >
        {encerrar ? 'Encerrar caso' : 'Reabrir caso'}
      </Button>
      <Modal
        open={confirmando}
        onClose={() => {
          setConfirmando(false);
        }}
        title="Encerrar caso"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" loading={envio.enviando} onClick={() => void envio.enviar()}>
              Encerrar
            </Button>
          </>
        }
      >
        <p>
          {caso.nome} vai para “Encerrados”. O dossiê continua aberto para todos, e você pode
          reabrir quando quiser.
        </p>
      </Modal>
    </>
  );
}

function Dossie({ id }: { id: string }) {
  const [params] = useSearchParams();
  const uso = useCarga(`/api/campanhas/${id}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(id)}`, {
      signal,
    }).then((r) => r.campanha),
  );
  const nome = uso.carga.estado === 'pronto' ? uso.carga.dados.nome : null;
  useEffect(() => {
    if (nome) document.title = tituloDaPagina(nome);
  }, [nome]);
  const voltar = params.toString() ? `/casos?${params.toString()}` : '/casos';

  return (
    <Paper className="casos-dossie" role="region" aria-label="Dossiê do caso">
      <Link
        className="btn sm no-papel casos-voltar"
        to={voltar}
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name="back" size="sm" />
        Todos os casos
      </Link>
      <Async
        uso={uso}
        falha="O dossiê não carregou."
        esqueleto={
          <div className="col">
            <Skeleton width="40%" />
            <Skeleton variant="h" width="70%" />
            <Skeleton width="60%" />
          </div>
        }
      >
        {(caso) => <ConteudoDoDossie uso={uso} caso={caso} />}
      </Async>
    </Paper>
  );
}

function ConteudoDoDossie({
  uso,
  caso,
}: {
  uso: UsoDaCarga<CampanhaDetalhe>;
  caso: CampanhaDetalhe;
}) {
  const papel = PAPEL[caso.papel];
  const mestra = caso.papel === 'mestre';
  const sessao = sessaoFutura(caso);
  const jogadores = caso.membros.filter((m) => m.papel === 'jogador');
  const linha = [
    caso.mestre && `Mestre: ${caso.mestre.nome}`,
    `${String(jogadores.length)} ${jogadores.length === 1 ? 'jogador' : 'jogadores'}`,
    sessao ? `próxima ${quandoCurto(sessao)}` : 'próxima sessão a combinar',
  ].filter(Boolean);
  const regras = [
    `Nível ${String(caso.nivelInicial)}`,
    `DT ${String(caso.dtPadrao)}`,
    caso.rodadas ? 'uma ação por rodada' : 'ações livres',
    caso.dadosFisicos ? 'dados físicos permitidos' : 'só dados virtuais',
    caso.fichasVisiveis ? 'fichas visíveis ao grupo' : 'cada um vê só a própria ficha',
  ];

  return (
    <>
      <div className="row between wrapx" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 6 }}>
          <span className="lab dossie-lab">
            Dossiê · caso nº {numeroDoCaso(caso.numero)} · {papel.voce}
          </span>
          <h2 className="h1 dossie-titulo">{caso.nome}</h2>
          <span className="doc dossie-linha">{linha.join(' · ')}</span>
        </div>
        <span className="carimbo">
          <Tag tone={caso.situacao === 'em-curso' ? 'red' : 'ink'}>
            {ROTULO_DA_SITUACAO[caso.situacao]}
          </Tag>
        </span>
      </div>

      <div className="row wrapx">
        <Link className="btn red" to={linkDaCampanha(caso.id, 'mesa')}>
          <Icon name="map" size="sm" />
          {mestra ? 'Abrir mesa' : 'Entrar na mesa'}
        </Link>
        <Link className="btn tinta" to={linkDaCampanha(caso.id, mestra ? 'escudo' : 'ficha')}>
          <Icon name={mestra ? 'shield' : 'user'} size="sm" />
          {mestra ? 'Escudo' : 'Ficha'}
        </Link>
        {mestra && <EncerrarCaso uso={uso} caso={caso} />}
      </div>

      {caso.gancho && <p className="type dossie-texto">{caso.gancho}</p>}

      <section className="col dossie-secao" aria-labelledby="dossie-premissa">
        <h3 id="dossie-premissa" className="lab">
          Premissa e regras
        </h3>
        <p className="doc small dossie-texto">
          {caso.sistema.nome} · {TONS[caso.tom]} · {FORMATOS[caso.formato]}
          {caso.agenda && ` · ${agendaEmTexto(caso.agenda)}`}
        </p>
        <p className="doc small dossie-texto">{regras.join(' · ')}</p>
      </section>

      <section className="col dossie-secao" aria-labelledby="dossie-grupo">
        <h3 id="dossie-grupo" className="lab">
          Grupo
        </h3>
        <p className="doc small dossie-texto">
          {jogadores.length === 0
            ? 'Ninguém entrou ainda.'
            : jogadores.map((m) => m.nome).join(', ')}
        </p>
      </section>

      {mestra && <ConvitesDoCaso uso={uso} caso={caso} />}

      <p className="small dossie-linha">
        Resumo, quadro de pistas, diário, objetivos e linha do tempo entram aqui com as sessões.
      </p>
    </>
  );
}

/* ---------- Página ---------- */

export function Casos() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const casos = useCarga('/api/campanhas', (signal) =>
    pedir<{ campanhas: CampanhaNaLista[] }>('/api/campanhas', { signal }).then((r) => r.campanhas),
  );

  useEffect(() => {
    if (!id) document.title = tituloDaPagina('Casos');
  }, [id]);

  function mudar(m: Partial<Filtros>) {
    const f = { ...filtros, ...m };
    const novos = new URLSearchParams();
    if (f.sistema !== 'todos') novos.set('sistema', f.sistema);
    if (f.situacao) novos.set('situacao', f.situacao);
    if (f.soMestre) novos.set('papel', 'mestre');
    if (f.busca) novos.set('q', f.busca);
    setParams(novos, { replace: true });
  }

  return (
    <div className={cx('wrap col casos', id && 'tem-caso')}>
      <section className="row between wrapx casos-cabeca" style={{ alignItems: 'flex-end' }}>
        <div className="col" style={{ gap: 6 }}>
          <span className="lab">Arquivo pessoal</span>
          <h1 className="h1">Casos</h1>
        </div>
        <div className="row wrapx">
          <div className="casos-busca">
            <label className="sr-only" htmlFor="busca-casos">
              Buscar caso ou mestre
            </label>
            <Input
              id="busca-casos"
              type="search"
              placeholder="Buscar caso ou mestre"
              value={filtros.busca}
              onChange={(e) => {
                mudar({ busca: e.target.value });
              }}
            />
            <Icon name="search" size="sm" />
          </div>
          <Link className="btn red" to="/casos/novo">
            <Icon name="plus" size="sm" />
            Abrir novo caso
          </Link>
        </div>
      </section>

      <div className="split" style={{ gap: 24 }}>
        <Async
          uso={casos}
          falha="A lista de casos não carregou."
          esqueleto={
            <div className="col casos-lado">
              <Skeleton variant="h" />
              <Card className="col" style={{ padding: 14 }}>
                <Skeleton variant="h" />
                <Skeleton variant="h" />
                <Skeleton variant="h" />
              </Card>
            </div>
          }
          vazio={{
            se: (lista) => lista.length === 0,
            mostrar: (
              <Card pad className="grow">
                <EmptyState
                  icon={<Icon name="folder" size="xl" />}
                  title="Nenhum caso ainda"
                  action={
                    <div className="row wrapx" style={{ justifyContent: 'center' }}>
                      <Link className="btn red" to="/casos/novo">
                        Abrir novo caso
                      </Link>
                      <Link className="btn" to="/convite">
                        Entrar com código
                      </Link>
                    </div>
                  }
                >
                  Abra um caso como mestre ou entre num pelo convite que o mestre mandou.
                </EmptyState>
              </Card>
            ),
          }}
        >
          {(lista) => <Lista casos={lista} idAberto={id} filtros={filtros} mudar={mudar} />}
        </Async>

        {id ? (
          <Dossie key={id} id={id} />
        ) : casos.carga.estado === 'pronto' && casos.carga.dados.length === 0 ? null : (
          <Paper className="casos-dossie">
            <EmptyState icon={<Icon name="folder" size="xl" />} title="Escolha um caso">
              O dossiê do caso aparece aqui.
            </EmptyState>
          </Paper>
        )}
      </div>
    </div>
  );
}
