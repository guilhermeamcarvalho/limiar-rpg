// Criação de personagem de Ordem Paranormal II: perfis, ocupações, passos de atributo e de perícia
// e os avisos de "fora da regra" (RF-09). Usado pela criação guiada e pela ficha em branco, que
// assim geram a mesma ficha. Fora da regra é permitido: os avisos nunca bloqueiam o salvar.
// Referência: docs/regras-do-jogo.md, "Perfis e ocupações" e "Criação de personagem".
import { VERSAO_DA_FICHA_OP2, type FichaOp2, type PerfilOp2 } from '../../schemas/ficha-op2.ts';
import { DADOS } from '../../sistemas.ts';
import type { Dado } from '../dados.ts';
import { maximosDeRecursos } from './ficha.ts';
import { idDoTexto } from './modificadores.ts';
import { mudarPasso } from './passos.ts';
import {
  ATRIBUTOS_OP2,
  IDS_DAS_PERICIAS_OP2,
  PERICIAS_OP2,
  nomeDaPericia,
  type PericiaOp2,
} from './pericias.ts';

export interface PerfilInfo {
  id: PerfilOp2;
  nome: string;
  habilidade: string;
  regra: string;
}

/** Os três perfis e a habilidade de cada um. Analista e Vigilante são provisórios do protótipo. */
export const PERFIS_INFO_OP2: readonly PerfilInfo[] = [
  {
    id: 'executor',
    nome: 'Executor',
    habilidade: 'Ímpeto',
    regra:
      'Barra com 3 espaços; cada teste que falha preenche 1. Gaste 1 para +d4 num teste, ou 3 para subir um atributo um passo até o fim da cena.',
  },
  {
    id: 'analista',
    nome: 'Analista',
    habilidade: 'Preparação',
    regra:
      'Gaste uma ação analisando para guardar até 2 marcadores; antes de rolar, gaste um para subir um dado em um passo.',
  },
  {
    id: 'vigilante',
    nome: 'Vigilante',
    habilidade: 'Reflexo',
    regra:
      'Age antes de todos quando algo inesperado acontece; uma vez por cena, rola de novo a RB de um teste.',
  },
];

export function infoDoPerfil(perfil: PerfilOp2): PerfilInfo {
  return PERFIS_INFO_OP2.find((p) => p.id === perfil) ?? (PERFIS_INFO_OP2[0] as PerfilInfo);
}

export interface Ocupacao {
  /** O nome sem acento, em minúsculas: casa com o texto da ficha por `idDoTexto`. */
  id: string;
  nome: string;
  habilidade: string;
  regra: string;
  /** Sobem um passo de graça na criação: começam em d6. */
  pericias: readonly [PericiaOp2, PericiaOp2];
}

/** As ocupações conhecidas. Habilidades e perícias são provisórias do protótipo. */
export const OCUPACOES_OP2: readonly Ocupacao[] = [
  {
    id: 'mecanico',
    nome: 'Mecânico',
    habilidade: 'Gambiarra',
    regra: 'Uma vez por cena, gaste 2 PV para +d4 num teste de Máquinas ou Crime.',
    pericias: ['maquinas', 'crime'],
  },
  {
    id: 'jornalista',
    nome: 'Jornalista',
    habilidade: 'Fontes',
    regra:
      'Uma vez por cena, gaste 1 PD para rolar Pesquisa ou Persuasão duas vezes e ficar com o melhor.',
    pericias: ['pesquisa', 'persuasao'],
  },
  {
    id: 'enfermeira',
    nome: 'Enfermeira',
    habilidade: 'Plantão',
    regra: 'Gaste uma ação e 1 PD: teste de Medicina; um aliado recupera PV igual à RA.',
    pericias: ['medicina', 'intuicao'],
  },
  {
    id: 'cientista',
    nome: 'Cientista',
    habilidade: 'Foco mental',
    regra: 'Num teste mental, gaste 2 PD para receber +d4.',
    pericias: ['tecnologia', 'aptidao'],
  },
  {
    id: 'policial',
    nome: 'Policial',
    habilidade: 'Treinamento',
    regra:
      'Uma vez por cena, num teste de Pontaria ou Intimidação, suba o dado da perícia em um passo.',
    pericias: ['pontaria', 'intimidacao'],
  },
  {
    id: 'entregador',
    nome: 'Entregador',
    habilidade: 'Conheço um atalho',
    regra:
      'Uma vez por cena, ao fugir ou se deslocar pela cidade, receba +d4 em Atletismo ou Acrobacia.',
    pericias: ['atletismo', 'acrobacia'],
  },
];

