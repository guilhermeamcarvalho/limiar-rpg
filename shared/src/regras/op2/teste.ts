// O teste de Ordem Paranormal II. É a única implementação: a ficha usa para a prévia e o servidor
// para o resultado oficial, então os dois nunca discordam. Referência: docs/regras-do-jogo.md,
// "Como funciona um teste".
//
// Rola o dado do atributo, o da perícia e até dois extras (Ímpeto, habilidades). Com 4 dados, só
// os 3 maiores contam. Sucesso crítico: dois dados iguais, de valor 6 ou mais, entre os que
// contam. Falha crítica: todos os dados em 1.
import { ErroDeRegra, faces, rolar, type Dado, type Rng } from '../dados.ts';
import type { PericiaOp2 } from './pericias.ts';

/** No máximo 4 dados: atributo, perícia e dois extras. */
export const MAX_DADOS_NO_TESTE = 4;
const CONTAM = 3;

export type PapelDoDado = 'atributo' | 'pericia' | 'bonus';
export type Veredito = 'sucesso' | 'falha' | 'critico' | 'falhaCritica';

/** Dado a mais no teste, como o d4 do Ímpeto ou da Gambiarra. */
export interface ExtraDeTeste {
  tipo: Dado;
  /** Quem deu o dado: "Ímpeto", "Gambiarra". */
  origem: string;
}

export interface TesteOp2 {
  atributo: Dado;
  pericia: Dado;
  extras: ExtraDeTeste[];
  dt: number;
  /** A perícia testada: as habilidades conferem se valem para ela. */
  periciaId?: PericiaOp2;
}

export interface DadoRolado {
  tipo: Dado;
  valor: number;
  papel: PapelDoDado;
  /** Só nos extras: de onde veio. */
  origem?: string;
  /** Não entrou na soma (o menor, quando há 4 dados). */
  descartado: boolean;
}

export interface ResultadoDeTeste {
  dados: DadoRolado[];
  total: number;
  dt: number;
  /** Rolagem alta: o maior dado que contou. Usada por desafios e dano. */
  ra: number;
  /** Rolagem baixa: o menor dado que contou. */
  rb: number;
  veredito: Veredito;
  /** Os valores vieram do jogador (dados físicos), não do sorteio. */
  informado: boolean;
  /**
   * Dados físicos, "Só o resultado": o jogador disse só o veredito e `dados` vem vazio. Cada
   * campo diz se aquele número foi informado. Sem a soma, o total é a DT no sucesso e DT − 1 na
   * falha (RF-85); sem o maior ou o menor, RA e RB ficam em 0.
   */
  soVeredito?: { soma: boolean; maior: boolean; menor: boolean };
}

type DadoDoTeste = Omit<DadoRolado, 'valor' | 'descartado'>;

/** Os dados do teste, na ordem: atributo, perícia e extras. É a ordem dos `valores` informados. */
export function dadosDoTeste(teste: TesteOp2): DadoDoTeste[] {
  if (teste.extras.length > MAX_DADOS_NO_TESTE - 2) {
    throw new ErroDeRegra(
      'extras',
      `No máximo ${String(MAX_DADOS_NO_TESTE)} dados num teste: atributo, perícia e dois bônus.`,
    );
  }
  if (!Number.isInteger(teste.dt) || teste.dt < 1 || teste.dt > 99) {
    throw new ErroDeRegra('dt', 'A DT precisa ser um número inteiro de 1 a 99.');
  }
  return [
    { tipo: teste.atributo, papel: 'atributo' },
    { tipo: teste.pericia, papel: 'pericia' },
    ...teste.extras.map((e) => ({ tipo: e.tipo, papel: 'bonus' as const, origem: e.origem })),
  ];
}

/** Soma os 3 maiores, marca o descartado e decide o veredito. */
function avaliar(
  dados: (DadoDoTeste & { valor: number })[],
  dt: number,
  informado: boolean,
): ResultadoDeTeste {
  // Com 4 dados, sai o menor; no empate, o que veio por último (um bônus antes do atributo).
  let descartado = -1;
  if (dados.length > CONTAM) {
    descartado = dados.reduce(
      (menor, d, i) => (d.valor <= (dados[menor] as { valor: number }).valor ? i : menor),
      0,
    );
  }
  const rolados: DadoRolado[] = dados.map((d, i) => ({ ...d, descartado: i === descartado }));
  const contam = rolados.filter((d) => !d.descartado).map((d) => d.valor);
  const total = contam.reduce((a, b) => a + b, 0);

  const critico = contam.some((v, i) => v >= 6 && contam.indexOf(v) !== i);
  const falhaCritica = rolados.every((d) => d.valor === 1);
  const veredito: Veredito = critico
    ? 'critico'
    : falhaCritica
      ? 'falhaCritica'
      : total >= dt
        ? 'sucesso'
        : 'falha';

  return {
    dados: rolados,
    total,
    dt,
    ra: Math.max(...contam),
    rb: Math.min(...contam),
    veredito,
    informado,
  };
}

