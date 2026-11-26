// A mesa de ponta a ponta: o servidor escutando numa porta e clientes Socket.IO de verdade.
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as conectarCliente, type Socket } from 'socket.io-client';
import {
  rngComSemente,
  type CampanhaNaLista,
  type ComandoDaMesa,
  type EventoDaMesa,
  type EventosDoCliente,
  type EventosDoServidor,
  type RecusaDaConexao,
  type RegistroDeTeste,
  type RespostaDoComando,
  type RespostaDoRegistro,
} from '@membrana/shared';
import { appDeTeste, casoDeTeste, mapaDeTeste, pessoaLogada } from '../teste/apoio.ts';

type Cliente = Socket<EventosDoServidor, EventosDoCliente>;
type Pessoa = ReturnType<typeof pessoaLogada>;

let app: FastifyInstance | undefined;
const clientes: Cliente[] = [];
afterEach(async () => {
  for (const c of clientes.splice(0)) c.disconnect();
  await app?.close();
  app = undefined;
});

async function servidor() {
  app = await appDeTeste({ discord: null });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.server.address() as AddressInfo;
  const caso = casoDeTeste(app);
  // Um mapa já na mesa: tokens, props e breu precisam de um mapa.
  const mapa = mapaDeTeste(app, caso.caso, { ativo: true });
  return { a: app, url: `http://127.0.0.1:${String(port)}`, mapa, ...caso };
}

/** Os eventos que chegaram a um cliente, com espera pelo próximo que satisfaça uma condição. */
interface Recebidos {
  cliente: Cliente;
  eventos: EventoDaMesa[];
  /** O primeiro evento (a partir do índice `desde`) que satisfaz a condição; espera se preciso. */
  esperar: (condicao: (e: EventoDaMesa) => boolean, desde?: number) => Promise<EventoDaMesa>;
  emitir: (comando: ComandoDaMesa | Record<string, unknown>) => Promise<RespostaDoComando>;
}

function abrir(
  url: string,
  pessoa: Pessoa | null,
  campanhaId: string | undefined,
  {
    origem,
    transporte = 'websocket',
  }: { origem?: string; transporte?: 'websocket' | 'polling' } = {},
): Recebidos {
  const cliente: Cliente = conectarCliente(url, {
    auth: campanhaId === undefined ? {} : { campanhaId },
    extraHeaders: {
      ...(pessoa && { cookie: `membrana_sessao=${pessoa.cookies.membrana_sessao}` }),
      ...(origem && { origin: origem }),
    },
    transports: [transporte],
    reconnection: false,
    forceNew: true,
  });
  clientes.push(cliente);
  const eventos: EventoDaMesa[] = [];
  const esperando: { condicao: (e: EventoDaMesa) => boolean; pronto: (e: EventoDaMesa) => void }[] =
    [];
  cliente.on('evt', (evento) => {
    eventos.push(evento);
    for (const espera of [...esperando]) {
      if (espera.condicao(evento)) {
        esperando.splice(esperando.indexOf(espera), 1);
        espera.pronto(evento);
      }
    }
  });
  return {
    cliente,
    eventos,
    esperar: (condicao, desde = 0) => {
      const ja = eventos.slice(desde).find(condicao);
      if (ja) return Promise.resolve(ja);
      return new Promise((pronto) => esperando.push({ condicao, pronto }));
    },
    emitir: (comando) => cliente.emitWithAck('cmd', comando as ComandoDaMesa),
  };
}

function conectado(r: Recebidos): Promise<void> {
  return new Promise((pronto, falha) => {
    r.cliente.once('connect', () => {
      pronto();
    });
    r.cliente.once('connect_error', falha);
  });
}

function recusado(r: Recebidos): Promise<RecusaDaConexao> {
  return new Promise((pronto, falha) => {
    r.cliente.once('connect', () => {
      falha(new Error('era para recusar a conexão'));
    });
    r.cliente.once('connect_error', (erro: Error & { data?: RecusaDaConexao }) => {
      if (erro.data) pronto(erro.data);
      else falha(erro);
    });
  });
}

