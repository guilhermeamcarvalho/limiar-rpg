// Testes de perícia pela ficha: o pedido (POST /personagens/:id/testes) e o registro que fica no
// histórico. O servidor rola e aplica as consequências com regras/op2/teste-da-ficha.ts.
import { z } from 'zod';
import type { FalhaCriticaDoTeste } from '../regras/op2/teste-da-ficha.ts';
import { IDS_DAS_PERICIAS_OP2, type AtributoOp2, type PericiaOp2 } from '../regras/op2/pericias.ts';
import type { ResultadoDeTeste } from '../regras/op2/teste.ts';

export const esquemaPedidoDeTeste = z
  .object({
    periciaId: z.enum(IDS_DAS_PERICIAS_OP2, { error: 'Escolha uma das perícias da ficha.' }),
    /** Sem ela, vale a DT padrão do caso. */
    dt: z
      .int({ error: 'A DT precisa ser um número inteiro.' })
      .min(1, { error: 'A DT vai de 1 a 99.' })
      .max(99, { error: 'A DT vai de 1 a 99.' })
      .optional(),
    ajuda: z.boolean().optional(),
    /** Gasta 1 de Ímpeto (Executor) para somar um d4. */
    impeto: z.boolean().optional(),
    /** Habilidades usadas neste teste, como ["gambiarra"]. */
    habilidades: z.array(z.string().trim().min(1).max(40)).max(2).optional(),
  })
  .strict();
export type PedidoDeTeste = z.input<typeof esquemaPedidoDeTeste>;

/** Quem rolou: o app (virtual) ou o jogador, que informou os valores (físico). */
export type OrigemDoTeste = 'virtual' | 'fisico';

/** Um teste no histórico da ficha. */
export interface RegistroDeTeste {
  id: string;
  personagemId: string;
  /** O caso onde o teste aconteceu, se o personagem estava num. */
  campanhaId: string | null;
  /** Quem pediu o teste (o jogador ou o mestre). Nulo se a conta foi apagada. */
  autor: { id: string; nome: string } | null;
  periciaId: PericiaOp2;
  atributo: AtributoOp2;
  origem: OrigemDoTeste;
  resultado: ResultadoDeTeste;
  falhaCritica: FalhaCriticaDoTeste | null;
  /** O que mudou na ficha: "Gambiarra usada: −2 PV.", "Ímpeto +1 (2/3)." */
  efeitos: string[];
  /** ISO. */
  em: string;
}
