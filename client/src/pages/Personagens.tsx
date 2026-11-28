// Personagens: artboards "06 · Personagens" e "Celular · 06"; vazio, "16 · Personagens vazio".
// Lista os sobreviventes de quem está logado, com filtros por caso e ações de cada cartão.
// Remover pede confirmação dentro do cartão e só apaga de vez depois de 5 s, com "Desfazer".
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ATRIBUTOS_OP2,
  tituloDaPagina,
  urlDoArquivo,
  type CampanhaNaLista,
  type PersonagemNaLista,
} from '@membrana/shared';
import { TopoDoCelular, useCelularProprio } from '../app/celular.tsx';
import { ErroDaApi, pedir } from '../auth/api.ts';
import { iniciais, linkDaCampanha } from '../casos/formatos.ts';
import {
  NOME_DO_PERFIL,
  TOM_DO_PERFIL,
  descricaoDaFicha,
  linkDaFicha,
  linkDaFichaEmBranco,
  linkDeCriar,
  primeiroNome,
} from '../personagens/formatos.ts';
import {
  Async,
  Avatar,
  Banner,
  Button,
  Card,
  Die,
  Icon,
  Modal,
  ResourceBar,
  Segmented,
  Select,
  Skeleton,
  Tag,
  cx,
  useCarga,
  useToast,
  type NomeDoIcone,
  type UsoDaCarga,
} from '../ui/index.ts';
import './personagens.css';

/** Quanto tempo o "Desfazer" vale: o mesmo do aviso de sucesso. */
export const PRAZO_PARA_DESFAZER_MS = 5000;

type Ordem = 'recentes' | 'nome';

const urlDoPersonagem = (id: string) => `/api/personagens/${encodeURIComponent(id)}`;

const mensagemDe = (e: unknown) =>
  e instanceof ErroDaApi ? e.message : 'Não conseguimos falar com o servidor. Tente de novo.';

async function buscarLista(signal?: AbortSignal) {
  const r = await pedir<{ personagens: PersonagemNaLista[] }>('/api/me/personagens', {
    ...(signal && { signal }),
  });
  return r.personagens;
}

/* ---------- Filtros ---------- */

interface OpcaoDeFiltro {
  value: string;
  nome: string;
  teste: (p: PersonagemNaLista) => boolean;
}

/** Todos, um por caso em curso, sem caso e encerrados; só os que têm alguém. */
function opcoesDeFiltro(lista: PersonagemNaLista[]): (OpcaoDeFiltro & { total: number })[] {
  const casos = new Map<string, string>();
  for (const p of lista) {
    if (p.campanha && !p.campanha.encerrado) casos.set(p.campanha.id, p.campanha.nome);
  }
  const opcoes: OpcaoDeFiltro[] = [
    { value: 'todos', nome: 'Todos', teste: () => true },
    ...[...casos].map(([id, nome]) => ({
      value: `caso:${id}`,
      nome,
      teste: (p: PersonagemNaLista) => p.campanha?.id === id,
    })),
    { value: 'sem-caso', nome: 'Sem caso', teste: (p) => p.campanha === null },
    { value: 'encerrados', nome: 'Encerrados', teste: (p) => p.campanha?.encerrado === true },
  ];
  return opcoes
    .map((o) => ({ ...o, total: lista.filter(o.teste).length }))
    .filter((o) => o.value === 'todos' || o.total > 0);
}

function ordenar(lista: PersonagemNaLista[], ordem: Ordem) {
  return [...lista].sort((a, b) =>
    ordem === 'nome'
      ? a.ficha.nome.localeCompare(b.ficha.nome, 'pt-BR')
      : b.atualizadoEm.localeCompare(a.atualizadoEm),
  );
}

/* ---------- Menu "mais ações" ---------- */

interface ItemDoMenu {
  rotulo: string;
  icone: NomeDoIcone;
  aoEscolher: () => void;
}

