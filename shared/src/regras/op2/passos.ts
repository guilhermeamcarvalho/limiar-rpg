// Passos de dado: d4 → d6 → d8 → d10 → d12. Subir ou descer troca o dado, sem passar dos limites.
// Efeitos temporários (Machucado, Ímpeto) ficam na ficha como modificadores e somem no fim da cena.
import type { AlvoDePasso, FichaOp2, ModificadorTemporario } from '../../schemas/ficha-op2.ts';
import { DADOS } from '../../sistemas.ts';
import type { Dado } from '../dados.ts';
import { IDS_DOS_ATRIBUTOS_OP2, type AtributoOp2 } from './pericias.ts';

/** Sobe ou desce `n` passos, parando em d4 e em d12. */
export function mudarPasso(dado: Dado, n: number): Dado {
  const atual = DADOS.indexOf(dado);
  const novo = Math.min(Math.max(atual + n, 0), DADOS.length - 1);
  return DADOS[novo] as Dado;
}

/** d6 → d8; d12 continua d12. */
export const subirPasso = (dado: Dado): Dado => mudarPasso(dado, 1);

/** d6 → d4; d4 continua d4. */
export const descerPasso = (dado: Dado): Dado => mudarPasso(dado, -1);

const ehAtributo = (alvo: AlvoDePasso): alvo is AtributoOp2 =>
  (IDS_DOS_ATRIBUTOS_OP2 as readonly string[]).includes(alvo);

/** O dado de um atributo ou perícia já com os modificadores da cena aplicados. */
export function dadoEfetivo(ficha: FichaOp2, alvo: AlvoDePasso): Dado {
  const base = ehAtributo(alvo) ? ficha.atributos[alvo] : ficha.pericias[alvo];
  const passos = ficha.modificadores
    .filter((m) => m.alvo === alvo)
    .reduce((soma, m) => soma + m.passos, 0);
  return mudarPasso(base, passos);
}

export function adicionarModificador(ficha: FichaOp2, mod: ModificadorTemporario): FichaOp2 {
  return { ...ficha, modificadores: [...ficha.modificadores, mod] };
}

/**
 * Fim da cena: desfaz o que durava "até o fim da cena" (modificadores, atributo do Ímpeto) e
 * libera de novo as habilidades de uma vez por cena.
 */
export function fimDaCena(ficha: FichaOp2): FichaOp2 {
  return {
    ...ficha,
    // Hoje todo modificador dura até o fim da cena; com outra duração, filtrar aqui.
    modificadores: [],
    impetoAtributo: null,
    usadasNaCena: [],
  };
}
