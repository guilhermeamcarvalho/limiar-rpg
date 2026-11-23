// Modal de dados físicos (artboards Mesa-Teste e Celular · 12, RF-84 a RF-87). Quem rola na mão
// conta o resultado de um de dois jeitos: "Informar os dados" (um campo por dado) ou "Só o
// resultado" (o veredito e, se o teste pedir, a soma, o maior e o menor). Se der falha crítica,
// vem o passo 2: o d8 da tabela e, em Acidente e Frustração, o d4.
//
// A prévia roda aqui a mesma regra que o servidor (registrarTesteInformado), então o veredito, os
// efeitos e os erros que a pessoa vê antes de enviar são os que vão valer. Cancelar não envia nada.
import { useId, useState } from 'react';
import {
  atributoDaPericia,
  dadosDoTeste,
  ErroDeRegra,
  faces,
  nomeDaPericia,
  nomeDoAtributo,
  NOME_DO_APP,
  pedeD4,
  prepararTeste,
  registrarTesteInformado,
  resolverTesteInformado,
  resolverTesteSoVeredito,
  TABELA_FALHA_CRITICA,
  type FalhaCriticaDoTeste,
  type FichaOp2,
  type PedidoDeTesteOp2,
  type RelatoDeTesteOp2,
  type TesteDaFicha,
  type Veredito,
} from '@membrana/shared';
import { Button } from './Button.tsx';
import { TabPanel, Tabs } from './Choice.tsx';
import { cx } from './cx.ts';
import { Banner, Note, Tag } from './Display.tsx';
import { Field, Input } from './Field.tsx';
import { Icon } from './Icon.tsx';
import { Modal } from './Overlay.tsx';
import { textoDoVeredito } from './ResultadoTeste.tsx';

export type JeitoDeInformar = 'dados' | 'veredito';

/** O app lembra o último jeito usado (RF-84). */
export const CHAVE_DO_JEITO = 'membrana.dadosFisicos.jeito';

function lerJeito(): JeitoDeInformar {
  try {
    return localStorage.getItem(CHAVE_DO_JEITO) === 'veredito' ? 'veredito' : 'dados';
  } catch {
    return 'dados';
  }
}

function gravarJeito(jeito: JeitoDeInformar) {
  try {
    localStorage.setItem(CHAVE_DO_JEITO, jeito);
  } catch {
    // Sem armazenamento: na próxima vez abre no padrão.
  }
}

/** Vazio é "não informado"; texto que não é número vira NaN, e a regra recusa. */
const numero = (texto: string) => (texto.trim() === '' ? undefined : Number(texto));

const OPCOES_DE_VEREDITO: { valor: Veredito; texto: string }[] = [
  { valor: 'sucesso', texto: 'Sucesso' },
  { valor: 'falha', texto: 'Falha' },
  { valor: 'critico', texto: 'Sucesso crítico' },
  { valor: 'falhaCritica', texto: 'Falha crítica' },
];

const COR_DO_VEREDITO: Record<Veredito, string> = {
  sucesso: 'green',
  critico: 'gold',
  falha: 'red',
  falhaCritica: 'red',
};

/** O que cada linha da tabela faz, curto, para caber no botão. */
const RESUMO_DO_D8: Partial<Record<number, string>> = {
  2: 'Físico −1 passo',
  3: 'Mente −1',
  4: 'Emoção −1',
  5: '−d4 PV',
  6: '−d4 PD',
  7: 'um item',
};

const ATRIBUTO_DO_D8: Partial<Record<number, string>> = { 2: 'Físico', 3: 'Mente', 4: 'Emoção' };

/** O efeito da falha crítica em destaque: "−3 PV" e "Davi fica com 7/12 PV." */
function efeitoEmDestaque(falha: FalhaCriticaDoTeste, depois: FichaOp2) {
  const nome = depois.nome.trim().split(/\s+/)[0] ?? depois.nome;
  if (falha.d4 !== undefined) {
    const pv = falha.d8 === 5;
    const [atual, maximo] = pv ? [depois.pv, depois.pvMax] : [depois.pd, depois.pdMax];
    const recurso = pv ? 'PV' : 'PD';
    return {
      grande: `−${String(falha.d4)} ${recurso}`,
      texto: `${nome} fica com ${String(atual)}/${String(maximo)} ${recurso}.`,
    };
  }
  const atributo = ATRIBUTO_DO_D8[falha.d8];
  return { grande: atributo ? `${atributo} −1` : falha.nome, texto: falha.descricao };
}

