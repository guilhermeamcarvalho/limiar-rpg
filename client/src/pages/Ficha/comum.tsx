// O que a ficha em branco e a ficha salva usam igual: salvar com os erros por campo e o esqueleto.
import { useState } from 'react';
import type { FichaOp2 } from '@membrana/shared';
import { ErroDaApi } from '../../auth/api.ts';
import { Card, Skeleton } from '../../ui/index.ts';

/**
 * 422 do servidor: "ficha.pv" → "pv", o campo como a edição o conhece. O que não é de um campo
 * (como "ficha" inteira) fica de fora: vira a falha geral.
 */
export function camposDaFicha(e: unknown): Record<string, string> {
  if (!(e instanceof ErroDaApi) || !e.campos) return {};
  return Object.fromEntries(
    Object.entries(e.campos)
      .map(([c, m]) => [c.replace(/^ficha\.?/, ''), m] as const)
      .filter(([c]) => c !== '' && c !== '_'),
  );
}

const mensagemDe = (e: unknown) =>
  e instanceof ErroDaApi
    ? e.message
    : 'Não conseguimos falar com o servidor. Suas mudanças continuam aqui; tente de novo.';

const SEM_ERROS: Record<string, string> = {};

/** Salvar: envia, guarda os erros por campo e a falha geral. */
export function useSalvar(enviar: (ficha: FichaOp2) => Promise<void>) {
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>(SEM_ERROS);
  const [falha, setFalha] = useState<string | null>(null);
  async function salvar(ficha: FichaOp2) {
    setSalvando(true);
    setFalha(null);
    try {
      await enviar(ficha);
      setErros(SEM_ERROS);
    } catch (e) {
      const campos = camposDaFicha(e);
      setErros(campos);
      if (Object.keys(campos).length === 0) setFalha(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }
  /** Esquece erros e falha da tentativa anterior (ao cancelar a edição). */
  function limpar() {
    setErros(SEM_ERROS);
    setFalha(null);
  }
  return { salvando, erros, falha, salvar, limpar };
}

export function Esqueleto() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }} aria-busy="true">
      <Card pad className="col">
        <Skeleton variant="h" width="40%" />
        <Skeleton />
        <Skeleton width="70%" />
      </Card>
    </div>
  );
}
