// Novo caso de Ordem Paranormal II: artboards "04 · Novo caso" e "Celular · 04" (RF-01, RF-04).
// Cinco passos: Premissa, Regras, Agenda, Convites e Revisão. O rascunho é salvo no navegador a
// cada mudança; abrir o caso cria a campanha (com o primeiro convite) e leva ao dossiê.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  DIAS_DA_SEMANA,
  FORMATOS,
  FREQUENCIAS,
  MAX_GANCHO,
  MAX_NOME_DO_CASO,
  NIVEL_MAXIMO,
  TONS,
  tituloDaPagina,
  type CampanhaDetalhe,
  type Formato,
  type Frequencia,
  type Tom,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import { agendaEmTexto, linkDoDossie, quandoCurto } from '../../casos/formatos.ts';
import {
  Banner,
  Button,
  Card,
  Field,
  Icon,
  Input,
  Paper,
  Select,
  Switch,
  Textarea,
  cx,
  useEnvio,
  useToast,
} from '../../ui/index.ts';
import {
  PASSOS,
  RASCUNHO_VAZIO,
  apagarRascunho,
  errosDoPasso,
  lerRascunho,
  montarPedido,
  passoDoCampo,
  salvarRascunho,
  validarRascunho,
  type Rascunho,
} from './rascunho.ts';
import './novo-caso.css';

const ULTIMO = PASSOS.length - 1;

