import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CampanhaNaLista } from '@limiar/shared';
import { abrir, caso, detalhe, endereco, json, servidor } from '../teste/apoio.tsx';
import { filtrarCasos, type Filtros } from './Casos.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LISTA: CampanhaNaLista[] = [
  caso({ id: 'c1', numero: 17, nome: 'O Sinal de Santa Ermida' }),
  caso({
    id: 'c2',
    numero: 22,
    nome: 'Maré de Concreto',
    papel: 'mestre',
    mestre: { id: 'usr_1', nome: 'Marta' },
  }),
  caso({
    id: 'c3',
    numero: 31,
    nome: 'As Cinzas de Vel’Kar',
    sistema: { id: 'sys_9', nome: 'Cinzas d20', tipo: 'inventado' },
    mestre: { id: 'usr_7', nome: 'Diego Moreira' },
  }),
  caso({ id: 'c4', numero: 9, nome: 'Ala 13', situacao: 'encerrado' }),
];

const TODOS: Filtros = { sistema: 'todos', situacao: null, soMestre: false, busca: '' };
const nomes = (l: CampanhaNaLista[]) => l.map((c) => c.nome);

describe('filtrarCasos', () => {
  it('sistema, chips e busca funcionam juntos', () => {
    expect(nomes(filtrarCasos(LISTA, { ...TODOS, sistema: 'inventados' }))).toEqual([
      'As Cinzas de Vel’Kar',
    ]);
    expect(
      nomes(filtrarCasos(LISTA, { ...TODOS, sistema: 'ordem', situacao: 'em-curso' })),
    ).toEqual(['O Sinal de Santa Ermida', 'Maré de Concreto']);
    expect(nomes(filtrarCasos(LISTA, { ...TODOS, soMestre: true, busca: 'mare' }))).toEqual([
      'Maré de Concreto',
    ]);
    expect(filtrarCasos(LISTA, { ...TODOS, soMestre: true, busca: 'ermida' })).toEqual([]);
  });

  it('a busca acha pelo nome do mestre, sem ligar para acento e maiúscula', () => {
    expect(nomes(filtrarCasos(LISTA, { ...TODOS, busca: 'DIÉGO' }))).toEqual([
      'As Cinzas de Vel’Kar',
    ]);
  });
});

function servidorDeCasos() {
  return servidor({
    'GET /api/campanhas': json(200, { campanhas: LISTA }),
    'GET /api/campanhas/c1': json(200, { campanha: detalhe({ ...LISTA[0] }) }),
    'GET /api/campanhas/c2': json(200, {
      campanha: detalhe({
        ...LISTA[1],
        convites: [
          {
            codigo: 'CONCRETO-7AND',
            vagas: 4,
            usados: 1,
            expiraEm: new Date(Date.now() + 86_400_000).toISOString(),
            expirado: false,
            entraram: [{ id: 'usr_2', nome: 'Iara', entrouEm: null }],
          },
        ],
      }),
    }),
    'POST /api/campanhas/c2/convites': json(201, {
      convite: {
        codigo: 'CONCRETO-9XYZ',
        vagas: 4,
        usados: 0,
        expiraEm: new Date(Date.now() + 86_400_000).toISOString(),
        expirado: false,
        entraram: [],
      },
    }),
  });
}

const listaDeCasos = () => screen.findByRole('navigation', { name: 'Casos' });

describe('página Casos', () => {
  it('mostra os casos com número, papel e situação; contagem em cada aba', async () => {
    servidorDeCasos();
    abrir('/casos');

    const lista = await listaDeCasos();
    expect(within(lista).getAllByRole('link')).toHaveLength(4);
    expect(within(lista).getByText('Nº 022 · Mestre')).toBeDefined();
    expect(within(lista).getByText(/Encerrado · Ordem/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Todos 4' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ordem 3' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Inventados 1' })).toBeDefined();
  });

  it('filtro, chip e busca juntos, guardados na URL', async () => {
    servidorDeCasos();
    abrir('/casos');
    await listaDeCasos();

    fireEvent.click(screen.getByRole('button', { name: 'Ordem 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Em curso' }));
    fireEvent.change(screen.getByLabelText('Buscar caso ou mestre'), {
      target: { value: 'marta' },
    });

    const lista = await listaDeCasos();
    expect(
      within(lista)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([expect.stringContaining('Maré de Concreto') as string]);
    expect(screen.getByRole('button', { name: 'Em curso' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(endereco()).toBe('/casos?sistema=ordem&situacao=em-curso&q=marta');
  });

  it('busca sem resultado mostra o estado vazio e "Limpar filtros" volta tudo', async () => {
    servidorDeCasos();
    abrir('/casos?q=zzz');

    expect(await screen.findByText('Nenhum caso encontrado')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(within(await listaDeCasos()).getAllByRole('link')).toHaveLength(4);
    expect(endereco()).toBe('/casos');
  });

  it('/casos/:id abre o dossiê; clicar noutro caso troca a URL e mantém os filtros', async () => {
    servidorDeCasos();
    abrir('/casos/c1?sistema=ordem');

    const dossie = await screen.findByRole('region', { name: 'Dossiê do caso' });
    expect(
      await within(dossie).findByRole('heading', { name: 'O Sinal de Santa Ermida' }),
    ).toBeDefined();
    expect(within(dossie).getByText(/Mestre: Helena Duarte/)).toBeDefined();
    expect(within(dossie).getByRole('link', { name: 'Entrar na mesa' })).toBeDefined();
    expect(within(dossie).getByRole('link', { name: 'Ficha' })).toBeDefined();
    const aberto = within(await listaDeCasos()).getByRole('link', { current: 'page' });
    expect(aberto.textContent).toContain('Santa Ermida');

    fireEvent.click(within(await listaDeCasos()).getByRole('link', { name: /Maré de Concreto/ }));

    await waitFor(() => {
      expect(endereco()).toBe('/casos/c2?sistema=ordem');
    });
    expect(
      await screen.findByRole('heading', { name: 'Maré de Concreto', level: 2 }),
    ).toBeDefined();
  });

  it('o mestre vê os convites no dossiê e gera outro', async () => {
    const chamadas = servidorDeCasos();
    abrir('/casos/c2');

    expect(await screen.findByText('CONCRETO-7AND')).toBeDefined();
    expect(screen.getByText(/entraram: Iara/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Escudo' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }));

    const dossie = screen.getByRole('region', { name: 'Dossiê do caso' });
    expect(await within(dossie).findByText('CONCRETO-9XYZ')).toBeDefined();
    expect(within(dossie).getByText('CONCRETO-7AND')).toBeDefined();
    expect(chamadas.filter((c) => c.metodo === 'POST')).toHaveLength(1);
  });

  it('caso que não existe mostra o erro no dossiê, e a lista continua', async () => {
    servidorDeCasos();
    abrir('/casos/c_nada');

    expect(await screen.findByText('O dossiê não carregou.')).toBeDefined();
    expect(within(await listaDeCasos()).getAllByRole('link')).toHaveLength(4);
  });
});
