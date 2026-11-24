// Arquivo (artboards "Arquivo" e "Celular · 14"): a biblioteca de referência (RF-80). As seções
// vêm dos Markdown de client/src/conteudo/. A busca procura em todas as seções de uma vez, mostra
// quantos resultados achou e quantos há em cada seção; os filtros são as categorias da seção.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tituloDaPagina } from '@membrana/shared';
import { SECOES, TEXTO_DE_BUSCA, type Bloco, type Entrada } from '../../conteudo/index.ts';
import { combina, tomDoSelo } from '../../conteudo/markdown.ts';
import { cx, EmptyState, Icon, Input, Tag } from '../../ui/index.ts';
import { TesteAvulso } from './TesteAvulso.tsx';
import './arquivo.css';

const TODAS = '';

/** "Feixe **forte**" → texto com <b>. */
function Texto({ children }: { children: string }) {
  const partes = children.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {partes.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <>
      {blocos.map((b, i) =>
        b.tipo === 'p' ? (
          <p key={i}>
            <Texto>{b.texto}</Texto>
          </p>
        ) : b.tipo === 'lista' ? (
          <ul key={i}>
            {b.itens.map((item, j) => (
              <li key={j}>
                <Texto>{item}</Texto>
              </li>
            ))}
          </ul>
        ) : (
          <table key={i} className="arq-tabela">
            <thead>
              <tr>
                {b.cabecalho.map((c, j) => (
                  <th key={j} scope="col">
                    <Texto>{c}</Texto>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.linhas.map((linha, j) => (
                <tr key={j}>
                  {linha.map((c, k) => (
                    <td key={k}>
                      <Texto>{c}</Texto>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </>
  );
}

function Detalhe({ entrada, secao }: { entrada: Entrada; secao: string }) {
  return (
    <article className="paper arq-detalhe" aria-labelledby="arq-detalhe-titulo">
      <span className="lab">
        {secao}
        {entrada.categoria && ` · ${entrada.categoria}`}
      </span>
      <h2 id="arq-detalhe-titulo" className="h2">
        {entrada.titulo}
      </h2>
      <div className="doc arq-corpo">
        <Blocos blocos={entrada.blocos} />
      </div>
      {entrada.etiquetas.length > 0 && (
        <div className="row wrapx arq-etiquetas">
          {entrada.etiquetas.map((t) => (
            <Tag key={t} tone="ink">
              {t}
            </Tag>
          ))}
        </div>
      )}
    </article>
  );
}

const plural = (n: number, um: string, varios: string) => `${String(n)} ${n === 1 ? um : varios}`;

export function Arquivo() {
  const [busca, setBusca] = useState('');
  const [secaoId, setSecaoId] = useState(SECOES[0]?.id ?? '');
  const [categoria, setCategoria] = useState(TODAS);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const detalhe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = tituloDaPagina('Arquivo');
  }, []);

  const buscando = busca.trim() !== '';
  const achados = useMemo(
    () =>
      new Map(
        SECOES.map((s) => [
          s.id,
          s.entradas.filter((e) => combina(TEXTO_DE_BUSCA.get(e) ?? '', busca)),
        ]),
      ),
    [busca],
  );
  const total = [...achados.values()].reduce((soma, l) => soma + l.length, 0);

  // Buscando, a seção aberta sem resultado dá lugar à primeira que tem.
  const semNada = (id: string) => (achados.get(id)?.length ?? 0) === 0;
  const secao =
    (buscando && semNada(secaoId) ? SECOES.find((s) => !semNada(s.id)) : undefined) ??
    SECOES.find((s) => s.id === secaoId) ??
    SECOES[0];
  const naSecao = (secao && achados.get(secao.id)) ?? [];
  const categorias = [...new Set(naSecao.map((e) => e.categoria).filter(Boolean))];
  const filtro = categorias.includes(categoria) ? categoria : TODAS;
  const visiveis = filtro === TODAS ? naSecao : naSecao.filter((e) => e.categoria === filtro);
  const aberta = visiveis.find((e) => e.id === escolhida) ?? visiveis[0];

  function abrirSecao(id: string) {
    setSecaoId(id);
    setCategoria(TODAS);
    setEscolhida(null);
  }

  let corpo: ReactNode;
  if (buscando && total === 0) {
    corpo = (
      <EmptyState icon={<Icon name="search" />} title="Nada encontrado">
        Nenhuma entrada do Arquivo tem “{busca.trim()}”. Tente outra palavra.
      </EmptyState>
    );
  } else if (secao) {
    corpo = (
      <>
        {!buscando && secao.intro.length > 0 && (
          <div className="small muted arq-intro">
            <Blocos blocos={secao.intro} />
          </div>
        )}
        {categorias.length > 1 && (
          <div className="row wrapx arq-filtros" role="group" aria-label="Filtrar por categoria">
            {[TODAS, ...categorias].map((c) => (
              <button
                key={c || 'todas'}
                type="button"
                className={cx('chip', filtro === c && 'on')}
                aria-pressed={filtro === c}
                onClick={() => {
                  setCategoria(c);
                  setEscolhida(null);
                }}
              >
                {c || 'Todos'}
              </button>
            ))}
          </div>
        )}
        <ul className="card list arq-lista" aria-label={`Entradas de ${secao.titulo}`}>
          {visiveis.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={cx('li', 'arq-item', e === aberta && 'on')}
                aria-current={e === aberta ? 'true' : undefined}
                onClick={() => {
                  setEscolhida(e.id);
                  detalhe.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }}
              >
                <span className="grow">
                  <b>{e.titulo}</b>
                  <span className="small muted arq-resumo">
                    {[e.categoria, e.resumo].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {e.selo && (
                  <Tag {...(tomDoSelo(e.selo) && { tone: 'gold' as const })}>{e.selo}</Tag>
                )}
                <Icon name="next" size="sm" className="arq-seta" />
              </button>
            </li>
          ))}
        </ul>
        <div ref={detalhe}>{aberta && <Detalhe entrada={aberta} secao={secao.titulo} />}</div>
      </>
    );
  }

  return (
    <div className="wrap col arq">
      <section className="row between wrapx arq-cabeca">
        <div className="col arq-titulo">
          <span className="lab">Biblioteca de referência</span>
          <h1 className="h1">Arquivo</h1>
        </div>
        <div className="arq-busca">
          <label htmlFor="arq-busca" className="sr-only">
            Buscar no Arquivo
          </label>
          <Icon name="search" size="sm" className="arq-lupa" />
          <Input
            id="arq-busca"
            type="search"
            placeholder="Buscar regra, perícia, item…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setEscolhida(null);
            }}
          />
          <span className="small muted arq-total" aria-live="polite">
            {buscando ? plural(total, 'resultado', 'resultados') : ''}
          </span>
        </div>
      </section>

      <div className="split arq-split">
        <nav className="card list arq-secoes" aria-label="Seções do Arquivo">
          {SECOES.map((s) => {
            const n = achados.get(s.id)?.length ?? 0;
            const ativa = s === secao;
            return (
              <button
                key={s.id}
                type="button"
                className={cx('li', ativa && 'on')}
                aria-current={ativa ? 'true' : undefined}
                disabled={buscando && n === 0}
                onClick={() => {
                  abrirSecao(s.id);
                }}
              >
                <Icon name={s.icone} size="sm" />
                <span className="grow">{s.titulo}</span>
                {(ativa || buscando) && (
                  <span className="cnt" aria-label={plural(n, 'entrada', 'entradas')}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <section className="col arq-meio" aria-label={secao?.titulo ?? 'Arquivo'}>
          {corpo}
        </section>

        <aside className="col arq-lado">
          <TesteAvulso />
        </aside>
      </div>
    </div>
  );
}
