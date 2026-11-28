// Edição da ficha de Ordem Paranormal II, com todos os campos numa página (RF-08) e os avisos
// RF-09. Usada pela ficha em branco (#44) e pelo modo de edição da tela Ficha (#47, artboard
// Ficha-Inventado). Erros (como PV acima do máximo) bloqueiam salvar, aparecem no campo e levam o
// foco até ele; avisos da regra de criação não bloqueiam. O rascunho é separado do estado salvo:
// Cancelar descarta.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ATRIBUTOS_OP2,
  DADOS,
  OCUPACOES_OP2,
  PERFIS_OP2,
  PERICIAS_OP2,
  avisosDaCriacao,
  esquemaFichaOp2,
  maximosDeRecursos,
  type Dado,
  type FichaOp2,
  type PerfilOp2,
} from '@membrana/shared';
import { NOME_DO_PERFIL } from '../../personagens/formatos.ts';
import {
  Banner,
  Button,
  Card,
  cx,
  Field,
  Icon,
  Input,
  ModoDados,
  Select,
  Textarea,
} from '../../ui/index.ts';
import './ficha.css';

function CampoOcupacao({
  valor,
  erro,
  aoMudar,
}: {
  valor: string;
  erro: string | undefined;
  aoMudar: (novo: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [focoIdx, setFocoIdx] = useState(-1);
  const raizRef = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const termo = valor.trim().toLowerCase();
  const opcoes = termo
    ? OCUPACOES_OP2.filter(
        (o) => o.nome.toLowerCase().includes(termo) || o.habilidade.toLowerCase().includes(termo),
      )
    : OCUPACOES_OP2;
  const mostrar = aberto && opcoes.length > 0;

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto]);

  function escolher(nome: string) {
    aoMudar(nome);
    setAberto(false);
    setFocoIdx(-1);
  }

  return (
    <div ref={raizRef} className="ocupacao-combo">
      <Field label="Ocupação" error={erro} help="Conhecidas trazem habilidade.">
        <div className="ocupacao-input-wrap">
          <Input
            value={valor}
            maxLength={40}
            role="combobox"
            aria-expanded={mostrar}
            aria-controls={listaId}
            aria-autocomplete="list"
            placeholder="Escolha ou digite…"
            onFocus={() => {
              setAberto(true);
              setFocoIdx(-1);
            }}
            onChange={(e) => {
              aoMudar(e.target.value);
              setAberto(true);
              setFocoIdx(-1);
            }}
            onKeyDown={(e) => {
              if (!mostrar) {
                if (e.key === 'ArrowDown') {
                  setAberto(true);
                  setFocoIdx(0);
                  e.preventDefault();
                }
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocoIdx((i) => (i + 1) % opcoes.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocoIdx((i) => (i <= 0 ? opcoes.length - 1 : i - 1));
              } else if (e.key === 'Enter' && focoIdx >= 0 && opcoes[focoIdx]) {
                e.preventDefault();
                escolher(opcoes[focoIdx].nome);
              } else if (e.key === 'Escape') {
                setAberto(false);
              }
            }}
          />
          <button
            type="button"
            className="ocupacao-toggle"
            aria-label={aberto ? 'Fechar lista de ocupações' : 'Abrir lista de ocupações'}
            tabIndex={-1}
            onClick={() => {
              setAberto((v) => !v);
            }}
          >
            <Icon name={aberto ? 'up' : 'down'} size="sm" />
          </button>
        </div>
      </Field>

      {mostrar && (
        <ul id={listaId} className="ocupacao-menu" role="listbox" aria-label="Ocupações">
          {opcoes.map((o, i) => {
            const selecionada = o.nome.toLowerCase() === termo;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={selecionada}
                className={cx(
                  'ocupacao-opcao',
                  selecionada && 'selecionada',
                  i === focoIdx && 'foco',
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(o.nome);
                }}
              >
                <span className="ocupacao-opcao-nome">{o.nome}</span>
                <span className="ocupacao-opcao-hab">{o.habilidade}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Os campos como a tela os edita: números ainda como texto, do jeito que a pessoa digitou. */
type CampoNumerico = 'nivel' | 'idade' | 'pv' | 'pvMax' | 'pd' | 'pdMax';
export type FormDaFicha = Omit<FichaOp2, CampoNumerico> & Record<CampoNumerico, string>;

export function paraForm(ficha: FichaOp2): FormDaFicha {
  return {
    ...ficha,
    nivel: String(ficha.nivel),
    idade: ficha.idade === null ? '' : String(ficha.idade),
    pv: String(ficha.pv),
    pvMax: String(ficha.pvMax),
    pd: String(ficha.pd),
    pdMax: String(ficha.pdMax),
  };
}

const numero = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto));

/** O objeto que vai para o schema (e para o servidor). */
export function daForm(f: FormDaFicha): FichaOp2 {
  return {
    ...f,
    nivel: numero(f.nivel),
    idade: f.idade.trim() === '' ? null : numero(f.idade),
    pv: numero(f.pv),
    pvMax: numero(f.pvMax),
    pd: numero(f.pd),
    pdMax: numero(f.pdMax),
  };
}

/** Erros por campo ("pericias.luta" → mensagem), com as mesmas regras do servidor. */
export function errosDaFicha(f: FormDaFicha): Record<string, string> {
  const resultado = esquemaFichaOp2.safeParse(daForm(f));
  if (resultado.success) return {};
  const erros: Record<string, string> = {};
  for (const p of resultado.error.issues) erros[p.path.join('.') || '_'] ??= p.message;
  return erros;
}

/** Quantos campos mudaram desde o estado salvo (cada atributo e perícia conta um). */
export function contarMudancas(atual: FormDaFicha, salvo: FormDaFicha): number {
  let n = 0;
  for (const chave of Object.keys(salvo) as (keyof FormDaFicha)[]) {
    if (chave === 'atributos' || chave === 'pericias') {
      const a = atual[chave] as Record<string, Dado>;
      const s = salvo[chave] as Record<string, Dado>;
      n += Object.keys(s).filter((k) => a[k] !== s[k]).length;
    } else if (JSON.stringify(atual[chave]) !== JSON.stringify(salvo[chave])) n += 1;
  }
  return n;
}

/**
 * Escolher o dado de um atributo ou perícia: as cinco opções à vista, um clique só (em vez de abrir
 * uma lista). São rádios de verdade: setas do teclado trocam o dado.
 */
function SeletorDeDado({
  rotulo,
  valor,
  aviso,
  mudar,
}: {
  rotulo: string;
  valor: Dado;
  aviso: string | undefined;
  mudar: (d: Dado) => void;
}) {
  const id = useId();
  return (
    <div className="field ficha-dado">
      <span className="flabel" id={`${id}-r`}>
        {rotulo}
      </span>
      <div className="dado-escolha" role="radiogroup" aria-labelledby={`${id}-r`}>
        {DADOS.map((d) => (
          <label key={d} className={cx('dado-opcao', d === valor && 'on')}>
            <input
              type="radio"
              name={id}
              value={d}
              checked={d === valor}
              onChange={() => {
                mudar(d);
              }}
            />
            {d}
          </label>
        ))}
      </div>
      {aviso && (
        <span className="fwarn">
          <Icon name="alert" size="sm" />
          {aviso}
        </span>
      )}
    </div>
  );
}

export interface EdicaoProps {
  /** A ficha salva (ou a de partida, na ficha em branco). */
  inicial: FichaOp2;
  /** "Editando a ficha de Davi", "Ficha em branco". */
  titulo: ReactNode;
  /** Etiquetas acima do nome: caso, sistema. */
  contexto?: ReactNode;
  rotuloDeSalvar: string;
  salvando: boolean;
  /** Erros que o servidor devolveu, por campo da ficha ("pv", "pericias.luta"). */
  errosDoServidor?: Record<string, string>;
  falha?: string | null;
  aoCancelar: () => void;
  aoSalvar: (ficha: FichaOp2) => void;
  /** Terceira coluna, ao lado das perícias: o aviso de testes pausados na tela Ficha. */
  lateral?: ReactNode;
  /** A regra do caso: sem ela, os dados físicos ficam de fora (RF-83). */
  permitirFisico?: boolean;
}

const SEM_ERROS: Record<string, string> = {};

/** Leva o foco ao primeiro campo com erro, depois de a tela mostrar os erros. */
function focarPrimeiroErro() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.ficha-edicao [aria-invalid="true"]')?.focus();
  });
}

export function EdicaoDaFicha({
  inicial,
  titulo,
  contexto,
  rotuloDeSalvar,
  salvando,
  errosDoServidor = SEM_ERROS,
  falha,
  aoCancelar,
  aoSalvar,
  lateral,
  permitirFisico = true,
}: EdicaoProps) {
  const [salvo] = useState(() => paraForm(inicial));
  const [f, setF] = useState<FormDaFicha>(salvo);
  const [tentou, setTentou] = useState(false);
  const [mexidos, setMexidos] = useState<ReadonlySet<string>>(() => new Set());
  // Erros do servidor valem até a pessoa mexer no campo; uma resposta nova recomeça a conta.
  const [doServidor, setDoServidor] = useState(errosDoServidor);
  const [mexidosDepois, setMexidosDepois] = useState<ReadonlySet<string>>(() => new Set());
  if (doServidor !== errosDoServidor) {
    setDoServidor(errosDoServidor);
    setMexidosDepois(new Set());
  }
  // Erro novo do servidor: o foco vai para o campo, como nos erros da própria tela.
  useEffect(() => {
    if (Object.keys(errosDoServidor).length > 0) focarPrimeiroErro();
  }, [errosDoServidor]);
  const servidorAinda = Object.fromEntries(
    Object.entries(errosDoServidor).filter(([c]) => !mexidosDepois.has(c.split('.')[0] ?? c)),
  );

  const erros = { ...errosDaFicha(f), ...servidorAinda };
  const avisos = avisosDaCriacao(daForm(f));
  const avisoDe = (campo: string) => avisos.find((a) => a.campo === campo)?.mensagem;
  const avisosGerais = avisos.filter((a) => a.campo === 'atributos' || a.campo === 'pericias');
  const mudancas = contarMudancas(f, salvo);
  const erro = (campo: string) =>
    tentou || mexidos.has(campo.split('.')[0] ?? campo) || campo in servidorAinda
      ? erros[campo]
      : undefined;

  function mudar(m: Partial<FormDaFicha>) {
    setF((atual) => ({ ...atual, ...m }));
    setMexidos((s) => new Set([...s, ...Object.keys(m)]));
    setMexidosDepois((s) => new Set([...s, ...Object.keys(m)]));
  }

  function recalcular() {
    const { pvMax, pdMax } = maximosDeRecursos(f.atributos, {
      nivel: Number(f.nivel) || 1,
      ocupacao: f.ocupacao,
    });
    mudar({ pv: String(pvMax), pvMax: String(pvMax), pd: String(pdMax), pdMax: String(pdMax) });
  }

  function salvar() {
    setTentou(true);
    if (Object.keys(erros).length > 0) {
      focarPrimeiroErro();
      return;
    }
    aoSalvar(daForm(f));
  }

  const texto = (campo: 'nome' | 'origem' | CampoNumerico, rotulo: string, extra: object = {}) => (
    <Field label={rotulo} error={erro(campo)}>
      <Input
        value={f[campo]}
        onChange={(e) => {
          mudar({ [campo]: e.target.value });
        }}
        {...extra}
      />
    </Field>
  );
  const inteiro = (campo: CampoNumerico, rotulo: string, min = 0) =>
    texto(campo, rotulo, { type: 'number', inputMode: 'numeric', min });

  const totalDeErros = tentou ? Object.keys(erros).length : 0;

  return (
    <form
      className="col ficha-edicao"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="ficha-barra" role="region" aria-label="Edição da ficha">
        <div className="wrap row between wrapx">
          <span className="row" style={{ gap: 10 }}>
            <Icon name="edit" size="sm" />
            <b>{titulo}</b>
            <span className="small muted" aria-live="polite">
              {mudancas === 1 ? '1 mudança' : `${String(mudancas)} mudanças`}
              {avisos.length > 0 &&
                ` · ${avisos.length === 1 ? '1 aviso' : `${String(avisos.length)} avisos`}`}
              {totalDeErros > 0 &&
                ` · ${totalDeErros === 1 ? '1 erro' : `${String(totalDeErros)} erros`}`}
            </span>
          </span>
          <span className="row">
            <Button variant="ghost" onClick={aoCancelar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={salvando}
              icon={<Icon name="check" size="sm" />}
            >
              {rotuloDeSalvar}
            </Button>
          </span>
        </div>
      </div>

      <div className="wrap col ficha-corpo">
        {falha && <Banner tone="err">{falha}</Banner>}
        {totalDeErros > 0 && (
          <Banner tone="err">
            {totalDeErros === 1
              ? 'Corrija 1 campo para salvar.'
              : `Corrija ${String(totalDeErros)} campos para salvar.`}
          </Banner>
        )}

        <Card pad className="col">
          {contexto}
          <div className="g3">
            {texto('nome', 'Nome', { maxLength: 60, className: 'ficha-nome' })}
            <CampoOcupacao
              valor={f.ocupacao}
              erro={erro('ocupacao')}
              aoMudar={(ocupacao) => {
                mudar({ ocupacao });
              }}
            />
            <Field label="Perfil" error={erro('perfil')}>
              <Select
                value={f.perfil}
                onChange={(e) => {
                  mudar({ perfil: e.target.value as PerfilOp2 });
                }}
              >
                {PERFIS_OP2.map((p) => (
                  <option key={p} value={p}>
                    {NOME_DO_PERFIL[p]}
                  </option>
                ))}
              </Select>
            </Field>
            {inteiro('nivel', 'Nível', 1)}
            {inteiro('idade', 'Idade (opcional)')}
            {texto('origem', 'Origem', { maxLength: 60 })}
          </div>
        </Card>

        <div className={cx('ficha-grade', lateral !== undefined && 'com-lateral')}>
          <div className="col ficha-coluna">
            <Card pad className="col">
              <h2 className="h3">Atributos</h2>
              <div className="col">
                {ATRIBUTOS_OP2.map((a) => (
                  <SeletorDeDado
                    key={a.id}
                    rotulo={a.nome}
                    valor={f.atributos[a.id]}
                    aviso={avisoDe(`atributos.${a.id}`)}
                    mudar={(d) => {
                      mudar({ atributos: { ...f.atributos, [a.id]: d } });
                    }}
                  />
                ))}
              </div>
            </Card>

            <Card pad className="col">
              <div className="row between">
                <h2 className="h3">Vida e sanidade</h2>
                <Button size="sm" variant="ghost" onClick={recalcular}>
                  Recalcular pelos atributos
                </Button>
              </div>
              <div className="g2">
                {inteiro('pv', 'PV atual')}
                {inteiro('pvMax', 'PV máximo', 1)}
                {inteiro('pd', 'PD atual')}
                {inteiro('pdMax', 'PD máximo', 1)}
              </div>
            </Card>

            <Card pad className="col">
              {(permitirFisico || f.modoDados === 'fisico') && (
                <div className="field">
                  <span className="flabel">Dados</span>
                  <ModoDados
                    value={f.modoDados}
                    onChange={(modoDados) => {
                      mudar({ modoDados });
                    }}
                    permitirFisico={permitirFisico}
                  />
                  <span className={erro('modoDados') ? 'ferr' : 'help'}>
                    {erro('modoDados') ?? 'Quem rola nos testes: o app ou você, na mão.'}
                  </span>
                </div>
              )}
              <Field label="Anotações" error={erro('anotacoes')}>
                <Textarea
                  value={f.anotacoes}
                  maxLength={20000}
                  onChange={(e) => {
                    mudar({ anotacoes: e.target.value });
                  }}
                />
              </Field>
            </Card>
          </div>

          <Card pad className="col">
            <h2 className="h3">Perícias</h2>
            <div className="ficha-pericias">
              {PERICIAS_OP2.map((p) => (
                <SeletorDeDado
                  key={p.id}
                  rotulo={p.nome}
                  valor={f.pericias[p.id]}
                  aviso={avisoDe(`pericias.${p.id}`)}
                  mudar={(d) => {
                    mudar({ pericias: { ...f.pericias, [p.id]: d } });
                  }}
                />
              ))}
            </div>
          </Card>

          {lateral !== undefined && <div className="col ficha-coluna">{lateral}</div>}
        </div>

        {avisosGerais.map((a) => (
          <Banner key={a.mensagem} tone="warn">
            {a.mensagem} Dá para salvar assim; o mestre verá o aviso na ficha.
          </Banner>
        ))}
      </div>
    </form>
  );
}
