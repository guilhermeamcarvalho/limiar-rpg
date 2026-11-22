import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DADOS } from '../../sistemas.ts';
import { ErroDeRegra, faces, rngComSemente, rngCripto, rolar, type Dado } from '../dados.ts';
import {
  dadosDoTeste,
  falhou,
  resolverTeste,
  resolverTesteInformado,
  type TesteOp2,
} from './teste.ts';

const teste = (campos: Partial<TesteOp2> = {}): TesteOp2 => ({
  atributo: 'd6',
  pericia: 'd10',
  extras: [],
  dt: 7,
  ...campos,
});
const d4 = (origem: string) => ({ tipo: 'd4' as const, origem });

/** Valores fixos: o teste roda com o que o "jogador" informou. */
const com = (valores: number[], campos: Partial<TesteOp2> = {}) =>
  resolverTesteInformado(teste(campos), valores);

/** Pega o erro de regra lançado, para conferir o campo e a mensagem. */
function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return e;
    throw e;
  }
  throw new Error('não lançou');
}

describe('exemplos das regras e do protótipo', () => {
  it('Davi: Mente 5 + Máquinas 9 + Gambiarra 3 = 17, sucesso contra DT 7', () => {
    const r = com([5, 9, 3], { extras: [d4('Gambiarra')] });
    expect(r).toMatchObject({ total: 17, dt: 7, veredito: 'sucesso', informado: true });
    expect(r.dados.map((d) => [d.papel, d.valor, d.descartado])).toEqual([
      ['atributo', 5, false],
      ['pericia', 9, false],
      ['bonus', 3, false],
    ]);
    expect(r.dados[2]?.origem).toBe('Gambiarra');
  });

  it('total igual à DT passa; abaixo falha (a DT padrão é 7)', () => {
    expect(com([3, 4]).veredito).toBe('sucesso');
    expect(com([3, 3]).veredito).toBe('falha');
  });

  it('RA e RB: o maior e o menor dado que contaram', () => {
    expect(com([2, 9, 4], { extras: [d4('Ímpeto')] })).toMatchObject({ ra: 9, rb: 2 });
  });
});

describe('quatro dados: só os três maiores contam', () => {
  it('o menor sai e vem marcado como descartado', () => {
    const r = com([5, 9, 1, 3], { extras: [d4('Ímpeto'), d4('Gambiarra')] });
    expect(r.total).toBe(17);
    expect(r.dados.map((d) => d.descartado)).toEqual([false, false, true, false]);
    expect(r.rb).toBe(3);
  });

  it('empate no menor: sai o que veio por último', () => {
    const r = com([2, 9, 4, 2], { extras: [d4('Ímpeto'), d4('Gambiarra')] });
    expect(r.dados.map((d) => d.descartado)).toEqual([false, false, false, true]);
    expect(r.total).toBe(15);
  });

  it('empate nos três maiores: todos iguais, sai o último e o total é 3 vezes o valor', () => {
    const r = com([4, 4, 4, 4], { extras: [d4('Ímpeto'), d4('Gambiarra')] });
    expect(r.total).toBe(12);
    expect(r.dados.filter((d) => d.descartado)).toHaveLength(1);
    expect(r.dados[3]?.descartado).toBe(true);
  });

  it('Ímpeto e Gambiarra juntos: quatro dados, e o total nunca soma os quatro', () => {
    const r = com([6, 10, 4, 4], { extras: [d4('Ímpeto'), d4('Gambiarra')] });
    expect(r.total).toBe(20);
    expect(r.dados.map((d) => d.origem ?? d.papel)).toEqual([
      'atributo',
      'pericia',
      'Ímpeto',
      'Gambiarra',
    ]);
  });
});

describe('críticos', () => {
  it('dois 6 entre os que contam: sucesso crítico, mesmo com DT alta', () => {
    expect(com([6, 6], { dt: 30 }).veredito).toBe('critico');
    expect(com([6, 6, 2], { extras: [d4('Ímpeto')] }).veredito).toBe('critico');
  });

  it('dois dados iguais acima de 6 também contam; abaixo de 6, não', () => {
    expect(com([3, 8], { atributo: 'd8' }).veredito).toBe('sucesso');
    expect(com([8, 8], { atributo: 'd8' }).veredito).toBe('critico');
    expect(com([5, 5]).veredito).toBe('sucesso');
  });

  it('um 6 descartado não forma par', () => {
    const r = com([6, 7, 6, 3], {
      extras: [
        { tipo: 'd6', origem: 'x' },
        { tipo: 'd4', origem: 'y' },
      ],
    });
    // Sai o 3; ficam 6, 7 e 6: par de 6, crítico.
    expect(r.veredito).toBe('critico');
    const semPar = com([6, 7, 8, 6], {
      atributo: 'd8',
      extras: [
        { tipo: 'd8', origem: 'x' },
        { tipo: 'd6', origem: 'y' },
      ],
    });
    // Sai o último 6 (empate no menor); ficam 6, 7 e 8: sem par.
    expect(semPar.veredito).toBe('sucesso');
  });

  it('todos os dados em 1: falha crítica, mesmo que a DT seja 1', () => {
    expect(com([1, 1], { dt: 1 }).veredito).toBe('falhaCritica');
    expect(com([1, 1, 1, 1], { extras: [d4('a'), d4('b')] }).veredito).toBe('falhaCritica');
    expect(com([1, 2]).veredito).toBe('falha');
  });

  it('falhou(): falha e falha crítica', () => {
    expect([falhou('falha'), falhou('falhaCritica'), falhou('sucesso'), falhou('critico')]).toEqual(
      [true, true, false, false],
    );
  });
});

