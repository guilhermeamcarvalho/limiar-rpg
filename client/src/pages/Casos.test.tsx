import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CampanhaNaLista } from '@membrana/shared';
import { abrir, caso, detalhe, endereco, json, servidor, type Respostas } from '../teste/apoio.tsx';
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

function servidorDeCasos(extra: Respostas = {}) {
  return servidor({
    ...extra,
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

describe('excluir caso', () => {
  async function abrirExclusao() {
    const dossie = await screen.findByRole('region', { name: 'Dossiê do caso' });
    fireEvent.click(await within(dossie).findByRole('button', { name: 'Excluir caso' }));
    return screen.findByRole('dialog', { name: 'Excluir caso' });
  }

  it('o jogador não vê a opção', async () => {
    servidorDeCasos();
    abrir('/casos/c1');
    const dossie = await screen.findByRole('region', { name: 'Dossiê do caso' });
    await within(dossie).findByRole('heading', { name: 'O Sinal de Santa Ermida' });
    expect(within(dossie).queryByRole('button', { name: 'Excluir caso' })).toBeNull();
  });

  it('só libera com o nome digitado; exclui, tira da lista e volta para Casos', async () => {
    const chamadas = servidorDeCasos({ 'DELETE /api/campanhas/c2': json(204) });
    abrir('/casos/c2?sistema=ordem');
    const janela = await abrirExclusao();
    const botao = within(janela).getByRole('button', { name: 'Excluir para sempre' });
    const campo = within(janela).getByLabelText('Digite o nome do caso para confirmar');

    fireEvent.change(campo, { target: { value: 'Maré' } });
    expect(botao).toHaveProperty('disabled', true);
    fireEvent.change(campo, { target: { value: 'Maré de Concreto' } });
    expect(botao).toHaveProperty('disabled', false);
    fireEvent.click(botao);

    await waitFor(() => {
      expect(endereco()).toBe('/casos?sistema=ordem');
    });
    expect(await screen.findByText('Caso excluído')).toBeDefined();
    expect(chamadas.find((c) => c.metodo === 'DELETE')?.corpo).toEqual({
      nome: 'Maré de Concreto',
    });
    const lista = await listaDeCasos();
    expect(within(lista).queryByText(/Maré de Concreto/)).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Excluir caso' })).toBeNull();
  });

  it('se o servidor recusar o nome, o erro aparece no campo e nada sai da lista', async () => {
    servidorDeCasos({
      'DELETE /api/campanhas/c2': json(400, {
        erro: {
          codigo: 'DADOS_INVALIDOS',
          mensagem: 'Confira os campos destacados.',
          campos: { nome: 'Digite o nome do caso exatamente como está.' },
        },
      }),
    });
    abrir('/casos/c2');
    const janela = await abrirExclusao();
    fireEvent.change(within(janela).getByLabelText('Digite o nome do caso para confirmar'), {
      target: { value: 'Maré de Concreto' },
    });
    fireEvent.click(within(janela).getByRole('button', { name: 'Excluir para sempre' }));
    expect(
      await within(janela).findByText('Digite o nome do caso exatamente como está.'),
    ).toBeDefined();
    expect(endereco()).toBe('/casos/c2');
  });
});

describe('editar caso', () => {
  async function abrirEdicao() {
    const dossie = await screen.findByRole('region', { name: 'Dossiê do caso' });
    fireEvent.click(await within(dossie).findByRole('button', { name: 'Editar caso' }));
    return screen.findByRole('dialog', { name: 'Editar caso' });
  }

  it('o jogador não vê a opção', async () => {
    servidorDeCasos();
    abrir('/casos/c1');
    const dossie = await screen.findByRole('region', { name: 'Dossiê do caso' });
    await within(dossie).findByRole('heading', { name: 'O Sinal de Santa Ermida' });
    expect(within(dossie).queryByRole('button', { name: 'Editar caso' })).toBeNull();
  });

  it('o mestre muda nome e DT; o dossiê mostra o caso novo e a agenda não vai junto', async () => {
    const chamadas = servidorDeCasos({
      'PATCH /api/campanhas/c2': (c) =>
        json(200, {
          campanha: detalhe({ ...LISTA[1], ...(c.corpo as object), id: 'c2', agenda: null }),
        }),
    });
    abrir('/casos/c2');
    const janela = await abrirEdicao();

    const nome = within(janela).getByLabelText<HTMLInputElement>('Nome do caso');
    expect(nome.value).toBe('Maré de Concreto');
    fireEvent.change(nome, { target: { value: 'Maré Alta' } });
    fireEvent.change(within(janela).getByLabelText('DT padrão'), { target: { value: '9' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));

    const dossie = screen.getByRole('region', { name: 'Dossiê do caso' });
    expect(await within(dossie).findByRole('heading', { name: 'Maré Alta' })).toBeDefined();
    expect(await screen.findByText('Caso atualizado')).toBeDefined();
    const corpo = chamadas.find((c) => c.metodo === 'PATCH')?.corpo as Record<string, unknown>;
    expect(corpo).toMatchObject({ nome: 'Maré Alta', dtPadrao: 9 });
    expect(corpo).not.toHaveProperty('agenda');
    expect(screen.queryByRole('dialog', { name: 'Editar caso' })).toBeNull();
  });

  it('sem nome, avisa no campo e não envia nada', async () => {
    const chamadas = servidorDeCasos();
    abrir('/casos/c2');
    const janela = await abrirEdicao();

    fireEvent.change(within(janela).getByLabelText('Nome do caso'), { target: { value: ' ' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(await within(janela).findByText('Dê um nome ao caso.')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'PATCH')).toBe(false);
  });
});
