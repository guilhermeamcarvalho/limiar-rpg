import { ICONES, type NomeDoIcone } from './icones.tsx';
import { cx } from './cx.ts';

export type { NomeDoIcone };
export const NOMES_DOS_ICONES = Object.keys(ICONES) as NomeDoIcone[];

export interface IconProps {
  name: NomeDoIcone;
  /** sm 15 px, md 18 px, lg 22 px, xl 32 px. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Só quando o ícone diz algo que nenhum texto ao lado diz.
   * Sem `label`, o ícone é decorativo e o leitor de tela o ignora.
   */
  label?: string;
  className?: string;
}

/** Ícone em traço que herda a cor do texto (`currentColor`). */
export function Icon({ name, size = 'md', label, className }: IconProps) {
  return (
    <svg
      className={cx('ic', size !== 'md' && size, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {ICONES[name]}
    </svg>
  );
}
