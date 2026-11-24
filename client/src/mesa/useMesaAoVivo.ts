// A conexão com a mesa ao vivo de um caso: abre o Socket.IO (o cookie de sessão vai junto), aplica
// cada evento e manda os comandos. Caiu? O Socket.IO tenta voltar sozinho, e ao voltar o servidor
// manda o estado completo. A fila de ações offline e a tela de conexão perdida chegam no #76/#77.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ComandoDaMesa,
  EventosDoCliente,
  EventosDoServidor,
  RecusaDaConexao,
  RespostaDoComando,
} from '@membrana/shared';
import { aplicarEvento, MESA_VAZIA } from './estado.ts';

type Conexao = Socket<EventosDoServidor, EventosDoCliente>;

export type SituacaoDaConexao =
  | { estado: 'conectando' }
  | { estado: 'conectada' }
  /** Caiu e está tentando voltar. */
  | { estado: 'caiu' }
  /** O servidor recusou (sem login, ou não é do caso): não adianta tentar de novo. */
  | { estado: 'recusada'; codigo: RecusaDaConexao['codigo']; mensagem: string };

/** Quanto esperar a resposta de um comando antes de desistir. */
const ESPERA_DA_RESPOSTA_MS = 10_000;

export function useMesaAoVivo(campanhaId: string) {
  const [mesa, aplicar] = useReducer(aplicarEvento, MESA_VAZIA);
  const [situacao, setSituacao] = useState<SituacaoDaConexao>({ estado: 'conectando' });
  const conexao = useRef<Conexao | null>(null);

  useEffect(() => {
    const socket: Conexao = io({ auth: { campanhaId } });
    conexao.current = socket;
    socket.on('connect', () => {
      setSituacao({ estado: 'conectada' });
    });
    socket.on('disconnect', () => {
      setSituacao({ estado: 'caiu' });
    });
    socket.on('connect_error', (erro: Error & { data?: RecusaDaConexao }) => {
      // Recusa do servidor vem com o motivo; erro de rede não (e o Socket.IO tenta de novo).
      if (erro.data) {
        setSituacao({ estado: 'recusada', codigo: erro.data.codigo, mensagem: erro.data.mensagem });
      } else {
        setSituacao({ estado: 'caiu' });
      }
    });
    socket.on('evt', aplicar);
    return () => {
      socket.disconnect();
      conexao.current = null;
    };
  }, [campanhaId]);

  const enviar = useCallback(async (comando: ComandoDaMesa): Promise<RespostaDoComando> => {
    const socket = conexao.current;
    if (!socket?.connected) {
      return { ok: false, motivo: 'Sem conexão com a mesa. Tente de novo em instantes.' };
    }
    try {
      // Com timeout, o Socket.IO perde o tipo da resposta; o contrato diz qual é.
      return (await socket
        .timeout(ESPERA_DA_RESPOSTA_MS)
        .emitWithAck('cmd', comando)) as RespostaDoComando;
    } catch {
      return { ok: false, motivo: 'A mesa não respondeu. Tente de novo.' };
    }
  }, []);

  return { mesa, situacao, enviar };
}
