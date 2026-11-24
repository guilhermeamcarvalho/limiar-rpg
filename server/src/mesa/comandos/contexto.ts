// O que cada tratador de comando recebe. O tratador confere a permissão (shared/permissoes.ts),
// muda o rascunho do estado e devolve os eventos; se recusar, lança `Recusa` e nada muda.
import type {
  CampanhaComMembros,
  ComandoValidado,
  EstadoDaMesa,
  EventoDaMesaSemSeq,
  TipoDeComando,
} from '@membrana/shared';

/** Recusa esperada: a mensagem vai, em português, para quem mandou o comando. */
export class Recusa extends Error {
  override name = 'Recusa';
}

export interface Contexto {
  quem: { id: string };
  campanha: CampanhaComMembros;
  /** Cópia do estado: o tratador muda à vontade; só vira o estado se não houver recusa. */
  estado: EstadoDaMesa;
  /** O dono do personagem, se o personagem for deste caso. */
  personagem: (personagemId: string) => { donoId: string } | null;
}

export type ComandoDo<T extends TipoDeComando> = Extract<ComandoValidado, { type: T }>;

export type Tratador<T extends TipoDeComando> = (
  ctx: Contexto,
  comando: ComandoDo<T>,
) => EventoDaMesaSemSeq[];

export type Tratadores = { [T in TipoDeComando]?: Tratador<T> };