/** A ocupação conhecida pelo texto da ficha ("Mecânico", "mecanico"), ou nenhuma. */
export function ocupacaoConhecida(texto: string): Ocupacao | null {
  const id = idDoTexto(texto);
  return OCUPACOES_OP2.find((o) => o.id === id) ?? null;
}

/** "+1 passo em Pesquisa e Persuasão". */
export function textoDoBonus(ocupacao: Ocupacao): string {
  const [a, b] = ocupacao.pericias.map(nomeDaPericia);
  return `+1 passo em ${String(a)} e ${String(b)}`;
}

/* ---------- Passos ---------- */

export const ATRIBUTO_INICIAL: Dado = 'd6';
/** Passos para subir atributos: d6 → d8 → d10. Baixar um atributo para d4 dá mais um. */
export const PASSOS_DE_ATRIBUTO = 2;
/** Na criação, nenhum atributo passa de d8. */
export const LIMITE_DE_ATRIBUTO: Dado = 'd8';

export const PERICIA_INICIAL: Dado = 'd4';
/** "Seis d6 e um d8": 6 + 2 = 8 passos a partir de d4. */
export const PASSOS_DE_PERICIA = 8;
/** Na criação, nenhuma perícia passa de d8; as da ocupação, que começam um passo acima, de d10. */
export const LIMITE_DE_PERICIA: Dado = 'd8';

const indice = (dado: Dado) => DADOS.indexOf(dado);
const nomeDoAtributo = (id: string) => ATRIBUTOS_OP2.find((a) => a.id === id)?.nome ?? id;

/** O dado de partida de cada perícia: d4, ou d6 nas da ocupação. */
export function basesDasPericias(ocupacao: string): Record<PericiaOp2, Dado> {
  const bonus: readonly PericiaOp2[] = ocupacaoConhecida(ocupacao)?.pericias ?? [];
  return Object.fromEntries(
    IDS_DAS_PERICIAS_OP2.map((id) => [
      id,
      bonus.includes(id) ? mudarPasso(PERICIA_INICIAL, 1) : PERICIA_INICIAL,
    ]),
  ) as Record<PericiaOp2, Dado>;
}

/** Quanto cada perícia pode chegar na criação. */
export function limiteDaPericia(base: Dado): Dado {
  return mudarPasso(LIMITE_DE_PERICIA, indice(base) - indice(PERICIA_INICIAL));
}

/** Passos gastos nos atributos. Um atributo em d4 conta −1: devolve um passo. */
export function passosEmAtributos(atributos: FichaOp2['atributos']): number {
  return Object.values(atributos).reduce(
    (soma, dado) => soma + indice(dado) - indice(ATRIBUTO_INICIAL),
    0,
  );
}

/** Passos gastos nas perícias, a partir do dado de partida. Abaixo dele não devolve passo. */
export function passosEmPericias(pericias: FichaOp2['pericias'], ocupacao: string): number {
  const bases = basesDasPericias(ocupacao);
  return IDS_DAS_PERICIAS_OP2.reduce(
    (soma, id) => soma + Math.max(0, indice(pericias[id]) - indice(bases[id])),
    0,
  );
}

/* ---------- Avisos (RF-09) ---------- */

