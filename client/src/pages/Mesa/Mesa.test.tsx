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
import { PROPS_PRONTOS } from '@membrana/shared';
import type { PalcoProps } from '../../mesa/Palco.tsx';
import { abrir, detalhe, json, MARTA, personagem, servidor } from '../../teste/apoio.tsx';
import { nomeDoArquivoSemExtensao as nomeDoToken } from '../../mesa/imagens.ts';

type Ouvinte = (...args: unknown[]) => void;

/** Um Socket.IO de mentira: o teste dispara os eventos do servidor e responde os comandos. */
class SocketFalso {
  connected = false;
  ouvintes = new Map<string, Ouvinte[]>();
  comandos: ComandoDaMesa[] = [];
  responder: (comando: ComandoDaMesa) => RespostaDoComando = () => ({ ok: true });
  connect = vi.fn();
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

/** A página aparece antes de o efeito abrir a conexão: espera o socket existir. */
async function conexaoAberta() {
  await screen.findByText('Conectando à mesa…');
  await waitFor(() => {
    expect(falso.sockets.length).toBeGreaterThan(0);
  });
}
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
  breu: [],
  nevoa: 0,
  pois: [],
  pistas: [],
  inventario: [],
  rodada: { numero: 3, agiram: [] },
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
  await conexaoAberta();
  socket().conectar();
  socket().receber({ type: 'mesa.estado', estado, seq: 1 });
  return chamadas;
}

