// Campanha (caso): o que se pode enviar ao criar e ao editar, e o que a API devolve.
import { z } from 'zod';
import type { Papel } from '../permissoes.ts';
import { esquemaNovoConvite } from './convite.ts';

const quando = z.iso
  .datetime({ offset: true, error: 'Use uma data e hora válidas.' })
  .transform((s) => new Date(s));

export const MAX_NOME_DO_CASO = 80;
export const MAX_GANCHO = 280;
export const DT_PADRAO = 7;
export const NIVEL_MAXIMO = 10;

export const TONS = {
  'horror-investigativo': 'Horror investigativo',
  suspense: 'Suspense',
  'acao-paranormal': 'Ação paranormal',
} as const;
export type Tom = keyof typeof TONS;

export const FORMATOS = {
  'campanha-curta': 'Campanha curta · 4 a 8 sessões',
  'one-shot': 'One-shot',
  'campanha-longa': 'Campanha longa',
} as const;
export type Formato = keyof typeof FORMATOS;

export const FREQUENCIAS = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
} as const;
export type Frequencia = keyof typeof FREQUENCIAS;

/** Domingo é 0, como em `Date.getDay()`. */
export const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const chaves = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

/** Quando a mesa costuma se reunir. */
export const esquemaAgenda = z.object({
  diaDaSemana: z
    .int({ error: 'Escolha o dia da semana.' })
    .min(0, { error: 'Escolha o dia da semana.' })
    .max(6, { error: 'Escolha o dia da semana.' }),
  horario: z
    .string({ error: 'Escolha o horário.' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use o horário no formato 21:00.' }),
  frequencia: z.enum(chaves(FREQUENCIAS), { error: 'Escolha a frequência.' }),
});
export type Agenda = z.infer<typeof esquemaAgenda>;

/**
 * Os campos de um caso, sem valor padrão. A edição usa estes campos como estão: com padrão,
 * um PATCH só com o nome voltaria as outras opções ao padrão sem ninguém pedir.
 */
const camposDaCampanha = {
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Dê um nome ao caso.' })
    .max(MAX_NOME_DO_CASO, { error: `Use até ${String(MAX_NOME_DO_CASO)} caracteres.` }),
  gancho: z
    .string()
    .trim()
    .max(MAX_GANCHO, { error: `Use até ${String(MAX_GANCHO)} caracteres.` }),
  sistemaId: z.string().min(1),
  tom: z.enum(chaves(TONS), { error: 'Escolha o tom.' }),
  formato: z.enum(chaves(FORMATOS), { error: 'Escolha o formato.' }),
  nivelInicial: z
    .int({ error: 'Use um número inteiro.' })
    .min(1, { error: 'O nível começa em 1.' })
    .max(NIVEL_MAXIMO, { error: `No máximo nível ${String(NIVEL_MAXIMO)}.` }),
  dtPadrao: z
    .int({ error: 'Use um número inteiro.' })
    .min(1, { error: 'A DT é pelo menos 1.' })
    .max(30, { error: 'No máximo DT 30.' }),
  /** Mesa em rodadas: uma ação por vez. */
  rodadas: z.boolean(),
  /** O jogador pode rolar dados de verdade e informar o resultado. */
  dadosFisicos: z.boolean(),
  /** Os jogadores veem as fichas uns dos outros. */
  fichasVisiveis: z.boolean(),
  agenda: esquemaAgenda.nullable(),
  proximaSessao: quando.nullable(),
};

export const esquemaNovaCampanha = z.object({
  ...camposDaCampanha,
  gancho: camposDaCampanha.gancho.optional(),
  /** Ordem Paranormal II por padrão. */
  sistemaId: camposDaCampanha.sistemaId.default('sys_op2'),
  tom: camposDaCampanha.tom.default('horror-investigativo'),
  formato: camposDaCampanha.formato.default('campanha-curta'),
  nivelInicial: camposDaCampanha.nivelInicial.default(1),
  dtPadrao: camposDaCampanha.dtPadrao.default(DT_PADRAO),
  rodadas: camposDaCampanha.rodadas.default(true),
  dadosFisicos: camposDaCampanha.dadosFisicos.default(true),
  fichasVisiveis: camposDaCampanha.fichasVisiveis.default(false),
  agenda: camposDaCampanha.agenda.optional(),
  proximaSessao: camposDaCampanha.proximaSessao.optional(),
  /** Já cria o primeiro convite, na mesma transação. */
  convite: esquemaNovoConvite.optional(),
});

/** Editar: os mesmos campos, todos opcionais e sem padrão; mais encerrar ou reabrir o caso. */
export const esquemaEdicaoDeCampanha = z
  .object({ ...camposDaCampanha, encerrado: z.boolean() })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { error: 'Nada para mudar.' });

export type NovaCampanha = z.input<typeof esquemaNovaCampanha>;
export type EdicaoDeCampanha = z.input<typeof esquemaEdicaoDeCampanha>;

/** Em curso até o mestre encerrar. */
export type SituacaoDoCaso = 'em-curso' | 'encerrado';

/** Um caso na lista de casos de quem pediu. */
export interface CampanhaNaLista {
  id: string;
  numero: number | null;
  nome: string;
  gancho: string | null;
  papel: Papel;
  sistema: { id: string; nome: string; tipo: 'op2' | 'inventado' };
  /** Quem mestra. Nulo só se o mestre apagou a conta. */
  mestre: { id: string; nome: string } | null;
  situacao: SituacaoDoCaso;
  agenda: Agenda | null;
  proximaSessao: string | null;
  contagens: { jogadores: number };
}

export interface Membro {
  id: string;
  nome: string;
  papel: Papel;
}

/** Um caso aberto. `convites` só vem para o mestre. */
export interface CampanhaDetalhe extends CampanhaNaLista {
  tom: Tom;
  formato: Formato;
  nivelInicial: number;
  dtPadrao: number;
  rodadas: boolean;
  dadosFisicos: boolean;
  fichasVisiveis: boolean;
  membros: Membro[];
  convites?: ConviteDoMestre[];
}

/** Como o mestre vê um convite: com quem entrou por ele. */
export interface ConviteDoMestre {
  codigo: string;
  vagas: number;
  usados: number;
  expiraEm: string;
  expirado: boolean;
  entraram: { id: string; nome: string; entrouEm: string | null }[];
}
