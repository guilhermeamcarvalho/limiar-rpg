// Ímpeto, a habilidade do Executor. Uma barra de 3 espaços: cada teste que falha enche um.
// Gaste 1 para somar um d4 ao próximo teste, ou 3 para subir um atributo um passo até o fim da
// cena. Referência: docs/regras-do-jogo.md, "Perfis e ocupações".
import { IMPETO_MAXIMO, type FichaOp2 } from '../../schemas/ficha-op2.ts';
import { ErroDeRegra } from '../dados.ts';
import { adicionarModificador } from './passos.ts';
import type { AtributoOp2 } from './pericias.ts';
import { falhou, type ExtraDeTeste, type Veredito } from './teste.ts';

export const temImpeto = (ficha: FichaOp2): boolean => ficha.perfil === 'executor';

function exigirExecutor(ficha: FichaOp2) {
  if (!temImpeto(ficha)) throw new ErroDeRegra('impeto', 'Só o Executor tem Ímpeto.');
}

function exigirSaldo(ficha: FichaOp2, quanto: number) {
  if (ficha.impeto < quanto) {
    throw new ErroDeRegra(
      'impeto',
      `Ímpeto insuficiente: precisa de ${String(quanto)}, tem ${String(ficha.impeto)}.`,
    );
  }
}

/** Depois de um teste: se falhou, o Executor enche um espaço (sem passar de 3). */
export function registrarResultadoNoImpeto(ficha: FichaOp2, veredito: Veredito): FichaOp2 {
  if (!temImpeto(ficha) || !falhou(veredito)) return ficha;
  return { ...ficha, impeto: Math.min(IMPETO_MAXIMO, ficha.impeto + 1) };
}

/** Gasta 1: devolve a ficha e o d4 dourado para somar ao teste. */
export function gastarImpetoNoTeste(ficha: FichaOp2): { ficha: FichaOp2; extra: ExtraDeTeste } {
  exigirExecutor(ficha);
  exigirSaldo(ficha, 1);
  return {
    ficha: { ...ficha, impeto: ficha.impeto - 1 },
    extra: { tipo: 'd4', origem: 'Ímpeto' },
  };
}

/** Gasta 3: o atributo sobe um passo até o fim da cena. */
export function gastarImpetoNoAtributo(ficha: FichaOp2, atributo: AtributoOp2): FichaOp2 {
  exigirExecutor(ficha);
  exigirSaldo(ficha, IMPETO_MAXIMO);
  const comMod = adicionarModificador(ficha, {
    alvo: atributo,
    passos: 1,
    origem: 'Ímpeto',
    duracao: 'cena',
  });
  return { ...comMod, impeto: ficha.impeto - IMPETO_MAXIMO, impetoAtributo: atributo };
}