beforeEach(() => {
  falso.sockets.length = 0;
  falso.palco = null;
  localStorage.clear();
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
    await conexaoAberta();
    socket().disparar(
      'connect_error',
      Object.assign(new Error('x'), {
        data: { codigo: 'CASO_NAO_ENCONTRADO', mensagem: 'Não encontramos este caso.' },
      }),
    );
    expect(await screen.findByText('Não encontramos este caso.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Voltar para a Central' })).toBeDefined();
  });

  it('caiu: avisa com faixa no topo e cartão Reconectando, sem tirar o mapa da tela', async () => {
    await naMesa(visao());
    socket().connected = false;
    socket().disparar('disconnect');
    expect(await screen.findByText(/Conexão com a mesa perdida\./)).toBeDefined();
    expect(screen.getByRole('status', { name: 'Reconectando à mesa' })).toBeDefined();
    expect(screen.getByTestId('palco')).toBeDefined();
    expect(screen.getByText('Sem conexão')).toBeDefined();
  });

  it('offline: enfileira movimentos e mensagens, bloqueia rolagens e reenvia ao reconectar', async () => {
    await naMesa(visao({ tokens: [token({ id: 'tok_1', nome: 'Davi' })] }));
    socket().connected = false;
    socket().disparar('disconnect');

    // Movimento offline vai para a fila (sem ir ao socket enquanto está desconectado).
    await act(async () => {
      await palco().enviar({ type: 'token.move', tokenId: 'tok_1', x: 200, y: 300 });
    });

    // Mensagem offline vai para a fila.
    const campo = screen.getByPlaceholderText(/Mensagem/);
    fireEvent.change(campo, { target: { value: 'Vou checar a mesa de som' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => {
      expect((campo as HTMLInputElement).value).toBe('');
    });

    // Rolagem offline é bloqueada com explicação.
    fireEvent.change(campo, { target: { value: '/r 2d6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    const lateral = screen.getByRole('complementary', { name: 'Chat e registros' });
    expect(await within(lateral).findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Rolagens só voltam com a conexão'),
    );

    const filaLista = await screen.findByLabelText('Ações na fila');
    expect(within(filaLista).getByText('Mover Davi')).toBeDefined();
    expect(within(filaLista).getByText('“Vou checar a mesa de som”')).toBeDefined();
    expect(socket().comandos).toEqual([]);

    // Tentar agora chama socket.connect().
    const botoesTentar = screen.getAllByRole('button', { name: 'Tentar agora' });
    const primeiroBotao = botoesTentar[0];
    if (!primeiroBotao) throw new Error('faltou botão Tentar agora');
    fireEvent.click(primeiroBotao);
    expect(socket().connect).toHaveBeenCalled();

    // Ao reconectar, reenvia a fila na ordem e limpa o aviso.
    socket().conectar();
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'token.move', tokenId: 'tok_1', x: 200, y: 300 },
        { type: 'chat.send', texto: 'Vou checar a mesa de som' },
      ]);
    });
    expect(screen.queryByRole('status', { name: 'Reconectando à mesa' })).toBeNull();
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

describe('caso excluído com a mesa aberta', () => {
  it('avisa que o mestre excluiu o caso, mesmo com a queda logo depois', async () => {
    await naMesa(visao());
    await screen.findByTestId('palco');
    socket().receber({ type: 'campaign.deleted', campanhaId: 'cmp_1', seq: 2 });
    socket().disparar('disconnect', 'io server disconnect');
    expect(await screen.findByText('Caso excluído')).toBeDefined();
    expect(
      screen.getByText('O mestre excluiu este caso. A mesa foi fechada para todos.'),
    ).toBeDefined();
    expect(screen.queryByText('Conexão perdida. Tentando voltar…')).toBeNull();
  });
});

describe('ferramentas de tokens e props (mestre)', () => {
  const doMestre = (rotas: Parameters<typeof servidor>[0] = {}) =>
    naMesa(visao({ papel: 'mestre', tokens: [token()] }), rotas);

  /** O palco de verdade diz onde é o meio da tela; o de mentira, aqui. */
  function meioDaTela(ponto: { x: number; y: number }) {
    const ref = palco().centroRef;
    if (ref) ref.current = ponto;
  }

  it('sem mapa, tokens e props ficam desligados; o mapa, não', async () => {
    await naMesa(visao({ papel: 'mestre', mapa: null }));
    const barra = await screen.findByRole('toolbar', { name: 'Ferramentas' });
    const botao = (nome: string) => within(barra).getByRole('button', { name: nome });
    expect(botao('Tokens e NPCs, ferramenta do mestre')).toHaveProperty('disabled', true);
    expect(botao('Props, ferramenta do mestre')).toHaveProperty('disabled', true);
    expect(botao('Mapa e grade, ferramenta do mestre')).toHaveProperty('disabled', false);
  });

  it('T abre os tokens; O troca para os props (um painel por vez)', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 't' });
    expect(await screen.findByRole('complementary', { name: 'Tokens e NPCs' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'o' });
    expect(await screen.findByRole('complementary', { name: 'Props' })).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Tokens e NPCs' })).toBeNull();
  });

  it('novo NPC entra no meio da tela, com o tamanho e oculto', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    meioDaTela({ x: 320, y: 240 });
    fireEvent.keyDown(window, { key: 't' });
    const painel = await screen.findByRole('complementary', { name: 'Tokens e NPCs' });
    fireEvent.change(within(painel).getByLabelText('Nome'), { target: { value: ' A Voz ' } });
    fireEvent.change(within(painel).getByLabelText('Tamanho'), { target: { value: '2' } });
    fireEvent.click(within(painel).getByLabelText('Começa oculto'));
    fireEvent.click(within(painel).getByRole('button', { name: 'Pôr no mapa' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'token.create', nome: 'A Voz', x: 320, y: 240, tamanho: 2, oculto: true },
      ]);
    });
  });

  it('NPC sem nome não sai; a lista oculta e remove', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 't' });
    const painel = await screen.findByRole('complementary', { name: 'Tokens e NPCs' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Pôr no mapa' }));
    expect(await within(painel).findByText('Dê um nome.')).toBeDefined();
    fireEvent.click(within(painel).getByRole('button', { name: 'Ocultar Davi' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Remover Davi' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'token.update', tokenId: 'tok_1', oculto: true },
        { type: 'token.delete', tokenId: 'tok_1' },
      ]);
    });
  });

  it('trazer o grupo: escolhe o ponto no mapa e manda o comando; Esc cancela', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 't' });
    const painel = await screen.findByRole('complementary', { name: 'Tokens e NPCs' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Trazer o grupo' }));
    expect(await screen.findByText('Clique no mapa onde o grupo deve ficar.')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Clique no mapa onde o grupo deve ficar.')).toBeNull();
    });
    expect(palco().aoEscolherPonto).toBeNull();

    fireEvent.click(within(painel).getByRole('button', { name: 'Trazer o grupo' }));
    await screen.findByText('Clique no mapa onde o grupo deve ficar.');
    act(() => {
      palco().aoEscolherPonto?.({ x: 400, y: 300 });
    });
    await waitFor(() => {
      expect(socket().comandos).toEqual([{ type: 'token.gather', x: 400, y: 300 }]);
    });
    expect(screen.queryByText('Clique no mapa onde o grupo deve ficar.')).toBeNull();
  });

  it('props prontos e imagem própria entram no meio da tela', async () => {
    const nome = `${'d'.repeat(64)}.webp`;
    const chamadas = await doMestre({ 'POST /api/campanhas/cmp_1/imagens': json(201, { nome }) });
    await screen.findByTestId('palco');
    meioDaTela({ x: 100, y: 200 });
    fireEvent.keyDown(window, { key: 'o' });
    const painel = await screen.findByRole('complementary', { name: 'Props' });
    expect(within(painel).getAllByRole('button', { name: /^Pôr .* no mapa$/ })).toHaveLength(
      PROPS_PRONTOS.length,
    );
    fireEvent.click(within(painel).getByRole('button', { name: 'Pôr Contorno no mapa' }));
    fireEvent.change(within(painel).getByLabelText('Imagem do prop'), {
      target: { files: [new File(['x'], 'caixa.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'prop.create', imagem: 'pronto:contorno', x: 100, y: 200, tamanho: 2 },
        { type: 'prop.create', imagem: nome, x: 100, y: 200, tamanho: 1 },
      ]);
    });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      uso: 'prop',
      arquivo: { nome: 'caixa.png', tipo: 'image/png' },
    });
  });

  it('o palco recebe o nome de cada pessoa do caso (para mostrar de quem é o token)', async () => {
    await doMestre();
    await screen.findByTestId('palco');
    await waitFor(() => {
      expect(palco().nomes).toMatchObject({ usr_9: 'Helena Duarte' });
    });
  });
});

