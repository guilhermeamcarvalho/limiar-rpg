// Os dados a mais de um teste pela ficha: o d4 do Ímpeto e os das habilidades (Gambiarra). A
// pessoa "arma" o bônus no cartão dele; o teste seguinte leva o bônus se ele valer para a perícia.
// Quem decide de verdade é o servidor; aqui é a prévia e o pedido.
import {
  habilidadesDaFicha,
  montarTeste,
  nomeDaPericia,
  temImpeto,
  type Dado,
  type FichaOp2,
  type Habilidade,
  type PedidoDeTeste,
  type PericiaOp2,
} from '@membrana/shared';

export interface Armados {
  /** "Gastar 1 · +d4" ligado. */
  impeto: boolean;
  /** Ids das habilidades ligadas para o próximo teste. */
  habilidades: readonly string[];
}

export const NADA_ARMADO: Armados = { impeto: false, habilidades: [] };

/** Dá para usar agora: não foi usada nesta cena (se for de uma vez por cena) e há PV e PD. */
export function habilidadeDisponivel(ficha: FichaOp2, hab: Habilidade): boolean {
  const usada = hab.limite === 'cena' && ficha.usadasNaCena.includes(hab.id);
  return !usada && ficha.pv >= (hab.custo.pv ?? 0) && ficha.pd >= (hab.custo.pd ?? 0);
}

export interface BonusDaPericia {
  tipo: Dado;
  /** "Ímpeto", "Gambiarra". */
  origem: string;
  /** Vai no próximo teste desta perícia. Desligado: só está disponível. */
  armado: boolean;
  /** Id da habilidade (o Ímpeto não tem). */
  habilidade?: string;
}

/** Os bônus que aparecem na linha da perícia: o Ímpeto ligado e as habilidades que valem nela. */
export function bonusDaPericia(
  ficha: FichaOp2,
  periciaId: PericiaOp2,
  armados: Armados,
): BonusDaPericia[] {
  const bonus: BonusDaPericia[] = [];
  if (armados.impeto && temImpeto(ficha) && ficha.impeto >= 1) {
    bonus.push({ tipo: 'd4', origem: 'Ímpeto', armado: true });
  }
  for (const hab of habilidadesDaFicha(ficha)) {
    if (!hab.pericias.includes(periciaId) || !habilidadeDisponivel(ficha, hab)) continue;
    bonus.push({
      tipo: hab.dado,
      origem: hab.nome,
      armado: armados.habilidades.includes(hab.id),
      habilidade: hab.id,
    });
  }
  return bonus;
}

/** "d6 de atributo e d10 de perícia", "d6 de atributo, d10 de perícia e d4 de Gambiarra". */
function emLista(partes: string[]): string {
  return partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} e ${String(partes.at(-1))}`
    : partes.join('');
}

export interface OpcoesDaPrevia {
  dt: number;
  ajuda: boolean;
  armados: Armados;
}

/** A prévia do teste de uma perícia: os dados que vão rolar, já com a cena, a Ajuda e os bônus. */
export function previaDoTeste(ficha: FichaOp2, periciaId: PericiaOp2, opcoes: OpcoesDaPrevia) {
  const teste = montarTeste(ficha, periciaId, { dt: opcoes.dt, ajuda: opcoes.ajuda });
  const bonus = bonusDaPericia(ficha, periciaId, opcoes.armados);
  const armados = bonus.filter((b) => b.armado);
  const descricao = `Testar ${nomeDaPericia(periciaId)}: ${emLista([
    `${teste.atributo} de atributo`,
    `${teste.pericia} de perícia`,
    ...armados.map((b) => `${b.tipo} de ${b.origem}`),
  ])}`;
  const pedido: PedidoDeTeste = {
    periciaId,
    dt: opcoes.dt,
    ...(opcoes.ajuda && { ajuda: true }),
    ...(armados.some((b) => !b.habilidade) && { impeto: true }),
    ...(armados.some((b) => b.habilidade) && {
      habilidades: armados.flatMap((b) => (b.habilidade ? [b.habilidade] : [])),
    }),
  };
  return { teste, bonus, armados, descricao, pedido };
}

/**
 * Depois do teste: o Ímpeto desliga (vale para qualquer perícia, então foi gasto); a habilidade
 * que não valia para a perícia testada continua ligada.
 */
export function depoisDoTeste(armados: Armados, pedido: PedidoDeTeste): Armados {
  const usadas = pedido.habilidades ?? [];
  return { impeto: false, habilidades: armados.habilidades.filter((h) => !usadas.includes(h)) };
}
