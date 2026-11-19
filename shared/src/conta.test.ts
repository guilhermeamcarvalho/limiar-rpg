import { describe, expect, it } from 'vitest';
import { esquemaCadastro, esquemaEntrar } from './conta.ts';
import { forcaDaSenha, MIN_SENHA, senhaValida } from './senha.ts';

const cadastro = {
  nome: '  Marta Quintela ',
  email: ' Marta@Exemplo.COM ',
  senha: 'mare-de-concreto',
  aceite: true,
};

describe('esquemaCadastro', () => {
  it('limpa espaços e põe o e-mail em minúsculas', () => {
    expect(esquemaCadastro.parse(cadastro)).toEqual({
      nome: 'Marta Quintela',
      email: 'marta@exemplo.com',
      senha: 'mare-de-concreto',
      aceite: true,
      manter: true,
    });
  });

  it.each([
    ['senha curta', { senha: 'curta' }, 'senha', 'pelo menos 10'],
    ['e-mail inválido', { email: 'marta' }, 'email', 'e-mail válido'],
    ['sem nome', { nome: '   ' }, 'nome', 'aparecer na mesa'],
    ['sem aceite', { aceite: false }, 'aceite', 'aceitar'],
  ])('%s', (_, troca, campo, trecho) => {
    const resultado = esquemaCadastro.safeParse({ ...cadastro, ...troca });

    expect(resultado.success).toBe(false);
    const problema = resultado.error?.issues.find((i) => i.path[0] === campo);
    expect(problema?.message).toContain(trecho);
  });
});

describe('esquemaEntrar', () => {
  it('não cobra tamanho de senha: senha errada é só "não confere"', () => {
    expect(esquemaEntrar.safeParse({ email: 'a@b.com', senha: 'x' }).success).toBe(true);
    expect(esquemaEntrar.safeParse({ email: 'a@b.com', senha: '' }).success).toBe(false);
  });
});

describe('forcaDaSenha', () => {
  it.each([
    ['', 0],
    ['abc', 1],
    ['mare7a', 2],
    ['abcdefghij', 2],
    ['mare7concreto', 3],
    ['Mare-7-Concreto', 4],
    ['umafrasebemcompridasemnada', 4],
  ])('"%s" → %i', (senha, forca) => {
    expect(forcaDaSenha(senha)).toBe(forca);
  });

  it('abaixo do mínimo nunca passa de fraca', () => {
    expect(forcaDaSenha('Aa1!Aa1!')).toBeLessThanOrEqual(2);
    expect(senhaValida('a'.repeat(MIN_SENHA - 1))).toBe(false);
    expect(senhaValida('a'.repeat(MIN_SENHA))).toBe(true);
  });
});
