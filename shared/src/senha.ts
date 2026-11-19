// Regra da senha, igual na tela e no servidor. Sem Zod, para o client usar sem pesar.

export const MIN_SENHA = 10;
export const MAX_SENHA = 200;

export type ForcaDaSenha = 0 | 1 | 2 | 3 | 4;

/**
 * Força de 0 a 4, para a barra da tela. Abaixo de 10 caracteres nunca passa de 2 (fraca).
 * Conta tamanho e variedade: minúsculas, maiúsculas, números e símbolos.
 */
export function forcaDaSenha(senha: string): ForcaDaSenha {
  if (!senha) return 0;
  const variedade = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(senha)).length;
  if (senha.length < MIN_SENHA) return senha.length >= 6 && variedade >= 2 ? 2 : 1;
  if (senha.length >= 16 || (senha.length >= 12 && variedade >= 3)) return 4;
  return variedade >= 2 ? 3 : 2;
}

export function senhaValida(senha: string): boolean {
  return senha.length >= MIN_SENHA && senha.length <= MAX_SENHA;
}
