import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.tsx';
import { cx } from './cx.ts';
import { Icon, type NomeDoIcone } from './Icon.tsx';

const IconeFechar = () => <Icon name="close" />;

/* ---------- Foco preso (Modal e Sheet) ---------- */

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
}

/**
 * Ao abrir: foca o primeiro campo e trava a rolagem da página.
 * Enquanto aberto: Tab e Shift+Tab dão a volta dentro da janela; Esc fecha.
 * Ao fechar: devolve o foco a quem abriu.
 */
function useJanela(aberta: boolean, aoFechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    const janela = ref.current;
    if (!aberta || !janela) return;
    const gatilho = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (focaveis(janela)[0] ?? janela).focus();

    return () => {
      document.body.style.overflow = rolagem;
      gatilho?.focus();
    };
  }, [aberta]);

  function aoTeclar(evento: KeyboardEvent) {
    const janela = ref.current;
    if (!janela) return;
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      aoFecharRef.current();
      return;
    }
    if (evento.key !== 'Tab') return;
    const itens = focaveis(janela);
    const primeiro = itens[0];
    const ultimo = itens.at(-1);
    if (!primeiro || !ultimo) {
      evento.preventDefault();
      return;
    }
    if (
      evento.shiftKey &&
      (document.activeElement === primeiro || document.activeElement === janela)
    ) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  return { ref, aoTeclar };
}

interface JanelaProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  closeLabel?: string;
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = 'Fechar',
}: JanelaProps & { footer?: ReactNode }) {
  const { ref, aoTeclar } = useJanela(open, onClose);
  const idTitulo = useId();
  if (!open) return null;

  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={aoTeclar}
      >
        <div className="modal-h">
          <h2 id={idTitulo} className="lab">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconeFechar />}
            aria-label={closeLabel}
            onClick={onClose}
          />
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Gaveta do celular ---------- */

export function Sheet({ open, onClose, title, children, closeLabel = 'Fechar' }: JanelaProps) {
  const { ref, aoTeclar } = useJanela(open, onClose);
  const idTitulo = useId();
  if (!open) return null;

  return createPortal(
    <div
      className="scrim bottom"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={aoTeclar}
      >
        <div className="grab" aria-hidden="true">
          <i />
        </div>
        <div className="sheet-b">
          <div className="row between">
            <h2 id={idTitulo} className="h3">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              icon={<IconeFechar />}
              aria-label={closeLabel}
              onClick={onClose}
            />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toast ---------- */

export type TipoDeAviso = 'ok' | 'warn' | 'err' | 'info';

/** No máximo 3 avisos na tela; o mais antigo sai quando chega o quarto. */
export const MAX_AVISOS = 3;
const DURACAO_MS: Record<TipoDeAviso, number> = { ok: 5000, info: 5000, warn: 8000, err: 10000 };

export interface AvisoNovo {
  type?: TipoDeAviso;
  title: ReactNode;
  text?: ReactNode;
  /** Troca o ícone padrão do tipo; `null` tira o ícone. */
  icon?: ReactNode;
  /** Um botão no aviso, como "Desfazer". Clicar faz a ação e fecha o aviso. */
  action?: { label: string; onClick: () => void };
}

const ICONE_DO_AVISO: Record<TipoDeAviso, NomeDoIcone> = {
  ok: 'check',
  warn: 'alert',
  err: 'alert',
  info: 'info',
};

interface Aviso extends AvisoNovo {
  id: number;
}

export function Toast({
  type = 'info',
  title,
  text,
  icon,
  action,
  onClose,
}: AvisoNovo & { onClose?: () => void }) {
  return (
    <div
      className={cx('toast', type !== 'info' && type)}
      role={type === 'err' ? 'alert' : 'status'}
    >
      {icon === undefined ? <Icon name={ICONE_DO_AVISO[type]} /> : icon}
      <div>
        <b>{title}</b>
        {text}
      </div>
      {action && (
        <Button
          size="sm"
          className="toast-acao"
          onClick={() => {
            action.onClick();
            onClose?.();
          }}
        >
          {action.label}
        </Button>
      )}
      {onClose && (
        <Button
          className="toast-x"
          variant="ghost"
          size="sm"
          icon={<IconeFechar />}
          aria-label="Dispensar aviso"
          onClick={onClose}
        />
      )}
    </div>
  );
}

function AvisoTemporario({ aviso, aoSair }: { aviso: Aviso; aoSair: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(
      () => {
        aoSair(aviso.id);
      },
      DURACAO_MS[aviso.type ?? 'info'],
    );
    return () => {
      clearTimeout(t);
    };
  }, [aviso, aoSair]);

  return (
    <Toast
      {...aviso}
      onClose={() => {
        aoSair(aviso.id);
      }}
    />
  );
}

interface Avisos {
  show: (aviso: AvisoNovo) => number;
  dismiss: (id: number) => void;
}

const AvisosContexto = createContext<Avisos | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximoId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
  }, []);

  const show = useCallback((aviso: AvisoNovo) => {
    const id = proximoId.current++;
    setAvisos((lista) => [...lista, { ...aviso, id }].slice(-MAX_AVISOS));
    return id;
  }, []);

  const valor = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <AvisosContexto value={valor}>
      {children}
      <section className="toasts" aria-label="Avisos">
        {avisos.map((aviso) => (
          <AvisoTemporario key={aviso.id} aviso={aviso} aoSair={dismiss} />
        ))}
      </section>
    </AvisosContexto>
  );
}

export function useToast(): Avisos {
  const avisos = useContext(AvisosContexto);
  if (!avisos) throw new Error('useToast precisa de um <ToastProvider> em volta');
  return avisos;
}
