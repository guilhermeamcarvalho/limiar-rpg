import { useEffect } from 'react';
import { tituloDaPagina } from '@limiar/shared';

export function App() {
  useEffect(() => {
    document.title = tituloDaPagina('Central');
  }, []);

  return <h1>{tituloDaPagina()}</h1>;
}
