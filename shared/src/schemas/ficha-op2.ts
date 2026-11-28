// Ficha de Ordem Paranormal II: guardada como JSON com `versao` e validada na entrada e na saída.
// `.strict()` em todo objeto: campo desconhecido (como um "res" repetido, que quebrou a ficha no
// protótipo) é recusado, em vez de ir parar no banco sem ninguém ver.
import { z } from 'zod';
import { esquemaDado } from '../sistemas.ts';
import { NIVEL_MAXIMO } from './campanha.ts';
import {
  IDS_DAS_PERICIAS_OP2,
  IDS_DOS_ATRIBUTOS_OP2,
  PERICIAS_OP2,
  type PericiaOp2,
} from '../regras/op2/pericias.ts';

export const VERSAO_DA_FICHA_OP2 = 1;
export const IMPETO_MAXIMO = 3;
export const IMPETO_MAXIMO_TRANSBORDANTE = 4;

export const PERFIS_OP2 = ['executor', 'analista', 'vigilante'] as const;
export type PerfilOp2 = (typeof PERFIS_OP2)[number];

export const esquemaAlvoDePasso = z.enum([...IDS_DOS_ATRIBUTOS_OP2, ...IDS_DAS_PERICIAS_OP2]);
export type AlvoDePasso = z.infer<typeof esquemaAlvoDePasso>;

/** Efeito que sobe ou desce um dado por um tempo, como "Machucado até o fim da cena". */
export const esquemaModificadorTemporario = z
  .object({
    alvo: esquemaAlvoDePasso,
    /** Quantos passos: −1 desce de d8 para d6; +1 sobe. */
    passos: z
      .int()
      .min(-4)
      .max(4)
      .refine((n) => n !== 0, { error: 'Um modificador muda pelo menos um passo.' }),
    /** De onde veio, para a ficha mostrar: "Machucado (falha crítica)". */
    origem: z.string().trim().min(1).max(80),
    /** Até quando vale. Por enquanto, só até o fim da cena. */
    duracao: z.literal('cena'),
  })
  .strict();
export type ModificadorTemporario = z.infer<typeof esquemaModificadorTemporario>;

export const esquemaItemDaFicha = z
  .object({
    id: z.string().min(1).max(40),
    nome: z.string().trim().min(1, { error: 'Dê um nome ao item.' }).max(80),
    descricao: z.string().max(500).default(''),
    espacos: z.number().min(0).max(20).default(1),
  })
  .strict();
export type ItemDaFicha = z.infer<typeof esquemaItemDaFicha>;

export const esquemaAptidaoDaFicha = z
  .object({
    area: z.string().trim().min(1).max(40),
    dado: esquemaDado,
  })
  .strict();
export type AptidaoDaFicha = z.infer<typeof esquemaAptidaoDaFicha>;

const pericias = z
  .object(
    Object.fromEntries(PERICIAS_OP2.map((p) => [p.id, esquemaDado])) as Record<
      PericiaOp2,
      typeof esquemaDado
    >,
  )
  .strict();

const inteiro = (min: number, max: number, nome: string) =>
  z
    .int({ error: `${nome} precisa ser um número inteiro.` })
    .min(min, { error: `${nome} não pode ser menor que ${String(min)}.` })
    .max(max, { error: `${nome} não pode passar de ${String(max)}.` });

export const esquemaFichaOp2 = z
  .object({
    versao: z.literal(VERSAO_DA_FICHA_OP2),

    // Identidade
    nome: z.string().trim().min(1, { error: 'Dê um nome ao personagem.' }).max(60),
    nivel: inteiro(1, NIVEL_MAXIMO, 'O nível'),
    /** Texto livre na ficha em branco; as conhecidas (Mecânico...) trazem uma habilidade. */
    ocupacao: z.string().trim().max(40),
    perfil: z.enum(PERFIS_OP2, { error: 'Escolha Executor, Analista ou Vigilante.' }),
    idade: inteiro(0, 150, 'A idade').nullable(),
    origem: z.string().trim().max(60),

    // Dados
    atributos: z.object({ fisico: esquemaDado, mente: esquemaDado, emocao: esquemaDado }).strict(),
    pericias,
    modificadores: z.array(esquemaModificadorTemporario).max(20),

    // Recursos
    pv: inteiro(0, 999, 'O PV'),
    pvMax: inteiro(1, 999, 'O PV máximo'),
    pd: inteiro(0, 999, 'O PD'),
    pdMax: inteiro(1, 999, 'O PD máximo'),
    ajustePvPd: inteiro(-2, 2, 'O ajuste entre PV e PD').default(0),
    xp: inteiro(0, 99999, 'O XP').default(0),
    nex: inteiro(0, 10, 'O NEX').default(0),
    /** Barra do perfil (Ímpeto, Plano ou Reflexo): 0 a 3 (ou 4 com Ímpeto transbordante). */
    impeto: inteiro(0, IMPETO_MAXIMO_TRANSBORDANTE, 'A barra de perfil'),
    /** O atributo que Ímpeto/Plano subiu nesta cena (gastando 3), ou nenhum. */
    impetoAtributo: z.enum(IDS_DOS_ATRIBUTOS_OP2).nullable(),
    /** Habilidades de "uma vez por cena" já usadas nesta cena, como "gambiarra". */
    usadasNaCena: z.array(z.string().min(1).max(40)).max(20),
    condicoes: z.array(z.string().min(1).max(40)).max(20).default([]),
    aptidoes: z.array(esquemaAptidaoDaFicha).max(6).default([]),

    itens: z.array(esquemaItemDaFicha).max(100),
    anotacoes: z.string().max(20000),
    /** Quem rola: o app (virtual) ou o jogador, que informa os valores (físico). */
    modoDados: z.enum(['virtual', 'fisico']),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.pv > f.pvMax) {
      ctx.addIssue({ code: 'custom', path: ['pv'], message: 'O PV não pode passar do máximo.' });
    }
    if (f.pd > f.pdMax) {
      ctx.addIssue({ code: 'custom', path: ['pd'], message: 'O PD não pode passar do máximo.' });
    }
    if (f.impetoAtributo !== null && f.perfil === 'vigilante') {
      ctx.addIssue({
        code: 'custom',
        path: ['impetoAtributo'],
        message: 'Apenas Executor (Ímpeto) e Analista (Plano) sobem atributo com a barra.',
      });
    }
    const ids = f.itens.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['itens'], message: 'Dois itens com o mesmo id.' });
    }
  });

export type FichaOp2 = z.infer<typeof esquemaFichaOp2>;
export type FichaOp2Entrada = z.input<typeof esquemaFichaOp2>;

/**
 * Lê uma ficha guardada, de qualquer versão, e devolve a versão atual validada. Hoje só existe a
 * versão 1; quando a ficha mudar, cada versão antiga ganha aqui um passo de conversão.
 */
export function migrarFicha(json: unknown): FichaOp2 {
  const versao =
    typeof json === 'object' && json !== null && 'versao' in json ? json.versao : undefined;
  if (versao !== VERSAO_DA_FICHA_OP2) {
    throw new Error(
      `Versão de ficha desconhecida: ${versao === undefined ? 'nenhuma' : JSON.stringify(versao)}`,
    );
  }
  return esquemaFichaOp2.parse(json);
}
