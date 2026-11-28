// Criação de personagem de Ordem Paranormal II: perfis, ocupações, passos de atributo e de perícia
// e os avisos de "fora da regra" (RF-09). Usado pela criação guiada e pela ficha em branco, que
// assim geram a mesma ficha. Fora da regra é permitido: os avisos nunca bloqueiam o salvar.
// Referência: docs/regras-do-jogo.md, "Perfis e ocupações" e "Criação de personagem".
import { VERSAO_DA_FICHA_OP2, type FichaOp2, type PerfilOp2 } from '../../schemas/ficha-op2.ts';
import { DADOS } from '../../sistemas.ts';
import type { Dado } from '../dados.ts';
import { maximosDeRecursos } from './ficha.ts';
import { idDoTexto } from './modificadores.ts';
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

/** Os três perfis oficiais de Ordem 2 e suas barras especiais. */
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
    habilidade: 'Plano',
    regra:
      'Barra com 3 espaços; gastar ação importante observando ou planejando (sem testar) preenche 1. Gaste 1 para +d4 num teste, ou 3 para subir um atributo um passo até o fim da cena.',
  },
  {
    id: 'vigilante',
    nome: 'Vigilante',
    habilidade: 'Reflexo',
    regra:
      'Barra com 3 espaços; ser atacado ou surpreendido preenche 1. Gaste 1 para +d4 em esquiva, ou 3 para realizar uma ação importante fora do seu turno.',
  },
];

const PERFIS_POR_ID = Object.fromEntries(PERFIS_INFO_OP2.map((p) => [p.id, p])) as Record<
  PerfilOp2,
  PerfilInfo
>;

