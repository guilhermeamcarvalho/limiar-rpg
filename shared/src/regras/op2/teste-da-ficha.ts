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
import { resolverTeste, type ResultadoDeTeste, type TesteOp2 } from './teste.ts';

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

export function testarPericia(ficha: FichaOp2, pedido: PedidoDeTesteOp2, rng: Rng): TesteDaFicha {
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

  const resultado = resolverTeste(teste, rng);

  let falhaCritica: FalhaCriticaDoTeste | null = null;
  if (resultado.veredito === 'falhaCritica') {
    const d8 = rolar('d8', rng);
    if (d8 === PERDA.d8 && atual.itens.length > 0) {
      // Quem perde escolhe o item: a ficha fica como está e a pessoa risca um na aba Itens.
      falhaCritica = { ...PERDA, descricao: 'Perde um item: escolha qual tirar na aba Itens.' };
    } else {
      const d4 = d8 === 5 || d8 === 6 ? rolar('d4', rng) : undefined;
      const aplicada = aplicarFalhaCritica(atual, d8, d4 === undefined ? {} : { d4 });
      atual = aplicada.ficha;
      falhaCritica = d4 === undefined ? aplicada.efeito : { ...aplicada.efeito, d4 };
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