/** "Rascunho salvo há 3 s", "há 2 min". */
export function textoDoSalvo(salvoEm: number, agora: number): string {
  const s = Math.max(0, Math.floor((agora - salvoEm) / 1000));
  if (s < 60) return `Rascunho salvo há ${String(s)} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `Rascunho salvo há ${String(min)} min`;
  return `Rascunho salvo às ${new Date(salvoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Atualiza a cada segundo, para o "salvo há X s" andar. */
function useAgora(): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, []);
  return agora;
}

interface PropsDoPasso {
  r: Rascunho;
  mudar: (m: Partial<Rascunho>) => void;
  /** Erro do campo, só depois de a pessoa tentar avançar (ou de o servidor recusar). */
  erro: (campo: string) => string | undefined;
}

/* ---------- 1 · Premissa ---------- */

function Premissa({ r, mudar, erro }: PropsDoPasso) {
  return (
    <>
      <fieldset className="col novo-sistemas">
        <legend className="flabel">Sistema de jogo</legend>
        <div className="g2">
          <label className="card hl novo-sistema">
            <input type="radio" name="sistema" checked readOnly />
            <span className="col" style={{ gap: 4 }}>
              <b className="h3">Ordem Paranormal II</b>
              <span className="small muted">
                Ficha, perícias, testes, Ímpeto e Gambiarra prontos. Falha crítica com d8.
              </span>
            </span>
          </label>
          <label className="card novo-sistema desligado">
            <input type="radio" name="sistema" disabled aria-describedby="inventado-em-breve" />
            <span className="col" style={{ gap: 4 }}>
              <b className="h3">RPG inventado</b>
              <span id="inventado-em-breve" className="small muted">
                Vocês definem o dado, os atributos e os recursos. Chega numa próxima versão.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <Field
        label="Nome do caso"
        error={erro('nome')}
        help={`${String(r.nome.length)} de ${String(MAX_NOME_DO_CASO)} caracteres`}
      >
        <Input
          className="novo-nome"
          value={r.nome}
          maxLength={MAX_NOME_DO_CASO}
          placeholder="Maré de Concreto"
          onChange={(e) => {
            mudar({ nome: e.target.value });
          }}
        />
      </Field>

      <Field
        label="O gancho · o que os jogadores sabem no início"
        error={erro('gancho')}
        help={`Aparece no convite e no topo do dossiê. ${String(r.gancho.length)} de ${String(MAX_GANCHO)} caracteres.`}
      >
        <Textarea
          className="type novo-gancho"
          value={r.gancho}
          maxLength={MAX_GANCHO}
          placeholder="Um prédio de doze andares à beira-mar afunda um andar por noite."
          onChange={(e) => {
            mudar({ gancho: e.target.value });
          }}
        />
      </Field>

      <div className="g2">
        <Field label="Tom" error={erro('tom')}>
          <Select
            value={r.tom}
            onChange={(e) => {
              mudar({ tom: e.target.value as Tom });
            }}
          >
            {Object.entries(TONS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Formato" error={erro('formato')}>
          <Select
            value={r.formato}
            onChange={(e) => {
              mudar({ formato: e.target.value as Formato });
            }}
          >
            {Object.entries(FORMATOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="field">
        <span className="flabel">Imagem de capa</span>
        <div className="novo-capa">
          <Icon name="image" size="xl" className="muted" />
          <div className="grow">
            <b>O envio de capa chega junto com os uploads</b>
            <div className="help">JPG, PNG ou WebP até 5 MB. Até lá, o caso usa a capa padrão.</div>
          </div>
          <Button size="sm" icon={<Icon name="upload" size="sm" />} disabled>
            Escolher
          </Button>
        </div>
      </div>
    </>
  );
}

/* ---------- 2 · Regras ---------- */

function Regras({ r, mudar, erro }: PropsDoPasso) {
  return (
    <>
      <div className="g2">
        <Field
          label="Nível inicial"
          error={erro('nivelInicial')}
          help="Nível em que os personagens começam."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={NIVEL_MAXIMO}
            value={r.nivelInicial}
            onChange={(e) => {
              mudar({ nivelInicial: e.target.value });
            }}
          />
        </Field>
        <Field
          label="DT padrão"
          error={erro('dtPadrao')}
          help="Dificuldade quando o mestre não disser outra. O livro usa 7."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={r.dtPadrao}
            onChange={(e) => {
              mudar({ dtPadrao: e.target.value });
            }}
          />
        </Field>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <Card className="novo-opcao">
          <Switch
            checked={r.rodadas}
            onChange={(rodadas) => {
              mudar({ rodadas });
            }}
            label={
              <span>
                <b>Uma ação por rodada</b>
                <span className="small muted" style={{ display: 'block' }}>
                  Investigar gasta a ação do jogador; o mestre encerra a rodada.
                </span>
              </span>
            }
          />
        </Card>
        <Card className="novo-opcao">
          <Switch
            checked={r.dadosFisicos}
            onChange={(dadosFisicos) => {
              mudar({ dadosFisicos });
            }}
            label={
              <span>
                <b>Permitir dados físicos</b>
                <span className="small muted" style={{ display: 'block' }}>
                  O jogador rola na mão e informa os valores.
                </span>
              </span>
            }
          />
        </Card>
        <Card className="novo-opcao">
          <Switch
            checked={r.fichasVisiveis}
            onChange={(fichasVisiveis) => {
              mudar({ fichasVisiveis });
            }}
            label={
              <span>
                <b>Outros jogadores podem ver as fichas</b>
                <span className="small muted" style={{ display: 'block' }}>
                  Desligado, cada jogador vê só a própria ficha. O mestre vê todas.
                </span>
              </span>
            }
          />
        </Card>
      </div>
    </>
  );
}

/* ---------- 3 · Agenda ---------- */

function Agenda({ r, mudar, erro, agora }: PropsDoPasso & { agora: Date }) {
  const pedido = montarPedido(r, agora);
  return (
    <>
      <Card className="novo-opcao">
        <Switch
          checked={r.temAgenda}
          onChange={(temAgenda) => {
            mudar({ temAgenda });
          }}
          label={
            <span>
              <b>A mesa tem dia fixo</b>
              <span className="small muted" style={{ display: 'block' }}>
                Desligado, a próxima sessão fica “a combinar”.
              </span>
            </span>
          }
        />
      </Card>
      {r.temAgenda && (
        <>
          <div className="g2">
            <Field label="Dia da semana" error={erro('agenda.diaDaSemana')}>
              <Select
                value={r.diaDaSemana}
                onChange={(e) => {
                  mudar({ diaDaSemana: e.target.value });
                }}
              >
                {DIAS_DA_SEMANA.map((dia, i) => (
                  <option key={dia} value={String(i)}>
                    {dia}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Horário" error={erro('agenda.horario')}>
              <Input
                type="time"
                value={r.horario}
                onChange={(e) => {
                  mudar({ horario: e.target.value });
                }}
              />
            </Field>
          </div>
          <Field label="Frequência" error={erro('agenda.frequencia')}>
            <Select
              value={r.frequencia}
              onChange={(e) => {
                mudar({ frequencia: e.target.value as Frequencia });
              }}
            >
              {Object.entries(FREQUENCIAS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </Field>
          {pedido.proximaSessao && (
            <p className="small" role="status">
              <Icon name="cal" size="sm" /> Primeira sessão:{' '}
              <b>{quandoCurto(pedido.proximaSessao)}</b>
            </p>
          )}
        </>
      )}
    </>
  );
}

/* ---------- 4 · Convites ---------- */

function Convites({ r, mudar, erro }: PropsDoPasso) {
  return (
    <>
      <div className="g2">
        <Field
          label="Vagas"
          error={erro('convite.vagas')}
          help="Quantas pessoas podem entrar pelo convite."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={r.vagas}
            onChange={(e) => {
              mudar({ vagas: e.target.value });
            }}
          />
        </Field>
        <Field label="Expira em (dias)" error={erro('convite.expiraEmDias')}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={r.expiraEmDias}
            onChange={(e) => {
              mudar({ expiraEmDias: e.target.value });
            }}
          />
        </Field>
      </div>
      <Banner icon={<Icon name="link" />}>
        O link e o código (como MARE-7AND) são gerados quando você abrir o caso e ficam no dossiê,
        prontos para copiar. Quem entra por eles vira jogador; você continua mestre.
      </Banner>
    </>
  );
}

/* ---------- 5 · Revisão ---------- */

function Revisao({ r, irPara, agora }: { r: Rascunho; irPara: (p: number) => void; agora: Date }) {
  const pedido = montarPedido(r, agora);
  const linhas: [string, ReactNode, number][] = [
    ['Sistema', 'Ordem Paranormal II', 0],
    ['Nome', r.nome.trim() || '—', 0],
    ['Gancho', r.gancho.trim() || 'Sem gancho', 0],
    ['Tom e formato', `${TONS[r.tom]} · ${FORMATOS[r.formato]}`, 0],
    [
      'Regras',
      [
        `Nível ${r.nivelInicial}`,
        `DT ${r.dtPadrao}`,
        r.rodadas ? 'uma ação por rodada' : 'ações livres',
        r.dadosFisicos ? 'dados físicos permitidos' : 'só dados virtuais',
        r.fichasVisiveis ? 'fichas visíveis ao grupo' : 'fichas só para o dono',
      ].join(' · '),
      1,
    ],
    [
      'Agenda',
      pedido.agenda && pedido.proximaSessao
        ? `${agendaEmTexto(pedido.agenda)} · primeira ${quandoCurto(pedido.proximaSessao)}`
        : 'A combinar',
      2,
    ],
    ['Convite', `${r.vagas} vagas · expira em ${r.expiraEmDias} dias`, 3],
  ];
  return (
    <dl className="novo-revisao">
      {linhas.map(([rotulo, valor, passo]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Editar ${rotulo.toLowerCase()}`}
            onClick={() => {
              irPara(passo);
            }}
          >
            Editar
          </Button>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Prévia do convite ---------- */

function PreviaDoConvite({ r }: { r: Rascunho }) {
  const vagas = Number(r.vagas);
  const detalhes = [
    `Nível ${r.nivelInicial || '?'}`,
    `DT ${r.dtPadrao || '?'}`,
    Number.isInteger(vagas) && vagas > 0 && `${String(vagas)} ${vagas === 1 ? 'vaga' : 'vagas'}`,
    r.temAgenda && FREQUENCIAS[r.frequencia].toLowerCase(),
  ].filter(Boolean);
  return (
    <aside className="col novo-lado" aria-label="Prévia do convite">
      <span className="lab">Como os jogadores verão o convite</span>
      <Paper className="previa">
        <div className="previa-capa">
          <Icon name="image" size="xl" />
        </div>
        <div className="col previa-corpo">
          <span className="lab">Caso novo · Ordem Paranormal II</span>
          <b className="h2">{r.nome.trim() || 'Nome do caso'}</b>
          <p className="doc small">{r.gancho.trim() || 'O gancho aparece aqui.'}</p>
          <span className="small">{detalhes.join(' · ')}</span>
        </div>
      </Paper>
    </aside>
  );
}

/* ---------- Página ---------- */

const TITULOS = [
  {
    titulo: 'Todo caso começa com uma pergunta',
    texto:
      'Escolha o sistema e diga o que os jogadores sabem ao chegar. Tudo pode ser mudado até a primeira sessão.',
  },
  { titulo: 'As regras da mesa', texto: 'Valem para todas as fichas e testes deste caso.' },
  {
    titulo: 'Quando a mesa se reúne',
    texto: 'A próxima sessão aparece na Central e no convite de cada jogador.',
  },
  { titulo: 'Chame o grupo', texto: 'Quem entra pelo link ou pelo código vira jogador.' },
  {
    titulo: 'Confira e abra o caso',
    texto: 'Ao abrir, o caso é criado e você vai para o dossiê, com o convite pronto.',
  },
] as const;

export function NovoCaso() {
  const { sessao } = useMe();
  const userId = sessao.estado === 'logado' ? sessao.usuario.id : '';
  const navegar = useNavigate();
  const avisos = useToast();
  const agoraMs = useAgora();
  const agora = new Date(agoraMs);

  const [inicial] = useState(() => lerRascunho(userId));
  const [r, setR] = useState<Rascunho>(inicial.rascunho);
  const [salvoEm, setSalvoEm] = useState<number | null>(inicial.salvoEm);
  /** Passos em que a pessoa já tentou avançar: só neles os erros aparecem. */
  const [tentados, setTentados] = useState<ReadonlySet<number>>(() => new Set());
  const [doServidor, setDoServidor] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    document.title = tituloDaPagina('Novo caso');
  }, []);

  // Ao trocar de passo, o foco vai para o título: o leitor de tela anuncia o passo novo e a
  // página volta ao topo. Na primeira abertura, o foco fica onde está.
  const titulo0 = useRef(true);
  useEffect(() => {
    if (titulo0.current) {
      titulo0.current = false;
      return;
    }
    document.getElementById('novo-titulo')?.focus();
  }, [r.passo]);

  const erros = { ...validarRascunho(r, agora), ...doServidor };
  const passo = r.passo;
  const errosAqui = errosDoPasso(erros, passo);
  const valido = (p: number) => errosDoPasso(erros, p).length === 0;
  const alcancavel = (p: number) => PASSOS.slice(0, p).every((_, i) => valido(i));

  function mudar(m: Partial<Rascunho>) {
    const novo = { ...r, ...m };
    setR(novo);
    setSalvoEm(salvarRascunho(userId, novo));
    // Mexeu num campo que o servidor recusou: a mensagem antiga não vale mais.
    if (Object.keys(doServidor).length > 0) setDoServidor({});
  }

  function irPara(p: number) {
    mudar({ passo: Math.min(Math.max(p, 0), ULTIMO) });
  }

  function avancar() {
    setTentados((t) => new Set(t).add(passo));
    if (errosAqui.length > 0) {
      // Leva o foco ao primeiro campo com erro.
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.novo-corpo [aria-invalid="true"]')?.focus();
      });
      return;
    }
    irPara(passo + 1);
  }

  const erro = (campo: string) =>
    tentados.has(passoDoCampo(campo)) || campo in doServidor ? erros[campo] : undefined;

  const abertura = useEnvio(async () => {
    setFalha(null);
    const todos = PASSOS.map((_, i) => i);
    setTentados(new Set(todos));
    const primeiroInvalido = todos.find((i) => !valido(i));
    if (primeiroInvalido !== undefined && primeiroInvalido !== ULTIMO) {
      irPara(primeiroInvalido);
      return;
    }
    try {
      const { campanha } = await pedir<{ campanha: CampanhaDetalhe }>('/api/campanhas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(montarPedido(r, new Date())),
      });
      apagarRascunho(userId);
      avisos.show({ type: 'ok', title: 'Caso aberto', text: campanha.nome });
      void navegar(linkDoDossie(campanha.id), { replace: true });
    } catch (e) {
      if (e instanceof ErroDaApi && e.campos) {
        setDoServidor(e.campos);
        const p = Math.min(...Object.keys(e.campos).map(passoDoCampo));
        if (p !== ULTIMO) irPara(p);
        else setFalha(e.message);
        return;
      }
      setFalha(
        e instanceof ErroDaApi && e.status < 500
          ? e.message
          : 'Não conseguimos falar com o servidor. O rascunho continua salvo; tente de novo.',
      );
    }
  });

  function descartar() {
    apagarRascunho(userId);
    setR(RASCUNHO_VAZIO);
    setSalvoEm(null);
    setTentados(new Set());
    setDoServidor({});
    setFalha(null);
  }

  const props: PropsDoPasso = { r, mudar, erro };
  const titulo = TITULOS[passo] ?? TITULOS[0];
  const atual = PASSOS[passo] ?? PASSOS[0];

  return (
    <div className="wrap novo-caso">
      <div className="split">
        <nav className="steps novo-passos" aria-label="Passos">
          {PASSOS.map((p, i) => {
            const feito = i < passo && valido(i);
            return (
              <button
                key={p.id}
                type="button"
                className={cx('step', i === passo && 'on', feito && 'done')}
                aria-current={i === passo ? 'step' : undefined}
                disabled={i !== passo && !alcancavel(i)}
                onClick={() => {
                  irPara(i);
                }}
              >
                <span className="n">{feito ? <Icon name="check" size="sm" /> : i + 1}</span>
                <span>
                  <b>{p.nome}</b>
                  <small>{i === 0 && feito && r.nome.trim() ? r.nome.trim() : p.dica}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <section className="col novo-corpo" aria-labelledby="novo-titulo">
          <div className="stepper novo-stepper" aria-hidden="true">
            {PASSOS.map((p, i) => (
              <i key={p.id} className={cx(i === passo && 'on', i < passo && 'done')} />
            ))}
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="eyebrow">
              Passo {passo + 1} de {PASSOS.length} · {atual.nome}
            </span>
            <h1 id="novo-titulo" className="h1" tabIndex={-1}>
              {titulo.titulo}
            </h1>
            <p className="muted">{titulo.texto}</p>
          </div>

          <form
            className="col"
            style={{ gap: 24 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (passo === ULTIMO) void abertura.enviar();
              else avancar();
            }}
          >
            {passo === 0 && <Premissa {...props} />}
            {passo === 1 && <Regras {...props} />}
            {passo === 2 && <Agenda {...props} agora={agora} />}
            {passo === 3 && <Convites {...props} />}
            {passo === 4 && <Revisao r={r} irPara={irPara} agora={agora} />}

            {falha && <Banner tone="err">{falha}</Banner>}

            <div className="novo-rodape">
              {passo === 0 ? (
                <Link className="btn ghost" to="/casos">
                  Fechar
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  icon={<Icon name="back" size="sm" />}
                  onClick={() => {
                    irPara(passo - 1);
                  }}
                >
                  Voltar
                </Button>
              )}
              <span className="small muted novo-salvo" aria-live="off">
                {salvoEm !== null && textoDoSalvo(salvoEm, agoraMs)}
              </span>
              {passo === ULTIMO ? (
                <Button type="submit" variant="primary" loading={abertura.enviando}>
                  <Icon name="folder" size="sm" />
                  Abrir o caso
                </Button>
              ) : (
                <Button type="submit" variant="primary">
                  Próximo: {PASSOS[passo + 1]?.nome.toLowerCase()}
                  <Icon name="next" size="sm" />
                </Button>
              )}
            </div>
            {tentados.has(passo) && errosAqui.length > 0 && (
              <p className="small red" role="alert">
                {errosAqui.length === 1
                  ? 'Corrija 1 campo para continuar.'
                  : `Corrija ${String(errosAqui.length)} campos para continuar.`}
              </p>
            )}
            {salvoEm !== null && (
              <div>
                <Button size="sm" variant="ghost" onClick={descartar}>
                  Descartar rascunho
                </Button>
              </div>
            )}
          </form>
        </section>

        <PreviaDoConvite r={r} />
      </div>
    </div>
  );
}
