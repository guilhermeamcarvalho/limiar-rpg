import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.ts';

/* ---------- Etiqueta e chip ---------- */

export function Tag({
  tone,
  children,
}: {
  /** vermelho: Executor; azul: Analista; verde: Vigilante; dourado: mestre; tinta: estado do caso. */
  tone?: 'red' | 'blue' | 'green' | 'gold' | 'ink';
  children: ReactNode;
}) {
  return <span className={cx('tag', tone)}>{children}</span>;
}

const PONTOS = { online: 'g', away: 'y', off: 'm', alert: undefined } as const;

export function Chip({ status, children }: { status?: keyof typeof PONTOS; children: ReactNode }) {
  return (
    <span className="chip">
      {status && <span className={cx('dot', PONTOS[status])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */

const ANEIS = { red: undefined, blue: 'b', green: 'g', gold: 'y', none: 'n' } as const;

export interface AvatarProps {
  /** Até duas letras. Sem pessoa, use "?" com `tone="none"`. */
  initials: string;
  /** Nome completo, lido pelo leitor de tela. O avatar nunca aparece sem o nome por perto. */
  name: string;
  /** Cor do anel: diz o perfil. */
  tone?: keyof typeof ANEIS;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({ initials, name, tone = 'red', size = 'md' }: AvatarProps) {
  return (
    <span
      className={cx('av', ANEIS[tone], size !== 'md' && size)}
      role="img"
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}

/* ---------- Dado ---------- */

export type TipoDeDado = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

const PAPEIS = {
  atributo: { classe: undefined, nome: 'atributo' },
  pericia: { classe: 'w', nome: 'perícia' },
  bonus: { classe: 'y', nome: 'bônus' },
} as const;

export interface DieProps {
  /** A forma do dado. */
  type: TipoDeDado;
  value: number;
  /** A cor: vermelho atributo, branco perícia, dourado bônus. */
  role?: keyof typeof PAPEIS;
  /** Apagado: não entrou na soma. */
  discarded?: boolean;
  size?: 'md' | 'lg' | 'xl';
}

export function Die({ type, value, role = 'atributo', discarded, size = 'md' }: DieProps) {
  const papel = PAPEIS[role];
  return (
    <span
      className={cx('dz', type, papel.classe, size !== 'md' && size, discarded && 'off')}
      role="img"
      aria-label={`${type} de ${papel.nome}: ${String(value)}${discarded ? ', descartado' : ''}`}
    >
      {value}
    </span>
  );
}

/* ---------- Recursos ---------- */

/** Acima disso a barra vira medidor contínuo. */
export const MAX_CAIXAS = 20;

const RECURSOS = {
  pv: { nome: 'PV', rotulo: 'lab red', caixas: 'boxes' },
  pd: { nome: 'PD', rotulo: 'lab pd', caixas: 'boxes pd' },
  impeto: { nome: 'Ímpeto', rotulo: 'lab gold', caixas: 'boxes imp' },
} as const;

const METROS = { pv: 'pv', pd: 'pd', impeto: 'imp' } as const;

export function Meter({
  value,
  max,
  label,
  kind,
}: {
  value: number;
  max: number;
  label: string;
  kind?: keyof typeof METROS;
}) {
  const atual = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (atual / max) * 100 : 0;
  return (
    <div
      className={cx('meter', kind && METROS[kind])}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={atual}
    >
      <i style={{ width: `${String(pct)}%` }} />
    </div>
  );
}

export function ResourceBar({
  kind,
  value,
  max,
}: {
  kind: keyof typeof RECURSOS;
  value: number;
  max: number;
}) {
  const recurso = RECURSOS[kind];
  const atual = Math.min(Math.max(value, 0), max);
  const texto = `${String(atual)}/${String(max)}`;

  return (
    <div className="res-row">
      <span className={recurso.rotulo}>{recurso.nome}</span>
      {max <= MAX_CAIXAS ? (
        <div
          className={recurso.caixas}
          role="meter"
          aria-label={recurso.nome}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={atual}
        >
          {Array.from({ length: max }, (_, i) => (
            <i key={i} className={cx(i >= atual && 'o')} />
          ))}
        </div>
      ) : (
        <Meter value={atual} max={max} label={recurso.nome} kind={kind} />
      )}
      <b aria-hidden="true">{texto}</b>
    </div>
  );
}

/* ---------- Superfícies ---------- */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Espaçamento interno padrão. */
  pad?: boolean;
  /** `highlight`: borda vermelha (ativo); `selected`: borda verde (escolhido). */
  state?: 'highlight' | 'selected';
}

export function Card({ pad, state, className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        'card',
        pad && 'pad',
        state === 'highlight' && 'hl',
        state === 'selected' && 'sel',
        className,
      )}
      {...props}
    />
  );
}

/** Papel e tinta: só para coisas do mundo do jogo. */
export function Paper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('paper', className)} {...props} />;
}

/** Bilhete datilografado, como a nota do mestre. */
export function Note({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('note', className)} {...props} />;
}

/* ---------- Avisos fixos e estados ---------- */

export function Banner({
  tone,
  icon,
  action,
  children,
}: {
  tone?: 'ok' | 'warn' | 'err';
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cx('banner', tone)} role={tone === 'err' ? 'alert' : 'status'}>
      {icon}
      <span className="grow">{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <b className="h3">{title}</b>
      {children && <p className="muted small">{children}</p>}
      {action}
    </div>
  );
}

/** Esqueleto no formato do conteúdo. Quem o contém marca `aria-busy`. */
export function Skeleton({ variant = 't', width }: { variant?: 't' | 'h'; width?: string }) {
  return (
    <div className={cx('skel', variant)} style={width ? { width } : undefined} aria-hidden="true" />
  );
}
