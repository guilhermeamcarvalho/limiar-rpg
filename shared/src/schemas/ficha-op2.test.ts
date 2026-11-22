import { describe, expect, it } from 'vitest';
import { fichaDoDavi } from '../regras/op2/exemplos.ts';
import { PERICIAS_OP2 } from '../regras/op2/pericias.ts';
import { esquemaFichaOp2, migrarFicha } from './ficha-op2.ts';

const erros = (valor: unknown) => {
  const r = esquemaFichaOp2.safeParse(valor);
  return r.success ? [] : r.error.issues.map((i) => ({ campo: i.path.join('.'), msg: i.message }));
};

describe('schema da ficha de Ordem Paranormal', () => {
  it('a ficha do Davi (protótipo) é válida', () => {
    expect(esquemaFichaOp2.parse(fichaDoDavi())).toEqual(fichaDoDavi());
  });

  it('tem as 20 perícias, nem mais nem menos', () => {
    expect(Object.keys(fichaDoDavi().pericias).sort()).toEqual(
      PERICIAS_OP2.map((p) => p.id).sort(),
    );
    const semMaquinas = Object.fromEntries(
      Object.entries(fichaDoDavi().pericias).filter(([id]) => id !== 'maquinas'),
    );
    expect(erros({ ...fichaDoDavi(), pericias: semMaquinas })[0]?.campo).toBe('pericias.maquinas');
  });

  it('recusa campo a mais, em qualquer nível (o "res" repetido do protótipo)', () => {
    expect(erros({ ...fichaDoDavi(), res: 3 })[0]?.msg).toMatch(/res/);
    expect(
      erros({ ...fichaDoDavi(), atributos: { ...fichaDoDavi().atributos, res: 'd6' } }),
    ).not.toEqual([]);
    expect(
      erros({ ...fichaDoDavi(), pericias: { ...fichaDoDavi().pericias, culinaria: 'd6' } }),
    ).not.toEqual([]);
    const item = { id: 'x', nome: 'Faca', descricao: '', peso: 1 };
    expect(erros({ ...fichaDoDavi(), itens: [item] })).not.toEqual([]);
  });

  it('PV acima do máximo e PD negativo são recusados, no campo certo', () => {
    expect(erros({ ...fichaDoDavi(), pv: 13 })).toEqual([
      { campo: 'pv', msg: 'O PV não pode passar do máximo.' },
    ]);
    expect(erros({ ...fichaDoDavi(), pd: 13 })).toEqual([
      { campo: 'pd', msg: 'O PD não pode passar do máximo.' },
    ]);
    expect(erros({ ...fichaDoDavi(), pd: -1 })).toEqual([
      { campo: 'pd', msg: 'O PD não pode ser menor que 0.' },
    ]);
  });

  it('dados só de d4 a d12; Ímpeto de 0 a 3; perfil conhecido', () => {
    expect(
      erros({ ...fichaDoDavi(), atributos: { fisico: 'd20', mente: 'd6', emocao: 'd6' } }),
    ).not.toEqual([]);
    expect(erros({ ...fichaDoDavi(), impeto: 4 })[0]?.campo).toBe('impeto');
    expect(erros({ ...fichaDoDavi(), perfil: 'mago' })[0]?.msg).toBe(
      'Escolha Executor, Analista ou Vigilante.',
    );
    expect(erros({ ...fichaDoDavi(), nivel: 1.5 })[0]?.msg).toBe(
      'O nível precisa ser um número inteiro.',
    );
  });

  it('só o Executor tem atributo do Ímpeto; itens não repetem o id', () => {
    expect(
      erros({ ...fichaDoDavi(), perfil: 'analista', impetoAtributo: 'fisico' })[0]?.campo,
    ).toBe('impetoAtributo');
    const item = { id: 'a', nome: 'Faca', descricao: '' };
    expect(erros({ ...fichaDoDavi(), itens: [item, item] })[0]?.campo).toBe('itens');
  });

  it('modificador temporário precisa de origem e de pelo menos um passo', () => {
    const mod = { alvo: 'fisico', passos: -1, origem: 'Machucado', duracao: 'cena' };
    expect(erros({ ...fichaDoDavi(), modificadores: [mod] })).toEqual([]);
    expect(erros({ ...fichaDoDavi(), modificadores: [{ ...mod, passos: 0 }] })[0]?.msg).toBe(
      'Um modificador muda pelo menos um passo.',
    );
    expect(erros({ ...fichaDoDavi(), modificadores: [{ ...mod, origem: ' ' }] })).not.toEqual([]);
  });
});

describe('migrarFicha', () => {
  it('versão atual: valida e devolve', () => {
    expect(migrarFicha(JSON.parse(JSON.stringify(fichaDoDavi())))).toEqual(fichaDoDavi());
  });

  it('versão desconhecida ou ausente é recusada', () => {
    expect(() => migrarFicha({ ...fichaDoDavi(), versao: 2 })).toThrow(
      'Versão de ficha desconhecida: 2',
    );
    expect(() => migrarFicha({ nome: 'x' })).toThrow('Versão de ficha desconhecida: nenhuma');
    expect(() => migrarFicha(null)).toThrow('nenhuma');
  });

  it('ficha da versão atual com erro continua sendo recusada', () => {
    expect(() => migrarFicha({ ...fichaDoDavi(), pv: 99 })).toThrow();
  });
});
