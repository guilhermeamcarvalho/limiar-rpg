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

// A faixa de cada valor (um d10 vai de 1 a 10) é conferida pela regra, que sabe qual dado é qual e
// devolve a mensagem no campo certo. Aqui só se recusa o que nem é um número de dado.
const numeroDeDado = z
  .int({ error: 'Informe um número inteiro.' })
  .min(0, { error: 'Informe um número de 1 para cima.' })
  .max(99, { error: 'Informe um número até 99.' });

export const VEREDITOS = ['sucesso', 'falha', 'critico', 'falhaCritica'] as const;

/**
 * POST /personagens/:id/testes/informado: o teste com dados físicos (o `test.report` da mesa). O
 * pedido é o mesmo do teste virtual, mais o que o jogador rolou na mão.
 */
export const esquemaTesteInformado = esquemaPedidoDeTeste
  .extend({
    resultado: z.discriminatedUnion(
      'modo',
      [
        /** "Informar os dados": um valor por dado, na ordem atributo, perícia e extras. */
        z
          .object({
            modo: z.literal('dados'),
            valores: z.array(numeroDeDado).min(1).max(4, { error: 'No máximo 4 dados.' }),
          })
          .strict(),
        /** "Só o resultado": o veredito e, se o teste pedir, a soma, o maior e o menor. */
        z
          .object({
            modo: z.literal('veredito'),
            veredito: z.enum(VEREDITOS, { error: 'Diga como foi o teste.' }),
            soma: numeroDeDado.optional(),
            maior: numeroDeDado.optional(),
            menor: numeroDeDado.optional(),
          })
          .strict(),
      ],
      { error: 'Informe os dados ou só o resultado.' },
    ),
    /** Na falha crítica: o d8 da tabela e, em Acidente e Frustração, o d4 da perda. */
    falhaCritica: z.object({ d8: numeroDeDado, d4: numeroDeDado.optional() }).strict().optional(),
  })
  .strict();
export type TesteInformado = z.input<typeof esquemaTesteInformado>;

/** Quem rolou: o app (virtual) ou o jogador, que informou os valores (físico). */
export type OrigemDoTeste = 'virtual' | 'fisico';

/** Um teste no histórico da ficha ou da mesa. */
export interface RegistroDeTeste {
  id: string;
  personagemId: string;
  /** Nome na ficha na hora do teste; opcional para registros antigos. */
  personagemNome?: string | undefined;
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
