// A conexão com a mesa ao vivo de um caso: abre o Socket.IO (o cookie de sessão vai junto), aplica
// cada evento e manda os comandos. Caiu? O Socket.IO tenta voltar sozinho, e ao voltar o servidor
// manda o estado completo. Movimentos e mensagens feitos offline ficam na fila (#76) e são
// reenviados ao reconectar; rolagens ficam bloqueadas offline.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ComandoDaMesa,
  EventosDoCliente,
  EventosDoServidor,
  RecusaDaConexao,
  RespostaDoComando,
} from '@membrana/shared';
import {
  AVISO_ROLAGEM_OFFLINE,
  descreverAcaoNaFila,
  ehRolagemBloqueadaOffline,
  podeEnfileirarOffline,
  segundosParaTentativa,
  type AcaoNaFila,
} from './conexao.ts';
import { aplicarEvento, MESA_VAZIA } from './estado.ts';

type Conexao = Socket<EventosDoServidor, EventosDoCliente>;

export type SituacaoDaConexao =
  | { estado: 'conectando' }
  | { estado: 'conectada' }
  /** Caiu e está tentando voltar. */
  | { estado: 'caiu'; tentativa: number; emSegundos: number }
  /** O servidor recusou (sem login, ou não é do caso): não adianta tentar de novo. */
  | { estado: 'recusada'; codigo: RecusaDaConexao['codigo']; mensagem: string }
  /** O mestre excluiu o caso enquanto a mesa estava aberta. */
  | { estado: 'excluido' };

/** Depois de recusada ou excluída, a queda que vem em seguida não muda a situação. */
const definitiva = (s: SituacaoDaConexao) => s.estado === 'recusada' || s.estado === 'excluido';

/** Quanto esperar a resposta de um comando antes de desistir. */
const ESPERA_DA_RESPOSTA_MS = 10_000;

export function useMesaAoVivo(campanhaId: string) {
  const [mesa, aplicar] = useReducer(aplicarEvento, MESA_VAZIA);
  const [situacao, setSituacao] = useState<SituacaoDaConexao>({ estado: 'conectando' });
  const [fila, setFila] = useState<AcaoNaFila[]>([]);
  const conexao = useRef<Conexao | null>(null);
  const filaRef = useRef<AcaoNaFila[]>([]);
  const tokensRef = useRef(mesa.visao?.tokens ?? []);
  useEffect(() => {
    tokensRef.current = mesa.visao?.tokens ?? [];
  }, [mesa.visao?.tokens]);

  const descarregarFila = useCallback(async (socket: Conexao) => {
    const pendentes = filaRef.current;
    if (pendentes.length === 0) return;
    filaRef.current = [];
    setFila([]);
    for (const item of pendentes) {
      if (!socket.connected) {
        filaRef.current = [item, ...filaRef.current];
        setFila([...filaRef.current]);
        break;
      }
      try {
        await socket.timeout(ESPERA_DA_RESPOSTA_MS).emitWithAck('cmd', item.comando);
      } catch {
        // Segue tentando os demais itens da fila.
      }
    }
  }, []);

  useEffect(() => {
    const socket: Conexao = io({ auth: { campanhaId } });
    conexao.current = socket;
    const registrarQueda = () => {
      setSituacao((s) => {
        if (definitiva(s)) return s;
        const tentativa = s.estado === 'caiu' ? s.tentativa + 1 : 1;
        return { estado: 'caiu', tentativa, emSegundos: segundosParaTentativa(tentativa) };
      });
    };

    socket.on('connect', () => {
      setSituacao({ estado: 'conectada' });
      void descarregarFila(socket);
    });
    socket.on('disconnect', () => {
      registrarQueda();
    });
    socket.on('connect_error', (erro: Error & { data?: RecusaDaConexao }) => {
      // Recusa do servidor vem com o motivo; erro de rede não (e o Socket.IO tenta de novo).
      if (erro.data) {
        setSituacao({ estado: 'recusada', codigo: erro.data.codigo, mensagem: erro.data.mensagem });
      } else {
        registrarQueda();
      }
    });
    socket.on('evt', (evento) => {
      if (evento.type === 'campaign.deleted') setSituacao({ estado: 'excluido' });
      aplicar(evento);
    });
    return () => {
      socket.disconnect();
      conexao.current = null;
    };
  }, [campanhaId, descarregarFila]);

  // Contagem regressiva visual enquanto está offline.
  const estaCaida = situacao.estado === 'caiu';
  useEffect(() => {
    if (!estaCaida) return;
    const timer = setInterval(() => {
      setSituacao((s) =>
        s.estado === 'caiu' && s.emSegundos > 1 ? { ...s, emSegundos: s.emSegundos - 1 } : s,
      );
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [estaCaida]);

  const tentarAgora = useCallback(() => {
    const socket = conexao.current;
    if (!socket || socket.connected) return;
    setSituacao((s) =>
      s.estado === 'caiu'
        ? {
            estado: 'caiu',
            tentativa: s.tentativa + 1,
            emSegundos: segundosParaTentativa(s.tentativa + 1),
          }
        : s,
    );
    socket.connect();
  }, []);

  const enviar = useCallback(async (comando: ComandoDaMesa): Promise<RespostaDoComando> => {
    const socket = conexao.current;
    if (!socket?.connected) {
      if (ehRolagemBloqueadaOffline(comando)) {
        return { ok: false, motivo: AVISO_ROLAGEM_OFFLINE };
      }
      if (podeEnfileirarOffline(comando)) {
        const item: AcaoNaFila = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          comando,
          descricao: descreverAcaoNaFila(comando, tokensRef.current),
        };
        filaRef.current = [...filaRef.current, item];
        setFila(filaRef.current);
        return { ok: true };
      }
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

  return { mesa, situacao, fila, enviar, tentarAgora };
}
