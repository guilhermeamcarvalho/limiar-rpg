// Observador leve de scroll reveal: anima blocos abaixo da dobra quando entram na tela,
// mantendo tudo visível se `IntersectionObserver` não existir ou com movimento reduzido.
import { useEffect } from 'react';
import { useLocation } from 'react-router';

const SELETOR_REVELAR =
  'main section, main .card, main .paper, main .arq-detalhe, .escudo-grade > *';

export function RevelarAoRolar() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') return;
    const reduzido =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) return;

    const vistos = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.remove('revelar-pendente');
          entrada.target.classList.add('revelar-visivel');
          io.unobserve(entrada.target);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );

    function registrar() {
      const altura = window.innerHeight || 0;
      if (altura <= 0) return;
      for (const el of document.querySelectorAll(SELETOR_REVELAR)) {
        if (vistos.has(el)) continue;
        vistos.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.top > altura * 0.96) {
          el.classList.add('revelar-pendente');
          io.observe(el);
        }
      }
    }

    registrar();
    const mo = new MutationObserver(registrar);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
