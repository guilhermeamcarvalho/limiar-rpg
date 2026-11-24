// Criação guiada de personagem: artboards "07 · Criar" e "Celular · 07" (RF-07, RF-09).
// Cinco passos: Perfil, Ocupação, Atributos, Perícias e Toques finais (com a revisão). O rascunho
// fica no navegador a cada mudança. Ao criar, o personagem é salvo, entra em uso no caso (se veio
// de um) e a tela final mostra o nome dele.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ATRIBUTOS_OP2,
  ID_OP2,
  OCUPACOES_OP2,
  PERFIS_INFO_OP2,
  PERICIAS_OP2,
  avisosDaCriacao,
  infoDoPerfil,
  ocupacaoConhecida,
  textoDoBonus,
  tituloDaPagina,
  type CampanhaDetalhe,
  type FichaOp2,
  type Personagem,
} from '@membrana/shared';
import { TopoDoCelular, useCelularProprio } from '../../app/celular.tsx';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import { linkDaCampanha } from '../../casos/formatos.ts';
import {
  NOME_DO_PERFIL,
  TOM_DO_PERFIL,
  linkDaFicha,
  linkDaFichaEmBranco,
} from '../../personagens/formatos.ts';
import {
  Banner,
  Button,
  Card,
  Die,
  Field,
  Icon,
  Input,
  ModoDados,
  ResourceBar,
  Tag,
  cx,
  useCarga,
  useEnvio,
} from '../../ui/index.ts';
import { Atributos, AvisosDaRegra } from './Atributos.tsx';
import { Pericias } from './Pericias.tsx';
import {
  OUTRA,
  PASSOS,
  ULTIMO,
  apagarRascunho,
  errosDoPasso,
  fichaDoRascunho,
  lerRascunho,
  passoDoCampo,
  salvarRascunho,
  textoDaOcupacao,
  validarRascunho,
  type Rascunho,
} from './rascunho.ts';
import './criar.css';

const faces = (dado: string) => Number(dado.slice(1));

interface PropsDoPasso {
  r: Rascunho;
  mudar: (m: Partial<Rascunho>) => void;
  erro: (campo: string) => string | undefined;
  /** O caso permite dados físicos (sem caso, permite). */
  permitirFisico: boolean;
}

/* ---------- 1 · Perfil ---------- */

function Perfil({ r, mudar, erro }: PropsDoPasso) {
  const mensagem = erro('perfil');
  return (
    <fieldset className="col criar-opcoes" aria-describedby={mensagem ? 'erro-perfil' : undefined}>
      <legend className="sr-only">Perfil</legend>
      <div className="g3">
        {PERFIS_INFO_OP2.map((p) => (
          <label key={p.id} className={cx('card criar-opcao', r.perfil === p.id && 'hl')}>
            <input
              type="radio"
              name="perfil"
              value={p.id}
              checked={r.perfil === p.id}
              aria-invalid={mensagem ? true : undefined}
              onChange={() => {
                mudar({ perfil: p.id });
              }}
            />
            <span className="col" style={{ gap: 6 }}>
              <Tag tone={TOM_DO_PERFIL[p.id]}>{p.nome}</Tag>
              <b className="h3">{p.habilidade}</b>
              <span className="small muted">{p.regra}</span>
            </span>
          </label>
        ))}
      </div>
      {mensagem && (
        <span id="erro-perfil" className="ferr">
          <Icon name="alert" size="sm" />
          {mensagem}
        </span>
      )}
    </fieldset>
  );
}

/* ---------- 2 · Ocupação ---------- */

