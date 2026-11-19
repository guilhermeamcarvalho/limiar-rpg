// Campanha (caso): o que se pode enviar ao criar e ao editar, e o que a API devolve.
import { z } from 'zod';
import type { Papel } from '../permissoes.ts';

const quando = z.iso
  .datetime({ offset: true, error: 'Use uma data e hora válidas.' })
  .transform((s) => new Date(s));

export const esquemaNovaCampanha = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Dê um nome ao caso.' })
    .max(80, { error: 'Use até 80 caracteres.' }),
  gancho: z.string().trim().max(280, { error: 'Use até 280 caracteres.' }).optional(),
  /** Ordem Paranormal II por padrão. */
  sistemaId: z.string().min(1).default('sys_op2'),
  rodadas: z.boolean().default(true),
  proximaSessao: quando.nullable().optional(),
});

/** Editar: os mesmos campos, todos opcionais. */
export const esquemaEdicaoDeCampanha = esquemaNovaCampanha
  .partial()
  .refine((d) => Object.keys(d).length > 0, { error: 'Nada para mudar.' });

export type NovaCampanha = z.input<typeof esquemaNovaCampanha>;
export type EdicaoDeCampanha = z.input<typeof esquemaEdicaoDeCampanha>;

/** Um caso na lista de casos de quem pediu. */
export interface CampanhaNaLista {
  id: string;
  numero: number | null;
  nome: string;
  gancho: string | null;
  papel: Papel;
  sistema: { id: string; nome: string; tipo: 'op2' | 'inventado' };
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
  rodadas: boolean;
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
