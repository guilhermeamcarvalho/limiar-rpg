import { useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx.ts';

/* ---------- Seletor segmentado ---------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  /** Nome do grupo para o leitor de tela, como "Como rolar os dados". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((opcao) => (
        <button
          key={opcao.value}
          type="button"
          className={cx(opcao.value === value && 'on')}
          aria-pressed={opcao.value === value}
          onClick={() => {
            onChange(opcao.value);
          }}
        >
          {opcao.icon}
          {opcao.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Abas ---------- */

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  /** Número ao lado do nome, como itens no inventário. */
  count?: number;
  /** Pinta o contador de vermelho: são novidades. */
  isNew?: boolean;
}

export interface TabsProps<T extends string> {
  /** Prefixo dos ids, o mesmo passado ao `TabPanel`. */
  idBase: string;
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  dense?: boolean;
}

const idAba = (base: string, id: string) => `${base}-aba-${id}`;
const idPainel = (base: string, id: string) => `${base}-painel-${id}`;

/** Abas no padrão WAI-ARIA: setas, Home e End trocam de aba; Tab sai da lista. */
export function Tabs<T extends string>({
  idBase,
  label,
  items,
  value,
  onChange,
  dense,
}: TabsProps<T>) {
  const botoes = useRef(new Map<T, HTMLButtonElement>());

  function aoTeclar(evento: KeyboardEvent) {
    const atual = items.findIndex((item) => item.id === value);
    const ultimo = items.length - 1;
    const destino = {
      ArrowRight: atual === ultimo ? 0 : atual + 1,
      ArrowLeft: atual === 0 ? ultimo : atual - 1,
      Home: 0,
      End: ultimo,
    }[evento.key];
    const item = destino === undefined ? undefined : items[destino];
    if (!item) return;
    evento.preventDefault();
    onChange(item.id);
    botoes.current.get(item.id)?.focus();
  }

  return (
    <div
      className={cx('tabs', dense && 'tight')}
      role="tablist"
      aria-label={label}
      onKeyDown={aoTeclar}
    >
      {items.map((item) => {
        const ativa = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) botoes.current.set(item.id, el);
              else botoes.current.delete(item.id);
            }}
            type="button"
            role="tab"
            id={idAba(idBase, item.id)}
            aria-controls={idPainel(idBase, item.id)}
            aria-selected={ativa}
            tabIndex={ativa ? 0 : -1}
            className={cx(ativa && 'on')}
            onClick={() => {
              onChange(item.id);
            }}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cx('cnt', item.isNew && 'new')}>
                {item.count}
                {item.isNew && <span className="sr-only"> novos</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  id,
  children,
  className,
}: {
  idBase: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={idPainel(idBase, id)}
      aria-labelledby={idAba(idBase, id)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}

/* ---------- Alternar ---------- */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="switch-row"
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span className={cx('switch', checked && 'on')} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/* ---------- Marcar ---------- */

export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={cx('check', className)}>
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}
