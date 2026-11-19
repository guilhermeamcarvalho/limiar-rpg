import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ExigirLogin } from './auth/ExigirLogin.tsx';
import { SessaoProvider } from './auth/sessao.tsx';
import { Central } from './pages/Central.tsx';
import { Entrar } from './pages/Entrar.tsx';

// Só existe no `pnpm dev`: o build de produção nem inclui esta página.
const Componentes = import.meta.env.DEV ? lazy(() => import('./pages/dev/Componentes.tsx')) : null;

/** Todas as rotas. Separado do roteador para os testes usarem um MemoryRouter. */
export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      {Componentes && (
        <Route
          path="/dev/componentes"
          element={
            <Suspense>
              <Componentes />
            </Suspense>
          }
        />
      )}
      {/* Daqui para baixo, só com login. */}
      <Route element={<ExigirLogin />}>
        <Route path="/" element={<Central />} />
      </Route>
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  );
}

function NaoEncontrada() {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <h1 className="h2">Página não encontrada</h1>
      <p className="muted">
        <a href="/">Voltar para a Central</a>
      </p>
    </main>
  );
}

export function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </SessaoProvider>
  );
}
