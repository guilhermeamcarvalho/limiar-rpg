import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  ComandoDaMesa,
  EventoDaMesa,
  MapaDoCaso,
  RespostaDoComando,
  TokenNaMesa,
  VisaoDaMesa,
} from '@membrana/shared';
import type { PalcoProps } from '../../mesa/Palco.tsx';
import { abrir, detalhe, json, MARTA, servidor } from '../../teste/apoio.tsx';
import { nomeDoToken } from './index.tsx';

type Ouvinte = (...args: unknown[]) => void;

/** Um Socket.IO de mentira: o teste dispara os eventos do servidor e responde os comandos. */
class SocketFalso {
  connected = false;
  ouvintes = new Map<string, Ouvinte[]>();
  comandos: ComandoDaMesa[] = [];
  responder: (comando: ComandoDaMesa) => RespostaDoComando = () => ({ ok: true });
  disconnect = vi.fn();
  readonly opcoes: unknown;
  constructor(opcoes: unknown) {
    this.opcoes = opcoes;
  }
  on(evento: string, ouvinte: Ouvinte) {
    this.ouvintes.set(evento, [...(this.ouvintes.get(evento) ?? []), ouvinte]);
    return this;
  }
  timeout() {
    return {
      emitWithAck: (_evento: string, comando: ComandoDaMesa) => {
        this.comandos.push(comando);
        return Promise.resolve(this.responder(comando));
      },
    };
  }
  disparar(evento: string, ...args: unknown[]) {
    act(() => {
      for (const ouvinte of this.ouvintes.get(evento) ?? []) ouvinte(...args);
    });
  }
  conectar() {
    this.connected = true;
    this.disparar('connect');
  }
  receber(evento: EventoDaMesa) {
    this.disparar('evt', evento);
  }
}

const falso = vi.hoisted(() => {
  const guardados: { sockets: unknown[]; palco: unknown } = { sockets: [], palco: null };
  return guardados;
});

vi.mock('socket.io-client', () => ({
  io: (opcoes: unknown) => {
    const socket = new SocketFalso(opcoes);
    falso.sockets.push(socket);
    return socket;
  },
}));

// O jsdom não tem canvas: o palco vira um marcador, e o teste guarda o que a página passou a ele.
vi.mock('../../mesa/Palco.tsx', () => ({
  Palco: (props: PalcoProps) => {
    falso.palco = props;
    return <div data-testid="palco">{props.visao.mapa.nome}</div>;
  },
}));

const socket = () => falso.sockets.at(-1) as SocketFalso;
const palco = () => falso.palco as PalcoProps;

const MAPA = {
  id: 'map_1',
  nome: 'Rádio, 2º andar',
  imagem: `${'a'.repeat(64)}.webp`,
  largura: 1000,
  altura: 800,
  grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
};

const token = (campos: Partial<TokenNaMesa> = {}): TokenNaMesa => ({
  id: 'tok_1',
  nome: 'Davi',
  imagem: null,
  x: 100,
  y: 100,
  tamanho: 1,
  oculto: false,
  personagemId: 'chr_1',
  donoId: MARTA.id,
  ...campos,
});

const visao = (campos: Partial<VisaoDaMesa> = {}): VisaoDaMesa => ({
  papel: 'jogador',
  mapa: MAPA,
  tokens: [],
  props: [],
  nevoa: [],
  pistas: [],
  inventario: [],
  rodada: { numero: 3 },
  trilha: null,
  ...campos,
});

const MAPA_NA_LISTA: MapaDoCaso = { ...MAPA, ativo: false, criadoEm: '2026-11-20T10:00:00Z' };

function abrirMesa(rotas: Parameters<typeof servidor>[0] = {}) {
  const chamadas = servidor({
    'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe() }),
    ...rotas,
  });
  abrir('/campanhas/cmp_1/mesa');
  return chamadas;
}

/** Abre a mesa, conecta e recebe o estado. */
async function naMesa(estado: VisaoDaMesa, rotas: Parameters<typeof servidor>[0] = {}) {
  const chamadas = abrirMesa(rotas);
  await screen.findByText('Conectando à mesa…');
  socket().conectar();
  socket().receber({ type: 'mesa.estado', estado, seq: 1 });
  return chamadas;
}