describe('dados físicos: valores informados', () => {
  it('valor fora da faixa do dado é recusado, com o campo do valor', () => {
    const e = erroDe(() => com([5, 11]));
    expect([e.campo, e.message]).toEqual(['valores.1', 'O d10 vai de 1 a 10.']);
    expect(erroDe(() => com([0, 5])).campo).toBe('valores.0');
    expect(erroDe(() => com([2.5, 5])).message).toBe('O d6 vai de 1 a 6.');
  });

  it('quantidade errada de valores é recusada', () => {
    const e = erroDe(() => com([5]));
    expect([e.campo, e.message]).toEqual([
      'valores',
      'Informe 2 valores, um para cada dado do teste.',
    ]);
  });
});

describe('pedido de teste inválido', () => {
  it('mais de quatro dados é recusado', () => {
    const e = erroDe(() => dadosDoTeste(teste({ extras: [d4('a'), d4('b'), d4('c')] })));
    expect(e.campo).toBe('extras');
  });

  it('DT fora de 1 a 99 ou quebrada é recusada', () => {
    for (const dt of [0, 100, 7.5]) expect(erroDe(() => com([3, 4], { dt })).campo).toBe('dt');
  });
});

describe('sorteio', () => {
  it('o mesmo rng dá sempre o mesmo resultado', () => {
    const t = teste({ extras: [d4('Ímpeto'), d4('Gambiarra')] });
    expect(resolverTeste(t, rngComSemente(42))).toEqual(resolverTeste(t, rngComSemente(42)));
    expect(resolverTeste(t, rngComSemente(42))).not.toEqual(resolverTeste(t, rngComSemente(7)));
    expect(resolverTeste(t, rngComSemente(42)).informado).toBe(false);
  });

  it('rolar respeita as faces, nos extremos do rng', () => {
    expect(rolar('d10', () => 0)).toBe(1);
    expect(rolar('d10', () => 0.999999)).toBe(10);
    expect(faces('d12')).toBe(12);
  });

  it('o sorteio criptográfico fica em [0, 1) e cobre todas as faces', () => {
    const rng = rngCripto();
    const vistos = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      vistos.add(rolar('d6', () => x));
    }
    expect([...vistos].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

/* ---------- Propriedades: 1000 testes aleatórios cada ---------- */

const dado = fc.constantFrom<Dado>(...DADOS);
const testeQualquer = fc.record({
  atributo: dado,
  pericia: dado,
  extras: fc.array(fc.record({ tipo: dado, origem: fc.constant('bônus') }), { maxLength: 2 }),
  dt: fc.integer({ min: 1, max: 99 }),
});
const PROPRIEDADE = { numRuns: 1000 };

describe('propriedades do teste (fast-check)', () => {
  it('o total nunca passa da soma dos três maiores valores possíveis', () => {
    fc.assert(
      fc.property(testeQualquer, fc.integer(), (t, semente) => {
        const r = resolverTeste(t, rngComSemente(semente));
        const maiores = r.dados
          .map((d) => faces(d.tipo))
          .sort((a, b) => b - a)
          .slice(0, 3);
        expect(r.total).toBeLessThanOrEqual(maiores.reduce((a, b) => a + b, 0));
      }),
      PROPRIEDADE,
    );
  });

  it('descartados nunca entram no total, e só há descarte com quatro dados', () => {
    fc.assert(
      fc.property(testeQualquer, fc.integer(), (t, semente) => {
        const r = resolverTeste(t, rngComSemente(semente));
        const contam = r.dados.filter((d) => !d.descartado);
        const descartados = r.dados.filter((d) => d.descartado);
        expect(r.total).toBe(contam.reduce((s, d) => s + d.valor, 0));
        expect(descartados).toHaveLength(Math.max(0, r.dados.length - 3));
        for (const fora of descartados) {
          for (const dentro of contam) expect(fora.valor).toBeLessThanOrEqual(dentro.valor);
        }
      }),
      PROPRIEDADE,
    );
  });

  it('cada valor cabe no seu dado, e RA ≥ RB', () => {
    fc.assert(
      fc.property(testeQualquer, fc.integer(), (t, semente) => {
        const r = resolverTeste(t, rngComSemente(semente));
        for (const d of r.dados) {
          expect(d.valor).toBeGreaterThanOrEqual(1);
          expect(d.valor).toBeLessThanOrEqual(faces(d.tipo));
        }
        expect(r.ra).toBeGreaterThanOrEqual(r.rb);
      }),
      PROPRIEDADE,
    );
  });

  it('informar os mesmos valores dá o mesmo resultado que rolar (ficha e servidor concordam)', () => {
    fc.assert(
      fc.property(testeQualquer, fc.integer(), (t, semente) => {
        const rolado = resolverTeste(t, rngComSemente(semente));
        const informado = resolverTesteInformado(
          t,
          rolado.dados.map((d) => d.valor),
        );
        expect({ ...informado, informado: false }).toEqual(rolado);
      }),
      PROPRIEDADE,
    );
  });

  it('veredito coerente: crítico tem par ≥ 6; falha crítica tem tudo em 1; senão, total contra DT', () => {
    fc.assert(
      fc.property(testeQualquer, fc.integer(), (t, semente) => {
        const r = resolverTeste(t, rngComSemente(semente));
        const contam = r.dados.filter((d) => !d.descartado).map((d) => d.valor);
        const par = contam.some((v, i) => v >= 6 && contam.indexOf(v) !== i);
        const tudoUm = r.dados.every((d) => d.valor === 1);
        const esperado = par
          ? 'critico'
          : tudoUm
            ? 'falhaCritica'
            : r.total >= r.dt
              ? 'sucesso'
              : 'falha';
        expect(r.veredito).toBe(esperado);
      }),
      PROPRIEDADE,
    );
  });
});
