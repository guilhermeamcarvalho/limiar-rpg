// Código de convite (ERMIDA-3H33). Sem Zod, para a tela conferir enquanto a pessoa digita.

/** Palavra do nome do caso, hífen, 4 letras ou números. */
export const FORMATO_DO_CODIGO = /^[A-Z]{2,8}-[A-Z0-9]{4}$/;

/** Maiúsculas e sem espaços, para comparar o que a pessoa digitou. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, '');
}

export function codigoBemFormado(codigo: string): boolean {
  return FORMATO_DO_CODIGO.test(normalizarCodigo(codigo));
}
