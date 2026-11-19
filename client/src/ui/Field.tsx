import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface CampoAtual {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const CampoContexto = createContext<CampoAtual | null>(null);

export interface FieldProps {
  label: ReactNode;
  /** Dica abaixo do campo. Some quando há erro. */
  help?: ReactNode;
  /** Erro de validação: pinta o campo de vermelho e é lido pelo leitor de tela. */
  error?: ReactNode;
  /** Aviso que não impede salvar, como "fora da regra". */
  warning?: ReactNode;
  className?: string;
  /** Um `Input`, `Textarea` ou `Select`: eles se ligam ao rótulo e às mensagens sozinhos. */
  children: ReactNode;
}

export function Field({ label, help, error, warning, className, children }: FieldProps) {
  const id = useId();
  const idHelp = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const idAviso = `${id}-aviso`;
  const mostrarHelp = Boolean(help) && !error;

  const describedBy =
    [mostrarHelp && idHelp, error && idErro, warning && idAviso].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cx('field', className)}>
      <label htmlFor={id}>{label}</label>
      <CampoContexto value={{ id, describedBy, invalid: Boolean(error) }}>{children}</CampoContexto>
      {mostrarHelp && (
        <span id={idHelp} className="help">
          {help}
        </span>
      )}
      {error && (
        <span id={idErro} className="ferr">
          <Icon name="alert" size="sm" />
          {error}
        </span>
      )}
      {warning && (
        <span id={idAviso} className="fwarn">
          <Icon name="alert" size="sm" />
          {warning}
        </span>
      )}
    </div>
  );
}

/** Atributos que o campo recebe do `Field` em volta, se houver. */
function useLigacao(className: string | undefined, extra?: string) {
  const campo = useContext(CampoContexto);
  return {
    id: campo?.id,
    'aria-describedby': campo?.describedBy,
    'aria-invalid': campo?.invalid || undefined,
    className: cx('fld', extra, className),
  };
}

export function Input({
  className,
  paper,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; paper?: boolean }) {
  return <input {...useLigacao(className, paper ? 'paper' : undefined)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea {...useLigacao(className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select {...useLigacao(className)} {...props} />;
}