const ehDo = (tipo: EventoDaMesa['type']) => (e: EventoDaMesa) => e.type === tipo;

describe('handshake', () => {
  it('sem cookie válido a conexão é recusada', async () => {
    const { url, caso } = await servidor();
    expect(await recusado(abrir(url, null, caso))).toEqual({
      codigo: 'NAO_AUTENTICADO',
      mensagem: 'Entre na sua conta para continuar.',
    });
    const falso = { id: 'x', nome: 'x', cookies: { membrana_sessao: 'inventado' } };
    expect((await recusado(abrir(url, falso, caso))).codigo).toBe('NAO_AUTENTICADO');
  });

  it('não membro não entra na sala, nem fica sabendo se o caso existe', async () => {
    const { url, caso, estranho, bia } = await servidor();
    const naoEncontrado = { codigo: 'CASO_NAO_ENCONTRADO', mensagem: 'Não encontramos este caso.' };
    expect(await recusado(abrir(url, estranho, caso))).toEqual(naoEncontrado);
    expect(await recusado(abrir(url, bia, 'cmp_que_nao_existe'))).toEqual(naoEncontrado);
    expect(await recusado(abrir(url, bia, undefined))).toEqual(naoEncontrado);
  });

  it('conexão vinda de outro site é recusada', async () => {
    const { url, caso, bia } = await servidor();
    expect((await recusado(abrir(url, bia, caso, { origem: 'https://outro.site' }))).codigo).toBe(
      'ORIGEM_INVALIDA',
    );
    await conectado(abrir(url, bia, caso, { origem: 'http://localhost:5173' }));
  });

  it('também conecta pelo polling (quando o WebSocket não passa)', async () => {
    const { url, caso, bia } = await servidor();
    const r = abrir(url, bia, caso, { transporte: 'polling' });
    await conectado(r);
    expect((await r.esperar(ehDo('mesa.estado'))).type).toBe('mesa.estado');
  });
});

