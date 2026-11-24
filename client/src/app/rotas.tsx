// Todas as rotas. Cada página é carregada só quando a pessoa chega nela (lazy).
// Separado do roteador para os testes usarem um MemoryRouter.
import { lazy, Suspense, type ComponentType } from 'react';
import { Link, Route, Routes } from 'react-router';
import { ExigirLogin } from '../auth/ExigirLogin.tsx';
import { AppLayout, CarregandoPagina } from './AppLayout.tsx';

const RECARREGOU = 'membrana.recarregou-por-versao';

/** Sem armazenamento (aba anônima, bloqueado), age como se nunca tivesse recarregado. */
function marca(acao: 'ler' | 'marcar' | 'limpar'): boolean {
  try {
    if (acao === 'ler') return sessionStorage.getItem(RECARREGOU) !== null;
    if (acao === 'marcar') sessionStorage.setItem(RECARREGOU, '1');
    else sessionStorage.removeItem(RECARREGOU);
    return true;
  } catch {
    return false;
  }
}

/**
 * Carrega o código de uma página. Se falhar logo depois de um deploy (a aba aberta pede um
 * arquivo da versão anterior, que não existe mais), recarrega a página uma vez para pegar a
 * versão nova. Se falhar de novo, o erro segue para a tela de erro.
 */
export async function carregarModulo<M>(
  carregar: () => Promise<M>,
  recarregar: () => void = () => {
    window.location.reload();
  },
): Promise<M> {
  try {
    const modulo = await carregar();
    marca('limpar');
    return modulo;
  } catch (erro) {
    // Só recarrega se der para lembrar que recarregou: sem isso, ficaria num laço.
    if (!marca('ler') && marca('marcar')) {
      recarregar();
      // Espera o recarregamento sem mostrar erro nenhum.
      return new Promise<M>(() => undefined);
    }
    throw erro;
  }
}

/** `lazy` para um componente exportado com nome (as páginas não usam export default). */
function pagina<M>(carregar: () => Promise<M>, nome: keyof M) {
  return lazy(async () => ({ default: (await carregarModulo(carregar))[nome] as ComponentType }));
}

const Entrar = pagina(() => import('../pages/Entrar.tsx'), 'Entrar');
const CriarConta = pagina(() => import('../pages/CriarConta.tsx'), 'CriarConta');
const Convite = pagina(() => import('../pages/Convite.tsx'), 'Convite');
const Central = pagina(() => import('../pages/Central.tsx'), 'Central');
const Casos = pagina(() => import('../pages/Casos.tsx'), 'Casos');
const NovoCaso = pagina(() => import('../pages/NovoCaso/index.tsx'), 'NovoCaso');
const Personagens = pagina(() => import('../pages/Personagens.tsx'), 'Personagens');
const Criar = pagina(() => import('../pages/Criar/index.tsx'), 'Criar');
const FichaEmBranco = pagina(() => import('../pages/Ficha/index.tsx'), 'FichaEmBranco');
const FichaDoPersonagem = pagina(() => import('../pages/Ficha/index.tsx'), 'FichaDoPersonagem');
const Arquivo = pagina(() => import('../pages/Arquivo/index.tsx'), 'Arquivo');
const Perfil = pagina(() => import('../pages/Perfil.tsx'), 'Perfil');
const Mesa = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await carregarModulo(() => import('../pages/EmBreve.tsx'));
  return { default: () => <PaginaDaCampanhaEmBreve pagina="mesa" /> };
});
const Escudo = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await carregarModulo(() => import('../pages/EmBreve.tsx'));
  return { default: () => <PaginaDaCampanhaEmBreve pagina="escudo" /> };
});
const Ficha = lazy(async () => {
  const { PaginaDaCampanhaEmBreve } = await carregarModulo(() => import('../pages/EmBreve.tsx'));
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
            <Route path="/personagens/novo" element={<Criar />} />
            <Route path="/personagens/novo/ficha" element={<FichaEmBranco />} />
            <Route path="/personagens/:id/ficha" element={<FichaDoPersonagem />} />
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
