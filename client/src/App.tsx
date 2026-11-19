import { lazy, Suspense, useEffect } from 'react';
import { tituloDaPagina } from '@limiar/shared';

// Só existe no `pnpm dev`: o build de produção nem inclui esta página.
const Componentes = import.meta.env.DEV ? lazy(() => import('./pages/dev/Componentes.tsx')) : null;

export function App() {
  const pagina =
    Componentes && window.location.pathname === '/dev/componentes' ? 'Componentes' : 'Central';

  useEffect(() => {
    document.title = tituloDaPagina(pagina);
  }, [pagina]);

  if (Componentes && pagina === 'Componentes') {
    return (
      <Suspense>
        <Componentes />
      </Suspense>
    );
  }

  return <h1>{tituloDaPagina()}</h1>;
}
