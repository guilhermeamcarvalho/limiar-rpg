// Editar caso: o mestre muda, a qualquer momento, o que definiu ao abrir o caso (nome, gancho,
// tom, formato, regras da mesa e agenda). Usa o PATCH /api/campanhas/:id, que só aceita o mestre.
// O sistema de jogo fica de fora: trocar depois quebraria as fichas já criadas.
import { useState } from 'react';
import {
  DIAS_DA_SEMANA,
  FORMATOS,
  FREQUENCIAS,
  MAX_GANCHO,
  MAX_NOME_DO_CASO,
  NIVEL_MAXIMO,
  TONS,
  esquemaEdicaoDeCampanha,
  proximaSessaoDa,
  type CampanhaDetalhe,
  type Formato,
  type Frequencia,
  type Tom,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import {
  Banner,
  Button,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  useEnvio,
  useToast,
  type UsoDaCarga,
} from '../ui/index.ts';

/** O formulário guarda números como texto, do jeito que a pessoa digita. */
interface Formulario {
  nome: string;
  gancho: string;
  tom: Tom;
  formato: Formato;
  nivelInicial: string;
  dtPadrao: string;
  rodadas: boolean;
  dadosFisicos: boolean;
  fichasVisiveis: boolean;
  temAgenda: boolean;
  diaDaSemana: string;
  horario: string;
  frequencia: Frequencia;
}

function doCaso(caso: CampanhaDetalhe): Formulario {
  return {
    nome: caso.nome,
    gancho: caso.gancho ?? '',
    tom: caso.tom,
    formato: caso.formato,
    nivelInicial: String(caso.nivelInicial),
    dtPadrao: String(caso.dtPadrao),
    rodadas: caso.rodadas,
    dadosFisicos: caso.dadosFisicos,
    fichasVisiveis: caso.fichasVisiveis,
    temAgenda: caso.agenda !== null,
    diaDaSemana: String(caso.agenda?.diaDaSemana ?? 5),
    horario: caso.agenda?.horario ?? '21:00',
    frequencia: caso.agenda?.frequencia ?? 'semanal',
  };
}

const inteiro = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto));

/**
 * O pedido de edição. A agenda (e a próxima sessão calculada a partir dela) só vai quando mudou:
 * assim, salvar outra coisa não mexe numa próxima sessão que o mestre marcou à parte.
 */
export function montarEdicao(f: Formulario, caso: CampanhaDetalhe, agora: Date) {
  const agenda = f.temAgenda
    ? { diaDaSemana: inteiro(f.diaDaSemana), horario: f.horario, frequencia: f.frequencia }
    : null;
  const agendaMudou = JSON.stringify(agenda) !== JSON.stringify(caso.agenda);
  return {
    nome: f.nome,
    gancho: f.gancho,
    tom: f.tom,
    formato: f.formato,
    nivelInicial: inteiro(f.nivelInicial),
    dtPadrao: inteiro(f.dtPadrao),
    rodadas: f.rodadas,
    dadosFisicos: f.dadosFisicos,
    fichasVisiveis: f.fichasVisiveis,
    ...(agendaMudou && {
      agenda,
      proximaSessao:
        agenda && /^([01]\d|2[0-3]):[0-5]\d$/.test(agenda.horario)
          ? proximaSessaoDa(agenda, agora).toISOString()
          : null,
    }),
  };
}

/** Erros por campo ("agenda.horario" → mensagem), com as mesmas regras do servidor. */
function validar(pedido: ReturnType<typeof montarEdicao>): Record<string, string> {
  const r = esquemaEdicaoDeCampanha.safeParse(pedido);
  if (r.success) return {};
  const erros: Record<string, string> = {};
  for (const problema of r.error.issues) {
    const campo = problema.path.join('.');
    erros[campo] ??= problema.message;
  }
  return erros;
}

