import { describe, expect, it } from 'vitest';
import { fichaDoDavi } from './exemplos.ts';
import {
  adicionarModificador,
  dadoEfetivo,
  descerPasso,
  fimDaCena,
  mudarPasso,
  subirPasso,
} from './passos.ts';
import {
  atributoDaPericia,
  nomeDaPericia,
  nomeDoAtributo,
  PERICIAS_OP2,
  type PericiaOp2,
} from './pericias.ts';

describe('passos de dado', () => {
  it('d4 → d6 → d8 → d10 → d12', () => {
    expect(subirPasso('d4')).toBe('d6');
    expect(subirPasso('d6')).toBe('d8');
    expect(subirPasso('d10')).toBe('d12');
    expect(descerPasso('d8')).toBe('d6');
  });

  it('d12 não sobe; d4 não desce', () => {
    expect(subirPasso('d12')).toBe('d12');
    expect(descerPasso('d4')).toBe('d4');
    expect(mudarPasso('d6', 9)).toBe('d12');
    expect(mudarPasso('d10', -9)).toBe('d4');
  });
});

describe('modificadores temporários', () => {
  const machucado = {
    alvo: 'fisico',
    passos: -1,
    origem: 'Machucado',
    duracao: 'cena',
  } as const;

  it('o dado efetivo soma os modificadores do alvo, atributo ou perícia', () => {
    let ficha = adicionarModificador(fichaDoDavi(), machucado);
    ficha = adicionarModificador(ficha, { ...machucado, passos: -1, origem: 'Queda' });
    ficha = adicionarModificador(ficha, {
      alvo: 'maquinas',
      passos: 1,
      origem: 'Treino',
      duracao: 'cena',
    });
    expect(dadoEfetivo(ficha, 'fisico')).toBe('d4');
    expect(dadoEfetivo(ficha, 'maquinas')).toBe('d12');
    expect(dadoEfetivo(ficha, 'mente')).toBe('d6');
  });

  it('o modificador não passa dos limites do dado', () => {
    const ficha = adicionarModificador(fichaDoDavi(), {
      alvo: 'maquinas',
      passos: 4,
      origem: 'x',
      duracao: 'cena',
    });
    expect(dadoEfetivo(ficha, 'maquinas')).toBe('d12');
  });

  it('fimDaCena() tira os modificadores, o atributo do Ímpeto e os usos da cena', () => {
    const ficha = {
      ...adicionarModificador(fichaDoDavi(), machucado),
      impetoAtributo: 'mente' as const,
      usadasNaCena: ['gambiarra'],
    };
    const depois = fimDaCena(ficha);
    expect(depois.modificadores).toEqual([]);
    expect(depois.impetoAtributo).toBeNull();
    expect(depois.usadasNaCena).toEqual([]);
    expect(dadoEfetivo(depois, 'fisico')).toBe('d8');
  });
});

describe('lista de perícias', () => {
  it('7 de Físico, 8 de Mente, 5 de Emoção', () => {
    const conta = (a: string) => PERICIAS_OP2.filter((p) => p.atributo === a).length;
    expect([conta('fisico'), conta('mente'), conta('emocao')]).toEqual([7, 8, 5]);
  });

  it('atributo e nome de cada perícia', () => {
    expect(atributoDaPericia('maquinas')).toBe('mente');
    expect(nomeDaPericia('maquinas')).toBe('Máquinas');
    expect(nomeDoAtributo('emocao')).toBe('Emoção');
  });

  it('perícia ou atributo desconhecido (dado de fora, sem tipo)', () => {
    const fantasma = 'culinaria' as PericiaOp2;
    expect(() => atributoDaPericia(fantasma)).toThrow('Perícia desconhecida');
    expect(nomeDaPericia(fantasma)).toBe('culinaria');
    expect(nomeDoAtributo('sorte' as 'fisico')).toBe('sorte');
  });
});
