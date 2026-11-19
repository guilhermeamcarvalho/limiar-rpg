/** Junta classes, ignorando as falsas: cx('btn', ativo && 'on') → 'btn on'. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