describe('arte pronta (mestre)', () => {
  it('NPC de um modelo: o nome vem do modelo e a arte vai no token', async () => {
    await naMesa(visao({ papel: 'mestre' }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 't' });
    const painel = await screen.findByRole('complementary', { name: 'Tokens e NPCs' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Escolher modelo' }));
    const modelos = within(painel).getByRole('group', { name: 'Modelos de NPC' });
    fireEvent.change(within(modelos).getByRole('searchbox'), { target: { value: 'cultista' } });
    fireEvent.click(within(modelos).getByRole('button', { name: 'Escolher Cultista' }));
    expect(within(painel).getByLabelText('Nome')).toHaveProperty('value', 'Cultista');
    expect(within(painel).getByRole('button', { name: 'Modelo: Cultista' })).toBeDefined();

    fireEvent.click(within(painel).getByRole('button', { name: 'Pôr no mapa' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        {
          type: 'token.create',
          nome: 'Cultista',
          x: 0,
          y: 0,
          tamanho: 1,
          oculto: false,
          imagem: 'npc:cultista',
        },
      ]);
    });
    // O modelo continua escolhido para pôr outro igual.
    expect(within(painel).getByLabelText('Nome')).toHaveProperty('value', 'Cultista');
  });

  it('nome digitado à mão não é trocado pelo do modelo', async () => {
    await naMesa(visao({ papel: 'mestre' }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 't' });
    const painel = await screen.findByRole('complementary', { name: 'Tokens e NPCs' });
    fireEvent.change(within(painel).getByLabelText('Nome'), { target: { value: 'Irmão Caio' } });
    fireEvent.click(within(painel).getByRole('button', { name: 'Escolher modelo' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Escolher Cultista' }));
    expect(within(painel).getByLabelText('Nome')).toHaveProperty('value', 'Irmão Caio');
  });

  it('mapa pronto: entra no caso e vai para a mesa', async () => {
    const porao: MapaDoCaso = {
      ...MAPA_NA_LISTA,
      id: 'map_9',
      nome: 'Porão',
      imagem: 'mapa:porao',
    };
    const chamadas = await naMesa(visao({ papel: 'mestre', mapa: null }), {
      'GET /api/campanhas/cmp_1/mapas': json(200, { mapas: [] }),
      'POST /api/campanhas/cmp_1/mapas/prontos': json(201, { mapa: porao }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Escolher mapa' }));
    const painel = await screen.findByRole('complementary', { name: 'Mapa e grade' });
    const prontos = within(painel).getByRole('region', { name: 'Mapas prontos' });
    fireEvent.click(within(prontos).getByRole('button', { name: 'Usar o mapa Porão' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([{ type: 'map.activate', mapaId: 'map_9' }]);
    });
    expect(chamadas.find((c) => c.url.endsWith('/mapas/prontos'))?.corpo).toEqual({
      id: 'mapa:porao',
    });
    const doCaso = within(painel).getByRole('region', { name: 'Mapas do caso' });
    expect(await within(doCaso).findByText('Porão')).toBeDefined();
  });
});

describe('breu (mestre)', () => {
  const RETANGULO = { tipo: 'retangulo', x: 10, y: 20, largura: 100, altura: 50 } as const;
  const COBERTA = { id: 'nev_1', modo: 'cobrir', forma: RETANGULO } as const;
  const SALA = {
    id: 'sala_1',
    nome: 'Estúdio B',
    notasMestre: '',
    area: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ],
  };

  async function abrirBreu(campos: Partial<VisaoDaMesa> = {}) {
    await naMesa(visao({ papel: 'mestre', salas: [], ...campos }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'b' });
    return screen.findByRole('complementary', { name: 'Breu' });
  }

  it('B abre a ferramenta e o palco passa a desenhar; fechar tira o pincel', async () => {
    const painel = await abrirBreu();
    expect(palco().pincelDoBreu).toEqual({ modo: 'cobrir', forma: 'retangulo' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Polígono' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar' }));
    expect(palco().pincelDoBreu).toEqual({ modo: 'revelar', forma: 'poligono' });
    fireEvent.keyDown(window, { key: 'b' });
    await waitFor(() => {
      expect(palco().pincelDoBreu).toBeNull();
    });
  });

  it('a forma desenhada cobre ou revela, conforme o pincel', async () => {
    const painel = await abrirBreu();
    act(() => {
      palco().aoDesenharBreu?.(RETANGULO);
    });
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar' }));
    act(() => {
      palco().aoDesenharBreu?.(RETANGULO);
    });
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'darkness.add', forma: RETANGULO },
        { type: 'darkness.reveal', forma: RETANGULO },
      ]);
    });
  });

  it('cobrir tudo, desfazer a última e limpar', async () => {
    const painel = await abrirBreu({ breu: [COBERTA] });
    fireEvent.click(within(painel).getByRole('button', { name: 'Cobrir tudo' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Desfazer a última' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Limpar breu' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        {
          type: 'darkness.add',
          forma: { tipo: 'retangulo', x: 0, y: 0, largura: 1000, altura: 800 },
        },
        { type: 'darkness.remove', formaId: 'nev_1' },
        { type: 'darkness.remove', tudo: true },
      ]);
    });
  });

  it('sem breu, limpar e desfazer ficam desligados e a legenda não aparece', async () => {
    const painel = await abrirBreu();
    expect(within(painel).getByRole('button', { name: 'Limpar breu' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByText('Breu: jogadores veem preto')).toBeNull();
  });

  it('com breu, a legenda diz que os jogadores veem preto', async () => {
    await naMesa(visao({ papel: 'mestre', breu: [COBERTA] }));
    expect(await screen.findByText('Breu: jogadores veem preto')).toBeDefined();
  });

  it('por sala: a sala sob o breu se revela inteira; à vista, se cobre', async () => {
    const sob = {
      id: 'nev_t',
      modo: 'cobrir',
      forma: { ...RETANGULO, x: 0, y: 0, largura: 1000, altura: 800 },
    } as const;
    const painel = await abrirBreu({ salas: [SALA], breu: [sob] });
    expect(within(painel).getByText('sob o breu')).toBeDefined();
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar Estúdio B' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'darkness.reveal', forma: { tipo: 'poligono', pontos: SALA.area } },
      ]);
    });
  });

  it('jogador: nem a ferramenta nem a legenda', async () => {
    await naMesa(visao({ breu: [COBERTA] }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'b' });
    expect(screen.queryByRole('complementary', { name: 'Breu' })).toBeNull();
    expect(screen.queryByText('Breu: jogadores veem preto')).toBeNull();
    expect(palco().pincelDoBreu).toBeNull();
  });
});

