// Socket.IO no mesmo servidor do Fastify, uma sala por campanha (`campanha:<id>`).
// O handshake confere o cookie de sessão e a participação no caso; sem as duas, não conecta.
// Cada comando passa por `Mesa.aplicar`; o autor recebe a resposta pelo ack e cada pessoa da sala
// recebe os eventos filtrados por `projetarEventos`. (O plugin fastify-socket.io parou no
// Fastify 4; ele só fazia isto: criar o Server em cima de `app.server`.)
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type {
  AutenticacaoDaMesa,
  EstadoDaMesa,
  EventoDaMesa,
  EventosDoCliente,
  EventosDoServidor,
  Papel,
  RecusaDaConexao,
  RespostaDoComando,
} from '@membrana/shared';
import { campaigns, memberships } from '../db/schema.ts';
import { buscarSessao, COOKIE_DA_SESSAO, type Usuario } from '../http/auth/sessao.ts';
import { registrarErro } from '../observabilidade.ts';
import type { Mesa } from './Mesa.ts';
import { projetarEstado, projetarEventos, type Espectador } from './projecao.ts';

interface DadosDaConexao {
  usuario: Usuario;
  papel: Papel;
  personagemId: string | null;
  campanhaId: string;
}

type Conexao = Socket<EventosDoCliente, EventosDoServidor, Record<string, never>, DadosDaConexao>;
export type ServidorDaMesa = Server<
  EventosDoCliente,
  EventosDoServidor,
  Record<string, never>,
  DadosDaConexao
>;

export const salaDa = (campanhaId: string) => `campanha:${campanhaId}`;

const espectador = ({ usuario, papel, personagemId }: DadosDaConexao): Espectador => ({
  id: usuario.id,
  papel,
  personagemId,
});

/** O erro do `connect_error`: o cliente lê `erro.data.codigo` e `erro.data.mensagem`. */
function recusa(codigo: RecusaDaConexao['codigo'], mensagem: string) {
  const erro = new Error(mensagem) as Error & { data: RecusaDaConexao };
  erro.data = { codigo, mensagem };
  return erro;
}

function campanhaPedida(auth: unknown): string | null {
  if (typeof auth !== 'object' || auth === null) return null;
  const { campanhaId } = auth as Partial<AutenticacaoDaMesa>;
  return typeof campanhaId === 'string' && campanhaId.length > 0 && campanhaId.length <= 40
    ? campanhaId
    : null;
}

export function ligarMesaAoVivo(app: FastifyInstance): ServidorDaMesa {
  const io: ServidorDaMesa = new Server(app.server, { serveClient: false });
  const origemDoApp = new URL(app.config.BASE_URL).origin;

  io.use((socket, proximo) => {
    // Navegador sempre manda Origin numa conexão de outro site: só aceita a do próprio app.
    const origem = socket.handshake.headers.origin;
    if (origem !== undefined && origem !== origemDoApp) {
      proximo(recusa('ORIGEM_INVALIDA', 'Conexão recusada.'));
      return;
    }

    const cookies = app.parseCookie(socket.handshake.headers.cookie ?? '');
    const token = cookies[COOKIE_DA_SESSAO];
    const usuario = token ? buscarSessao(app.db, token) : null;
    if (!usuario) {
      proximo(recusa('NAO_AUTENTICADO', 'Entre na sua conta para continuar.'));
      return;
    }

    // Quem não participa recebe o mesmo que um caso que não existe: não fica sabendo que existe.
    const campanhaId = campanhaPedida(socket.handshake.auth);
    const participacao =
      campanhaId &&
      app.db
        .select({ papel: memberships.papel, personagemId: memberships.characterId })
        .from(memberships)
        .innerJoin(campaigns, eq(campaigns.id, memberships.campaignId))
        .where(and(eq(memberships.campaignId, campanhaId), eq(memberships.userId, usuario.id)))
        .get();
    if (!campanhaId || !participacao) {
      proximo(recusa('CASO_NAO_ENCONTRADO', 'Não encontramos este caso.'));
      return;
    }

    socket.data = { usuario, campanhaId, ...participacao };
    proximo();
  });

  /** Manda os eventos a cada pessoa da sala, cada uma com a sua projeção. */
  function transmitir(
    campanhaId: string,
    eventos: readonly EventoDaMesa[],
    antes: EstadoDaMesa,
    depois: EstadoDaMesa,
  ) {
    const ids = io.sockets.adapter.rooms.get(salaDa(campanhaId));
    if (!ids) return;
    for (const id of ids) {
      const conexao = io.sockets.sockets.get(id);
      if (!conexao) continue;
      for (const evento of projetarEventos(espectador(conexao.data), eventos, antes, depois)) {
        conexao.emit('evt', evento);
      }
    }
  }

  function avisarPresenca(mesa: Mesa) {
    const online = app.presenca.online(mesa.campanhaId);
    transmitir(
      mesa.campanhaId,
      [mesa.carimbar({ type: 'presence.changed', online })],
      mesa.estado,
      mesa.estado,
    );
  }

  io.on('connection', (conexao: Conexao) => {
    const { usuario, campanhaId, papel, personagemId } = conexao.data;
    const mesa = app.mesas.obter(campanhaId);
    void conexao.join(salaDa(campanhaId));
    app.presenca.entrar(campanhaId, conexao.id, {
      id: usuario.id,
      nome: usuario.nome,
      papel,
      personagemId,
    });

    // Ao entrar (e ao voltar de uma queda): o estado completo, do jeito que esta pessoa pode ver.
    conexao.emit('evt', {
      type: 'mesa.estado',
      estado: projetarEstado(espectador(conexao.data), mesa.estado),
      seq: mesa.seq,
    });
    avisarPresenca(mesa);

    conexao.on('cmd', (comando: unknown, responder: unknown) => {
      const responda =
        typeof responder === 'function'
          ? (responder as (resposta: RespostaDoComando) => void)
          : () => undefined;
      let resultado;
      try {
        resultado = mesa.aplicar(usuario, comando);
      } catch (erro) {
        app.log.error({ err: erro, campanhaId }, 'comando da mesa falhou');
        registrarErro(erro, { metodo: 'WS', url: '/mesa/cmd' });
        responda({ ok: false, motivo: 'Algo deu errado do nosso lado. Tente de novo.' });
        return;
      }
      if (!resultado.ok) {
        responda({ ok: false, motivo: resultado.motivo });
        return;
      }
      responda({ ok: true });
      transmitir(campanhaId, resultado.eventos, resultado.antes, resultado.depois);
    });

    conexao.on('disconnect', () => {
      app.presenca.sair(campanhaId, conexao.id);
      avisarPresenca(mesa);
    });
  });

  // Mudanças que nascem nas rotas HTTP (uma ficha editada) vão para a sala, se houver alguém.
  const pararDeOuvir = app.mesa.ouvir((evento) => {
    if (!io.sockets.adapter.rooms.has(salaDa(evento.campanhaId))) return;
    const mesa = app.mesas.obter(evento.campanhaId);
    transmitir(evento.campanhaId, [mesa.carimbar(evento)], mesa.estado, mesa.estado);
  });

  // Conexões abertas seguram o servidor HTTP: ao fechar, derruba todas antes do Fastify parar.
  // Fecha só o transporte, sem o "servidor desconectou você": assim o cliente tenta reconectar
  // sozinho e volta quando o serviço subir de novo (num deploy, segundos depois).
  // (`io.close()` fecharia o servidor HTTP também, que é do Fastify.)
  app.addHook('preClose', (pronto) => {
    pararDeOuvir();
    io.engine.close();
    pronto();
  });

  return io;
}
