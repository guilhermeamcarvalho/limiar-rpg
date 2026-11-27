import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoDaMesa } from '@membrana/shared';

const ouvintes: ((evento: EventoDaMesa) => void)[] = [];
const socketMock = {
  on: vi.fn((evento: string, cb: (dado: EventoDaMesa) => void) => {
    if (evento === 'evt') ouvintes.push(cb);
  }),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: () => socketMock,
}));

const pedirMock = vi.fn();
vi.mock('../../auth/api.ts', async () => {
  const atual = await vi.importActual<typeof import('../../auth/api.ts')>('../../auth/api.ts');
  return {
    ...atual,
    pedir: (...args: unknown[]) => pedirMock(...args) as Promise<unknown>,
  };
});

import { ToastProvider } from '../../ui/index.ts';
import { Escudo } from './index.tsx';

function dadosIniciais() {
  return {
    campanha: { id: 'cmp_1', nome: 'Caso da Rádio' },
    mapa: {
      id: 'map_1',
      nome: 'Estúdio',
      imagem: 'mapa:radio',
      largura: 1000,
      altura: 800,
      grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
    },
    salas: [{ id: 'rom_1', nome: 'Cabine', area: [], notasMestre: 'Porta trancada.' }],
    pois: [],
    pistas: [],
    inventario: [],
    personagens: [{ id: 'chr_1', donoId: 'usr_1', nome: 'Davi', perfil: 'investigador' }],
  };
}

function abrirEscudo() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/campanhas/cmp_1/escudo']}>
        <Routes>
          <Route path="/campanhas/:id/escudo" element={<Escudo />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('Escudo do mestre', () => {
  beforeEach(() => {
    ouvintes.length = 0;
    pedirMock.mockReset();
    socketMock.on.mockClear();
    socketMock.disconnect.mockClear();
    pedirMock.mockResolvedValue(dadosIniciais());
  });

  afterEach(() => {
    cleanup();
  });

  it('recolhe e expande seções como dropdown e cria pista via modal com mini-mapa', async () => {
    abrirEscudo();
    const toggleSalas = await screen.findByRole('button', { name: /Salas \(1\)/i });
    expect(screen.getByText('Cabine')).toBeDefined();

    // Recolhe e expande o dropdown de Salas.
    fireEvent.click(toggleSalas);
    expect(screen.queryByText('Cabine')).toBeNull();
    fireEvent.click(toggleSalas);
    expect(screen.getByText('Cabine')).toBeDefined();

    // Abre o modal de Nova pista e cria uma pista escolhendo posição no mini-mapa.
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pista' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova pista' });
    fireEvent.change(within(dialog).getByLabelText('Título da nova pista'), {
      target: { value: 'Carta rasgada' },
    });
    const minimapa = within(dialog).getByRole('button', { name: /Posição da pista no mapa/i });
    vi.spyOn(minimapa, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 160,
      right: 200,
      bottom: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(minimapa, { clientX: 50, clientY: 40 });

    pedirMock.mockResolvedValueOnce({
      mapa: dadosIniciais().mapa,
      salas: dadosIniciais().salas,
      pois: [],
      pistas: [
        {
          id: 'pst_1',
          titulo: 'Carta rasgada',
          texto: '',
          notaMestre: '',
          x: 250,
          y: 200,
          visivel: false,
          descoberta: false,
        },
      ],
      inventario: [],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar pista no mapa' }));

    await waitFor(() => {
      expect(pedirMock).toHaveBeenCalledWith(
        '/api/campanhas/cmp_1/escudo/comandos',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'clue.create',
            titulo: 'Carta rasgada',
            texto: '',
            notaMestre: '',
            x: 250,
            y: 200,
            visivel: false,
          }),
        }),
      );
    });
    expect(await screen.findByText('Carta rasgada')).toBeDefined();
  });

  it('sincroniza em tempo real quando chegam eventos da mesa pelo socket', async () => {
    abrirEscudo();
    await screen.findByRole('button', { name: /Pistas \(0\)/i });

    const emitir = ouvintes[0];
    expect(emitir).toBeDefined();
    act(() => {
      emitir?.({
        type: 'clue.changed',
        seq: 5,
        pistaId: 'pst_live',
        pista: {
          id: 'pst_live',
          titulo: 'Chave ao vivo',
          texto: 'Encontrada na mesa.',
          notaMestre: '',
          x: 10,
          y: 10,
          visivel: true,
          descoberta: true,
        },
      });
    });

    expect(await screen.findByText('Chave ao vivo')).toBeDefined();
    expect(screen.getByRole('button', { name: /Pistas \(1\)/i })).toBeDefined();
  });

  it('card de sala mostra contagem de POIs, cria sala via modal, edita e confirma remoção', async () => {
    const comPoi = {
      ...dadosIniciais(),
      pois: [
        {
          id: 'poi_1',
          salaId: 'rom_1',
          nome: 'Mesa de som',
          x: 50,
          y: 50,
          descricao: '',
          contextoMestre: '',
          informacoes: [],
        },
      ],
    };
    pedirMock.mockResolvedValue(comPoi);
    abrirEscudo();

    expect(await screen.findByText('1 POI')).toBeDefined();

    // Abre a edição da sala, edita notas e salva.
    fireEvent.click(screen.getByRole('button', { name: 'Editar Cabine' }));
    const notas = screen.getByLabelText('Notas secretas');
    fireEvent.change(notas, { target: { value: 'Chave atrás do painel.' } });
    pedirMock.mockResolvedValueOnce({
      ...comPoi,
      salas: [{ id: 'rom_1', nome: 'Cabine', area: [], notasMestre: 'Chave atrás do painel.' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Salvo')).toBeDefined();

    // Abre o modal de Nova sala e cria uma sala.
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sala' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova sala' });
    fireEvent.change(within(dialog).getByLabelText('Nome da nova sala'), {
      target: { value: 'Porão' },
    });
    pedirMock.mockResolvedValueOnce({
      ...comPoi,
      salas: [...comPoi.salas, { id: 'rom_2', nome: 'Porão', area: [], notasMestre: '' }],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar sala no mapa' }));
    expect(await screen.findByText('Porão')).toBeDefined();

    // Remover exige confirmação em dois passos (Cancelar volta sem apagar).
    fireEvent.click(screen.getByRole('button', { name: 'Remover sala Cabine' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });
});
