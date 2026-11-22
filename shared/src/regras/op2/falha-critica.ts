// Falha crítica: o jogador rola 1d8 na tabela. A mesma função vale na ficha, na mesa e no
// celular, para o efeito ser sempre o mesmo. Referência: docs/regras-do-jogo.md, "Falha crítica".
import type { FichaOp2 } from '../../schemas/ficha-op2.ts';
import { ErroDeRegra } from '../dados.ts';
import { adicionarModificador } from './passos.ts';
import type { AtributoOp2 } from './pericias.ts';

export interface EfeitoDeFalhaCritica {
  d8: number;
  nome: string;
  /** Como a tela e o histórico contam o que aconteceu. */
  descricao: string;
}

export const TABELA_FALHA_CRITICA = [
  { d8: 1, nome: 'Vexame', descricao: 'Vexame: nada muda na ficha, só no orgulho.' },
  { d8: 2, nome: 'Machucado', descricao: 'Físico desce um passo até o fim da cena.' },
  { d8: 3, nome: 'Desatenção', descricao: 'Mente desce um passo até o fim da cena.' },
  { d8: 4, nome: 'Irritação', descricao: 'Emoção desce um passo até o fim da cena.' },
  { d8: 5, nome: 'Acidente', descricao: 'Perde d4 PV.' },
  { d8: 6, nome: 'Frustração', descricao: 'Perde d4 PD.' },
  { d8: 7, nome: 'Perda', descricao: 'Perde um item.' },
  { d8: 8, nome: 'Sem efeito', descricao: 'Nada acontece.' },
] as const satisfies readonly EfeitoDeFalhaCritica[];

const ATRIBUTO_DO_EFEITO: Partial<Record<number, AtributoOp2>> = {
  2: 'fisico',
  3: 'mente',
  4: 'emocao',
};

function validarDado(campo: 'd8' | 'd4', valor: number | undefined, faces: number): number {
  if (valor === undefined) {
    throw new ErroDeRegra(campo, `Este efeito pede o ${campo}: role e informe o valor.`);
  }
  if (!Number.isInteger(valor) || valor < 1 || valor > faces) {
    throw new ErroDeRegra(campo, `O ${campo} vai de 1 a ${String(faces)}.`);
  }
  return valor;
}

export interface OpcoesDeFalhaCritica {
  /** Acidente (5) e Frustração (6) pedem o d4 da perda. */
  d4?: number;
  /** Perda (7): o item que se foi. Obrigatório se a ficha tiver algum item. */
  itemId?: string;
}

/**
 * Aplica o efeito do d8 à ficha. Devolve a ficha nova (a original não muda) e o efeito, com a
 * descrição do que aconteceu. PV e PD param em 0.
 */
export function aplicarFalhaCritica(
  ficha: FichaOp2,
  d8: number,
  opcoes: OpcoesDeFalhaCritica = {},
): { ficha: FichaOp2; efeito: EfeitoDeFalhaCritica } {
  const valor = validarDado('d8', d8, 8);
  const linha = TABELA_FALHA_CRITICA[valor - 1] as EfeitoDeFalhaCritica;
  const efeito = { ...linha };

  const atributo = ATRIBUTO_DO_EFEITO[valor];
  if (atributo) {
    return {
      ficha: adicionarModificador(ficha, {
        alvo: atributo,
        passos: -1,
        origem: `${linha.nome} (falha crítica)`,
        duracao: 'cena',
      }),
      efeito,
    };
  }

  if (valor === 5 || valor === 6) {
    const perda = validarDado('d4', opcoes.d4, 4);
    const recurso = valor === 5 ? 'pv' : 'pd';
    const nome = valor === 5 ? 'PV' : 'PD';
    return {
      ficha: { ...ficha, [recurso]: Math.max(0, ficha[recurso] - perda) },
      efeito: { ...efeito, descricao: `Perde ${String(perda)} ${nome}.` },
    };
  }

  if (valor === 7) {
    if (ficha.itens.length === 0) {
      return {
        ficha,
        efeito: { ...efeito, descricao: 'Perderia um item, mas não carrega nenhum.' },
      };
    }
    const item = ficha.itens.find((i) => i.id === opcoes.itemId);
    if (!item) throw new ErroDeRegra('itemId', 'Escolha o item que foi perdido.');
    return {
      ficha: { ...ficha, itens: ficha.itens.filter((i) => i.id !== item.id) },
      efeito: { ...efeito, descricao: `Perde ${item.nome}.` },
    };
  }

  // 1 (Vexame) e 8 (Sem efeito): a ficha fica como está.
  return { ficha, efeito };
}
