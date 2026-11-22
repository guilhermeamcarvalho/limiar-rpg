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

/** Um teste que veio mal (falha ou falha crítica). O Ímpeto enche com isso. */
export const falhou = (veredito: Veredito): boolean =>
  veredito === 'falha' || veredito === 'falhaCritica';
