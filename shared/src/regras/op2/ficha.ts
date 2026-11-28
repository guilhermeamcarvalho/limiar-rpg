// A ponte entre a ficha e as regras: monta o teste de uma perícia e calcula PV e PD máximos.
import { DT_PADRAO } from '../../schemas/campanha.ts';
import type { FichaOp2, ItemDaFicha } from '../../schemas/ficha-op2.ts';
import { faces } from '../dados.ts';
import { idDoTexto } from './modificadores.ts';
import { dadoEfetivo, mudarPasso } from './passos.ts';
import { atributoDaPericia, type PericiaOp2 } from './pericias.ts';
import type { TesteOp2 } from './teste.ts';

export interface OpcoesDeRecursos {
  nivel?: number;
  ocupacao?: string;
  ajustePvPd?: number;
}

/**
 * Ordem 2 (p. 10): PV = 4 + faces(Físico); PD = 24 - PV no nível 1, com ajuste opcional de ±2
 * entre PV e PD. A cada nível após o 1º, +2 pontos distribuídos (padrão +1 PV / +1 PD).
 * Ocultista começa com -2 PD.
 */
export function maximosDeRecursos(
  atributos: FichaOp2['atributos'],
  { nivel = 1, ocupacao = '', ajustePvPd = 0 }: OpcoesDeRecursos = {},
): {
  pvMax: number;
  pdMax: number;
} {
  const ajuste = Math.min(2, Math.max(-2, ajustePvPd));
  const niveisExtras = Math.max(0, nivel - 1);
  const bonusPvNivel = Math.floor(niveisExtras);
  const bonusPdNivel = Math.ceil(niveisExtras);
  const ocultista = idDoTexto(ocupacao) === 'ocultista' ? 2 : 0;

  const pvBase = 4 + faces(atributos.fisico) + ajuste;
  const pdBase = 24 - (4 + faces(atributos.fisico)) - ajuste;

  return {
    pvMax: Math.max(1, pvBase + bonusPvNivel),
    pdMax: Math.max(1, pdBase + bonusPdNivel - ocultista),
  };
}

/**
 * Espaços para itens (Ordem 2, p. 18): 5 + faces(Físico) (d6 → 11, d8 → 13, d10 → 15).
 * Passar do limite deixa sobrecarregado; passar do dobro impede movimento.
 */
export function espacosDeItens(atributos: FichaOp2['atributos']): number {
  return 5 + faces(atributos.fisico);
}

/** Soma dos espaços ocupados pelos itens (padrão 1 se o item for antigo sem o campo). */
export function espacosOcupados(itens: readonly Pick<ItemDaFicha, 'espacos'>[]): number {
  return itens.reduce((soma, item) => soma + item.espacos, 0);
}

export function estaSobrecarregado(ficha: Pick<FichaOp2, 'atributos' | 'itens'>): boolean {
  return espacosOcupados(ficha.itens) > espacosDeItens(ficha.atributos);
}

export function imobilizadoPorCarga(ficha: Pick<FichaOp2, 'atributos' | 'itens'>): boolean {
  return espacosOcupados(ficha.itens) > espacosDeItens(ficha.atributos) * 2;
}

export interface OpcoesDoTeste {
  /** DT pedida pelo mestre; sem ela, a padrão (7). */
  dt?: number;
  /** Um aliado ajuda: +1 passo em perícia d4..d8, ou +2 passos em d10..d12 (Ordem 2, p. 26). */
  ajuda?: boolean;
}

/** O teste de uma perícia da ficha, já com os modificadores da cena aplicados. */
export function montarTeste(
  ficha: FichaOp2,
  periciaId: PericiaOp2,
  { dt = DT_PADRAO, ajuda = false }: OpcoesDoTeste = {},
): TesteOp2 {
  const pericia = dadoEfetivo(ficha, periciaId);
  const passoAjuda = pericia === 'd10' || pericia === 'd12' ? 2 : 1;
  return {
    atributo: dadoEfetivo(ficha, atributoDaPericia(periciaId)),
    pericia: ajuda ? mudarPasso(pericia, passoAjuda) : pericia,
    extras: [],
    dt,
    periciaId,
  };
}
