import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

const VARIANTES = {
  primary: 'red',
  secondary: undefined,
  ghost: 'ghost',
  danger: 'danger',
} as const;

/** Quanto tempo o botão fica verde depois de `success`. */
export const DURACAO_SUCESSO_MS = 2000;

interface Comum extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ref?: Ref<HTMLButtonElement>;
  /** principal (vermelho, um por área), secundário, fantasma ou perigo. */
  variant?: keyof typeof VARIANTES;
  /** `sm` tem 36 px: só para barras densas do computador. */
  size?: 'md' | 'sm';
  /** Mostra o giro e ignora cliques até terminar: evita clique duplo. */
  loading?: boolean;
  /** Ao virar `true`, o botão fica verde por 2 s e volta ao normal. */
  success?: boolean;
  successLabel?: ReactNode;
  successIcon?: ReactNode;
  icon?: ReactNode;
  wide?: boolean;
}

/** Botão só com ícone exige `aria-label`: sem ele, o leitor de tela não diz nada. */
export type ButtonProps = Comum &
  (
    | { children: ReactNode; 'aria-label'?: string }
    | { children?: undefined; icon: ReactNode; 'aria-label': string }
  );

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  success = false,
  successLabel = 'Salvo',
  successIcon = <Icon name="check" size="sm" />,
  icon,
  wide = false,
  className,
  children,
  onClick,
  type = 'button',
  ...resto
}: ButtonProps) {
  // Guarda o `success` anterior para notar a virada de false para true durante a renderização.
  const [successAnterior, setSuccessAnterior] = useState(success);
  const [mostrandoSucesso, setMostrandoSucesso] = useState(false);
  if (success !== successAnterior) {
    setSuccessAnterior(success);
    if (success) setMostrandoSucesso(true);
  }

  useEffect(() => {
    if (!mostrandoSucesso) return;
    const t = setTimeout(() => {
      setMostrandoSucesso(false);
    }, DURACAO_SUCESSO_MS);
    return () => {
      clearTimeout(t);
    };
  }, [mostrandoSucesso]);

  const bloqueado = loading || mostrandoSucesso;
  const soIcone = children === undefined && !mostrandoSucesso;

  return (
    <button
      type={type}
      className={cx(
        'btn',
        VARIANTES[variant],
        size === 'sm' && 'sm',
        soIcone && 'icon',
        wide && 'wide',
        loading && 'is-loading',
        mostrandoSucesso && 'is-ok',
        className,
      )}
      aria-busy={loading || undefined}
      aria-disabled={bloqueado || undefined}
      onClick={(evento) => {
        if (bloqueado) {
          evento.preventDefault();
          return;
        }
        onClick?.(evento);
      }}
      {...resto}
    >
      {mostrandoSucesso ? (
        <>
          {successIcon}
          {successLabel}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
