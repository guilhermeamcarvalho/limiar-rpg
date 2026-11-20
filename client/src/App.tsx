import { BrowserRouter } from 'react-router';
import { Rotas } from './app/rotas.tsx';
import { SessaoProvider } from './auth/sessao.tsx';

export { Rotas };

export function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </SessaoProvider>
  );
}
