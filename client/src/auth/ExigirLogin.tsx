import { Navigate, Outlet, useLocation } from 'react-router';
import { Banner, Button, Card, Skeleton } from '../ui/index.ts';
import { useMe } from './sessao.tsx';

/**
 * Envolve as rotas que precisam de login. Sem sessão, manda para /entrar lembrando a página
 * (?voltar=/casos/123), para voltar a ela depois de entrar.
 */
export function ExigirLogin() {
  const { sessao, recarregar } = useMe();
  const local = useLocation();

  if (sessao.estado === 'carregando') {
    return (
      <main className="wrap" style={{ paddingTop: 48 }} aria-busy="true">
        <Card pad className="col">
          <Skeleton variant="h" width="40%" />
          <Skeleton />
          <Skeleton width="70%" />
        </Card>
      </main>
    );
  }

  if (sessao.estado === 'erro') {
    return (
      <main className="wrap" style={{ paddingTop: 48 }}>
        <Banner
          tone="err"
          action={
            <Button size="sm" onClick={() => void recarregar()}>
              Tentar de novo
            </Button>
          }
        >
          {sessao.mensagem}
        </Banner>
      </main>
    );
  }

  if (sessao.estado === 'anonimo') {
    const voltar = `${local.pathname}${local.search}`;
    const destino = voltar === '/' ? '/entrar' : `/entrar?voltar=${encodeURIComponent(voltar)}`;
    return <Navigate to={destino} replace />;
  }

  return <Outlet />;
}
