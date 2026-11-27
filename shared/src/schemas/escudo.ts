// Notas, relógios e segredos do Escudo do mestre (#92, #93). Só o mestre lê e edita.
import { z } from 'zod';

export interface BlocoDoEscudo {
  id: string;
  titulo: string;
  texto: string;
}

export interface RelogioDoEscudo {
  id: string;
  titulo: string;
  segmentos: number;
  preenchidos: number;
}

export interface SegredoDoEscudo {
  id: string;
  titulo: string;
  texto: string;
  reveladoNaSessao: string | null;
}

export interface NotasDoEscudo {
  regras: BlocoDoEscudo[];
  ameacas: BlocoDoEscudo[];
  relogios: RelogioDoEscudo[];
  segredos: SegredoDoEscudo[];
}

const textoId = z.string().trim().min(1).max(64);
const tituloCurto = z.string().trim().min(1, { error: 'Escreva um título.' }).max(120);
const textoBloco = z.string().max(4000);

export const esquemaBlocoDoEscudo = z.object({
  id: textoId,
  titulo: tituloCurto,
  texto: textoBloco,
});

export const esquemaRelogioDoEscudo = z
  .object({
    id: textoId,
    titulo: tituloCurto,
    segmentos: z.number().int().min(2).max(12),
    preenchidos: z.number().int().min(0).max(12),
  })
  .refine((r) => r.preenchidos <= r.segmentos, {
    error: 'Os segmentos preenchidos não podem passar do total.',
    path: ['preenchidos'],
  });

export const esquemaSegredoDoEscudo = z.object({
  id: textoId,
  titulo: tituloCurto,
  texto: textoBloco,
  reveladoNaSessao: z.string().trim().min(1).max(40).nullable(),
});

export const esquemaNotasDoEscudo = z.object({
  regras: z.array(esquemaBlocoDoEscudo).max(40),
  ameacas: z.array(esquemaBlocoDoEscudo).max(60),
  relogios: z.array(esquemaRelogioDoEscudo).max(20),
  segredos: z.array(esquemaSegredoDoEscudo).max(60),
});

export function modeloPadraoDoEscudo(): NotasDoEscudo {
  return {
    regras: [
      {
        id: 'reg_dt',
        titulo: 'Dificuldades de referência',
        texto:
          'Fácil 5 · Padrão 7 · Difícil 10 · Muito difícil 13. Sucesso crítico com 3+ acima da DT.',
      },
      {
        id: 'reg_impeto',
        titulo: 'Ímpeto e Gambiarra',
        texto: 'Ímpeto soma +1d6 antes de rolar. Gambiarra troca o atributo ou pede esforço extra.',
      },
    ],
    ameacas: [
      {
        id: 'amc_1',
        titulo: 'Vulto na estática',
        texto: 'Reage a som alto. Aparência distorce perto de microfones ligados.',
      },
    ],
    relogios: [
      {
        id: 'rel_1',
        titulo: 'A Membrana afina',
        segmentos: 6,
        preenchidos: 0,
      },
    ],
    segredos: [
      {
        id: 'seg_1',
        titulo: 'O transmissor nunca foi desligado',
        texto: 'A fita de 1998 ainda roda em loop no porão.',
        reveladoNaSessao: null,
      },
    ],
  };
}
