// No celular, algumas páginas trazem o próprio cabeçalho (voltar, título, passo) e a própria barra
// de baixo, como a Criação e a Ficha (#56). A página avisa com `useCelularProprio` e o AppLayout
// esconde os dele. No computador, nada disso aparece: .m-top e .m-tabbar só existem no celular.
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { Marca } from '../ui/index.ts';

export interface CelularProprio {
  /** A página desenha o cabeçalho (`TopoDoCelular`). */
  topo: boolean;
  /** A página desenha a barra de baixo, ou não quer barra (botões fixos da Criação). */
  barra: boolean;
}

export const NADA_PROPRIO: CelularProprio = { topo: false, barra: false };

export const ContextoDoCelular = createContext<(proprio: CelularProprio) => void>(() => undefined);

/** Enquanto a página estiver aberta, o layout não mostra o cabeçalho e/ou a barra dele. */
export function useCelularProprio({ topo, barra }: CelularProprio) {
  const avisar = useContext(ContextoDoCelular);
  // Antes de pintar: o cabeçalho do app não chega a aparecer por um instante.
  useLayoutEffect(() => {
    avisar({ topo, barra });
    return () => {
      avisar(NADA_PROPRIO);
    };
  }, [avisar, topo, barra]);
}

/** O cabeçalho do celular de uma página: à esquerda a marca (ou o voltar), o título e uma ação. */
export function TopoDoCelular({
  inicio = <Marca compacta />,
  titulo,
  subtitulo,
  fim,
}: {
  inicio?: ReactNode;
  titulo: string;
  subtitulo?: string | undefined;
  fim?: ReactNode;
}) {
  return (
    <header className="m-top">
      {inicio}
      <div className="t">
        <b>{titulo}</b>
        {subtitulo && <span className="small muted">{subtitulo}</span>}
      </div>
      {fim}
    </header>
  );
}
