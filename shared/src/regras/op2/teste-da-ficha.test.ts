import { describe, expect, it } from 'vitest';
import { ErroDeRegra, rngComSemente, type Rng } from '../dados.ts';
import { fichaDoDavi } from './exemplos.ts';
import { espacosDeItens } from './ficha.ts';
import {
  pedeD4,
  registrarTesteInformado,
  testarPericia,
  textoDoUso,
  type RelatoDeTesteOp2,
} from './teste-da-ficha.ts';

/**
 * Sorteio que dá exatamente estes valores, na ordem em que o teste rola: atributo, perícia,
 * extras, depois o d8 e o d4 da falha crítica. Cada par é [valor, faces do dado].
 */
function rolagens(...pares: [number, number][]): Rng {
  const fila = [...pares];
  return () => {
    const proximo = fila.shift();
    if (!proximo) throw new Error('Rolou mais dados do que o teste previa.');
    const [valor, faces] = proximo;
    return (valor - 0.5) / faces;
  };
}

function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return e;
    throw e;
  }
  throw new Error('não lançou');
}

/** Todos os dados em 1 (Máquinas do Davi: d6 de Mente e d10 de perícia). */
const tudoEm1 = (): [number, number][] => [
  [1, 6],
  [1, 10],
];

describe('testarPericia', () => {
  it('sucesso simples: rola atributo e perícia e não mexe na ficha', () => {
    const davi = fichaDoDavi();
    const r = testarPericia(davi, { periciaId: 'maquinas' }, rolagens([5, 6], [9, 10]));

    expect(r.teste).toMatchObject({ atributo: 'd6', pericia: 'd10', dt: 7, extras: [] });
    expect(r.resultado).toMatchObject({ total: 14, veredito: 'sucesso', informado: false });
    expect(r.ficha).toEqual(davi);
    expect(r.efeitos).toEqual([]);
    expect(r.falhaCritica).toBeNull();
  });

  it('Ímpeto e Gambiarra: gastam, somam um d4 cada e contam os 3 maiores', () => {
    const r = testarPericia(
      fichaDoDavi(),
      { periciaId: 'maquinas', impeto: true, habilidades: ['gambiarra'] },
      rolagens([5, 6], [9, 10], [3, 4], [2, 4]),
    );

    expect(r.teste.extras).toEqual([
      { tipo: 'd4', origem: 'Ímpeto' },
      { tipo: 'd4', origem: 'Gambiarra' },
    ]);
    expect(r.resultado.total).toBe(17);
    expect(r.resultado.dados.map((d) => d.descartado)).toEqual([false, false, false, true]);
    expect(r.ficha).toMatchObject({ impeto: 0, pv: 10, usadasNaCena: ['gambiarra'] });
    expect(r.efeitos).toEqual(['Ímpeto gasto: +d4.', 'Gambiarra usada: −2 PV.']);
  });

  it('a mesma habilidade pedida duas vezes conta uma', () => {
    const r = testarPericia(
      fichaDoDavi(),
      { periciaId: 'crime', habilidades: ['gambiarra', 'gambiarra'] },
      rolagens([4, 8], [4, 8], [2, 4]),
    );
    expect(r.teste.extras).toHaveLength(1);
    expect(r.ficha.pv).toBe(10);
  });

  it('DT e Ajuda vão para o teste: a perícia sobe um passo', () => {
    const r = testarPericia(
      fichaDoDavi(),
      { periciaId: 'maquinas', dt: 12, ajuda: true },
      rolagens([5, 6], [9, 12]),
    );
    expect(r.teste).toMatchObject({ pericia: 'd12', dt: 12 });
    expect(r.resultado.veredito).toBe('sucesso');
  });

  it('falha do Executor enche um espaço de Ímpeto e conta no efeito', () => {
    const r = testarPericia(fichaDoDavi(), { periciaId: 'maquinas' }, rolagens([1, 6], [2, 10]));
    expect(r.resultado.veredito).toBe('falha');
    expect(r.ficha.impeto).toBe(2);
    expect(r.efeitos).toEqual(['Ímpeto +1 (2/3).']);
  });

  it('com o Ímpeto cheio, a falha não acrescenta efeito', () => {
    const r = testarPericia(
      { ...fichaDoDavi(), impeto: 3 },
      { periciaId: 'maquinas' },
      rolagens([1, 6], [2, 10]),
    );
    expect(r.ficha.impeto).toBe(3);
    expect(r.efeitos).toEqual([]);
  });

  it('falha crítica rola o d8 e aplica o efeito (Machucado)', () => {
    const r = testarPericia(
      fichaDoDavi(),
      { periciaId: 'maquinas' },
      rolagens(...tudoEm1(), [2, 8]),
    );
    expect(r.resultado.veredito).toBe('falhaCritica');
    expect(r.falhaCritica).toMatchObject({ d8: 2, nome: 'Machucado' });
    expect(r.ficha.modificadores).toEqual([
      { alvo: 'fisico', passos: -1, origem: 'Machucado (falha crítica)', duracao: 'cena' },
    ]);
    expect(r.efeitos).toEqual([
      'Falha crítica (Machucado): Físico desce um passo até o fim da cena.',
      'Ímpeto +1 (2/3).',
    ]);
  });

  it('Acidente rola o d4 da perda e tira PV', () => {
    const r = testarPericia(
      fichaDoDavi(),
      { periciaId: 'maquinas' },
      rolagens(...tudoEm1(), [5, 8], [3, 4]),
    );
    expect(r.falhaCritica).toEqual({
      d8: 5,
      d4: 3,
      nome: 'Acidente',
      descricao: 'Perde 3 PV.',
    });
    expect(r.ficha.pv).toBe(9);
  });

  it('Perda com itens: a ficha fica e a pessoa escolhe o item', () => {
    const davi = fichaDoDavi();
    const r = testarPericia(davi, { periciaId: 'maquinas' }, rolagens(...tudoEm1(), [7, 8]));
    expect(r.ficha.itens).toEqual(davi.itens);
    expect(r.falhaCritica).toMatchObject({
      d8: 7,
      nome: 'Perda',
      descricao: 'Perde um item: escolha qual tirar na aba Itens.',
    });
  });

  it('Perda sem itens: nada a perder', () => {
    const r = testarPericia(
      { ...fichaDoDavi(), itens: [] },
      { periciaId: 'maquinas' },
      rolagens(...tudoEm1(), [7, 8]),
    );
    expect(r.falhaCritica?.descricao).toBe('Perderia um item, mas não carrega nenhum.');
  });

  it('habilidade desconhecida é recusada no campo habilidades', () => {
    const erro = erroDe(() =>
      testarPericia(
        fichaDoDavi(),
        { periciaId: 'maquinas', habilidades: ['voar'] },
        rngComSemente(1),
      ),
    );
    expect(erro.campo).toBe('habilidades');
    expect(erro.message).toBe('Habilidade desconhecida: voar.');
  });

  it('as regras de cada extra continuam valendo (Gambiarra fora de Máquinas e Crime)', () => {
    const erro = erroDe(() =>
      testarPericia(
        fichaDoDavi(),
        { periciaId: 'luta', habilidades: ['gambiarra'] },
        rngComSemente(1),
      ),
    );
    expect(erro.campo).toBe('periciaId');
  });

  it('não muda a ficha recebida', () => {
    const davi = fichaDoDavi();
    testarPericia(
      davi,
      { periciaId: 'maquinas', impeto: true, habilidades: ['gambiarra'] },
      rolagens(...tudoEm1(), [1, 4], [1, 4], [5, 8], [2, 4]),
    );
    expect(davi).toEqual(fichaDoDavi());
  });
});

