// Painel de dados avulsos e testes da ficha na mesa (#69 e #70): rola dados simples ou secretos
// (`dice.roll`) e executa testes de perícia pela mesa (`test.resolve` no modo virtual e
// `test.report` com `ModalDadosFisicos` no modo físico), recarregando a ficha a cada
// `character.changed`.
import { useId, useState, type SyntheticEvent } from 'react';
import {
  DT_PADRAO,
  habilidadesDaFicha,
  IMPETO_MAXIMO,
  PERICIAS_OP2,
  temImpeto,
  type ComandoDaMesa,
  type Papel,
  type PedidoDeTeste,
  type PericiaOp2,
  type Personagem,
  type PersonagemNaMesa,
  type RelatoDeTesteOp2,
  type RespostaDoComando,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import {
  depoisDoTeste,
  habilidadeDisponivel,
  NADA_ARMADO,
  previaDoTeste,
  type Armados,
} from '../../pages/Ficha/extras.ts';
import {
  Async,
  Button,
  Checkbox,
  cx,
  Die,
  Field,
  Icon,
  Input,
  ModalDadosFisicos,
  ModoDados,
  Select,
  Skeleton,
  Switch,
  useCarga,
  useToast,
} from '../../ui/index.ts';

const DADOS_RAPIDOS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

interface SecaoDaFichaProps {
  personagemId: string;
  versao: number;
  dtPadrao: number;
  permitirFisico: boolean;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

function TestesDoPersonagem({
  personagemId,
  versao,
  dtPadrao,
  permitirFisico,
  enviar,
}: SecaoDaFichaProps) {
  const avisos = useToast();
  const idDt = useId();
  const url = `/api/personagens/${encodeURIComponent(personagemId)}`;
  const uso = useCarga(`${url}#${String(versao)}`, (signal) =>
    pedir<{ personagem: Personagem }>(url, { signal }).then((r) => r.personagem),
  );

  const [dt, setDt] = useState(dtPadrao);
  const [ajuda, setAjuda] = useState(false);
  const [armados, setArmados] = useState<Armados>(NADA_ARMADO);
  const [testando, setTestando] = useState(false);
  const [fisico, setFisico] = useState<PericiaOp2 | null>(null);
  const [erroFisico, setErroFisico] = useState<string | null>(null);

  async function trocarModo(personagem: Personagem, modoDados: 'virtual' | 'fisico') {
    const nova = { ...personagem.ficha, modoDados };
    uso.mudar((p) => ({ ...p, ficha: nova }));
    try {
      const { personagem: salvo } = await pedir<{ personagem: Personagem }>(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ficha: nova }),
      });
      uso.mudar(() => salvo);
    } catch {
      uso.recarregar();
      avisos.show({
        type: 'err',
        title: 'Não deu para mudar o modo dos dados',
        text: 'Tente de novo em instantes.',
      });
    }
  }

  async function rolarPericia(personagem: Personagem, periciaId: PericiaOp2) {
    if (testando) return;
    if (personagem.ficha.modoDados === 'fisico') {
      setErroFisico(null);
      setFisico(periciaId);
      return;
    }
    const { pedido } = previaDoTeste(personagem.ficha, periciaId, { dt, ajuda, armados });
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

  async function informarPericia(
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
      falha="A ficha não carregou."
      esqueleto={
        <div className="col">
          <Skeleton />
          <Skeleton width="75%" />
        </div>
      }
    >
      {(personagem) => {
        const { ficha } = personagem;
        const previaFisica =
          fisico === null ? null : previaDoTeste(ficha, fisico, { dt, ajuda, armados });
        const habilidades = habilidadesDaFicha(ficha);

        return (
          <div className="col dados-ficha">
            <div className="row between">
              <b className="small">{ficha.nome}</b>
              <span className="small muted">
                PV {ficha.pv}/{ficha.pvMax} · PD {ficha.pd}/{ficha.pdMax}
                {temImpeto(ficha) && ` · Ímpeto ${String(ficha.impeto)}/${String(IMPETO_MAXIMO)}`}
              </span>
            </div>

            {permitirFisico && (
              <ModoDados
                value={ficha.modoDados}
                onChange={(modo) => void trocarModo(personagem, modo)}
              />
            )}

            <div className="row wrapx dados-opcoes">
              <div className="row dados-dt">
                <label className="lab" htmlFor={idDt}>
                  DT
                </label>
                <Input
                  id={idDt}
                  type="number"
                  min={1}
                  max={99}
                  value={dt}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 99) setDt(n);
                  }}
                />
              </div>
              <Checkbox
                label="Ajuda (+1 passo)"
                checked={ajuda}
                onChange={(e) => {
                  setAjuda(e.target.checked);
                }}
              />
            </div>

            {(temImpeto(ficha) || habilidades.length > 0) && (
              <div className="row wrapx prontos-categorias">
                {temImpeto(ficha) && (
                  <button
                    type="button"
                    className={cx('chip', armados.impeto && 'on')}
                    aria-pressed={armados.impeto}
                    disabled={ficha.impeto < 1}
                    onClick={() => {
                      setArmados((a) => ({ ...a, impeto: !a.impeto }));
                    }}
                  >
                    Ímpeto +d4 ({ficha.impeto}/{IMPETO_MAXIMO})
                  </button>
                )}
                {habilidades.map((hab) => {
                  const ligada = armados.habilidades.includes(hab.id);
                  const disponivel = habilidadeDisponivel(ficha, hab);
                  return (
                    <button
                      key={hab.id}
                      type="button"
                      className={cx('chip', ligada && 'on')}
                      aria-pressed={ligada}
                      disabled={!disponivel}
                      onClick={() => {
                        setArmados((a) => ({
                          ...a,
                          habilidades: ligada
                            ? a.habilidades.filter((h) => h !== hab.id)
                            : [...a.habilidades, hab.id],
                        }));
                      }}
                    >
                      {hab.nome} +{hab.dado}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="dados-pericias" role="group" aria-label="Perícias para testar">
              {PERICIAS_OP2.map((p) => {
                const previa = previaDoTeste(ficha, p.id, { dt, ajuda, armados });
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="dados-pericia"
                    aria-label={previa.descricao}
                    disabled={testando}
                    onClick={() => void rolarPericia(personagem, p.id)}
                  >
                    <span className="small">{p.nome}</span>
                    <span className="row dados-pericia-dados">
                      <Die
                        type={previa.teste.atributo}
                        value={Number(previa.teste.atributo.slice(1))}
                        role="atributo"
                      />
                      <Die
                        type={previa.teste.pericia}
                        value={Number(previa.teste.pericia.slice(1))}
                        role="pericia"
                      />
                      {previa.armados.map((b, i) => (
                        <Die key={i} type={b.tipo} value={Number(b.tipo.slice(1))} role="bonus" />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {previaFisica && fisico && (
              <ModalDadosFisicos
                key={fisico}
                ficha={ficha}
                pedido={{ ...previaFisica.pedido, dt }}
                enviando={testando}
                erro={erroFisico}
                aoEnviar={(relato) => void informarPericia(personagem, previaFisica.pedido, relato)}
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

export interface DadosETestesProps {
  papel: Papel;
  meuPersonagemId: string | null;
  personagens: readonly PersonagemNaMesa[];
  versaoPersonagens: Readonly<Record<string, number>>;
  dtPadrao: number | undefined;
  permitirFisico: boolean;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

export function DadosETestes({
  papel,
  meuPersonagemId,
  personagens,
  versaoPersonagens,
  dtPadrao = DT_PADRAO,
  permitirFisico,
  enviar,
}: DadosETestesProps) {
  const [expressao, setExpressao] = useState('2d6');
  const [secreta, setSecreta] = useState(false);
  const [rolando, setRolando] = useState(false);
  const [erroLivre, setErroLivre] = useState<string | null>(null);
  const [escolhidoMestre, setEscolhidoMestre] = useState<string>(personagens[0]?.id ?? '');

  const personagemAtivo =
    papel === 'mestre'
      ? (personagens.find((p) => p.id === escolhidoMestre)?.id ?? personagens[0]?.id ?? null)
      : meuPersonagemId;

  async function rolarLivre(pedida: string) {
    if (rolando) return;
    setErroLivre(null);
    setRolando(true);
    try {
      const r = await enviar({
        type: 'dice.roll',
        expressao: pedida,
        ...(secreta && { secreta: true }),
      });
      if (!r.ok) setErroLivre(r.motivo);
    } finally {
      setRolando(false);
    }
  }

  function aoSubmeterLivre(e: SyntheticEvent) {
    e.preventDefault();
    void rolarLivre(expressao);
  }

  return (
    <div className="col dados-painel">
      <section className="col dados-bloco" aria-label="Dados avulsos">
        <span className="lab">Dados avulsos</span>
        <div className="row wrapx dados-rapidos">
          {DADOS_RAPIDOS.map((d) => (
            <Button key={d} size="sm" disabled={rolando} onClick={() => void rolarLivre(d)}>
              {d}
            </Button>
          ))}
        </div>

        <form className="row dados-form" onSubmit={aoSubmeterLivre} noValidate>
          <Field label="Expressão" error={erroLivre ?? undefined} className="grow">
            <Input
              value={expressao}
              maxLength={40}
              placeholder="2d6+1 ou d20"
              onChange={(e) => {
                setExpressao(e.target.value);
                if (erroLivre) setErroLivre(null);
              }}
            />
          </Field>
          <Button type="submit" icon={<Icon name="dice" size="sm" />} disabled={rolando}>
            Rolar
          </Button>
        </form>

        <Switch checked={secreta} onChange={setSecreta} label="Rolagem secreta" />
      </section>

      <hr className="hr" />

      <section className="col dados-bloco" aria-label="Testes de perícia">
        <span className="lab">Testes da ficha</span>
        {papel === 'mestre' && personagens.length > 1 && personagemAtivo && (
          <Select
            aria-label="Personagem para testar"
            value={personagemAtivo}
            onChange={(e) => {
              setEscolhidoMestre(e.target.value);
            }}
          >
            {personagens.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        )}

        {personagemAtivo ? (
          <TestesDoPersonagem
            key={personagemAtivo}
            personagemId={personagemAtivo}
            versao={versaoPersonagens[personagemAtivo] ?? 0}
            dtPadrao={dtPadrao}
            permitirFisico={permitirFisico && papel !== 'mestre'}
            enviar={enviar}
          />
        ) : (
          <p className="small muted">
            {papel === 'mestre'
              ? 'Nenhum personagem escolhido neste caso ainda.'
              : 'Escolha um personagem para este caso em Personagens para rolar perícias aqui.'}
          </p>
        )}
      </section>
    </div>
  );
}
