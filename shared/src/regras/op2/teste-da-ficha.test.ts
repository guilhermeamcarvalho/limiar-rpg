import { describe, expect, it } from 'vitest';
import { ErroDeRegra, rngComSemente, type Rng } from '../dados.ts';
import { fichaDoDavi } from './exemplos.ts';
import { espacosDeItens } from './ficha.ts';
import { testarPericia, textoDoUso } from './teste-da-ficha.ts';

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
  it('um espaço por face do dado de Físico', () => {
    expect(espacosDeItens(fichaDoDavi().atributos)).toBe(8);
    expect(espacosDeItens({ fisico: 'd4', mente: 'd6', emocao: 'd6' })).toBe(4);
  });
});
