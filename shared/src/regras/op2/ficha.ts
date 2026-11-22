// A ponte entre a ficha e as regras: monta o teste de uma perícia e calcula PV e PD máximos.
import { DT_PADRAO } from '../../schemas/campanha.ts';
import type { FichaOp2 } from '../../schemas/ficha-op2.ts';
import { CONFIG_OP2 } from '../../sistemas.ts';
import { faces } from '../dados.ts';
import { dadoEfetivo, subirPasso } from './passos.ts';
import { atributoDaPericia, type PericiaOp2 } from './pericias.ts';
import type { TesteOp2 } from './teste.ts';

/**
 * PV = 4 + o máximo do dado de Físico; PD = máximo de Mente + máximo de Emoção. As fórmulas vêm
 * do config do sistema (CONFIG_OP2.recursos), não de números soltos aqui.
 */
export function maximosDeRecursos(atributos: FichaOp2['atributos']): {
  pvMax: number;
  pdMax: number;
} {
  const calcular = ({ base, somaMaximoDe }: { base: number; somaMaximoDe: string[] }) =>
    base +
    somaMaximoDe.reduce(
      (soma, id) => soma + faces(atributos[id as keyof FichaOp2['atributos']]),
      0,
    );
  return { pvMax: calcular(CONFIG_OP2.recursos.pv), pdMax: calcular(CONFIG_OP2.recursos.pd) };
}

export interface OpcoesDoTeste {
  /** DT pedida pelo mestre; sem ela, a padrão (7). */
  dt?: number;
  /** Um aliado ajuda: o dado da perícia sobe um passo. */
  ajuda?: boolean;
}

/** O teste de uma perícia da ficha, já com os modificadores da cena aplicados. */
export function montarTeste(
  ficha: FichaOp2,
  periciaId: PericiaOp2,
  { dt = DT_PADRAO, ajuda = false }: OpcoesDoTeste = {},
): TesteOp2 {
  const pericia = dadoEfetivo(ficha, periciaId);
  return {
    atributo: dadoEfetivo(ficha, atributoDaPericia(periciaId)),
    pericia: ajuda ? subirPasso(pericia) : pericia,
    extras: [],
    dt,
    periciaId,
  };
}