describe('textoDoUso', () => {
  it('diz o custo em PV, em PD, nos dois ou em nenhum', () => {
    expect(textoDoUso({ nome: 'Gambiarra', custo: { pv: 2 } })).toBe('Gambiarra usada: −2 PV.');
    expect(textoDoUso({ nome: 'Fontes', custo: { pd: 1 } })).toBe('Fontes usada: −1 PD.');
    expect(textoDoUso({ nome: 'X', custo: { pv: 1, pd: 2 } })).toBe('X usada: −1 PV, −2 PD.');
    expect(textoDoUso({ nome: 'Reflexo', custo: {} })).toBe('Reflexo usada.');
  });
});

describe('espacosDeItens', () => {
  it('5 + máximo do dado de Físico (Ordem 2, p. 18)', () => {
    expect(espacosDeItens(fichaDoDavi().atributos)).toBe(13);
    expect(espacosDeItens({ fisico: 'd4', mente: 'd6', emocao: 'd6' })).toBe(9);
  });
});

describe('registrarTesteInformado (dados físicos)', () => {
  const dados = (...valores: number[]): RelatoDeTesteOp2 => ({
    resultado: { modo: 'dados', valores },
  });
  const maquinas = { periciaId: 'maquinas' } as const;

  it('os valores informados decidem o teste, igual ao sorteio', () => {
    const davi = fichaDoDavi();
    const r = registrarTesteInformado(davi, maquinas, dados(5, 9));
    expect(r.resultado).toMatchObject({ total: 14, veredito: 'sucesso', informado: true });
    expect(r.ficha).toEqual(davi);
    expect(r.falhaCritica).toBeNull();
  });

  it('gasta o Ímpeto e a Gambiarra e enche o Ímpeto na falha (RF-87)', () => {
    const r = registrarTesteInformado(
      fichaDoDavi(),
      { ...maquinas, dt: 20, impeto: true, habilidades: ['gambiarra'] },
      dados(5, 9, 3, 2),
    );
    expect(r.resultado).toMatchObject({ total: 17, veredito: 'falha' });
    expect(r.ficha).toMatchObject({ impeto: 1, pv: 10, usadasNaCena: ['gambiarra'] });
    expect(r.efeitos).toEqual([
      'Ímpeto gasto: +d4.',
      'Gambiarra usada: −2 PV.',
      'Ímpeto +1 (1/3).',
    ]);
  });

  it('valor fora do dado é recusado no campo do dado', () => {
    const erro = erroDe(() => registrarTesteInformado(fichaDoDavi(), maquinas, dados(5, 12)));
    expect(erro).toMatchObject({ campo: 'valores.1', message: 'O d10 vai de 1 a 10.' });
  });

  it('só o resultado: o veredito e os números opcionais', () => {
    const r = registrarTesteInformado(fichaDoDavi(), maquinas, {
      resultado: { modo: 'veredito', veredito: 'sucesso', soma: 12 },
    });
    expect(r.resultado).toMatchObject({ total: 12, dados: [], veredito: 'sucesso' });
  });

  it('falha crítica com o d8 e o d4 informados aplica o efeito', () => {
    const r = registrarTesteInformado(fichaDoDavi(), maquinas, {
      ...dados(1, 1),
      falhaCritica: { d8: 5, d4: 3 },
    });
    expect(r.falhaCritica).toEqual({ d8: 5, d4: 3, nome: 'Acidente', descricao: 'Perde 3 PV.' });
    expect(r.ficha).toMatchObject({ pv: 9, impeto: 2 });
  });

  it('o d4 a mais num efeito que não pede fica de fora', () => {
    const r = registrarTesteInformado(fichaDoDavi(), maquinas, {
      resultado: { modo: 'veredito', veredito: 'falhaCritica' },
      falhaCritica: { d8: 1, d4: 2 },
    });
    expect(r.falhaCritica).toEqual({
      d8: 1,
      nome: 'Vexame',
      descricao: 'Vexame: nada muda na ficha, só no orgulho.',
    });
  });

  it('Perda com itens: a pessoa escolhe o item, como no virtual', () => {
    const davi = fichaDoDavi();
    const r = registrarTesteInformado(davi, maquinas, {
      ...dados(1, 1),
      falhaCritica: { d8: 7 },
    });
    expect(r.ficha.itens).toEqual(davi.itens);
    expect(r.falhaCritica?.nome).toBe('Perda');
  });

  it('a falha crítica pede o d8 e, em Acidente e Frustração, o d4', () => {
    const testar = (falhaCritica?: { d8: number; d4?: number }) =>
      erroDe(() =>
        registrarTesteInformado(fichaDoDavi(), maquinas, {
          ...dados(1, 1),
          ...(falhaCritica && { falhaCritica }),
        }),
      );
    expect(testar()).toMatchObject({
      campo: 'falhaCritica.d8',
      message: 'Falha crítica: role o d8 e informe o resultado.',
    });
    expect(testar({ d8: 9 })).toMatchObject({
      campo: 'falhaCritica.d8',
      message: 'O d8 vai de 1 a 8.',
    });
    expect(testar({ d8: 2.5 }).campo).toBe('falhaCritica.d8');
    expect(testar({ d8: 6 })).toMatchObject({
      campo: 'falhaCritica.d4',
      message: 'Este efeito pede o d4: role e informe o valor.',
    });
    expect(testar({ d8: 6, d4: 5 })).toMatchObject({
      campo: 'falhaCritica.d4',
      message: 'O d4 vai de 1 a 4.',
    });
    expect(testar({ d8: 6, d4: 1.5 }).campo).toBe('falhaCritica.d4');
  });

  it('d8 sem falha crítica é recusado', () => {
    const erro = erroDe(() =>
      registrarTesteInformado(fichaDoDavi(), maquinas, {
        ...dados(5, 9),
        falhaCritica: { d8: 2 },
      }),
    );
    expect(erro.campo).toBe('falhaCritica');
  });
});

describe('pedeD4', () => {
  it('só Acidente (5) e Frustração (6)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter(pedeD4)).toEqual([5, 6]);
  });
});