describe('na sala', () => {
  it('quem entra recebe o estado do jeito que pode ver e a lista de quem está online', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    await conectado(mestre);
    const jogadora = abrir(url, bia, caso);
    await conectado(jogadora);

    const estado = await jogadora.esperar(ehDo('mesa.estado'));
    expect(estado).toMatchObject({ type: 'mesa.estado', estado: { papel: 'jogador' } });
    expect(estado).not.toHaveProperty('estado.guia');
    expect(await mestre.esperar(ehDo('mesa.estado'))).toHaveProperty('estado.guia', '');

    const comAsDuas = (e: EventoDaMesa) => e.type === 'presence.changed' && e.online.length === 2;
    for (const r of [mestre, jogadora]) {
      expect(await r.esperar(comAsDuas)).toMatchObject({
        online: [
          { id: ana.id, nome: 'Ana', papel: 'mestre', personagemId: null },
          { id: bia.id, nome: 'Bia', papel: 'jogador' },
        ],
      });
    }
  });

  it('o comando vale para todos; o autor recebe o ack', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);

    expect(await mestre.emitir({ type: 'token.create', nome: 'Vulto', x: 100, y: 100 })).toEqual({
      ok: true,
    });
    const criado = await jogadora.esperar(ehDo('token.changed'));
    if (criado.type !== 'token.changed' || !criado.token) throw new Error('sem token');

    expect(
      await mestre.emitir({ type: 'token.move', tokenId: criado.token.id, x: 300, y: 200 }),
    ).toEqual({ ok: true });
    expect(await jogadora.esperar(ehDo('token.moved'))).toMatchObject({ x: 300, y: 200 });
  });

  it('comando recusado volta só ao autor, com o motivo', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);
    await mestre.esperar(ehDo('mesa.estado'));

    expect(await jogadora.emitir({ type: 'round.end' })).toEqual({
      ok: false,
      motivo: 'Só o mestre passa a rodada.',
    });
    expect(await jogadora.emitir({ type: 'token.move', tokenId: 'tok_1', x: -1, y: 0 })).toEqual({
      ok: false,
      motivo: 'A posição não pode ser negativa.',
    });
    // O próximo evento que o mestre vê é o da rodada que ele mesmo passou: nada vazou antes.
    await mestre.emitir({ type: 'round.end' });
    const depoisDoEstado = mestre.eventos.filter((e) => e.type !== 'presence.changed');
    expect(depoisDoEstado.map((e) => e.type)).toEqual(['mesa.estado', 'round.started']);
  });

  it('o jogador não recebe o token oculto', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);

    await mestre.emitir({ type: 'token.create', nome: 'Sombra', x: 1, y: 1, oculto: true });
    await mestre.emitir({ type: 'round.end' });
    await jogadora.esperar(ehDo('round.started'));
    expect(mestre.eventos.some((e) => e.type === 'token.changed')).toBe(true);
    expect(JSON.stringify(jogadora.eventos)).not.toContain('Sombra');
  });

  it('os eventos chegam na ordem da sequência', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);
    await jogadora.esperar(ehDo('mesa.estado'));

    const pedidos = Array.from({ length: 20 }, () => mestre.emitir({ type: 'round.end' }));
    await Promise.all(pedidos);
    await jogadora.esperar((e) => e.type === 'round.started' && e.numero === 21);

    const seqs = jogadora.eventos.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    const rodadas = jogadora.eventos.flatMap((e) => (e.type === 'round.started' ? [e.numero] : []));
    expect(rodadas).toEqual(Array.from({ length: 20 }, (_, i) => i + 2));
  });

  it('ao voltar de uma queda, recebe o estado completo', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    await conectado(mestre);
    await mestre.emitir({ type: 'token.create', nome: 'Vulto', x: 10, y: 10 });

    const primeira = abrir(url, bia, caso);
    await conectado(primeira);
    primeira.cliente.disconnect();
    await mestre.emitir({ type: 'round.end' });

    const segunda = abrir(url, bia, caso);
    await conectado(segunda);
    expect(await segunda.esperar(ehDo('mesa.estado'))).toMatchObject({
      estado: { tokens: [{ nome: 'Vulto' }], rodada: { numero: 2 } },
    });
  });

  it('ficha editada numa rota HTTP chega à sala com número de sequência', async () => {
    const { a, url, caso, davi, bia } = await servidor();
    const jogadora = abrir(url, bia, caso);
    await conectado(jogadora);
    await jogadora.esperar(ehDo('mesa.estado'));

    a.mesa.emitir({
      type: 'character.changed',
      campanhaId: caso,
      personagemId: davi,
      removido: false,
    });
    const evento = await jogadora.esperar(ehDo('character.changed'));
    expect(evento).toMatchObject({ personagemId: davi, removido: false });
    expect(evento.seq).toBeGreaterThan(0);
  });

  it('board.ping chega tanto para quem marcou quanto para os outros na sala', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);

    expect(await jogadora.emitir({ type: 'board.ping', x: 180, y: 240 })).toEqual({ ok: true });
    const [noMestre, naJogadora] = await Promise.all([
      mestre.esperar(ehDo('board.pinged')),
      jogadora.esperar(ehDo('board.pinged')),
    ]);
    expect(noMestre).toMatchObject({ type: 'board.pinged', autorId: bia.id, x: 180, y: 240 });
    expect(naJogadora).toMatchObject({ type: 'board.pinged', autorId: bia.id, x: 180, y: 240 });
  });
});

describe('Mesa aberta na Central', () => {
  it('a mesa fica aberta enquanto o mestre está conectado', async () => {
    const { a, url, caso, ana, bia } = await servidor();
    const aberta = async () => {
      const r = await a.inject({ method: 'GET', url: '/api/campanhas', cookies: bia.cookies });
      return r.json<{ campanhas: CampanhaNaLista[] }>().campanhas[0]?.mesaAbertaDesde ?? null;
    };
    expect(await aberta()).toBeNull();

    // Só a jogadora na mesa: ainda não está aberta.
    const jogadora = abrir(url, bia, caso);
    await conectado(jogadora);
    expect(await aberta()).toBeNull();

    const mestre = abrir(url, ana, caso);
    await conectado(mestre);
    await jogadora.esperar((e) => e.type === 'presence.changed' && e.online.length === 2);
    const desde = await aberta();
    expect(desde).not.toBeNull();
    expect(Date.now() - new Date(desde ?? 0).getTime()).toBeLessThan(5000);

    const marca = jogadora.eventos.length;
    mestre.cliente.disconnect();
    await jogadora.esperar((e) => e.type === 'presence.changed' && e.online.length === 1, marca);
    expect(await aberta()).toBeNull();
  });
});

