// Todas as rotas. Cada página é carregada só quando a pessoa chega nela (lazy).
// Separado do roteador para os testes usarem um MemoryRouter.
import { lazy, Suspense, type ComponentType } from 'react';
import { Link, Route, Routes } from 'react-router';
import { ExigirLogin } from '../auth/ExigirLogin.tsx';
import { AppLayout, CarregandoPagina } from './AppLayout.tsx';

/** `lazy` para um componente exportado com nome (as páginas não usam export default). */
function pagina<M>(carregar: () => Promise<M>, nome: keyof M) {
  return lazy(async () => ({ default: (await carregar())[nome] as ComponentType }));
}

const Entrar = pagina(() => import('../pages/Entrar.tsx'), 'Entrar');
const CriarConta = pagina(() => import('../pages/CriarConta.tsx'), 'CriarConta');
const Convite = pagina(() => import('../pages/Convite.tsx'), 'Convite');
const Central = pagina(() => import('../pages/Central.tsx'), 'Central');
const Casos = pagina(() => import('../pages/Casos.tsx'), 'Casos');
const NovoCaso = pagina(() => import('../pages/NovoCaso/index.tsx'), 'NovoCaso');
const Personagens = pagina(() => import('../pages/EmBreve.tsx'), 'Personagens');
const Arquivo = pagina(() => import('../pages/EmBreve.tsx'), 'Arquivo');
const Perfil = pagina(() => import('../pages/Perfil.tsx'), 'Perfil');
const Mesa = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await import('../pages/EmBreve.tsx');
  return { default: () => <PaginaDaCampanhaEmBreve pagina="mesa" /> };
});
const Escudo = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await import('../pages/EmBreve.tsx');
  return { default: () => <PaginaDaCampanhaEmBreve pagina="escudo" /> };
});
const Ficha = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await import('../pages/EmBreve.tsx');
  return { default: () => <PaginaDaCampanhaEmBreve pagina="ficha" /> };
});

// Só existe no `pnpm dev`: o build de produção nem inclui esta página.
const Componentes = import.meta.env.DEV ? lazy(() => import('../pages/dev/Componentes.tsx')) : null;

function NaoEncontrada() {
  return (
    <div className="wrap" style={{ paddingTop: 64 }}>
      <h1 className="h2">Página não encontrada</h1>
      <p className="muted">
        <Link to="/">Voltar para a Central</Link>
      </p>
    </div>
  );
}

export function Rotas() {
  return (
    <Suspense fallback={<CarregandoPagina />}>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="/c/:codigo" element={<Convite />} />
        <Route path="/convite" element={<Convite />} />
        {Componentes && <Route path="/dev/componentes" element={<Componentes />} />}
        {/* Daqui para baixo, só com login, dentro do cabeçalho comum. */}
        <Route element={<ExigirLogin />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Central />} />
            <Route path="/casos" element={<Casos />} />
            <Route path="/casos/novo" element={<NovoCaso />} />
            <Route path="/casos/:id" element={<Casos />} />
            <Route path="/personagens" element={<Personagens />} />
            <Route path="/arquivo" element={<Arquivo />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/campanhas/:id/mesa" element={<Mesa />} />
            <Route path="/campanhas/:id/escudo" element={<Escudo />} />
            <Route path="/campanhas/:id/ficha" element={<Ficha />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
