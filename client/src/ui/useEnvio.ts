import { useRef, useState } from 'react';

/**
 * Envio que ignora o segundo clique enquanto o primeiro não termina. A trava é uma ref, então
 * vale até para dois cliques no mesmo quadro, antes de o botão virar "carregando".
 * A `acao` trata os próprios erros: o que ela lançar volta para quem chamou `enviar`.
 */
export function useEnvio<A extends unknown[]>(acao: (...args: A) => Promise<void>) {
  const emCurso = useRef(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(...args: A) {
    if (emCurso.current) return;
    emCurso.current = true;
    setEnviando(true);
    try {
      await acao(...args);
    } finally {
      emCurso.current = false;
      setEnviando(false);
    }
  }

  return { enviar, enviando };
}