describe('ao fechar o servidor', () => {
  it('derruba as conexões sem ficar preso; o cliente vai tentar reconectar', async () => {
    const { a, url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);

    const caiu = new Promise<string>((pronto) => {
      jogadora.cliente.once('disconnect', pronto);
    });
    await a.close();
    app = undefined;
    // Queda de transporte, não "o servidor desconectou você": o cliente tenta voltar sozinho.
    expect(await caiu).toBe('transport close');
  });
});

describe('troca de mapa', () => {
  it('trocar o mapa troca para todos ao mesmo tempo, com o mesmo número', async () => {
    const { a, url, caso, ana, bia, caio } = await servidor();
    const porao = mapaDeTeste(a, caso, { nome: 'Porão', largura: 800, altura: 600 });
    const pessoas = [abrir(url, ana, caso), abrir(url, bia, caso), abrir(url, caio, caso)];
    await Promise.all(pessoas.map(conectado));
    await Promise.all(pessoas.map((p) => p.esperar(ehDo('mesa.estado'))));
    const marcas = pessoas.map((p) => p.eventos.length);

    expect(await pessoas[0]?.emitir({ type: 'map.activate', mapaId: porao.id })).toEqual({
      ok: true,
    });
    const recebidos = await Promise.all(
      pessoas.map((p, i) =>
        p.esperar((e) => e.type === 'mesa.estado' && e.estado.mapa?.id === porao.id, marcas[i]),
      ),
    );
    const seqs = new Set(recebidos.map((e) => e.seq));
    expect(seqs.size).toBe(1);
    for (const evento of recebidos) {
      expect(evento).toMatchObject({ estado: { mapa: { nome: 'Porão', largura: 800 } } });
    }
  });
});

describe('caso excluído', () => {
  it('quem está na mesa recebe o aviso e é desconectado, sem tentar voltar', async () => {
    const { a, url, caso, ana, bia } = await servidor();
    const jogadora = abrir(url, bia, caso);
    await conectado(jogadora);
    await jogadora.esperar(ehDo('mesa.estado'));
    const caiu = new Promise<string>((pronto) => {
      jogadora.cliente.once('disconnect', pronto);
    });

    const r = await a.inject({
      method: 'DELETE',
      url: `/api/campanhas/${caso}`,
      cookies: ana.cookies,
      payload: { nome: 'O Sinal de Santa Ermida' },
    });
    expect(r.statusCode).toBe(204);
    expect(await jogadora.esperar(ehDo('campaign.deleted'))).toMatchObject({ campanhaId: caso });
    expect(await caiu).toBe('io server disconnect');

    // E não entra de novo: o caso não existe mais.
    expect((await recusado(abrir(url, bia, caso))).codigo).toBe('CASO_NAO_ENCONTRADO');
  });
});

describe('arrasto', () => {
  it('os outros veem o arrasto; quem arrasta não recebe o próprio eco', async () => {
    const { url, caso, ana, bia } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jogadora = abrir(url, bia, caso);
    await Promise.all([conectado(mestre), conectado(jogadora)]);
    await mestre.emitir({ type: 'token.create', nome: 'Vulto', x: 100, y: 100 });
    const criado = await mestre.esperar(ehDo('token.changed'));
    if (criado.type !== 'token.changed' || !criado.token) throw new Error('sem token');

    await mestre.emitir({ type: 'token.drag', tokenId: criado.token.id, x: 150, y: 120 });
    await mestre.emitir({ type: 'round.end' });
    expect(await jogadora.esperar(ehDo('token.dragging'))).toMatchObject({ x: 150, y: 120 });
    await mestre.esperar(ehDo('round.started'));
    expect(mestre.eventos.some((e) => e.type === 'token.dragging')).toBe(false);
  });
});