export interface AvisoDaCriacao {
  /** Onde mostrar: "atributos", "atributos.mente", "pericias", "pericias.luta". */
  campo: string;
  mensagem: string;
}

/**
 * O que foge da regra de criação. Lista vazia: tudo certo. Nunca bloqueia: a ficha pode ser salva
 * assim, e o mestre vê os mesmos avisos.
 */
export function avisosDaCriacao(ficha: FichaOp2): AvisoDaCriacao[] {
  const avisos: AvisoDaCriacao[] = [];

  for (const { id } of ATRIBUTOS_OP2) {
    const dado = ficha.atributos[id];
    if (indice(dado) > indice(LIMITE_DE_ATRIBUTO)) {
      avisos.push({
        campo: `atributos.${id}`,
        mensagem: `${nomeDoAtributo(id)} ${dado} passa do limite da criação (${LIMITE_DE_ATRIBUTO}).`,
      });
    }
  }
  const emD4 = Object.values(ficha.atributos).filter((d) => d === 'd4').length;
  if (emD4 > 1) {
    avisos.push({ campo: 'atributos', mensagem: 'Só um atributo pode baixar para d4.' });
  }
  const passosA = passosEmAtributos(ficha.atributos);
  if (passosA > PASSOS_DE_ATRIBUTO) {
    avisos.push({
      campo: 'atributos',
      mensagem: `Os atributos usam ${String(passosA)} passos; a regra dá ${String(PASSOS_DE_ATRIBUTO)}.`,
    });
  }

  const bases = basesDasPericias(ficha.ocupacao);
  for (const { id, nome } of PERICIAS_OP2) {
    const limite = limiteDaPericia(bases[id]);
    const dado = ficha.pericias[id];
    if (indice(dado) > indice(limite)) {
      avisos.push({
        campo: `pericias.${id}`,
        mensagem: `${nome} ${dado} passa do limite da criação (${limite}).`,
      });
    }
  }
  const passosP = passosEmPericias(ficha.pericias, ficha.ocupacao);
  if (passosP > PASSOS_DE_PERICIA) {
    avisos.push({
      campo: 'pericias',
      mensagem: `As perícias usam ${String(passosP)} passos; a regra dá ${String(PASSOS_DE_PERICIA)}.`,
    });
  }
  return avisos;
}

/* ---------- Ficha nova ---------- */

export interface InicioDaFicha {
  nome?: string;
  nivel?: number;
  perfil?: PerfilOp2;
  ocupacao?: string;
}

/**
 * A ficha de partida, igual na criação guiada e na ficha em branco: atributos em d6, perícias no
 * dado de partida da ocupação, PV e PD cheios e calculados.
 */
export function fichaNova({
  nome = '',
  nivel = 1,
  perfil = 'executor',
  ocupacao = '',
}: InicioDaFicha = {}): FichaOp2 {
  const atributos = { fisico: ATRIBUTO_INICIAL, mente: ATRIBUTO_INICIAL, emocao: ATRIBUTO_INICIAL };
  return comRecursosCheios({
    versao: VERSAO_DA_FICHA_OP2,
    nome,
    nivel,
    ocupacao,
    perfil,
    idade: null,
    origem: '',
    atributos,
    pericias: basesDasPericias(ocupacao),
    modificadores: [],
    pv: 0,
    pvMax: 1,
    pd: 0,
    pdMax: 1,
    impeto: 0,
    impetoAtributo: null,
    usadasNaCena: [],
    itens: [],
    anotacoes: '',
    modoDados: 'virtual',
  });
}

/** PV e PD máximos recalculados pelos atributos, e os atuais cheios. */
export function comRecursosCheios(ficha: FichaOp2): FichaOp2 {
  const { pvMax, pdMax } = maximosDeRecursos(ficha.atributos);
  return { ...ficha, pv: pvMax, pvMax, pd: pdMax, pdMax };
}