export function EditarCaso({
  uso,
  caso,
}: {
  uso: UsoDaCarga<CampanhaDetalhe>;
  caso: CampanhaDetalhe;
}) {
  const avisos = useToast();
  const [aberta, setAberta] = useState(false);
  const [f, setF] = useState<Formulario>(() => doCaso(caso));
  const [tentou, setTentou] = useState(false);
  const [doServidor, setDoServidor] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);

  const pedido = montarEdicao(f, caso, new Date());
  const erros = { ...(tentou ? validar(pedido) : {}), ...doServidor };
  const mudar = (m: Partial<Formulario>) => {
    setF((atual) => ({ ...atual, ...m }));
    setDoServidor({});
  };

  function abrir() {
    setF(doCaso(caso));
    setTentou(false);
    setDoServidor({});
    setFalha(null);
    setAberta(true);
  }

  const salvar = useEnvio(async () => {
    setTentou(true);
    setFalha(null);
    if (Object.keys(validar(pedido)).length > 0) return;
    try {
      const r = await pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${caso.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      uso.mudar(() => r.campanha);
      setAberta(false);
      avisos.show({ type: 'ok', title: 'Caso atualizado', text: r.campanha.nome });
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.campos) setDoServidor(erro.campos);
      setFalha(
        erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Suas mudanças continuam aqui.',
      );
    }
  });

  return (
    <>
      <Button icon={<Icon name="edit" size="sm" />} onClick={abrir}>
        Editar caso
      </Button>
      <Modal
        open={aberta}
        onClose={() => {
          setAberta(false);
        }}
        title="Editar caso"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setAberta(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-editar-caso"
              variant="primary"
              loading={salvar.enviando}
            >
              Salvar
            </Button>
          </>
        }
      >
        <form
          id="form-editar-caso"
          className="col editar-caso"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar.enviar();
          }}
          noValidate
        >
          {falha && <Banner tone="err">{falha}</Banner>}

          <Field
            label="Nome do caso"
            error={erros['nome']}
            help={`${String(f.nome.length)} de ${String(MAX_NOME_DO_CASO)} caracteres`}
          >
            <Input
              value={f.nome}
              maxLength={MAX_NOME_DO_CASO}
              onChange={(e) => {
                mudar({ nome: e.target.value });
              }}
            />
          </Field>

          <Field
            label="Gancho · o que os jogadores sabem no início"
            error={erros['gancho']}
            help={`Aparece no convite e no topo do dossiê. ${String(f.gancho.length)} de ${String(MAX_GANCHO)} caracteres.`}
          >
            <Textarea
              className="type"
              value={f.gancho}
              maxLength={MAX_GANCHO}
              onChange={(e) => {
                mudar({ gancho: e.target.value });
              }}
            />
          </Field>

          <div className="g2">
            <Field label="Tom" error={erros['tom']}>
              <Select
                value={f.tom}
                onChange={(e) => {
                  mudar({ tom: e.target.value as Tom });
                }}
              >
                {Object.entries(TONS).map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato" error={erros['formato']}>
              <Select
                value={f.formato}
                onChange={(e) => {
                  mudar({ formato: e.target.value as Formato });
                }}
              >
                {Object.entries(FORMATOS).map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Nível inicial"
              error={erros['nivelInicial']}
              help="Vale para os personagens criados daqui em diante."
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={NIVEL_MAXIMO}
                value={f.nivelInicial}
                onChange={(e) => {
                  mudar({ nivelInicial: e.target.value });
                }}
              />
            </Field>
            <Field label="DT padrão" error={erros['dtPadrao']} help="A dificuldade normal: 7.">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                value={f.dtPadrao}
                onChange={(e) => {
                  mudar({ dtPadrao: e.target.value });
                }}
              />
            </Field>
          </div>

          <fieldset className="col editar-caso-grupo">
            <legend className="h3">Regras da mesa</legend>
            <Switch
              checked={f.rodadas}
              onChange={(rodadas) => {
                mudar({ rodadas });
              }}
              label="Uma ação por rodada"
            />
            <Switch
              checked={f.dadosFisicos}
              onChange={(dadosFisicos) => {
                mudar({ dadosFisicos });
              }}
              label="Jogadores podem rolar dados físicos"
            />
            <Switch
              checked={f.fichasVisiveis}
              onChange={(fichasVisiveis) => {
                mudar({ fichasVisiveis });
              }}
              label="Jogadores veem as fichas uns dos outros"
            />
          </fieldset>

          <fieldset className="col editar-caso-grupo">
            <legend className="h3">Agenda</legend>
            <Switch
              checked={f.temAgenda}
              onChange={(temAgenda) => {
                mudar({ temAgenda });
              }}
              label="A mesa tem dia fixo"
            />
            {f.temAgenda && (
              <div className="g3">
                <Field label="Dia" error={erros['agenda.diaDaSemana']}>
                  <Select
                    value={f.diaDaSemana}
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
                <Field label="Horário" error={erros['agenda.horario']}>
                  <Input
                    type="time"
                    value={f.horario}
                    onChange={(e) => {
                      mudar({ horario: e.target.value });
                    }}
                  />
                </Field>
                <Field label="Frequência" error={erros['agenda.frequencia']}>
                  <Select
                    value={f.frequencia}
                    onChange={(e) => {
                      mudar({ frequencia: e.target.value as Frequencia });
                    }}
                  >
                    {Object.entries(FREQUENCIAS).map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
