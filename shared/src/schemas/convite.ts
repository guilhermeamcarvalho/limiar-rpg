// Convite: criar (mestre) e ver (qualquer um com o código). O formato do código está em codigo.ts.
import { z } from 'zod';

export const esquemaNovoConvite = z.object({
  vagas: z
    .int({ error: 'Diga quantas vagas.' })
    .min(1, { error: 'Pelo menos 1 vaga.' })
    .max(20, { error: 'No máximo 20 vagas.' })
    .default(4),
  expiraEmDias: z
    .int({ error: 'Diga em quantos dias o convite expira.' })
    .min(1, { error: 'Pelo menos 1 dia.' })
    .max(30, { error: 'No máximo 30 dias.' })
    .default(7),
});

export type NovoConvite = z.input<typeof esquemaNovoConvite>;

export type EstadoDoConvite = 'valido' | 'expirado' | 'esgotado';

/** O que aparece no cartão de convite, para quem tem o código. */
export interface ConvitePublico {
  codigo: string;
  estado: EstadoDoConvite;
  vagasRestantes: number;
  campanha: { id: string; numero: number | null; nome: string; gancho: string | null };
  mestre: { nome: string };
  sistema: { nome: string };
  proximaSessao: string | null;
  /** Só vem para quem está logado: se já está no caso. */
  jaParticipa?: boolean;
}