export function infoDoPerfil(perfil: PerfilOp2): PerfilInfo {
  return PERFIS_POR_ID[perfil];
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

/** As 17 ocupações oficiais de Ordem 2 (pp. 6–9). As 2 perícias listadas são sugestões. */
export const OCUPACOES_OP2: readonly Ocupacao[] = [
  {
    id: 'academico',
    nome: 'Acadêmico',
    habilidade: 'Saber é poder',
    regra:
      'Uma vez por cena, em um teste de Mente, recebe +d4 se puder consultar ou recordar teoria.',
    pericias: ['aptidao', 'pesquisa'],
  },
  {
    id: 'agente de saude',
    nome: 'Agente de saúde',
    habilidade: 'Técnica medicinal',
    regra:
      'Ao curar com Medicina, recupera +2 PV adicionais (ou estabiliza automaticamente em sucesso).',
    pericias: ['medicina', 'intuicao'],
  },
  {
    id: 'artista',
    nome: 'Artista',
    habilidade: 'Magnum opus',
    regra: 'Uma vez por cena, cria distração ou conexão emocional (+d4 em Persuasão ou Enganação).',
    pericias: ['aptidao', 'persuasao'],
  },
  {
    id: 'atleta',
    nome: 'Atleta',
    habilidade: '110%',
    regra: 'Uma vez por cena, gasta 2 PV para ganhar +d4 em Acrobacia, Atletismo ou Vigor.',
    pericias: ['acrobacia', 'atletismo'],
  },
  {
    id: 'criminoso',
    nome: 'Criminoso',
    habilidade: 'O crime compensa',
    regra: 'Recebe +1 passo em Crime para arrombamento, furto ou disfarce.',
    pericias: ['crime', 'furtividade'],
  },
  {
    id: 'explorador',
    nome: 'Explorador',
    habilidade: 'Desbravador',
    regra: 'Ignora penalidades leves de terreno e recebe +d4 em Sobrevivência para rastrear.',
    pericias: ['percepcao', 'sobrevivencia'],
  },
  {
    id: 'gente do campo',
    nome: 'Gente do campo',
    habilidade: 'Calejado',
    regra: 'Recebe +2 espaços de carga e +d4 para resistir a exaustão ou veneno.',
    pericias: ['sobrevivencia', 'vigor'],
  },
  {
    id: 'hacker',
    nome: 'Hacker',
    habilidade: 'Invasão silenciosa',
    regra: 'Uma vez por cena, recebe +d4 ao invadir ou manipular sistemas eletrônicos.',
    pericias: ['crime', 'tecnologia'],
  },
  {
    id: 'herdeiro',
    nome: 'Herdeiro',
    habilidade: 'Patrimônio',
    regra: 'Começa o caso com +2 itens comuns extras e acesso facilitado a recursos.',
    pericias: ['aptidao', 'persuasao'],
  },
  {
    id: 'investigador',
    nome: 'Investigador',
    habilidade: 'Faro para pistas',
    regra: 'Uma vez por cena, recebe +d4 em Percepção ou Pesquisa ao examinar uma cena de crime.',
    pericias: ['percepcao', 'pesquisa'],
  },
  {
    id: 'lider',
    nome: 'Líder',
    habilidade: 'Voz de comando',
    regra: 'Uma vez por cena, gasta ação para conceder +d4 no próximo teste de um aliado próximo.',
    pericias: ['intimidacao', 'persuasao'],
  },
  {
    id: 'ocultista',
    nome: 'Ocultista',
    habilidade: 'Contato paranormal',
    regra: 'Começa com NEX 1 e 1 ritual de 1º círculo, mas inicia com −2 PD máximos.',
    pericias: ['ocultismo', 'disciplina'],
  },
  {
    id: 'policial',
    nome: 'Policial',
    habilidade: 'Patrulha',
    regra: 'Uma vez por cena, age com prioridade ao sacar arma ou responder a emboscada.',
    pericias: ['percepcao', 'pontaria'],
  },
  {
    id: 'religioso',
    nome: 'Religioso',
    habilidade: 'Acalmar',
    regra: 'Uma vez por cena, pode testar Disciplina ou Persuasão para acalmar aliado Perturbado.',
    pericias: ['disciplina', 'intuicao'],
  },
  {
    id: 'soldado',
    nome: 'Soldado',
    habilidade: 'Treinamento tático',
    regra: 'Sabe usar proteções sem penalidade leve e recebe +d4 no primeiro ataque da cena.',
    pericias: ['luta', 'pontaria'],
  },
  {
    id: 'tecnico',
    nome: 'Técnico',
    habilidade: 'Improvisação',
    regra: 'Uma vez por cena, repara ou adapta equipamento sem precisar de oficina completa.',
    pericias: ['maquinas', 'tecnologia'],
  },
  {
    id: 'trabalhador bracal',
    nome: 'Trabalhador braçal',
    habilidade: 'Mão pesada',
    regra: 'Soma +2 espaços de carga e +d4 em esforços prolongados de força.',
    pericias: ['atletismo', 'vigor'],
  },
];

/** A ocupação conhecida pelo texto da ficha ("Agente de saúde", "agente de saude"), ou nenhuma. */
export function ocupacaoConhecida(texto: string): Ocupacao | null {
  const id = idDoTexto(texto);
  return OCUPACOES_OP2.find((o) => o.id === id) ?? null;
}

/** "Sugeridas: Pesquisa e Persuasão". */
export function textoDoBonus(ocupacao: Ocupacao): string {
  const [a, b] = ocupacao.pericias.map(nomeDaPericia);
  return `Sugeridas: ${String(a)} e ${String(b)}`;
}

/* ---------- Passos ---------- */

export const ATRIBUTO_INICIAL: Dado = 'd4';
/** 5 passos para distribuir entre os 3 atributos a partir de d4. */
export const PASSOS_DE_ATRIBUTO = 5;
/** Na criação, nenhum atributo passa de d10 (d12 só por evolução). */
export const LIMITE_DE_ATRIBUTO: Dado = 'd10';

export const PERICIA_INICIAL: Dado = 'd4';
/** 7 passos no nível 1 (8 no nível 2) a partir de d4. */
export const PASSOS_DE_PERICIA = 7;
export const PASSOS_DE_PERICIA_NIVEL_2 = 8;
/** Na criação, nenhuma perícia passa de d8. */
export const LIMITE_DE_PERICIA: Dado = 'd8';

export const passosDePericiaParaNivel = (nivel: number): number =>
  PASSOS_DE_PERICIA + Math.max(0, nivel - 1);

const indice = (dado: Dado) => DADOS.indexOf(dado);

/** Todas as 20 perícias começam em d4 (a ocupação sugere, não dá passo grátis). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function basesDasPericias(_ocupacao: string): Record<PericiaOp2, Dado> {
  return Object.fromEntries(IDS_DAS_PERICIAS_OP2.map((id) => [id, PERICIA_INICIAL])) as Record<
    PericiaOp2,
    Dado
  >;
}

/** Quanto cada perícia pode chegar na criação (d8). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function limiteDaPericia(_base: Dado): Dado {
  return LIMITE_DE_PERICIA;
}

/** Passos gastos nos atributos a partir de d4. */
export function passosEmAtributos(atributos: FichaOp2['atributos']): number {
  return Object.values(atributos).reduce(
    (soma, dado) => soma + Math.max(0, indice(dado) - indice(ATRIBUTO_INICIAL)),
    0,
  );
}

/** Passos gastos nas perícias a partir de d4. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function passosEmPericias(pericias: FichaOp2['pericias'], _ocupacao: string): number {
  return IDS_DAS_PERICIAS_OP2.reduce(
    (soma, id) => soma + Math.max(0, indice(pericias[id]) - indice(PERICIA_INICIAL)),
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

  for (const { id, nome } of ATRIBUTOS_OP2) {
    const dado = ficha.atributos[id];
    if (indice(dado) > indice(LIMITE_DE_ATRIBUTO)) {
      avisos.push({
        campo: `atributos.${id}`,
        mensagem: `${nome} ${dado} passa do limite da criação (${LIMITE_DE_ATRIBUTO}).`,
      });
    }
  }

  for (const { id, nome } of PERICIAS_OP2) {
    const dado = ficha.pericias[id];
    if (indice(dado) > indice(LIMITE_DE_PERICIA)) {
      avisos.push({
        campo: `pericias.${id}`,
        mensagem: `${nome} ${dado} passa do limite da criação (${LIMITE_DE_PERICIA}).`,
      });
    }
  }

  const passosA = passosEmAtributos(ficha.atributos);
  const passosP = passosEmPericias(ficha.pericias, ficha.ocupacao);
  const metaPericias = passosDePericiaParaNivel(ficha.nivel);
  const totalUsado = passosA + passosP;
  const totalPermitido = PASSOS_DE_ATRIBUTO + metaPericias;

  if (totalUsado > totalPermitido) {
    if (passosA > PASSOS_DE_ATRIBUTO) {
      avisos.push({
        campo: 'atributos',
        mensagem: `Os atributos usam ${String(passosA)} passos; a regra dá ${String(PASSOS_DE_ATRIBUTO)} (ou troca 1-por-1 com perícias).`,
      });
    }
    if (passosP > metaPericias) {
      avisos.push({
        campo: 'pericias',
        mensagem: `As perícias usam ${String(passosP)} passos; no nível ${String(ficha.nivel)} a regra dá ${String(metaPericias)} (ou troca 1-por-1 com atributos).`,
      });
    }
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
 * A ficha de partida, igual na criação guiada e na ficha em branco: atributos em d4, perícias em d4,
 * PV e PD cheios e calculados pela regra de Ordem 2.
 */
export function fichaNova({
  nome = '',
  nivel = 1,
  perfil = 'executor',
  ocupacao = '',
}: InicioDaFicha = {}): FichaOp2 {
  const atributos = { fisico: ATRIBUTO_INICIAL, mente: ATRIBUTO_INICIAL, emocao: ATRIBUTO_INICIAL };
  const ehOcultista = ocupacao.trim().toLowerCase() === 'ocultista';
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
    ajustePvPd: 0,
    xp: 0,
    nex: ehOcultista ? 1 : 0,
    impeto: 0,
    impetoAtributo: null,
    usadasNaCena: [],
    condicoes: [],
    aptidoes: [],
    itens: [],
    anotacoes: '',
    modoDados: 'virtual',
  });
}

/** PV e PD máximos recalculados pelos atributos/nível/ocupação, e os atuais cheios. */
export function comRecursosCheios(ficha: FichaOp2): FichaOp2 {
  const { pvMax, pdMax } = maximosDeRecursos(ficha.atributos, {
    nivel: ficha.nivel,
    ocupacao: ficha.ocupacao,
    ajustePvPd: ficha.ajustePvPd,
  });
  return { ...ficha, pv: pvMax, pvMax, pd: pdMax, pdMax };
}