describe('névoa da Membrana', () => {
  async function abrirNevoa(campos: Partial<VisaoDaMesa> = {}) {
    await naMesa(visao({ papel: 'mestre', ...campos }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'n' });
    return screen.findByRole('complementary', { name: 'Névoa' });
  }

  it('sem névoa, nada cobre o palco', async () => {
    await naMesa(visao());
    await screen.findByTestId('palco');
    expect(screen.queryByTestId('nevoa')).toBeNull();
  });

  it('o jogador vê a névoa no nível do mestre, e ela acompanha o evento', async () => {
    await naMesa(visao({ nevoa: 60 }));
    const nevoa = await screen.findByRole('img', { name: 'Névoa densa' });
    expect(nevoa.style.getPropertyValue('--nevoa')).toBe('0.6');
    act(() => {
      socket().receber({ type: 'mist.changed', nivel: 0, seq: 99 });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('nevoa')).toBeNull();
    });
  });

  it('o jogador não tem a ferramenta', async () => {
    await naMesa(visao({ nevoa: 20 }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.queryByRole('complementary', { name: 'Névoa' })).toBeNull();
  });

  it('N abre a régua; arrastar manda um nível só, depois de parar', async () => {
    const painel = await abrirNevoa();
    const regua = within(painel).getByRole('slider', { name: 'Nível da névoa' });
    fireEvent.change(regua, { target: { value: '20' } });
    fireEvent.change(regua, { target: { value: '45' } });
    expect(within(painel).getByText('Névoa densa')).toBeDefined();
    await waitFor(() => {
      expect(socket().comandos).toEqual([{ type: 'mist.set', nivel: 45 }]);
    });
  });

  it('os atalhos mandam na hora; a legenda do mestre mostra o nível', async () => {
    const painel = await abrirNevoa({ nevoa: 30 });
    expect(screen.getByText('Névoa fina (30%)')).toBeDefined();
    expect(within(painel).getByRole('button', { name: 'Fina' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(painel).getByRole('button', { name: 'Espessa' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Sem névoa' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'mist.set', nivel: 100 },
        { type: 'mist.set', nivel: 0 },
      ]);
    });
  });

  it('vale sem mapa na mesa', async () => {
    await naMesa(visao({ papel: 'mestre', mapa: null }), {
      'GET /api/campanhas/cmp_1/mapas': json(200, { mapas: [] }),
    });
    const botao = await screen.findByRole('button', { name: 'Névoa, ferramenta do mestre' });
    expect(botao).toHaveProperty('disabled', false);
  });
});

describe('dados, testes, chat e registro na página da Mesa', () => {
  it('mantém o registro ao recarregar e não duplica evento que também chegou ao vivo', async () => {
    const eventoSalvo: EventoDaMesa = {
      type: 'round.started',
      numero: 2,
      seq: 2,
    };
    const falaSalva: EventoDaMesa = {
      type: 'chat.message',
      id: 'msg_1',
      autorId: MARTA.id,
      texto: 'Fala gravada antes do reload',
      para: null,
      narracao: false,
      em: '2026-11-26T21:00:00.000Z',
      seq: 3,
    };
    await naMesa(visao(), {
      'GET /api/campanhas/cmp_1/registro': json(200, {
        eventos: [eventoSalvo, falaSalva],
        personagens: [{ id: 'chr_davi', donoId: MARTA.id, nome: 'Davi Rocha', perfil: 'executor' }],
      }),
    });

    // O mesmo seq 3 chega também pelo Socket.IO: não pode aparecer duas vezes.
    socket().receber(falaSalva);
    expect(await screen.findAllByText('Fala gravada antes do reload')).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: /Registro/ }));
    expect(await screen.findAllByText(/Rodada 2/)).toHaveLength(1);
    expect(screen.queryByText('Fala gravada antes do reload')).toBeNull();
  });

  it('envia test.resolve na perícia virtual, test.report na física e mostra Resultado no canto', async () => {
    const daviVirtual = personagem();
    await naMesa(visao({ papel: 'mestre' }), {
      'GET /api/campanhas/cmp_1': json(200, {
        campanha: detalhe({
          papel: 'mestre',
          meuPersonagem: { id: daviVirtual.id, nome: daviVirtual.ficha.nome },
        }),
      }),
      'GET /api/campanhas/cmp_1/registro': json(200, {
        eventos: [],
        personagens: [
          {
            id: daviVirtual.id,
            donoId: MARTA.id,
            nome: daviVirtual.ficha.nome,
            perfil: 'executor',
          },
        ],
      }),
      'GET /api/personagens/chr_davi': json(200, { personagem: daviVirtual }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Dados' }));
    const painel = await screen.findByRole('complementary', { name: 'Dados e testes' });
    fireEvent.click(await within(painel).findByRole('button', { name: /Testar Máquinas/ }));

    await waitFor(() => {
      expect(socket().comandos).toContainEqual({
        type: 'test.resolve',
        personagemId: 'chr_davi',
        periciaId: 'maquinas',
        dt: 7,
      });
    });

    socket().receber({
      type: 'test.resolved',
      seq: 5,
      registro: {
        id: 'tst_1',
        personagemId: 'chr_davi',
        personagemNome: 'Davi Rocha',
        campanhaId: 'cmp_1',
        autor: { id: MARTA.id, nome: 'Marta' },
        periciaId: 'maquinas',
        atributo: 'mente',
        origem: 'fisico',
        resultado: {
          dados: [
            { tipo: 'd6', valor: 5, papel: 'atributo', descartado: false },
            { tipo: 'd10', valor: 6, papel: 'pericia', descartado: false },
          ],
          total: 11,
          dt: 7,
          ra: 6,
          rb: 5,
          veredito: 'sucesso',
          informado: true,
        },
        falhaCritica: null,
        efeitos: ['Ímpeto gasto: +d4.'],
        em: '2026-11-26T21:10:00.000Z',
      },
    });

    const cartao = await screen.findByRole('region', { name: 'Resultado do teste na mesa' });
    expect(cartao.className).toContain('mesa-resultado');
    expect(within(cartao).getByText(/Dados físicos/)).toBeDefined();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Fechar resultado' }));
    expect(screen.queryByRole('region', { name: 'Resultado do teste na mesa' })).toBeNull();
  });

  it('no modo de dados físicos abre o modal e envia test.report', async () => {
    const daviFisico = personagem({}, { modoDados: 'fisico' });
    await naMesa(visao(), {
      'GET /api/campanhas/cmp_1': json(200, {
        campanha: detalhe({ meuPersonagem: { id: daviFisico.id, nome: daviFisico.ficha.nome } }),
      }),
      'GET /api/personagens/chr_davi': json(200, { personagem: daviFisico }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Dados' }));
    const painel = await screen.findByRole('complementary', { name: 'Dados e testes' });
    fireEvent.click(await within(painel).findByRole('button', { name: /Testar Percepção/ }));

    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('tab', { name: 'Só o resultado' }));
    fireEvent.click(within(modal).getByRole('button', { name: /Sucesso$/i }));
    fireEvent.click(within(modal).getByRole('button', { name: 'Enviar resultado' }));

    await waitFor(() => {
      expect(socket().comandos).toContainEqual({
        type: 'test.report',
        personagemId: 'chr_davi',
        periciaId: 'percepcao',
        dt: 7,
        resultado: { modo: 'veredito', veredito: 'sucesso' },
      });
    });
  });
});

describe('layout recolhível, painel do jogador e ordem da rodada', () => {
  it('recolhe os painéis esquerdo e direito e lembra a escolha ao reabrir', async () => {
    await naMesa(visao());
    expect(await screen.findByRole('complementary', { name: 'Você e o grupo' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Chat e registros' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Recolher painel esquerdo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recolher painel direito' }));

    expect(screen.queryByRole('complementary', { name: 'Você e o grupo' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Chat e registros' })).toBeNull();
    expect(localStorage.getItem('membrana:mesa-paineis')).toBe(
      JSON.stringify({ esquerdo: false, direito: false }),
    );

    cleanup();
    await naMesa(visao());
    expect(await screen.findByRole('button', { name: 'Expandir painel esquerdo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expandir painel direito' })).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Você e o grupo' })).toBeNull();
  });

  it('mostra PV, PD, Ímpeto e testes rápidos do jogador, e atualiza PV ao receber character.changed', async () => {
    let pvAtual = 12;
    await naMesa(visao(), {
      'GET /api/campanhas/cmp_1': json(200, {
        campanha: detalhe({ meuPersonagem: { id: 'chr_davi', nome: 'Davi Rocha' } }),
      }),
      'GET /api/personagens/chr_davi': () =>
        json(200, { personagem: personagem({}, { pv: pvAtual }) }),
    });

    const esquerdo = await screen.findByRole('complementary', { name: 'Você e o grupo' });
    expect(await within(esquerdo).findByText('12/12')).toBeDefined();
    expect(within(esquerdo).getByText('Testes rápidos')).toBeDefined();

    // O mestre aplica dano e a mesa recebe `character.changed`: o PV muda na hora.
    pvAtual = 8;
    socket().receber({
      type: 'character.changed',
      campanhaId: 'cmp_1',
      personagemId: 'chr_davi',
      removido: false,
      seq: 2,
    });
    expect(await within(esquerdo).findByText('8/12')).toBeDefined();

    // Botão "Teste livre ou dados avulsos" abre o painel de dados.
    fireEvent.click(within(esquerdo).getByRole('button', { name: 'Teste livre ou dados avulsos' }));
    expect(await screen.findByRole('complementary', { name: 'Dados e testes' })).toBeDefined();
  });

  it('ordem da rodada mostra quem age, quem já agiu e quem está ausente; mestre encerra a rodada', async () => {
    await naMesa(
      visao({
        papel: 'mestre',
        rodada: { numero: 3, agiram: ['usr_1'] },
      }),
      {
        'GET /api/campanhas/cmp_1': json(200, {
          campanha: detalhe({
            papel: 'mestre',
            membros: [
              { id: 'usr_9', nome: 'Helena Duarte', papel: 'mestre' },
              { id: 'usr_1', nome: 'Marta', papel: 'jogador' },
              { id: 'usr_2', nome: 'Caio', papel: 'jogador' },
              { id: 'usr_3', nome: 'Téo', papel: 'jogador' },
            ],
          }),
        }),
      },
    );

    socket().receber({
      type: 'presence.changed',
      online: [
        { id: 'usr_9', nome: 'Helena Duarte', papel: 'mestre', personagemId: null },
        { id: 'usr_1', nome: 'Marta', papel: 'jogador', personagemId: null },
        { id: 'usr_2', nome: 'Caio', papel: 'jogador', personagemId: null },
      ],
      seq: 2,
    });

    const ordem = await screen.findByRole('list', { name: 'Ordem da rodada' });
    const [martaItem, caioItem, teoItem] = within(ordem).getAllByRole('listitem');
    if (!martaItem || !caioItem || !teoItem) throw new Error('faltou item na ordem');
    expect(within(martaItem).getByLabelText('Já agiu')).toBeDefined();
    expect(within(caioItem).getByText('Agindo')).toBeDefined();
    expect(within(teoItem).getByText('ausente')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar rodada' }));
    await waitFor(() => {
      expect(socket().comandos).toContainEqual({ type: 'round.end' });
    });
  });

  it('abas compactas do painel direito incluem Pistas e Itens sem erro', async () => {
    await naMesa(
      visao({
        inventario: [
          {
            pistaId: 'pst_1',
            personagemId: 'chr_davi',
            apresentada: false,
            em: '2026-11-26T20:00:00.000Z',
            titulo: 'Fita 33',
            texto: 'Gravada às 3h33.',
          },
        ],
      }),
    );

    fireEvent.click(await screen.findByRole('tab', { name: /Pistas/ }));
    expect(await screen.findByText('Fita 33')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Itens' }));
    expect(await screen.findByText('Sem personagem em uso')).toBeDefined();
  });

  it('medir (M) e marcar ponto (P): alternam o modo do palco, enviam board.ping e recebem pulso', async () => {
    await naMesa(visao());
    expect(palco().modo).toBe('mover');

    const botaoMover = screen.getByRole('button', { name: 'Mover meu token' });
    const botaoMedir = screen.getByRole('button', { name: 'Medir distância' });
    const botaoMarcar = screen.getByRole('button', { name: 'Marcar um ponto para todos' });
    expect(botaoMover.getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(window, { key: 'm' });
    expect(palco().modo).toBe('medir');
    expect(botaoMedir.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(botaoMarcar);
    expect(palco().modo).toBe('marcar');
    expect(botaoMarcar.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      palco().aoMarcarPonto?.({ x: 140, y: 260 });
    });
    await waitFor(() => {
      expect(socket().comandos).toContainEqual({ type: 'board.ping', x: 140, y: 260 });
    });

    socket().receber({
      type: 'board.pinged',
      autorId: 'usr_9',
      x: 140,
      y: 260,
      seq: 2,
    });
    await waitFor(() => {
      expect(palco().ultimoPulso).toEqual({ seq: 2, autorId: 'usr_9', x: 140, y: 260 });
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(palco().modo).toBe('mover');
  });

  it('modo celular (#80): jogador acessa Você, Dados, Chat e ferramentas do mapa sem controles do mestre', async () => {
    await naMesa(visao({ papel: 'jogador' }));

    expect(screen.getByRole('button', { name: 'Você' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Dados' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mover meu token' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Medir distância' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Marcar um ponto para todos' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Encerrar rodada' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Breu, ferramenta do mestre' })).toBeNull();
  });

  it('mestre: ferramentas Salas (S) e Pontos de interesse (I) criam salas e POIs (#82, #83)', async () => {
    await naMesa(
      visao({
        papel: 'mestre',
        salas: [{ id: 'rom_1', nome: 'Recepção', area: [{ x: 0, y: 0 }], notasMestre: '' }],
        pois: [
          {
            id: 'poi_1',
            salaId: 'rom_1',
            numero: 1,
            nome: 'Balcão',
            descricao: '',
            x: 100,
            y: 120,
            pericias: [],
            informacoes: [],
            desafio: null,
            contextoMestre: '',
          },
        ],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salas, ferramenta do mestre' }));
    expect(await screen.findByDisplayValue('Recepção')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Pontos de interesse, ferramenta do mestre' }),
    );
    expect(await screen.findByText('Balcão')).toBeDefined();
  });

  it('cartão do ponto de interesse: custos visíveis, tarjas pretas e envio de poi.investigate (#85, #86)', async () => {
    await naMesa(
      visao({
        pois: [
          {
            id: 'poi_2',
            numero: 2,
            nome: 'Mesa de som',
            descricao: 'Os faders estão no máximo.',
            x: 445,
            y: 64,
            pericias: [{ periciaId: 'percepcao', dt: 7 }],
            informacoes: [
              { id: 'inf_1', nivel: 5, descoberta: true, texto: 'Fita marcada 33.' },
              { id: 'inf_2', nivel: 12, descoberta: false },
            ],
            desafio: null,
            tudoDescoberto: false,
          },
        ],
      }),
    );

    act(() => {
      palco().aoAbrirPoi?.('poi_2');
    });

    const cartao = await screen.findByRole('dialog', { name: 'Ponto 2: Mesa de som' });
    expect(within(cartao).getByText(/gasta sua ação da rodada/)).toBeDefined();
    expect(within(cartao).getByText(/custa 1 PD se não houver nada novo/)).toBeDefined();
    expect(within(cartao).getByText(/Descreva a ação; o mestre decide o teste/)).toBeDefined();
    expect(within(cartao).getByText('Fita marcada 33.')).toBeDefined();
    expect(within(cartao).getByLabelText('Informação oculta')).toBeDefined();

    fireEvent.click(within(cartao).getByRole('button', { name: /Investigar/ }));
    await waitFor(() => {
      expect(socket().comandos).toContainEqual({
        type: 'poi.investigate',
        poiId: 'poi_2',
        modo: 'investigar',
        periciaId: 'percepcao',
      });
    });
  });
});

describe('pop-up do resultado', () => {
  it('a rolagem de quem está olhando abre o pop-up; a dos outros, não', async () => {
    await naMesa(visao());

    act(() => {
      socket().receber({
        type: 'dice.rolled',
        seq: 5,
        autorId: 'usr_outro',
        expressao: 'd20',
        dados: [17],
        total: 17,
        secreta: false,
      });
    });
    expect(screen.queryByRole('region', { name: 'Resultado da rolagem' })).toBeNull();

    act(() => {
      socket().receber({
        type: 'dice.rolled',
        seq: 6,
        autorId: MARTA.id,
        expressao: '2d6',
        dados: [3, 5],
        total: 8,
        secreta: false,
      });
    });
    const popup = await screen.findByRole('region', { name: 'Resultado da rolagem' });
    expect(await within(popup).findByText('2d6: 8')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Resultado da rolagem' })).toBeNull();
  });
});
