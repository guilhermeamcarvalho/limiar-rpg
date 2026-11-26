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
  await conexaoAberta();
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

describe('névoa (mestre)', () => {
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

  async function abrirNevoa(campos: Partial<VisaoDaMesa> = {}) {
    await naMesa(visao({ papel: 'mestre', salas: [], ...campos }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'n' });
    return screen.findByRole('complementary', { name: 'Névoa' });
  }

  it('N abre a ferramenta e o palco passa a desenhar; fechar tira o pincel', async () => {
    const painel = await abrirNevoa();
    expect(palco().pincelDaNevoa).toEqual({ modo: 'cobrir', forma: 'retangulo' });
    fireEvent.click(within(painel).getByRole('button', { name: 'Polígono' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar' }));
    expect(palco().pincelDaNevoa).toEqual({ modo: 'revelar', forma: 'poligono' });
    fireEvent.keyDown(window, { key: 'n' });
    await waitFor(() => {
      expect(palco().pincelDaNevoa).toBeNull();
    });
  });

  it('a forma desenhada cobre ou revela, conforme o pincel', async () => {
    const painel = await abrirNevoa();
    act(() => {
      palco().aoDesenharNevoa?.(RETANGULO);
    });
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar' }));
    act(() => {
      palco().aoDesenharNevoa?.(RETANGULO);
    });
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'fog.add', forma: RETANGULO },
        { type: 'fog.reveal', forma: RETANGULO },
      ]);
    });
  });

  it('cobrir tudo, desfazer a última e limpar', async () => {
    const painel = await abrirNevoa({ nevoa: [COBERTA] });
    fireEvent.click(within(painel).getByRole('button', { name: 'Cobrir tudo' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Desfazer a última' }));
    fireEvent.click(within(painel).getByRole('button', { name: 'Limpar névoa' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'fog.add', forma: { tipo: 'retangulo', x: 0, y: 0, largura: 1000, altura: 800 } },
        { type: 'fog.remove', formaId: 'nev_1' },
        { type: 'fog.remove', tudo: true },
      ]);
    });
  });

  it('sem névoa, limpar e desfazer ficam desligados e a legenda não aparece', async () => {
    const painel = await abrirNevoa();
    expect(within(painel).getByRole('button', { name: 'Limpar névoa' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByText('Névoa: jogadores veem preto')).toBeNull();
  });

  it('com névoa, a legenda diz que os jogadores veem preto', async () => {
    await naMesa(visao({ papel: 'mestre', nevoa: [COBERTA] }));
    expect(await screen.findByText('Névoa: jogadores veem preto')).toBeDefined();
  });

  it('por sala: a sala sob a névoa se revela inteira; à vista, se cobre', async () => {
    const sob = {
      id: 'nev_t',
      modo: 'cobrir',
      forma: { ...RETANGULO, x: 0, y: 0, largura: 1000, altura: 800 },
    } as const;
    const painel = await abrirNevoa({ salas: [SALA], nevoa: [sob] });
    expect(within(painel).getByText('sob a névoa')).toBeDefined();
    fireEvent.click(within(painel).getByRole('button', { name: 'Revelar Estúdio B' }));
    await waitFor(() => {
      expect(socket().comandos).toEqual([
        { type: 'fog.reveal', forma: { tipo: 'poligono', pontos: SALA.area } },
      ]);
    });
  });

  it('jogador: nem a ferramenta nem a legenda', async () => {
    await naMesa(visao({ nevoa: [COBERTA] }));
    await screen.findByTestId('palco');
    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.queryByRole('complementary', { name: 'Névoa' })).toBeNull();
    expect(screen.queryByText('Névoa: jogadores veem preto')).toBeNull();
    expect(palco().pincelDaNevoa).toBeNull();
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