function Ocupacao({ r, mudar, erro }: PropsDoPasso) {
  const mensagem = erro('ocupacao');
  return (
    <>
      <fieldset
        className="col criar-opcoes"
        aria-describedby={mensagem ? 'erro-ocupacao' : undefined}
      >
        <legend className="sr-only">Ocupação</legend>
        <div className="g3">
          {OCUPACOES_OP2.map((o) => (
            <label key={o.id} className={cx('card criar-opcao', r.ocupacao === o.id && 'hl')}>
              <input
                type="radio"
                name="ocupacao"
                value={o.id}
                checked={r.ocupacao === o.id}
                aria-invalid={mensagem ? true : undefined}
                onChange={() => {
                  // Trocar de ocupação muda o dado de partida: os passos voltam a zero.
                  mudar({ ocupacao: o.id, passosDasPericias: {} });
                }}
              />
              <span className="col" style={{ gap: 6 }}>
                <b className="h3">{o.nome}</b>
                <span className="small">
                  <b>{o.habilidade}.</b> {o.regra}
                </span>
                <span className="small red">{textoDoBonus(o)}</span>
              </span>
            </label>
          ))}
          <label className={cx('card criar-opcao', r.ocupacao === OUTRA && 'hl')}>
            <input
              type="radio"
              name="ocupacao"
              value={OUTRA}
              checked={r.ocupacao === OUTRA}
              aria-invalid={mensagem ? true : undefined}
              onChange={() => {
                mudar({ ocupacao: OUTRA, passosDasPericias: {} });
              }}
            />
            <span className="col" style={{ gap: 6 }}>
              <b className="h3">Outra</b>
              <span className="small muted">
                Escreva a sua. Sem habilidade nem bônus de perícia; combine com o mestre.
              </span>
            </span>
          </label>
        </div>
        {mensagem && (
          <span id="erro-ocupacao" className="ferr">
            <Icon name="alert" size="sm" />
            {mensagem}
          </span>
        )}
      </fieldset>
      {r.ocupacao === OUTRA && (
        <Field label="Qual ocupação?" error={erro('ocupacaoLivre')}>
          <Input
            value={r.ocupacaoLivre}
            maxLength={40}
            placeholder="Radialista"
            onChange={(e) => {
              mudar({ ocupacaoLivre: e.target.value });
            }}
          />
        </Field>
      )}
    </>
  );
}

/* ---------- 5 · Toques finais e revisão ---------- */