/** Rola o teste. O `rng` vem de fora: criptográfico no servidor, com semente nos testes. */
export function resolverTeste(teste: TesteOp2, rng: Rng): ResultadoDeTeste {
  const dados = dadosDoTeste(teste).map((d) => ({ ...d, valor: rolar(d.tipo, rng) }));
  return avaliar(dados, teste.dt, false);
}

/**
 * Dados físicos: o jogador rolou na mão e informa os valores, na ordem de `dadosDoTeste`. Cada
 * valor precisa caber no dado (um d10 vai de 1 a 10); o erro diz qual campo está errado.
 */
export function resolverTesteInformado(teste: TesteOp2, valores: number[]): ResultadoDeTeste {
  const dados = dadosDoTeste(teste);
  if (valores.length !== dados.length) {
    throw new ErroDeRegra(
      'valores',
      `Informe ${String(dados.length)} valores, um para cada dado do teste.`,
    );
  }
  const comValores = dados.map((d, i) => {
    const valor = valores[i] as number;
    if (!Number.isInteger(valor) || valor < 1 || valor > faces(d.tipo)) {
      throw new ErroDeRegra(
        `valores.${String(i)}`,
        `O ${d.tipo} vai de 1 a ${String(faces(d.tipo))}.`,
      );
    }
    return { ...d, valor };
  });
  return avaliar(comValores, teste.dt, true);
}

/** O que o jogador diz no "Só o resultado": o veredito e, se o teste pedir, os números. */
export interface VereditoInformado {
  veredito: Veredito;
  /** A soma dos três maiores. */
  soma?: number | undefined;
  /** O maior dado que contou (RA). */
  maior?: number | undefined;
  /** O menor dado que contou (RB). */
  menor?: number | undefined;
}

/**
 * Dados físicos, "Só o resultado": o jogador rolou na mão e diz só se passou. Os números são
 * opcionais, mas precisam caber nos dados do teste e combinar com o veredito: uma soma abaixo da
 * DT não é sucesso. Falha crítica é todos os dados em 1, então os números saem dela.
 */
export function resolverTesteSoVeredito(
  teste: TesteOp2,
  informado: VereditoInformado,
): ResultadoDeTeste {
  const dados = dadosDoTeste(teste);
  const { veredito } = informado;
  const { dt } = teste;
  const contam = Math.min(dados.length, CONTAM);
  const maiorFace = Math.max(...dados.map((d) => faces(d.tipo)));

  if (veredito === 'falhaCritica') {
    return {
      dados: [],
      total: contam,
      dt,
      ra: 1,
      rb: 1,
      veredito,
      informado: true,
      soVeredito: { soma: true, maior: true, menor: true },
    };
  }

  const { soma, maior, menor } = informado;
  if (soma !== undefined) {
    const maximo = dados
      .map((d) => faces(d.tipo))
      .sort((a, b) => b - a)
      .slice(0, CONTAM)
      .reduce((a, b) => a + b, 0);
    if (!Number.isInteger(soma) || soma < contam || soma > maximo) {
      throw new ErroDeRegra(
        'soma',
        `A soma dos três maiores vai de ${String(contam)} a ${String(maximo)}.`,
      );
    }
    if (veredito === 'sucesso' && soma < dt) {
      throw new ErroDeRegra('soma', `${String(soma)} não alcança a DT ${String(dt)}: é falha.`);
    }
    if (veredito === 'falha' && soma >= dt) {
      throw new ErroDeRegra('soma', `${String(soma)} alcança a DT ${String(dt)}: é sucesso.`);
    }
  }
  if (maior !== undefined && (!Number.isInteger(maior) || maior < 1 || maior > maiorFace)) {
    throw new ErroDeRegra('maior', `O maior dado vai de 1 a ${String(maiorFace)}.`);
  }
  if (menor !== undefined) {
    const teto = maior ?? maiorFace;
    if (!Number.isInteger(menor) || menor < 1 || menor > teto) {
      throw new ErroDeRegra('menor', `O menor dado vai de 1 a ${String(teto)}.`);
    }
  }

  const passou = veredito !== 'falha';
  return {
    dados: [],
    total: soma ?? (passou ? dt : dt - 1),
    dt,
    ra: maior ?? 0,
    rb: menor ?? 0,
    veredito,
    informado: true,
    soVeredito: {
      soma: soma !== undefined,
      maior: maior !== undefined,
      menor: menor !== undefined,
    },
  };
}

/** Um teste que veio mal (falha ou falha crítica). O Ímpeto enche com isso. */
export const falhou = (veredito: Veredito): boolean =>
  veredito === 'falha' || veredito === 'falhaCritica';
