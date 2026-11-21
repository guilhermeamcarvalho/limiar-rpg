import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { BarreiraDeErro, iniciarObservabilidade } from './observabilidade.ts';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import { ToastProvider } from './ui/index.ts';

iniciarObservabilidade();

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado no index.html');

/** Um erro ao desenhar a tela não deixa a página em branco: avisa e oferece recarregar. */
function TelaDeErro() {
  return (
    <main className="wrap col" style={{ paddingTop: 64, gap: 16 }} role="alert">
      <h1 className="h2">Algo deu errado nesta página</h1>
      <p className="muted">O erro foi registrado. Recarregue para continuar de onde parou.</p>
      <div>
        <button
          type="button"
          className="btn red"
          onClick={() => {
            window.location.reload();
          }}
        >
          Recarregar
        </button>
      </div>
    </main>
  );
}

createRoot(raiz).render(
  <StrictMode>
    <BarreiraDeErro fallback={<TelaDeErro />}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BarreiraDeErro>
  </StrictMode>,
);
