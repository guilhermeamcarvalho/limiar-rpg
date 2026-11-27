import { BrowserRouter } from 'react-router';
import { Rotas } from './app/rotas.tsx';
import { SessaoProvider } from './auth/sessao.tsx';
import { PulsoDeClique } from './ui/PulsoDeClique.tsx';
import { RevelarAoRolar } from './ui/RevelarAoRolar.tsx';

export { Rotas };

export function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Rotas />
        <PulsoDeClique />
        <RevelarAoRolar />
      </BrowserRouter>
    </SessaoProvider>
  );
}
