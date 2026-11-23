// O teste de uma perícia a partir da ficha, com tudo o que ele mexe: gasta o Ímpeto e as
// habilidades pedidas, rola, aplica a falha crítica e enche o Ímpeto na falha. O servidor chama
// esta função para o resultado oficial (com o sorteio criptográfico) e grava a ficha que ela
// devolve; nada aqui decide pela tela. Referência: docs/regras-do-jogo.md, "Como funciona um teste".
import { IMPETO_MAXIMO, type FichaOp2 } from '../../schemas/ficha-op2.ts';
import { ErroDeRegra, rolar, type Rng } from '../dados.ts';
import {
  aplicarFalhaCritica,
  TABELA_FALHA_CRITICA,
  type EfeitoDeFalhaCritica,
} from './falha-critica.ts';
import { montarTeste } from './ficha.ts';
import { gastarImpetoNoTeste, registrarResultadoNoImpeto } from './impeto.ts';
import { aplicarModificador, HABILIDADES_OP2, type Habilidade } from './modificadores.ts';
import type { PericiaOp2 } from './pericias.ts';
import {
  resolverTeste,
  resolverTesteInformado,
  resolverTesteSoVeredito,
  type ResultadoDeTeste,
  type TesteOp2,
  type VereditoInformado,
} from './teste.ts';

export interface PedidoDeTesteOp2 {
  periciaId: PericiaOp2;
  /** Sem ela, a DT padrão. */
  dt?: number | undefined;
  /** Um aliado ajuda: a perícia sobe um passo. */
  ajuda?: boolean | undefined;
  /** Gasta 1 de Ímpeto para somar um d4. */
  impeto?: boolean | undefined;
  /** Ids das habilidades usadas neste teste, como "gambiarra". */
  habilidades?: readonly string[] | undefined;
}

/** O efeito da falha crítica, com o d4 da perda quando houve. */
export interface FalhaCriticaDoTeste extends EfeitoDeFalhaCritica {
  d4?: number;
}

export interface TesteDaFicha {
  /** A ficha depois do teste: Ímpeto, PV, habilidades usadas e efeitos já aplicados. */
  ficha: FichaOp2;
  teste: TesteOp2;
  resultado: ResultadoDeTeste;
  falhaCritica: FalhaCriticaDoTeste | null;
  /** O que mudou na ficha, como a tela e o histórico contam: "Gambiarra usada: −2 PV." */
  efeitos: string[];
}

/** "Gambiarra usada: −2 PV.", ou só "Reflexo usada." quando a habilidade não custa nada. */
export function textoDoUso(hab: Pick<Habilidade, 'nome' | 'custo'>): string {
  const partes: string[] = [];
  if (hab.custo.pv) partes.push(`−${String(hab.custo.pv)} PV`);
  if (hab.custo.pd) partes.push(`−${String(hab.custo.pd)} PD`);
  return partes.length > 0 ? `${hab.nome} usada: ${partes.join(', ')}.` : `${hab.nome} usada.`;
}

/** A linha "Perda" (d8 = 7) da tabela de falha crítica. */
const PERDA = TABELA_FALHA_CRITICA[6];

/** O teste montado, com o Ímpeto e as habilidades já gastos, antes de rolar. */
export interface TestePreparado {
  ficha: FichaOp2;
  teste: TesteOp2;
  efeitos: string[];
}

/**
 * Monta o teste do pedido e já gasta o Ímpeto e as habilidades. A ficha usa para saber quais dados
 * pedir no modo físico; o resto do teste sai de `testarPericia` e `registrarTesteInformado`.
 */
export function prepararTeste(ficha: FichaOp2, pedido: PedidoDeTesteOp2): TestePreparado {
  let atual = ficha;
  let teste = montarTeste(ficha, pedido.periciaId, {
    ...(pedido.dt !== undefined && { dt: pedido.dt }),
    ajuda: pedido.ajuda ?? false,
  });
  const efeitos: string[] = [];

  if (pedido.impeto) {
    const gasto = gastarImpetoNoTeste(atual);
    atual = gasto.ficha;
    teste = { ...teste, extras: [...teste.extras, gasto.extra] };
    efeitos.push('Ímpeto gasto: +d4.');
  }

  for (const id of new Set(pedido.habilidades ?? [])) {
    const hab = HABILIDADES_OP2.find((h) => h.id === id);
    if (!hab) throw new ErroDeRegra('habilidades', `Habilidade desconhecida: ${id}.`);
    ({ ficha: atual, teste } = aplicarModificador(atual, teste, hab));
    efeitos.push(textoDoUso(hab));
  }

  return { ficha: atual, teste, efeitos };
}

