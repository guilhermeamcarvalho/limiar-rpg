// Um jeito só de carregar dados: esqueleto enquanto pede, erro com "tentar de novo" se falhar,
// estado vazio quando não há nada e o conteúdo quando chega. Ver o artboard 17 (Central carregando).
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { ErrorBlock } from './ErrorBlock.tsx';

export type Carga<T> =
  { estado: 'carregando' } | { estado: 'pronto'; dados: T } | { estado: 'erro'; erro: unknown };

export interface UsoDaCarga<T> {
  carga: Carga<T>;
  /** Pede de novo só isto, mostrando o esqueleto enquanto espera. */
  recarregar: () => void;
  /** Ajusta os dados já carregados sem pedir ao servidor (depois de aceitar um convite, por exemplo). */
  mudar: (mudanca: (dados: T) => T) => void;
}

interface Resultado<T> {
  chave: string;
  versao: number;
  carga: Carga<T>;
}

const CARREGANDO = { estado: 'carregando' } as const;

/**
 * Busca dados quando a `chave` muda (a URL pedida, em geral). `null` não busca nada.
 * Resposta que chega depois de a chave mudar é descartada.
 */
export function useCarga<T>(
  chave: string | null,
  buscar: (sinal: AbortSignal) => Promise<T>,
): UsoDaCarga<T> {
  const [versao, setVersao] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);
  const aoBuscar = useEffectEvent(buscar);

  useEffect(() => {
    if (chave === null) return;
    const controle = new AbortController();
    aoBuscar(controle.signal).then(
      (dados) => {
        if (!controle.signal.aborted)
          setResultado({ chave, versao, carga: { estado: 'pronto', dados } });
      },
      (erro: unknown) => {
        if (!controle.signal.aborted)
          setResultado({ chave, versao, carga: { estado: 'erro', erro } });
      },
    );
    return () => {
      controle.abort();
    };
  }, [chave, versao]);

  const atual =
    resultado && resultado.chave === chave && resultado.versao === versao
      ? resultado.carga
      : CARREGANDO;

  return {
    carga: atual,
    recarregar: () => {
      setVersao((v) => v + 1);
    },
    mudar: (mudanca) => {
      setResultado((r) =>
        r?.carga.estado === 'pronto'
          ? { ...r, carga: { estado: 'pronto', dados: mudanca(r.carga.dados) } }
          : r,
      );
    },
  };
}

export interface AsyncProps<T> {
  uso: UsoDaCarga<T>;
  /** Esqueleto no formato do conteúdo. Nunca uma área em branco. */
  esqueleto: ReactNode;
  /** O que não carregou, dito de forma específica: "Os casos não carregaram." */
  falha: string;
  /** Quando os dados contam como vazios, e o que mostrar nesse caso. */
  vazio?: { se: (dados: T) => boolean; mostrar: ReactNode };
  children: (dados: T) => ReactNode;
}

/** Escolhe entre esqueleto, erro, vazio e conteúdo. */
export function Async<T>({ uso, esqueleto, falha, vazio, children }: AsyncProps<T>) {
  const { carga } = uso;
  if (carga.estado === 'carregando') {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Carregando…</span>
        {esqueleto}
      </div>
    );
  }
  if (carga.estado === 'erro') {
    return <ErrorBlock titulo={falha} erro={carga.erro} onRetry={uso.recarregar} />;
  }
  if (vazio?.se(carga.dados)) return <>{vazio.mostrar}</>;
  return <>{children(carga.dados)}</>;
}