describe('dados, testes, chat e registro da sessão', () => {
  it('rolagem secreta e sussurro não chegam aos outros jogadores nem pelo registro HTTP', async () => {
    const { a, url, caso, ana, bia, caio } = await servidor();
    const mestre = abrir(url, ana, caso);
    const jBia = abrir(url, bia, caso);
    const jCaio = abrir(url, caio, caso);
    await Promise.all([conectado(mestre), conectado(jBia), conectado(jCaio)]);
    await Promise.all([mestre, jBia, jCaio].map((p) => p.esperar(ehDo('mesa.estado'))));

    expect(await mestre.emitir({ type: 'dice.roll', expressao: 'd20', secreta: true })).toEqual({
      ok: true,
    });
    expect(
      await mestre.emitir({ type: 'chat.send', texto: 'Segredo para Bia', para: bia.id }),
    ).toEqual({ ok: true });
    expect(await mestre.emitir({ type: 'chat.send', texto: 'Boa noite a todos' })).toEqual({
      ok: true,
    });

    await jCaio.esperar((e) => e.type === 'chat.message' && e.texto === 'Boa noite a todos');
    expect(jCaio.eventos.some((e) => e.type === 'dice.rolled')).toBe(false);
    expect(JSON.stringify(jCaio.eventos)).not.toContain('Segredo para Bia');
    expect(JSON.stringify(jBia.eventos)).toContain('Segredo para Bia');

    // Ao recarregar a página (GET /api/campanhas/:id/registro), cada pessoa só vê o que pode.
    const rCaio = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${caso}/registro`,
      cookies: caio.cookies,
    });
    expect(rCaio.statusCode).toBe(200);
    const regCaio = rCaio.json<RespostaDoRegistro>();
    expect(regCaio.eventos.map((e) => e.type)).toEqual(['chat.message']);
    expect(JSON.stringify(regCaio)).not.toContain('Segredo para Bia');

    const rMestre = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${caso}/registro`,
      cookies: ana.cookies,
    });
    expect(rMestre.json<RespostaDoRegistro>().eventos).toHaveLength(3);
  });

  it('o mesmo teste dá exatamente o mesmo resultado pela ficha HTTP e pela mesa', async () => {
    const appFicha = await appDeTeste({ discord: null, sorteio: rngComSemente(99) });
    await appFicha.ready();
    const casoFicha = casoDeTeste(appFicha);
    const viaHttp = await appFicha.inject({
      method: 'POST',
      url: `/api/personagens/${casoFicha.davi}/testes`,
      cookies: casoFicha.bia.cookies,
      payload: { periciaId: 'maquinas', impeto: true, habilidades: ['gambiarra'] },
    });
    const testeHttp = viaHttp.json<{ teste: RegistroDeTeste }>().teste;
    await appFicha.close();

    app = await appDeTeste({ discord: null, sorteio: rngComSemente(99) });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;
    const casoMesa = casoDeTeste(app);
    const jBia = abrir(`http://127.0.0.1:${String(port)}`, casoMesa.bia, casoMesa.caso);
    const jCaio = abrir(`http://127.0.0.1:${String(port)}`, casoMesa.caio, casoMesa.caso);
    await Promise.all([conectado(jBia), conectado(jCaio)]);

    expect(
      await jBia.emitir({
        type: 'test.resolve',
        personagemId: casoMesa.davi,
        periciaId: 'maquinas',
        impeto: true,
        habilidades: ['gambiarra'],
      }),
    ).toEqual({ ok: true });

    const evtCaio = await jCaio.esperar(ehDo('test.resolved'));
    await jCaio.esperar(ehDo('character.changed'));
    if (evtCaio.type !== 'test.resolved') throw new Error('esperava test.resolved');

    expect(evtCaio.registro.resultado).toEqual(testeHttp.resultado);
    expect(evtCaio.registro.efeitos).toEqual(testeHttp.efeitos);
    expect(evtCaio.registro.falhaCritica).toEqual(testeHttp.falhaCritica);
  });
});