function ToquesFinais({ r, mudar, erro, permitirFisico }: PropsDoPasso) {
  return (
    <>
      <Field label="Nome" error={erro('nome')} help="Como a mesa vai chamar o personagem.">
        <Input
          value={r.nome}
          maxLength={60}
          placeholder="Bianca Moreira"
          autoComplete="off"
          onChange={(e) => {
            mudar({ nome: e.target.value });
          }}
        />
      </Field>
      <div className="g2">
        <Field label="Idade" error={erro('idade')} help="Opcional.">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={150}
            value={r.idade}
            onChange={(e) => {
              mudar({ idade: e.target.value });
            }}
          />
        </Field>
        <Field label="Origem" error={erro('origem')} help="Opcional. De onde o personagem vem.">
          <Input
            value={r.origem}
            maxLength={60}
            placeholder="Santa Ermida"
            onChange={(e) => {
              mudar({ origem: e.target.value });
            }}
          />
        </Field>
      </div>
      {permitirFisico && (
        <div className="field">
          <span className="flabel">Dados</span>
          <ModoDados
            value={r.modoDados}
            onChange={(modoDados) => {
              mudar({ modoDados });
            }}
          />
          <span className="help">
            Quem rola nos testes: o app ou você, na mão. Dá para trocar depois, na ficha.
          </span>
        </div>
      )}
      <div className="field">
        <span className="flabel">Foto e token</span>
        <div className="criar-envio">
          <Icon name="image" size="xl" className="muted" />
          <div className="grow">
            <b>Envie a foto e o token pela ficha, depois de criar</b>
            <div className="help">Até lá, o personagem usa as iniciais do nome.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Revisao({ ficha, irPara }: { ficha: FichaOp2; irPara: (p: number) => void }) {
  const ocupacao = ocupacaoConhecida(ficha.ocupacao);
  const linhas: [string, ReactNode, number][] = [
    ['Perfil', `${NOME_DO_PERFIL[ficha.perfil]} · ${infoDoPerfil(ficha.perfil).habilidade}`, 0],
    [
      'Ocupação',
      ocupacao
        ? `${ocupacao.nome} · ${ocupacao.habilidade} · ${textoDoBonus(ocupacao)}`
        : ficha.ocupacao || '—',
      1,
    ],
    [
      'Atributos',
      <span key="a" className="row wrapx" style={{ gap: 12 }}>
        {ATRIBUTOS_OP2.map((a) => (
          <span key={a.id} className="disp">
            {a.sigla} <Die type={ficha.atributos[a.id]} value={faces(ficha.atributos[a.id])} />
          </span>
        ))}
      </span>,
      2,
    ],
    [
      'Perícias',
      PERICIAS_OP2.filter((p) => ficha.pericias[p.id] !== 'd4')
        .map((p) => `${p.nome} ${ficha.pericias[p.id]}`)
        .join(' · ') || 'Todas em d4',
      3,
    ],
  ];
  return (
    <section className="col" aria-labelledby="criar-revisao">
      <h2 id="criar-revisao" className="h3">
        Revisão
      </h2>
      <dl className="criar-revisao">
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
      <AvisosDaRegra mensagens={avisosDaCriacao(ficha).map((a) => a.mensagem)} />
    </section>
  );
}

/* ---------- Ficha até agora ---------- */

function FichaAteAgora({
  ficha,
  nome,
  mudarNome,
}: {
  ficha: FichaOp2;
  nome: string;
  mudarNome: (nome: string) => void;
}) {
  const perfil = ficha.perfil;
  const ocupacao = ocupacaoConhecida(ficha.ocupacao);
  return (
    <aside className="col criar-lado" aria-label="Ficha até agora">
      <span className="lab">Ficha até agora</span>
      <Card className="col criar-previa">
        <div className="row">
          <span className="av xl n" aria-hidden="true">
            <Icon name="image" size="lg" />
          </span>
          <div className="col" style={{ gap: 6, minWidth: 0 }}>
            <Input
              className="criar-nome"
              value={nome}
              maxLength={60}
              placeholder="Nome"
              aria-label="Nome"
              onChange={(e) => {
                mudarNome(e.target.value);
              }}
            />
            <div className="row wrapx" style={{ gap: 6 }}>
              <Tag tone={TOM_DO_PERFIL[perfil]}>{NOME_DO_PERFIL[perfil]}</Tag>
              {ficha.ocupacao && <Tag>{ficha.ocupacao}</Tag>}
            </div>
          </div>
        </div>
        <div className="kv">
          <span className="muted">Habilidade · {NOME_DO_PERFIL[perfil]}</span>
          <span>{infoDoPerfil(perfil).habilidade}</span>
        </div>
        <div className="kv">
          <span className="muted">Ocupação</span>
          <span>{ocupacao ? textoDoBonus(ocupacao) : 'Sem bônus'}</span>
        </div>
        <ResourceBar kind="pv" value={ficha.pv} max={ficha.pvMax} />
        <ResourceBar kind="pd" value={ficha.pd} max={ficha.pdMax} />
        <span className="small muted">Foto e token podem ser enviados depois, na ficha.</span>
      </Card>
    </aside>
  );
}

/* ---------- Tela final ---------- */

function Pronto({ personagem, caso }: { personagem: Personagem; caso: CampanhaDetalhe | null }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
    document.title = tituloDaPagina(personagem.ficha.nome);
  }, [personagem.ficha.nome]);
  return (
    <div className="wrap criar">
      <Card pad className="col criar-pronto">
        <Icon name="check" size="xl" />
        <span className="eyebrow">Personagem criado</span>
        <h1 ref={titulo} className="h1" tabIndex={-1}>
          {personagem.ficha.nome}
        </h1>
        <p className="muted">
          {caso
            ? `Já está em uso em ${caso.nome}: é com ele que você entra na mesa.`
            : 'Ficou na sua lista, sem caso. Leve-o para um caso quando quiser.'}
        </p>
        <div className="row wrapx" style={{ justifyContent: 'center' }}>
          {caso && (
            <Link className="btn red" to={linkDaCampanha(caso.id, 'mesa')}>
              <Icon name="map" size="sm" />
              Jogar na mesa
            </Link>
          )}
          <Link className="btn" to="/personagens">
            Ver personagens
          </Link>
          <Link className="btn ghost" to={linkDaFicha(personagem.id)}>
            Abrir ficha
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Página ---------- */

const TITULOS = [
  {
    titulo: 'Que tipo de sobrevivente',
    texto: 'O perfil define o seu estilo de jogo e traz uma habilidade.',
  },
  {
    titulo: 'O que fazia antes disso',
    texto: 'A ocupação traz uma habilidade e sobe um passo em duas perícias.',
  },
  {
    titulo: 'Do que é feito',
    texto:
      'Cada atributo começa em d6. Você tem 2 passos para subir: d6 → d8 → d10. Pode baixar um atributo para d4 e ganhar mais um passo.',
  },
  {
    titulo: 'O que sabe fazer',
    texto:
      'Todas as perícias começam em d4, e as da ocupação em d6. Distribua 8 passos: seis d6 e um d8, por exemplo.',
  },
  {
    titulo: 'Os toques finais',
    texto: 'Nome, idade e origem. Confira a ficha e crie o personagem.',
  },
] as const;

export function Criar() {
  const { sessao } = useMe();
  const userId = sessao.estado === 'logado' ? sessao.usuario.id : '';
  const [params] = useSearchParams();
  const casoId = params.get('caso');
  const usoDoCaso = useCarga(casoId && `/api/campanhas/${casoId}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(casoId ?? '')}`, {
      signal,
    }).then((r) => r.campanha),
  );
  const caso = usoDoCaso.carga.estado === 'pronto' ? usoDoCaso.carga.dados : null;
  const casoFalhou = usoDoCaso.carga.estado === 'erro';
  const outroSistema = caso !== null && caso.sistema.tipo !== 'op2';
  const nivel = caso?.nivelInicial ?? 1;

  const [r, setR] = useState<Rascunho>(() => lerRascunho(userId, casoId));
  const [tentados, setTentados] = useState<ReadonlySet<number>>(() => new Set());
  const [doServidor, setDoServidor] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [criado, setCriado] = useState<Personagem | null>(null);

  useEffect(() => {
    document.title = tituloDaPagina('Novo sobrevivente');
  }, []);
  // Celular · 07: cabeçalho com o passo e, no lugar da barra do app, os botões fixos embaixo.
  useCelularProprio({ topo: !criado, barra: !criado });

  // Ao trocar de passo, o foco vai para o título (o leitor de tela anuncia o passo novo).
  const primeiraVez = useRef(true);
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    document.getElementById('criar-titulo')?.focus();
  }, [r.passo]);

  const permitirFisico = caso?.dadosFisicos !== false;
  // Caso só com dados virtuais: o que o rascunho guardou não vale.
  const ficha = {
    ...fichaDoRascunho(r, nivel),
    ...(!permitirFisico && { modoDados: 'virtual' as const }),
  };
  const erros = { ...validarRascunho(r, nivel), ...doServidor };
  const passo = r.passo;
  const errosAqui = errosDoPasso(erros, passo);
  const valido = (p: number) => errosDoPasso(erros, p).length === 0;
  const alcancavel = (p: number) => PASSOS.slice(0, p).every((_, i) => valido(i));

  function mudar(m: Partial<Rascunho>) {
    const novo = { ...r, ...m };
    setR(novo);
    salvarRascunho(userId, casoId, novo);
    if (Object.keys(doServidor).length > 0) setDoServidor({});
  }

  const irPara = (p: number) => {
    mudar({ passo: Math.min(Math.max(p, 0), ULTIMO) });
  };

  function avancar() {
    setTentados((t) => new Set(t).add(passo));
    if (errosAqui.length > 0) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.criar-corpo [aria-invalid="true"]')?.focus();
      });
      return;
    }
    irPara(passo + 1);
  }

  const erro = (campo: string) =>
    tentados.has(passoDoCampo(campo)) || campo in doServidor ? erros[campo] : undefined;

  const criacao = useEnvio(async () => {
    setFalha(null);
    const todos = PASSOS.map((_, i) => i);
    setTentados(new Set(todos));
    const primeiroInvalido = todos.find((i) => !valido(i));
    if (primeiroInvalido !== undefined) {
      if (primeiroInvalido !== ULTIMO) irPara(primeiroInvalido);
      return;
    }
    try {
      const { personagem } = await pedir<{ personagem: Personagem }>('/api/personagens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          caso ? { campanhaId: caso.id, usarNoCaso: true, ficha } : { sistemaId: ID_OP2, ficha },
        ),
      });
      apagarRascunho(userId, casoId);
      setCriado(personagem);
    } catch (e) {
      if (e instanceof ErroDaApi && e.campos) {
        // "ficha.nome" → "nome": o campo como a tela o conhece.
        const campos = Object.fromEntries(
          Object.entries(e.campos).map(([c, m]) => [c.replace(/^ficha\./, ''), m]),
        );
        setDoServidor(campos);
        const p = Math.min(...Object.keys(campos).map(passoDoCampo));
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

  if (criado) return <Pronto personagem={criado} caso={caso} />;

  const props: PropsDoPasso = { r, mudar, erro, permitirFisico };
  const titulo = TITULOS[passo] ?? TITULOS[0];
  // Veio de um caso que ainda não carregou (ou falhou): criar agora salvaria o personagem sem caso.
  const bloqueado = (casoId !== null && caso === null) || outroSistema;

  const passoAtual = PASSOS[passo];
  return (
    <>
      <TopoDoCelular
        inicio={
          passo === 0 ? (
            <Link className="btn icon ghost" to="/personagens" aria-label="Voltar para Personagens">
              <Icon name="back" />
            </Link>
          ) : (
            <Button
              variant="ghost"
              icon={<Icon name="back" />}
              aria-label={`Voltar para ${PASSOS[passo - 1]?.nome ?? 'o passo anterior'}`}
              onClick={() => {
                irPara(passo - 1);
              }}
            />
          )
        }
        titulo="Novo sobrevivente"
        subtitulo={`Passo ${String(passo + 1)} de ${String(PASSOS.length)}${passoAtual ? ` · ${passoAtual.nome}` : ''}`}
        fim={
          <Link className="btn ghost sm" to="/personagens">
            Fechar
          </Link>
        }
      />
      <div className="wrap col criar">
        <div className="row between wrapx criar-topo">
          <nav className="crumb" aria-label="Você está em">
            <Link to="/personagens">Personagens</Link>
            <Icon name="next" size="sm" />
            <b aria-current="page">Novo sobrevivente</b>
          </nav>
          <div className="row">
            <Link className="btn ghost sm" to={linkDaFichaEmBranco(casoId)}>
              Preferir ficha em branco
            </Link>
            <Link className="btn ghost sm criar-cancelar" to="/personagens">
              <Icon name="close" size="sm" />
              Cancelar
            </Link>
          </div>
        </div>

        <div className="col criar-progresso">
          <div className="row between wrapx">
            <span className="lab">
              {caso ? (
                <>
                  Para o caso <b className="criar-caso">{caso.nome}</b> · {caso.sistema.nome} ·
                  nível {nivel}
                </>
              ) : casoId ? (
                <>Carregando o caso…</>
              ) : (
                <>Sem caso · Ordem Paranormal II · nível {nivel}</>
              )}
            </span>
            <span className="lab">
              Passo {passo + 1} de {PASSOS.length}
            </span>
          </div>
          <div className="stepper" aria-hidden="true">
            {PASSOS.map((p, i) => (
              <i key={p.id} className={cx(i === passo && 'on', i < passo && valido(i) && 'done')} />
            ))}
          </div>
          <nav className="row wrapx criar-passos" aria-label="Passos">
            {PASSOS.map((p, i) => {
              const feito = i < passo && valido(i);
              const resumo =
                i === 0 && r.perfil
                  ? `${p.nome}: ${NOME_DO_PERFIL[r.perfil]}`
                  : i === 1 && textoDaOcupacao(r)
                    ? `${p.nome}: ${textoDaOcupacao(r)}`
                    : `${String(i + 1)} · ${p.nome}`;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cx('criar-passo', i === passo && 'on', feito && 'feito')}
                  aria-current={i === passo ? 'step' : undefined}
                  disabled={i !== passo && !alcancavel(i)}
                  onClick={() => {
                    irPara(i);
                  }}
                >
                  {feito && <Icon name="check" size="sm" />}
                  {feito ? resumo : `${String(i + 1)} · ${p.nome}`}
                </button>
              );
            })}
          </nav>
        </div>

        {casoFalhou && (
          <Banner tone="err">
            Não encontramos este caso. <Link to="/personagens">Voltar para Personagens</Link>
          </Banner>
        )}
        {outroSistema && (
          <Banner tone="warn">
            {caso.nome} usa {caso.sistema.nome}. A criação guiada é de Ordem Paranormal II; peça ao
            mestre a ficha do sistema do caso.
          </Banner>
        )}

        <div className="split criar-split">
          <section className="col criar-corpo" aria-labelledby="criar-titulo">
            <div className="col" style={{ gap: 6 }}>
              <h1 id="criar-titulo" className="h1" tabIndex={-1}>
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
                if (bloqueado) return;
                if (passo === ULTIMO) void criacao.enviar();
                else avancar();
              }}
            >
              {passo === 0 && <Perfil {...props} />}
              {passo === 1 && <Ocupacao {...props} />}
              {passo === 2 && (
                <Atributos
                  ficha={ficha}
                  mudar={(atributos) => {
                    mudar({ atributos });
                  }}
                />
              )}
              {passo === 3 && (
                <Pericias
                  ficha={ficha}
                  passos={r.passosDasPericias}
                  mudar={(passosDasPericias) => {
                    mudar({ passosDasPericias });
                  }}
                />
              )}
              {passo === ULTIMO && (
                <>
                  <ToquesFinais {...props} />
                  <Revisao ficha={ficha} irPara={irPara} />
                </>
              )}

              {falha && <Banner tone="err">{falha}</Banner>}

              <div className="row between criar-rodape">
                {passo === 0 ? (
                  <Link className="btn ghost" to="/personagens">
                    Cancelar
                  </Link>
                ) : (
                  <Button
                    icon={<Icon name="back" size="sm" />}
                    onClick={() => {
                      irPara(passo - 1);
                    }}
                  >
                    {PASSOS[passo - 1]?.nome}
                  </Button>
                )}
                {passo === ULTIMO ? (
                  <Button
                    type="submit"
                    variant="primary"
                    loading={criacao.enviando}
                    disabled={bloqueado}
                  >
                    <Icon name="check" size="sm" />
                    Criar personagem
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" disabled={bloqueado}>
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
            </form>
          </section>

          <FichaAteAgora
            ficha={ficha}
            nome={r.nome}
            mudarNome={(nome) => {
              mudar({ nome });
            }}
          />
        </div>
      </div>
    </>
  );
}