function MenuDeAcoes({ nome, itens }: { nome: string; itens: ItemDoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => {
      document.removeEventListener('pointerdown', fora);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const opcoes = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const atual = opcoes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      opcoes[(atual + passo + opcoes.length) % opcoes.length]?.focus();
    } else if (e.key === 'Tab') {
      setAberto(false);
    }
  }

  return (
    <div className="pers-menu" ref={raiz} onKeyDown={aoTeclar}>
      <Button
        ref={botao}
        size="sm"
        variant="ghost"
        icon={<Icon name="more" />}
        aria-label={`Mais ações para ${nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => {
          setAberto((a) => !a);
        }}
      />
      {aberto && (
        <div className="pers-menu-lista" role="menu" aria-label={`Ações para ${nome}`}>
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setAberto(false);
                item.aoEscolher();
              }}
            >
              <Icon name={item.icone} size="sm" />
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Cartão ---------- */

interface AcoesDoCartao {
  usar: (p: PersonagemNaLista) => Promise<void>;
  levar: (p: PersonagemNaLista) => void;
  duplicar: (p: PersonagemNaLista) => Promise<void>;
  remover: (p: PersonagemNaLista) => void;
}

function Cartao({
  p,
  acoes,
  papelNoCaso,
}: {
  p: PersonagemNaLista;
  acoes: AcoesDoCartao;
  papelNoCaso?: 'mestre' | 'jogador' | undefined;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [usando, setUsando] = useState(false);
  const manter = useRef<HTMLButtonElement>(null);
  const { ficha, campanha } = p;
  // O token é o que a mesa mostra; sem ele, a foto.
  const imagem = p.tokenImg ?? p.foto;
  const nome = primeiroNome(ficha.nome) || ficha.nome;
  const ativo = campanha !== null && !campanha.encerrado;
  const doEscudoDoMestre = campanha !== null && papelNoCaso === 'mestre';

  useEffect(() => {
    if (confirmando) manter.current?.focus();
  }, [confirmando]);

  return (
    <Card
      className="col pers-cartao"
      {...(p.emUso && ativo && { state: 'selected' as const })}
      aria-labelledby={`pers-${p.id}`}
      role="article"
    >
      <div className="row">
        <Avatar
          initials={iniciais(ficha.nome)}
          name={ficha.nome}
          tone={TOM_DO_PERFIL[ficha.perfil]}
          size="lg"
          src={imagem ? urlDoArquivo(imagem) : undefined}
        />
        <div className="grow pers-nome">
          <div className="row between">
            <b id={`pers-${p.id}`} className="h2">
              {nome}
            </b>
            {p.emUso && ativo && !doEscudoDoMestre && <Tag tone="green">Em uso</Tag>}
            {doEscudoDoMestre && <Tag tone="gold">Escudo · {campanha.nome}</Tag>}
          </div>
          <span className="small muted pers-desc">{descricaoDaFicha(ficha)}</span>
          <span className="small muted pers-desc-celular">
            {NOME_DO_PERFIL[ficha.perfil]} · {campanha ? campanha.nome : 'sem caso'}
          </span>
        </div>
      </div>

      <div className="row wrapx pers-tags">
        <Tag>
          {campanha ? `${campanha.nome}${campanha.encerrado ? ' · encerrado' : ''}` : 'Sem caso'}
        </Tag>
        <Tag>{p.sistema.nome}</Tag>
        <Tag tone={TOM_DO_PERFIL[ficha.perfil]}>{NOME_DO_PERFIL[ficha.perfil]}</Tag>
      </div>

      {confirmando ? (
        <div
          className="banner err pers-confirma"
          role="alertdialog"
          aria-label={`Confirmar remoção de ${nome}`}
        >
          <p>
            <b>Remover {nome}?</b> A ficha, a foto, o token e as pistas guardadas somem.
            {campanha && ` O caso ${campanha.nome} mantém o histórico.`}
          </p>
          <div className="row">
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="trash" size="sm" />}
              onClick={() => {
                acoes.remover(p);
              }}
            >
              Remover
            </Button>
            <Button
              ref={manter}
              size="sm"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Manter
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="row pers-atributos">
            {ATRIBUTOS_OP2.map((a) => {
              const dado = ficha.atributos[a.id];
              return (
                <span key={a.id} className="disp">
                  {a.sigla} <Die type={dado} value={Number(dado.slice(1))} />
                </span>
              );
            })}
          </div>
          <div className="pers-pv">
            <ResourceBar kind="pv" value={ficha.pv} max={ficha.pvMax} />
          </div>
          <div className="pers-pd">
            <ResourceBar kind="pd" value={ficha.pd} max={ficha.pdMax} />
          </div>

          {!campanha && (
            <div className="pers-sem-caso">
              <Banner icon={<Icon name="info" size="sm" />}>
                <span className="small">
                  Sem caso. Leve {nome} para um caso de {p.sistema.nome}.
                </span>
              </Banner>
            </div>
          )}

          <div className="row wrapx pers-acoes">
            {doEscudoDoMestre && (
              <Link className="btn sm" to={linkDaCampanha(campanha.id, 'escudo')}>
                <Icon name="shield" size="sm" />
                Abrir Escudo
              </Link>
            )}
            {ativo && p.emUso && !doEscudoDoMestre && (
              <Link className="btn red sm" to={linkDaCampanha(campanha.id, 'mesa')}>
                <Icon name="map" size="sm" />
                Jogar na mesa
              </Link>
            )}
            {ativo && !p.emUso && !doEscudoDoMestre && (
              <Button
                size="sm"
                icon={<Icon name="check" size="sm" />}
                loading={usando}
                onClick={() => {
                  setUsando(true);
                  void acoes.usar(p).finally(() => {
                    setUsando(false);
                  });
                }}
              >
                Usar este
              </Button>
            )}
            {!campanha && (
              <Button
                size="sm"
                onClick={() => {
                  acoes.levar(p);
                }}
              >
                Levar para um caso
              </Button>
            )}
            <Link className="btn sm" to={linkDaFicha(p.id)}>
              Abrir ficha
            </Link>
            <MenuDeAcoes
              nome={nome}
              itens={[
                { rotulo: 'Duplicar', icone: 'copy', aoEscolher: () => void acoes.duplicar(p) },
                {
                  rotulo: 'Remover',
                  icone: 'trash',
                  aoEscolher: () => {
                    setConfirmando(true);
                  },
                },
              ]}
            />
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- Levar para um caso ---------- */

function LevarParaCaso({
  personagem,
  campanhas,
  aoFechar,
  aoLevar,
}: {
  personagem: PersonagemNaLista | null;
  campanhas: CampanhaNaLista[] | null;
  aoFechar: () => void;
  aoLevar: (p: PersonagemNaLista, caso: CampanhaNaLista) => Promise<void>;
}) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const nome = personagem ? primeiroNome(personagem.ficha.nome) : '';
  const possiveis = (campanhas ?? []).filter(
    (c) => c.situacao === 'em-curso' && c.sistema.id === personagem?.sistemaId,
  );

  return (
    <Modal
      open={personagem !== null}
      onClose={() => {
        setFalha(null);
        aoFechar();
      }}
      title={`Levar ${nome} para um caso`}
    >
      <div className="col">
        {campanhas === null ? (
          <Skeleton />
        ) : possiveis.length === 0 ? (
          <p className="muted">
            Você não está em nenhum caso de {personagem?.sistema.nome} em curso. Entre num caso pelo
            convite do mestre ou crie um.
          </p>
        ) : (
          <>
            <p className="small muted">
              {nome} passa a ser o seu personagem no caso escolhido. Os outros casos não mudam.
            </p>
            <ul className="col pers-casos">
              {possiveis.map((c) => (
                <li key={c.id}>
                  <Button
                    wide
                    loading={enviando === c.id}
                    disabled={enviando !== null}
                    onClick={() => {
                      if (!personagem) return;
                      setEnviando(c.id);
                      setFalha(null);
                      aoLevar(personagem, c)
                        .catch((e: unknown) => {
                          setFalha(mensagemDe(e));
                        })
                        .finally(() => {
                          setEnviando(null);
                        });
                    }}
                  >
                    {c.nome}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        {falha && <Banner tone="err">{falha}</Banner>}
      </div>
    </Modal>
  );
}

/* ---------- Vazio (primeiro acesso) ---------- */

function Vazio({ caso }: { caso: CampanhaNaLista | null }) {
  return (
    <>
      <div className="empty pers-vazio">
        <Icon name="users" size="xl" />
        <h2 className="h2">Ninguém sobreviveu ainda</h2>
        <p className="muted">
          {caso ? `Crie um personagem para ${caso.nome}.` : 'Crie o seu primeiro personagem.'} O
          passo a passo leva uns 10 minutos; a ficha em branco é para quem já sabe as regras.
        </p>
        <div className="row wrapx pers-vazio-acoes">
          <Link className="btn red pers-cta" to={linkDeCriar(caso?.id)}>
            <Icon name="plus" size="sm" />
            Criar com passo a passo
          </Link>
          <Link className="btn" to={linkDaFichaEmBranco(caso?.id)}>
            Ficha em branco
          </Link>
        </div>
      </div>
      <ol className="g3 pers-etapas">
        <li className="card pad col">
          <span className="lab red">1 · Perfil</span>
          <p className="small muted">Executor, Analista ou Vigilante. Define a sua habilidade.</p>
        </li>
        <li className="card pad col">
          <span className="lab red">2 · Atributos e perícias</span>
          <p className="small muted">Os dados que você vai rolar na mesa.</p>
        </li>
        <li className="card pad col">
          <span className="lab red">3 · Foto e token</span>
          <p className="small muted">Como os outros veem você no mapa.</p>
        </li>
      </ol>
    </>
  );
}

/* ---------- Página ---------- */

function useRemocaoComDesfazer(uso: UsoDaCarga<PersonagemNaLista[]>) {
  const avisos = useToast();
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(() => new Set());
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const mostrar = (id: string) => {
    setOcultos((s) => {
      const novo = new Set(s);
      novo.delete(id);
      return novo;
    });
  };

  // Saiu da página antes dos 5 s: a remoção vale do mesmo jeito.
  useEffect(() => {
    const lista = pendentes.current;
    return () => {
      for (const [id, t] of lista) {
        clearTimeout(t);
        void fetch(urlDoPersonagem(id), {
          method: 'DELETE',
          credentials: 'same-origin',
          keepalive: true,
        });
      }
      lista.clear();
    };
  }, []);

  async function apagarDeVez(p: PersonagemNaLista) {
    pendentes.current.delete(p.id);
    try {
      await pedir(urlDoPersonagem(p.id), { method: 'DELETE' });
      uso.mudar((lista) => lista.filter((x) => x.id !== p.id));
    } catch (e) {
      avisos.show({
        type: 'err',
        title: `Não deu para remover ${primeiroNome(p.ficha.nome)}`,
        text: mensagemDe(e),
      });
    }
    mostrar(p.id);
  }

  function remover(p: PersonagemNaLista) {
    setOcultos((s) => new Set(s).add(p.id));
    pendentes.current.set(
      p.id,
      setTimeout(() => void apagarDeVez(p), PRAZO_PARA_DESFAZER_MS),
    );
    avisos.show({
      type: 'ok',
      title: `${primeiroNome(p.ficha.nome)} removido`,
      text: 'Dá para desfazer por 5 segundos.',
      action: {
        label: 'Desfazer',
        onClick: () => {
          const t = pendentes.current.get(p.id);
          if (t === undefined) return;
          clearTimeout(t);
          pendentes.current.delete(p.id);
          mostrar(p.id);
        },
      },
    });
  }

  return { ocultos, remover };
}

export function Personagens() {
  const [params] = useSearchParams();
  const aceito = params.get('aceito');
  const avisos = useToast();
  const uso = useCarga('/api/me/personagens', buscarLista);
  const casos = useCarga('/api/campanhas', (signal) =>
    pedir<{ campanhas: CampanhaNaLista[] }>('/api/campanhas', { signal }).then((r) => r.campanhas),
  );
  const listaDeCasos = casos.carga.estado === 'pronto' ? casos.carga.dados : null;
  const casoAceito = (aceito && listaDeCasos?.find((c) => c.id === aceito)) || null;

  const [filtro, setFiltro] = useState('todos');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const [levando, setLevando] = useState<PersonagemNaLista | null>(null);
  const { ocultos, remover } = useRemocaoComDesfazer(uso);

  useEffect(() => {
    document.title = tituloDaPagina('Personagens');
  }, []);
  // No celular, o "Novo sobrevivente" fica no cabeçalho (Celular · 06).
  useCelularProprio({ topo: true, barra: false });

  /** Busca a lista de novo sem piscar o esqueleto. */
  async function atualizar() {
    const lista = await buscarLista();
    uso.mudar(() => lista);
  }

  async function escolherNoCaso(p: PersonagemNaLista, caso: { id: string; nome: string }) {
    await pedir(`/api/campanhas/${encodeURIComponent(caso.id)}/meu-personagem`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personagemId: p.id }),
    });
    await atualizar();
    avisos.show({
      type: 'ok',
      title: `${primeiroNome(p.ficha.nome)} em uso`,
      text: `No caso ${caso.nome}.`,
    });
  }

  const acoes: AcoesDoCartao = {
    usar: async (p) => {
      if (!p.campanha) return;
      try {
        await escolherNoCaso(p, p.campanha);
      } catch (e) {
        avisos.show({ type: 'err', title: 'Não deu para usar este', text: mensagemDe(e) });
      }
    },
    levar: setLevando,
    duplicar: async (p) => {
      try {
        const nome = `${p.ficha.nome} (cópia)`.slice(0, 60);
        await pedir('/api/personagens', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sistemaId: p.sistemaId, ficha: { ...p.ficha, nome } }),
        });
        await atualizar();
        avisos.show({ type: 'ok', title: 'Personagem duplicado', text: `${nome}, sem caso.` });
      } catch (e) {
        avisos.show({ type: 'err', title: 'Não deu para duplicar', text: mensagemDe(e) });
      }
    },
    remover,
  };

  return (
    <>
      <TopoDoCelular
        titulo="Personagens"
        fim={
          <Link className="btn red icon" to={linkDeCriar(aceito)} aria-label="Novo sobrevivente">
            <Icon name="plus" />
          </Link>
        }
      />
      <div className="wrap col pers">
        {aceito && casoAceito && (
          <Banner tone="ok">
            Convite aceito. Você agora joga em <b>{casoAceito.nome}</b>. Falta só o personagem.
          </Banner>
        )}

        <Async
          uso={uso}
          falha="Seus personagens não carregaram."
          esqueleto={
            <div className="g3" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <Card key={i} pad className="col">
                  <Skeleton variant="h" width="50%" />
                  <Skeleton />
                  <Skeleton width="70%" />
                </Card>
              ))}
            </div>
          }
        >
          {(todos) => {
            const lista = todos.filter((p) => !ocultos.has(p.id));
            if (lista.length === 0) {
              return (
                <>
                  <section className="col pers-titulo">
                    <span className="lab">Personagens</span>
                    <h1 className="h1">Seus sobreviventes</h1>
                  </section>
                  <Vazio caso={casoAceito} />
                </>
              );
            }
            const opcoes = opcoesDeFiltro(lista);
            const ativa = opcoes.find((o) => o.value === filtro) ?? opcoes[0];
            const visiveis = ordenar(lista.filter(ativa?.teste ?? (() => true)), ordem);
            return (
              <>
                <section className="row between wrapx pers-cabeca">
                  <div className="col pers-titulo">
                    <span className="lab">Personagens</span>
                    <h1 className="h1">Seus sobreviventes</h1>
                    <p className="muted">
                      Cada personagem pertence a um caso. O que está “em uso” abre na mesa, no
                      celular e na ficha.
                    </p>
                  </div>
                  <Link className="btn red" to={linkDeCriar(aceito)}>
                    <Icon name="plus" size="sm" />
                    Novo sobrevivente
                  </Link>
                </section>

                <div className="row between wrapx pers-filtros">
                  <Segmented
                    label="Filtrar por caso"
                    value={ativa?.value ?? 'todos'}
                    onChange={setFiltro}
                    options={opcoes.map((o) => ({
                      value: o.value,
                      label: (
                        <>
                          {o.nome} <span className="pers-cnt">{o.total}</span>
                        </>
                      ),
                    }))}
                  />
                  <Select
                    className="pers-ordem"
                    aria-label="Ordenar"
                    value={ordem}
                    onChange={(e) => {
                      setOrdem(e.target.value as Ordem);
                    }}
                  >
                    <option value="recentes">Jogados recentemente</option>
                    <option value="nome">Nome</option>
                  </Select>
                </div>

                <div className={cx('g3', 'pers-grade')}>
                  {visiveis.map((p) => (
                    <Cartao
                      key={p.id}
                      p={p}
                      acoes={acoes}
                      papelNoCaso={listaDeCasos?.find((c) => c.id === p.campanhaId)?.papel}
                    />
                  ))}
                </div>
              </>
            );
          }}
        </Async>

        <LevarParaCaso
          personagem={levando}
          campanhas={listaDeCasos}
          aoFechar={() => {
            setLevando(null);
          }}
          aoLevar={async (p, caso) => {
            await escolherNoCaso(p, caso);
            setLevando(null);
          }}
        />
      </div>
    </>
  );
}
