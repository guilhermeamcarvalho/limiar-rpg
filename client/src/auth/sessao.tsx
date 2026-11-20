// Quem está logado, para o app inteiro. Pergunta ao servidor uma vez (GET /api/me) e guarda.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ErroDaApi, pedir } from './api.ts';

export interface Usuario {
  id: string;
  nome: string;
  email: string | null;
}

export type EstadoDaSessao =
  | { estado: 'carregando' }
  /** `saiu`: a pessoa clicou em Sair agora (não é sessão expirada); não lembra a página. */
  | { estado: 'anonimo'; saiu?: true }
  | { estado: 'logado'; usuario: Usuario }
  /** Servidor fora do ar ou sem rede: não dá para saber se há sessão. */
  | { estado: 'erro'; mensagem: string };

interface Sessao {
  sessao: EstadoDaSessao;
  /** Pergunta de novo ao servidor (depois de entrar por e-mail, por exemplo). */
  recarregar: () => Promise<void>;
  /** Apaga a sessão no servidor e volta a anônimo. */
  sair: () => Promise<void>;
}

const SessaoContexto = createContext<Sessao | null>(null);

async function perguntar(): Promise<EstadoDaSessao> {
  try {
    const { usuario } = await pedir<{ usuario: Usuario }>('/api/me');
    return { estado: 'logado', usuario };
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 401) return { estado: 'anonimo' };
    return { estado: 'erro', mensagem: 'Não conseguimos falar com o servidor.' };
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<EstadoDaSessao>({ estado: 'carregando' });

  useEffect(() => {
    let ativo = true;
    void perguntar().then((resultado) => {
      if (ativo) setSessao(resultado);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const recarregar = useCallback(async () => {
    setSessao(await perguntar());
  }, []);

  const sair = useCallback(async () => {
    await pedir('/api/auth/sair', { method: 'POST' });
    setSessao({ estado: 'anonimo', saiu: true });
  }, []);

  const valor = useMemo(() => ({ sessao, recarregar, sair }), [sessao, recarregar, sair]);
  return <SessaoContexto value={valor}>{children}</SessaoContexto>;
}

/** Estado da sessão: carregando, anônimo, logado (com o usuário) ou erro. */
export function useMe(): Sessao {
  const sessao = useContext(SessaoContexto);
  if (!sessao) throw new Error('useMe precisa de um <SessaoProvider> em volta');
  return sessao;
}
