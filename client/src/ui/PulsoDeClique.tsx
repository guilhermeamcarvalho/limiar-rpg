// Pulso visual discreto em cada clique do ponteiro, respeitando `prefers-reduced-motion`.
import { useEffect, useRef, useState } from 'react';

interface Pulso {
  id: number;
  x: number;
  y: number;
  interativo: boolean;
}

const DURACAO_MS = 460;
const MAX_PULSOS = 6;

export function PulsoDeClique() {
  const [pulsos, setPulsos] = useState<Pulso[]>([]);
  const proximoId = useRef(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduzido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) return;

    const timers = new Set<ReturnType<typeof setTimeout>>();

    function aoClicar(e: PointerEvent) {
      if (e.button !== 0) return;
      const alvo = e.target instanceof Element ? e.target : null;
      const interativo = Boolean(
        alvo?.closest('button, a, [role="button"], .chip, .tbtn, summary, input[type="checkbox"]'),
      );
      const id = proximoId.current++;
      setPulsos((atual) => [
        ...atual.slice(-(MAX_PULSOS - 1)),
        { id, x: e.clientX, y: e.clientY, interativo },
      ]);

      const timer = setTimeout(() => {
        timers.delete(timer);
        setPulsos((atual) => atual.filter((p) => p.id !== id));
      }, DURACAO_MS);
      timers.add(timer);
    }

    window.addEventListener('pointerdown', aoClicar, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', aoClicar);
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  if (pulsos.length === 0) return null;

  return (
    <div className="pulsos-clique" aria-hidden="true">
      {pulsos.map((p) => (
        <span
          key={p.id}
          className={p.interativo ? 'pulso-clique ativo' : 'pulso-clique'}
          style={{ left: p.x, top: p.y }}
        />
      ))}
    </div>
  );
}
