// Personagens: o corpo das rotas e o que elas devolvem. A ficha em si é validada pelo schema do
// sistema (hoje só Ordem Paranormal II); aqui ela entra como `unknown` para o servidor responder
// 422 com o campo errado da ficha, separado de um pedido mal montado (400).
import { z } from 'zod';
import { esquemaFichaOp2, type FichaOp2 } from './ficha-op2.ts';

const id = z.string().trim().min(1).max(40);

export const esquemaNovoPersonagem = z
  .object({
    /** O caso a que o personagem pertence. Sem ele, fica só na lista de quem criou. */
    campanhaId: id.nullable().optional(),
    /** Sem campanha, diz o sistema da ficha; com campanha, vale o sistema dela. */
    sistemaId: id.optional(),
    /** Com campanha: já vira o personagem de quem criou naquele caso (meu-personagem). */
    usarNoCaso: z.boolean().optional(),
    ficha: z.unknown(),
  })
  .strict();
export type NovoPersonagem = z.input<typeof esquemaNovoPersonagem>;

export const esquemaEdicaoDePersonagem = z.object({ ficha: z.unknown() }).strict();
export type EdicaoDePersonagem = z.input<typeof esquemaEdicaoDePersonagem>;

/** PUT /campanhas/:id/meu-personagem. `null` deixa a pessoa sem personagem neste caso. */
export const esquemaMeuPersonagem = z.object({ personagemId: id.nullable() }).strict();
export type MeuPersonagem = z.input<typeof esquemaMeuPersonagem>;

/** O schema da ficha de cada tipo de sistema. RPG inventado ainda não tem ficha. */
export function esquemaDaFicha(tipo: 'op2' | 'inventado') {
  return tipo === 'op2' ? esquemaFichaOp2 : null;
}

export interface Personagem {
  id: string;
  donoId: string;
  campanhaId: string | null;
  sistemaId: string;
  ficha: FichaOp2;
  /** Nome do arquivo enviado, ou nulo. Os uploads chegam na Fase 2. */
  foto: string | null;
  tokenImg: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Um personagem na página Personagens: com o caso, o sistema e se está em uso no caso. */
export interface PersonagemNaLista extends Personagem {
  sistema: { id: string; nome: string; tipo: 'op2' | 'inventado' };
  campanha: { id: string; nome: string; encerrado: boolean } | null;
  /** É o personagem que o dono escolheu para jogar no caso dele (meu-personagem). */
  emUso: boolean;
}

/** O personagem que a pessoa usa num caso, como o caso o mostra. */
export interface PersonagemEmUso {
  id: string;
  nome: string;
}

/**
 * Evento da mesa quando uma ficha muda (criada, editada ou removida). Leva só os ids: na Fase 2
 * cada pessoa da sala busca a ficha de novo, e o servidor decide se ela pode ver.
 */
export interface EventoPersonagemMudou {
  type: 'character.changed';
  campanhaId: string;
  personagemId: string;
  removido: boolean;
}
