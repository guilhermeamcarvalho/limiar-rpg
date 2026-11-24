import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { abrir, json, personagem, servidor } from '../../teste/apoio.tsx';
import { personagensEmUso } from './TesteAvulso.tsx';

afterEach(() => {
  cleanup();
});

const DAVI = personagem();
const RUI = personagem(
  { id: 'chr_rui', emUso: false, campanhaId: null, campanha: null },
  { nome: 'Rui Batista' },
);

function montar(lista = [DAVI, RUI]) {
  servidor({
    'GET /api/me/personagens': json(200, { personagens: lista }),
    'GET /api/campanhas': json(200, { campanhas: [] }),
  });
  abrir('/arquivo');
}

const secoes = () => screen.getByRole('navigation', { name: 'Seções do Arquivo' });
const lista = () => screen.getByRole('list', { name: /^Entradas de/ });
const busca = () => screen.getByRole('searchbox', { name: 'Buscar no Arquivo' });
/** O cartão do teste avulso, a partir de algo dentro dele. */
const avulso = (dentro: HTMLElement) => dentro.closest('.arq-cartao') as HTMLElement;

describe('Arquivo (#55)', () => {
  it('abre em Testes e dados, com as sete seções e o detalhe da primeira entrada', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Arquivo', level: 1 })).toBeDefined();
    expect(within(secoes()).getAllByRole('button')).toHaveLength(7);
    expect(
      within(secoes())
        .getByRole('button', { name: /Testes e dados/ })
        .getAttribute('aria-current'),
    ).toBe('true');
    expect(screen.getByRole('heading', { name: 'Como funciona um teste', level: 2 })).toBeDefined();
  });

  it('buscar "lanterna" acha os 3 itens e diz quantos são', async () => {
    montar();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'lanterna' } });

    expect(screen.getByText('3 resultados')).toBeDefined();
    const itens = within(lista()).getAllByRole('button');
    expect(itens.map((b) => b.querySelector('b')?.textContent)).toEqual([
      'Lanterna tática',
      'Lanterna de cabeça',
      'Lanterna UV',
    ]);
    // A seção sem resultado fica desligada; a de Itens abre sozinha, com a contagem.
    expect(
      within(secoes()).getByRole('button', { name: /Itens/ }).getAttribute('aria-current'),
    ).toBe('true');
    expect(within(secoes()).getByRole('button', { name: /Ameaças/ })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('heading', { name: 'Lanterna tática', level: 2 })).toBeDefined();
  });

  it('escolher um item mostra o detalhe em papel', async () => {
    montar();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'lanterna' } });
    fireEvent.click(within(lista()).getByRole('button', { name: /Lanterna UV/ }));

    const detalhe = screen.getByRole('article', { name: 'Lanterna UV' });
    expect(within(detalhe).getByText(/Revela sangue limpo/)).toBeDefined();
    expect(within(detalhe).getByText('Revela marcas')).toBeDefined();
  });

  it('os filtros são as categorias da seção', async () => {
    montar();
    await screen.findByRole('navigation', { name: 'Seções do Arquivo' });
    fireEvent.click(within(secoes()).getByRole('button', { name: /Itens/ }));
    const filtros = screen.getByRole('group', { name: 'Filtrar por categoria' });
    expect(
      within(filtros)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Todos', 'Luz', 'Ferramentas', 'Proteção', 'Ocultismo']);

    fireEvent.click(within(filtros).getByRole('button', { name: 'Proteção' }));
    expect(
      within(filtros).getByRole('button', { name: 'Proteção' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const nomes = within(lista())
      .getAllByRole('button')
      .map((b) => b.querySelector('b')?.textContent);
    expect(nomes).toContain('Colete balístico');
    expect(nomes).not.toContain('Lanterna tática');
  });

  it('busca sem resultado avisa', async () => {
    montar();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('0 resultados')).toBeDefined();
    expect(screen.getByText('Nada encontrado')).toBeDefined();
    expect(busca()).toBeDefined();
  });

  it('a busca ignora acentos', async () => {
    montar();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'percepcao' } });
    expect(within(secoes()).getByRole('button', { name: /As 20 perícias/ }).textContent).toMatch(
      /1$/,
    );
  });
});

describe('teste avulso', () => {
  it('rola uma perícia do personagem em uso, sem mexer na ficha', async () => {
    montar();
    const cartao = avulso(await screen.findByText('Teste avulso'));
    expect(await within(cartao).findByText(/Com a ficha de Davi/)).toBeDefined();

    fireEvent.change(within(cartao).getByRole('combobox', { name: 'Perícia' }), {
      target: { value: 'crime' },
    });
    fireEvent.click(within(cartao).getByRole('button', { name: 'Rolar' }));

    const resultado = within(cartao).getByRole('region', { name: 'Resultado do teste' });
    expect(within(resultado).getByText(/Crime · Físico · avulso/)).toBeDefined();
    expect(within(resultado).getByText(/a ficha não muda|A ficha não muda/)).toBeDefined();
  });

  it('sem personagem em uso, manda escolher um', async () => {
    montar([RUI]);
    const aviso = await screen.findByText(/Nenhum personagem em uso num caso/);
    expect(within(avulso(aviso)).getByRole('link', { name: 'Personagens' })).toBeDefined();
  });

  it('só conta Ordem Paranormal II em uso num caso em curso', () => {
    const encerrado = personagem({
      id: 'chr_lia',
      campanha: { id: 'cmp_3', nome: 'Ala 13', encerrado: true },
    });
    const inventado = personagem({
      id: 'chr_kael',
      sistema: { id: 'sys_x', nome: 'Cinzas d20', tipo: 'inventado' },
    });
    expect(personagensEmUso([DAVI, RUI, encerrado, inventado]).map((p) => p.id)).toEqual([
      'chr_davi',
    ]);
  });
});
