// O que cada tratador de comando recebe. O tratador confere a permissão (shared/permissoes.ts),
// muda o rascunho do estado e devolve os eventos; se recusar, lança `Recusa` e nada muda.
import type {
  CampanhaComMembros,
  ComandoValidado,
  EstadoDaMesa,
  EventoDaMesaSemSeq,
  RegistroDeTeste,
  Rng,
  TipoDeComando,
} from '@membrana/shared';
import type {
  ConteudoDoMapa,
  EntradaDeTesteDaMesa,
  FichaNoCaso,
  PersonagemDoGrupo,
} from '../dados.ts';

/** Recusa esperada: a mensagem vai, em português, para quem mandou o comando. */
export class Recusa extends Error {
  override name = 'Recusa';
}

export interface Contexto {
  quem: { id: string };
  campanha: CampanhaComMembros;
  /** Cópia do estado: o tratador muda à vontade; só vira o estado se não houver recusa. */
  estado: EstadoDaMesa;
  /** O sorteio oficial dos dados (criptográfico no app; semente fixa nos testes). */
  sorteio: Rng;
  /** O dono do personagem, se o personagem for deste caso. */
  personagem: (personagemId: string) => { donoId: string } | null;
  /** Os personagens que o grupo usa neste caso (para "Trazer o grupo"). */
  grupo: () => PersonagemDoGrupo[];
  /** Um mapa deste caso, como está salvo (com tokens, props e breu); ou nulo. */
  mapa: (mapaId: string) => ConteudoDoMapa | null;
  /** A ficha e as regras do caso para rodar um teste pela mesa. */
  fichaNoCaso: (personagemId: string) => FichaNoCaso | null;
  /** Persiste a ficha atualizada e o registro do teste oficial. */
  gravarTeste: (entrada: EntradaDeTesteDaMesa) => RegistroDeTeste;
}

export type ComandoDo<T extends TipoDeComando> = Extract<ComandoValidado, { type: T }>;

export type Tratador<T extends TipoDeComando> = (
  ctx: Contexto,
  comando: ComandoDo<T>,
) => EventoDaMesaSemSeq[];

export type Tratadores = { [T in TipoDeComando]?: Tratador<T> };

/** Tokens, props e breu são de um mapa: sem mapa na mesa, não há onde pôr. */
export function exigirMapa(ctx: Contexto) {
  if (!ctx.estado.mapa) throw new Recusa('Ponha um mapa na mesa antes.');
  return ctx.estado.mapa;
}
