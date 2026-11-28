import { describe, expect, it } from 'vitest';
import { ErroDeRegra } from '../dados.ts';
import { fichaDoDavi } from './exemplos.ts';
import { montarTeste } from './ficha.ts';
import {
  gastarImpetoNoAtributo,
  gastarImpetoNoTeste,
  registrarResultadoNoImpeto,
  temImpeto,
} from './impeto.ts';
import { aplicarModificador, GAMBIARRA } from './modificadores.ts';
import { dadoEfetivo, fimDaCena } from './passos.ts';
import { resolverTesteInformado } from './teste.ts';

const analista = () => ({ ...fichaDoDavi(), perfil: 'analista' as const });

function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return e;
    throw e;
  }
  throw new Error('não lançou');
}

describe('Ímpeto enche com as falhas', () => {
  it('falha e falha crítica enchem um espaço; sucesso não', () => {
    const davi = { ...fichaDoDavi(), impeto: 0 };
    expect(registrarResultadoNoImpeto(davi, 'falha').impeto).toBe(1);
    expect(registrarResultadoNoImpeto(davi, 'falhaCritica').impeto).toBe(1);
    expect(registrarResultadoNoImpeto(davi, 'sucesso').impeto).toBe(0);
    expect(registrarResultadoNoImpeto(davi, 'critico').impeto).toBe(0);
  });

  it('com o Ímpeto em 3, uma falha não passa de 3', () => {
    expect(registrarResultadoNoImpeto({ ...fichaDoDavi(), impeto: 3 }, 'falha').impeto).toBe(3);
  });

  it('só o Executor enche automaticamente na falha; todos os perfis têm barra', () => {
    expect(temImpeto(fichaDoDavi())).toBe(true);
    expect(temImpeto(analista())).toBe(true);
    expect(registrarResultadoNoImpeto({ ...analista(), impeto: 0 }, 'falha').impeto).toBe(0);
  });
});

describe('gastar Ímpeto', () => {
  it('gastar 1: um d4 dourado no teste', () => {
    const { ficha, extra } = gastarImpetoNoTeste({ ...fichaDoDavi(), impeto: 2 });
    expect(ficha.impeto).toBe(1);
    expect(extra).toEqual({ tipo: 'd4', origem: 'Ímpeto' });
  });

  it('gastar sem saldo é recusado', () => {
    const e = erroDe(() => gastarImpetoNoTeste({ ...fichaDoDavi(), impeto: 0 }));
    expect([e.campo, e.message]).toEqual(['impeto', 'Ímpeto insuficiente: precisa de 1, tem 0.']);
    expect(
      erroDe(() => gastarImpetoNoAtributo({ ...fichaDoDavi(), impeto: 2 }, 'fisico')).message,
    ).toBe('Ímpeto insuficiente: precisa de 3, tem 2.');
  });

  it('gastar 3: o atributo sobe um passo até o fim da cena', () => {
    const ficha = gastarImpetoNoAtributo({ ...fichaDoDavi(), impeto: 3 }, 'mente');
    expect(ficha.impeto).toBe(0);
    expect(ficha.impetoAtributo).toBe('mente');
    expect(dadoEfetivo(ficha, 'mente')).toBe('d8');
    expect(dadoEfetivo(fimDaCena(ficha), 'mente')).toBe('d6');
  });

  it('Analista gasta Plano para +d4 ou +1 passo em atributo; Vigilante não sobe atributo', () => {
    const a = gastarImpetoNoTeste({ ...analista(), impeto: 2 });
    expect(a.extra).toEqual({ tipo: 'd4', origem: 'Plano' });
    const aAtr = gastarImpetoNoAtributo({ ...analista(), impeto: 3 }, 'mente');
    expect(aAtr.impetoAtributo).toBe('mente');
    const vigilante = { ...fichaDoDavi(), perfil: 'vigilante' as const, impeto: 3 };
    expect(erroDe(() => gastarImpetoNoAtributo(vigilante, 'fisico')).campo).toBe('impeto');
  });
});

describe('Ímpeto e Gambiarra no mesmo teste', () => {
  it('quatro dados: Mente, Máquinas, Ímpeto e Gambiarra; só os três maiores contam', () => {
    const inicio = { ...fichaDoDavi(), impeto: 1 };
    const impeto = gastarImpetoNoTeste(inicio);
    const base = montarTeste(impeto.ficha, 'maquinas');
    const comImpeto = { ...base, extras: [impeto.extra] };
    const { ficha, teste } = aplicarModificador(impeto.ficha, comImpeto, GAMBIARRA);

    expect(teste.extras.map((e) => e.origem)).toEqual(['Ímpeto', 'Gambiarra']);
    expect([ficha.impeto, ficha.pv, ficha.usadasNaCena]).toEqual([0, 10, ['gambiarra']]);

    const r = resolverTesteInformado(teste, [5, 9, 2, 4]);
    expect(r.total).toBe(18);
    expect(r.dados.find((d) => d.descartado)?.origem).toBe('Ímpeto');
  });
});