export interface ModalDadosFisicosProps {
  /** A ficha como está agora: a prévia aplica o teste nela, sem gravar. */
  ficha: FichaOp2;
  /** O teste pedido, com a DT, a Ajuda, o Ímpeto e as habilidades ligadas. */
  pedido: PedidoDeTesteOp2 & { dt: number };
  enviando?: boolean;
  /** O servidor recusou o envio: o modal fica aberto com o motivo. */
  erro?: string | null;
  aoEnviar: (relato: RelatoDeTesteOp2) => void;
  /** Fechar ou cancelar: nada é enviado. */
  aoCancelar: () => void;
}

export function ModalDadosFisicos({
  ficha,
  pedido,
  enviando = false,
  erro = null,
  aoEnviar,
  aoCancelar,
}: ModalDadosFisicosProps) {
  const idBase = useId();

  // O teste montado como o servidor vai montar: com os d4 do Ímpeto e da Gambiarra.
  let preparado: ReturnType<typeof prepararTeste> | null = null;
  let erroDoPedido: string | null = null;
  try {
    preparado = prepararTeste(ficha, pedido);
  } catch (e) {
    if (!(e instanceof ErroDeRegra)) throw e;
    erroDoPedido = e.message;
  }
  const atributo = atributoDaPericia(pedido.periciaId);
  const dados = preparado
    ? dadosDoTeste(preparado.teste).map((d) => ({
        ...d,
        rotulo:
          d.papel === 'atributo'
            ? nomeDoAtributo(atributo)
            : d.papel === 'pericia'
              ? nomeDaPericia(pedido.periciaId)
              : (d.origem ?? 'Bônus'),
      }))
    : [];

  const [jeito, setJeito] = useState<JeitoDeInformar>(lerJeito);
  const [valores, setValores] = useState<string[]>(() => dados.map(() => ''));
  const [veredito, setVeredito] = useState<Veredito | null>(null);
  const [numeros, setNumeros] = useState({ soma: '', maior: '', menor: '' });
  const [d8, setD8] = useState<number | null>(null);
  const [d4, setD4] = useState('');

  /* ---------- Informar os dados ---------- */

  const errosDosValores = valores.map((texto, i) => {
    const valor = numero(texto);
    const dado = dados[i];
    if (valor === undefined || !dado) return null;
    const maximo = faces(dado.tipo);
    return Number.isInteger(valor) && valor >= 1 && valor <= maximo
      ? null
      : `O ${dado.tipo} vai de 1 a ${String(maximo)}. Confira o dado de ${dado.rotulo}.`;
  });
  const erroDosValores = errosDosValores.find((e) => e !== null) ?? null;
  const valoresProntos =
    valores.length > 0 && valores.every((t) => numero(t) !== undefined) && !erroDosValores;
  const resultadoDosDados =
    preparado && valoresProntos
      ? resolverTesteInformado(preparado.teste, valores.map(Number))
      : null;

  /* ---------- Só o resultado ---------- */

  const informado = {
    soma: numero(numeros.soma),
    maior: numero(numeros.maior),
    menor: numero(numeros.menor),
  };
  let erroDoVeredito: ErroDeRegra | null = null;
  if (preparado && veredito) {
    try {
      resolverTesteSoVeredito(preparado.teste, { veredito, ...informado });
    } catch (e) {
      if (!(e instanceof ErroDeRegra)) throw e;
      erroDoVeredito = e;
    }
  }
  const erroNoNumero = (campo: 'soma' | 'maior' | 'menor') =>
    erroDoVeredito?.campo === campo ? erroDoVeredito.message : undefined;

  /* ---------- O relato e a prévia ---------- */

  const vereditoAtual: Veredito | null =
    jeito === 'dados'
      ? (resultadoDosDados?.veredito ?? null)
      : veredito && !erroDoVeredito
        ? veredito
        : null;
  const pedeFalha = vereditoAtual === 'falhaCritica';

  let relato: RelatoDeTesteOp2 | null = null;
  if (vereditoAtual) {
    const resultado: RelatoDeTesteOp2['resultado'] =
      jeito === 'dados'
        ? { modo: 'dados', valores: valores.map(Number) }
        : // Os números vazios ficam `undefined` e somem no JSON; na falha crítica nem vão.
          { modo: 'veredito', veredito: vereditoAtual, ...(pedeFalha ? {} : informado) };
    if (!pedeFalha) relato = { resultado };
    else if (d8 !== null) {
      relato = {
        resultado,
        falhaCritica: pedeD4(d8) ? { d8, d4: numero(d4) } : { d8 },
      };
    }
  }

  let previa: TesteDaFicha | null = null;
  let erroDaPrevia: ErroDeRegra | null = null;
  if (relato) {
    try {
      previa = registrarTesteInformado(ficha, pedido, relato);
    } catch (e) {
      if (!(e instanceof ErroDeRegra)) throw e;
      erroDaPrevia = e;
    }
  }
  // "Este efeito pede o d4" só aparece depois que a pessoa digita algo errado.
  const erroDoD4 =
    erroDaPrevia?.campo === 'falhaCritica.d4' && d4.trim() !== '' ? erroDaPrevia.message : null;
  const destaque = previa?.falhaCritica
    ? efeitoEmDestaque(previa.falhaCritica, previa.ficha)
    : null;

  const trocarJeito = (novo: JeitoDeInformar) => {
    setJeito(novo);
    gravarJeito(novo);
  };

  const titulo = (
    <span className="row fisico-titulo">
      <Tag tone="red">Dados físicos</Tag>
      {nomeDaPericia(pedido.periciaId)} · {nomeDoAtributo(atributo)}
    </span>
  );

  return (
    <Modal
      open
      onClose={() => {
        if (!enviando) aoCancelar();
      }}
      title={titulo}
      closeLabel="Fechar sem enviar"
      footer={
        <>
          <Button variant="ghost" disabled={enviando} onClick={aoCancelar}>
            Cancelar · nada é enviado
          </Button>
          <Button
            variant="primary"
            loading={enviando}
            disabled={!previa}
            onClick={() => {
              if (relato && previa) aoEnviar(relato);
            }}
          >
            Enviar resultado
          </Button>
        </>
      }
    >
      {erroDoPedido || !preparado ? (
        <Banner tone="err">{erroDoPedido}</Banner>
      ) : (
        <>
          <p className="fisico-intro">
            {jeito === 'dados'
              ? `Role na mesa e digite o valor de cada dado. ${NOME_DO_APP} soma os três maiores e aplica a regra.`
              : 'Role na mesa e diga como foi. Os números só valem se o teste pedir.'}
          </p>
          <div className="row wrapx fisico-etiquetas">
            <Tag>
              {nomeDaPericia(pedido.periciaId)} · {nomeDoAtributo(atributo)}
            </Tag>
            <Tag>DT {pedido.dt}</Tag>
            {dados
              .filter((d) => d.papel === 'bonus')
              .map((d, i) => (
                <Tag key={i} tone="gold">
                  {d.rotulo} +{d.tipo} incluído
                </Tag>
              ))}
          </div>

          <Tabs
            idBase={idBase}
            label="Como informar"
            value={jeito}
            onChange={trocarJeito}
            items={[
              { id: 'dados', label: 'Informar os dados' },
              { id: 'veredito', label: 'Só o resultado' },
            ]}
          />

          {jeito === 'dados' ? (
            <TabPanel idBase={idBase} id="dados" className="col fisico-painel">
              <div className="fisico-dados">
                {dados.map((d, i) => {
                  const invalido = errosDosValores[i] !== null;
                  return (
                    <div key={i} className="fisico-dado">
                      <span
                        className={cx(
                          'dz lg',
                          d.tipo,
                          d.papel === 'pericia' && 'w',
                          d.papel === 'bonus' && 'y',
                        )}
                        aria-hidden="true"
                      >
                        {d.tipo}
                      </span>
                      <span className="lab">{d.rotulo}</span>
                      <Input
                        className={cx('fisico-valor', invalido && 'erro')}
                        inputMode="numeric"
                        maxLength={2}
                        autoComplete="off"
                        aria-label={`Valor do ${d.tipo} de ${d.rotulo}`}
                        aria-invalid={invalido || undefined}
                        aria-describedby={invalido ? `${idBase}-erro-valor` : undefined}
                        value={valores[i] ?? ''}
                        onChange={(e) => {
                          const novo = [...valores];
                          novo[i] = e.target.value;
                          setValores(novo);
                          setD8(null);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {erroDosValores && (
                <span id={`${idBase}-erro-valor`} className="ferr" role="alert">
                  <Icon name="alert" size="sm" />
                  {erroDosValores}
                </span>
              )}
              <div
                className={cx(
                  'fisico-soma',
                  resultadoDosDados && COR_DO_VEREDITO[resultadoDosDados.veredito],
                )}
                role="status"
              >
                {resultadoDosDados ? (
                  <>
                    <span>
                      {resultadoDosDados.dados
                        .filter((d) => !d.descartado)
                        .map((d) => d.valor)
                        .join(' + ')}
                    </span>
                    <b className={cx('verdict', COR_DO_VEREDITO[resultadoDosDados.veredito])}>
                      {resultadoDosDados.total} · {textoDoVeredito(resultadoDosDados.veredito)}
                    </b>
                  </>
                ) : (
                  <>
                    <span>Soma dos 3 maiores</span>
                    <b>Aguardando os valores</b>
                  </>
                )}
              </div>
              <Banner>
                Dois dados iguais a 6 ou mais dão sucesso crítico. Todos em 1 abrem a falha crítica
                e pedem o d8.
              </Banner>
            </TabPanel>
          ) : (
            <TabPanel idBase={idBase} id="veredito" className="col fisico-painel">
              <div className="seg fisico-vereditos" role="group" aria-label="Como foi o teste">
                {OPCOES_DE_VEREDITO.map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    className={cx(veredito === o.valor && 'on')}
                    aria-pressed={veredito === o.valor}
                    onClick={() => {
                      setVeredito(o.valor);
                      setD8(null);
                    }}
                  >
                    {o.texto}
                  </button>
                ))}
              </div>
              {veredito !== 'falhaCritica' && (
                <>
                  <p className="small muted">
                    Só preencha os números se o teste depender deles (investigar, hack social,
                    arrombar, alcançar). Sem a soma, o sucesso conta como a DT exata.
                  </p>
                  <div className="g3">
                    {(
                      [
                        ['soma', 'Soma dos 3 maiores'],
                        ['maior', 'Maior dado'],
                        ['menor', 'Menor dado'],
                      ] as const
                    ).map(([campo, rotulo]) => (
                      <Field
                        key={campo}
                        label={rotulo}
                        error={erroNoNumero(campo)}
                        help="Opcional."
                      >
                        <Input
                          inputMode="numeric"
                          maxLength={2}
                          autoComplete="off"
                          value={numeros[campo]}
                          onChange={(e) => {
                            setNumeros({ ...numeros, [campo]: e.target.value });
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                </>
              )}
            </TabPanel>
          )}

          {pedeFalha && (
            <section className="col fisico-falha" aria-labelledby={`${idBase}-falha`}>
              <div className="row between">
                <h3 id={`${idBase}-falha`} className="lab">
                  Falha crítica
                </h3>
                <Tag>Passo 2</Tag>
              </div>
              <p className="small muted">
                Role o d8 e toque no resultado. Acidente e Frustração pedem também o d4.
              </p>
              <div className="fisico-tabela" role="group" aria-label="Resultado do d8">
                {TABELA_FALHA_CRITICA.map((linha) => {
                  const resumo = RESUMO_DO_D8[linha.d8];
                  return (
                    <button
                      key={linha.d8}
                      type="button"
                      className={cx('fisico-efeito', d8 === linha.d8 && 'on')}
                      aria-pressed={d8 === linha.d8}
                      aria-label={`${String(linha.d8)}: ${linha.nome}${resumo ? ` · ${resumo}` : ''}`}
                      onClick={() => {
                        setD8(linha.d8);
                      }}
                    >
                      <span className="dz d8 fisico-numero" aria-hidden="true">
                        {linha.d8}
                      </span>
                      <span>
                        {linha.nome}
                        {resumo && ` · ${resumo}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {d8 !== null && pedeD4(d8) && (
                <div className="col fisico-d4">
                  <div className="row">
                    <span className="dz lg d4" aria-hidden="true">
                      d4
                    </span>
                    <label className="grow" htmlFor={`${idBase}-d4`}>
                      <b>{TABELA_FALHA_CRITICA[d8 - 1]?.nome}:</b> quanto deu o d4?
                    </label>
                    <Input
                      id={`${idBase}-d4`}
                      className="fisico-valor"
                      inputMode="numeric"
                      maxLength={1}
                      autoComplete="off"
                      aria-invalid={erroDoD4 ? true : undefined}
                      value={d4}
                      onChange={(e) => {
                        setD4(e.target.value);
                      }}
                    />
                  </div>
                  {erroDoD4 && (
                    <span className="ferr" role="alert">
                      <Icon name="alert" size="sm" />
                      {erroDoD4}
                    </span>
                  )}
                </div>
              )}
              {destaque && (
                <div className="row fisico-destaque" role="status">
                  <span className="fisico-grande">{destaque.grande}</span>
                  <p>{destaque.texto} Vai para o registro com a origem “dados físicos”.</p>
                </div>
              )}
            </section>
          )}

          {previa && previa.efeitos.length > 0 && !destaque && (
            <Note>Na ficha: {previa.efeitos.join(' ')}</Note>
          )}
          {erro && <Banner tone="err">{erro}</Banner>}
        </>
      )}
    </Modal>
  );
}