/** Acidente (5) e Frustração (6) pedem o d4 da perda. */
export const pedeD4 = (d8: number): boolean => d8 === 5 || d8 === 6;

/**
 * Depois de rolar: aplica a falha crítica (com o d8 e o d4 que `dadosDaFalha` der) e enche o
 * Ímpeto na falha. Vale igual para o sorteio e para os dados físicos.
 */
function concluirTeste(
  { ficha, teste, efeitos }: TestePreparado,
  resultado: ResultadoDeTeste,
  dadosDaFalha: () => { d8: number; d4?: number | undefined },
): TesteDaFicha {
  let atual = ficha;
  let falhaCritica: FalhaCriticaDoTeste | null = null;
  if (resultado.veredito === 'falhaCritica') {
    const { d8, d4 } = dadosDaFalha();
    if (d8 === PERDA.d8 && atual.itens.length > 0) {
      // Quem perde escolhe o item: a ficha fica como está e a pessoa risca um na aba Itens.
      falhaCritica = { ...PERDA, descricao: 'Perde um item: escolha qual tirar na aba Itens.' };
    } else {
      const perda = pedeD4(d8) ? d4 : undefined;
      const aplicada = aplicarFalhaCritica(atual, d8, perda === undefined ? {} : { d4: perda });
      atual = aplicada.ficha;
      falhaCritica = perda === undefined ? aplicada.efeito : { ...aplicada.efeito, d4: perda };
    }
    efeitos.push(`Falha crítica (${falhaCritica.nome}): ${falhaCritica.descricao}`);
  }

  const impetoAntes = atual.impeto;
  atual = registrarResultadoNoImpeto(atual, resultado.veredito);
  if (atual.impeto > impetoAntes) {
    efeitos.push(`Ímpeto +1 (${String(atual.impeto)}/${String(IMPETO_MAXIMO)}).`);
  }

  return { ficha: atual, teste, resultado, falhaCritica, efeitos };
}

export function testarPericia(ficha: FichaOp2, pedido: PedidoDeTesteOp2, rng: Rng): TesteDaFicha {
  const preparado = prepararTeste(ficha, pedido);
  const resultado = resolverTeste(preparado.teste, rng);
  return concluirTeste(preparado, resultado, () => {
    const d8 = rolar('d8', rng);
    return pedeD4(d8) ? { d8, d4: rolar('d4', rng) } : { d8 };
  });
}

/** O que o jogador informa depois de rolar na mão (dados físicos). */
export interface RelatoDeTesteOp2 {
  /** Os valores de cada dado, na ordem de `dadosDoTeste`, ou só o veredito. */
  resultado: { modo: 'dados'; valores: number[] } | ({ modo: 'veredito' } & VereditoInformado);
  /** Na falha crítica: o d8 da tabela e, em Acidente e Frustração, o d4 da perda. */
  falhaCritica?: { d8: number; d4?: number | undefined } | undefined;
}

/**
 * O teste com dados físicos: o jogador rolou e informa os valores (ou só o veredito). Gasta o
 * Ímpeto e as habilidades, aplica a falha crítica com o d8 e o d4 informados e enche o Ímpeto,
 * igual ao teste rolado pelo servidor (RF-87).
 */
export function registrarTesteInformado(
  ficha: FichaOp2,
  pedido: PedidoDeTesteOp2,
  relato: RelatoDeTesteOp2,
): TesteDaFicha {
  const preparado = prepararTeste(ficha, pedido);
  const resultado =
    relato.resultado.modo === 'dados'
      ? resolverTesteInformado(preparado.teste, relato.resultado.valores)
      : resolverTesteSoVeredito(preparado.teste, relato.resultado);

  const falha = relato.falhaCritica;
  if (resultado.veredito !== 'falhaCritica') {
    if (falha) throw new ErroDeRegra('falhaCritica', 'Só a falha crítica pede o d8 da tabela.');
  } else {
    if (!falha) {
      throw new ErroDeRegra('falhaCritica.d8', 'Falha crítica: role o d8 e informe o resultado.');
    }
    if (!Number.isInteger(falha.d8) || falha.d8 < 1 || falha.d8 > 8) {
      throw new ErroDeRegra('falhaCritica.d8', 'O d8 vai de 1 a 8.');
    }
    if (pedeD4(falha.d8)) {
      const d4 = falha.d4;
      if (d4 === undefined) {
        throw new ErroDeRegra('falhaCritica.d4', 'Este efeito pede o d4: role e informe o valor.');
      }
      if (!Number.isInteger(d4) || d4 < 1 || d4 > 4) {
        throw new ErroDeRegra('falhaCritica.d4', 'O d4 vai de 1 a 4.');
      }
    }
  }
  return concluirTeste(preparado, resultado, () => falha as NonNullable<typeof falha>);
}