beforeEach(() => {
  falso.sockets.length = 0;
  falso.palco = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('conexão', () => {
  it('conecta à mesa do caso da URL e mostra o mapa quando o estado chega', async () => {
    await naMesa(visao());
    expect((socket().opcoes as { auth: unknown }).auth).toEqual({ campanhaId: 'cmp_1' });
    expect(await screen.findByTestId('palco')).toHaveProperty('textContent', 'Rádio, 2º andar');
    expect(screen.getByRole('heading', { name: 'O Sinal de Santa Ermida' })).toBeDefined();
    expect(screen.getByText('Rodada 3')).toBeDefined();
    expect(screen.getByText('Ao vivo')).toBeDefined();
  });

  it('recusada pelo servidor: diz por quê e leva de volta à Central', async () => {
    abrirMesa();
    await screen.findByText('Conectando à mesa…');
    socket().disparar(
      'connect_error',
      Object.assign(new Error('x'), {
        data: { codigo: 'CASO_NAO_ENCONTRADO', mensagem: 'Não encontramos este caso.' },
      }),
    );
    expect(await screen.findByText('Não encontramos este caso.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Voltar para a Central' })).toBeDefined();
  });

  it('caiu: avisa que está tentando voltar, sem tirar o mapa da tela', async () => {
    await naMesa(visao());
    socket().disparar('disconnect');
    expect(await screen.findByText('Conexão perdida. Tentando voltar…')).toBeDefined();
    expect(screen.getByTestId('palco')).toBeDefined();
    expect(screen.getByText('Sem conexão')).toBeDefined();
  });

  it('sair da página fecha a conexão', async () => {
    await naMesa(visao());
    const s = socket();
    cleanup();
    expect(s.disconnect).toHaveBeenCalled();
  });
});

describe('sem mapa', () => {
  it('jogador: espera o mestre, sem ferramentas', async () => {
    await naMesa(visao({ mapa: null }));
    expect(await screen.findByText('O mestre ainda não pôs um mapa na mesa.')).toBeDefined();
    expect(screen.queryByRole('toolbar', { name: 'Ferramentas' })).toBeNull();
  });

  it('mestre: escolhe um mapa da lista e põe na mesa', async () => {
    await naMesa(visao({ papel: 'mestre', mapa: null }), {
      'GET /api/campanhas/cmp_1/mapas': json(200, { mapas: [MAPA_NA_LISTA] }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Escolher mapa' }));
    const painel = await screen.findByRole('complementary', { name: 'Mapa e grade' });
    fireEvent.click(await within(painel).findByRole('button', { name: 'Usar' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([{ type: 'map.activate', mapaId: 'map_1' }]);
    });
  });
});

describe('mapa e grade (mestre)', () => {
  const doMestre = () =>
    naMesa(visao({ papel: 'mestre' }), {
      'GET /api/campanhas/cmp_1/mapas': json(200, { mapas: [{ ...MAPA_NA_LISTA, ativo: true }] }),
    });

  async function abrirPainel() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mapa e grade, ferramenta do mestre' }),
    );
    return screen.findByRole('complementary', { name: 'Mapa e grade' });
  }

  it('a tecla G abre e fecha a ferramenta', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'g' });
    expect(await screen.findByRole('complementary', { name: 'Mapa e grade' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'g' });
    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Mapa e grade' })).toBeNull();
    });
  });

  it('o mapa da mesa aparece marcado e sem os botões de usar e apagar', async () => {
    await doMestre();
    const painel = await abrirPainel();
    expect(await within(painel).findByText(/na mesa/)).toBeDefined();
    expect(within(painel).queryByRole('button', { name: 'Usar' })).toBeNull();
  });

  it('ajustar a grade manda o comando com números; recusa aparece no campo', async () => {
    await doMestre();
    const painel = await abrirPainel();
    fireEvent.change(within(painel).getByLabelText('Tamanho da célula (px)'), {
      target: { value: '70' },
    });
    fireEvent.change(within(painel).getByLabelText('Deslocamento X'), { target: { value: '12' } });
    socket().responder = () => ({ ok: false, motivo: 'A célula vai de 10 a 500 px.' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Aplicar grade' }));
    expect(await within(painel).findByText('A célula vai de 10 a 500 px.')).toBeDefined();
    expect(socket().comandos).toEqual([
      { type: 'map.grid', grade: { celula: 70, deslocamentoX: 12, deslocamentoY: 0 } },
    ]);
  });

  it('mapa acima de 20 MB é barrado antes de enviar, com o aviso do design', async () => {
    const chamadas = await doMestre();
    const painel = await abrirPainel();
    const grande = new File(['x'], 'enorme.jpg', { type: 'image/jpeg' });
    Object.defineProperty(grande, 'size', { value: 21 * 1024 * 1024 });
    fireEvent.change(within(painel).getByLabelText('Arquivo do mapa'), {
      target: { files: [grande] },
    });
    expect(await screen.findByText('Mapa acima de 20 MB. Reduza para 4096 px.')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('enviar mapa: entra na lista', async () => {
    const novo: MapaDoCaso = { ...MAPA_NA_LISTA, id: 'map_2', nome: 'Porão' };
    const chamadas = await naMesa(visao({ papel: 'mestre' }), {
      'GET /api/campanhas/cmp_1/mapas': json(200, { mapas: [] }),
      'POST /api/campanhas/cmp_1/mapas': json(201, { mapa: novo }),
    });
    const painel = await abrirPainel();
    await within(painel).findByText('Nenhum mapa ainda. Envie o primeiro.');
    fireEvent.change(within(painel).getByLabelText('Arquivo do mapa'), {
      target: { files: [new File(['x'], 'porao.jpg', { type: 'image/jpeg' })] },
    });
    expect(await within(painel).findByText('Porão')).toBeDefined();
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      arquivo: { nome: 'porao.jpg', tipo: 'image/jpeg' },
    });
  });
});

describe('imagem solta sobre o mapa (RF-24)', () => {
  const imagem = () => new File(['x'], 'vulto-no-corredor.png', { type: 'image/png' });
  const nome = `${'b'.repeat(64)}.webp`;

  it('mestre: vira um token onde caiu (dentro do mapa)', async () => {
    const chamadas = await naMesa(visao({ papel: 'mestre' }), {
      'POST /api/campanhas/cmp_1/imagens': json(201, { nome }),
    });
    await screen.findByTestId('palco');
    palco().aoSoltarImagem?.(imagem(), { x: 5000, y: 40 });
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'token.create', nome: 'vulto-no-corredor', imagem: nome, x: 1000, y: 40 },
      ]);
    });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      uso: 'token',
      arquivo: { nome: 'vulto-no-corredor.png', tipo: 'image/png' },
    });
  });

  it('jogador: troca a imagem do próprio token', async () => {
    await naMesa(visao({ tokens: [token()] }), {
      'POST /api/campanhas/cmp_1/imagens': json(201, { nome }),
    });
    await screen.findByTestId('palco');
    palco().aoSoltarImagem?.(imagem(), { x: 10, y: 10 });
    await waitFor(() => {
      expect(socket().comandos).toEqual([{ type: 'token.update', tokenId: 'tok_1', imagem: nome }]);
    });
  });

  it('jogador sem token no mapa: avisa e não envia nada', async () => {
    const chamadas = await naMesa(visao({ tokens: [token({ donoId: 'usr_outro' })] }));
    await screen.findByTestId('palco');
    palco().aoSoltarImagem?.(imagem(), { x: 10, y: 10 });
    expect(await screen.findByText('Você ainda não tem um token neste mapa')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
    expect(socket().comandos).toEqual([]);
  });

  it('o que não é imagem é recusado antes de enviar', async () => {
    await naMesa(visao({ papel: 'mestre' }));
    await screen.findByTestId('palco');
    palco().aoSoltarImagem?.(new File(['x'], 'notas.txt', { type: 'text/plain' }), {
      x: 1,
      y: 1,
    });
    expect(await screen.findByText('Isso não é uma imagem')).toBeDefined();
  });

  it('o nome do token sai do nome do arquivo', () => {
    expect(nomeDoToken('vulto.png')).toBe('vulto');
    expect(nomeDoToken('.png')).toBe('Token');
    expect(nomeDoToken(`${'x'.repeat(80)}.jpg`)).toHaveLength(60);
  });
});

describe('eventos', () => {
  it('a troca de mapa chega como estado completo e o palco mostra o novo', async () => {
    await naMesa(visao());
    await screen.findByText('Rádio, 2º andar');
    const porao = { ...MAPA, id: 'map_2', nome: 'Porão' };
    socket().receber({ type: 'map.activated', mapa: porao, seq: 2 });
    socket().receber({ type: 'mesa.estado', estado: visao({ mapa: porao }), seq: 2 });
    expect(await screen.findByText('Porão')).toBeDefined();
  });
});
