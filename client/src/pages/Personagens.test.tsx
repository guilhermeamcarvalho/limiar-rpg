import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  abrir,
  caso,
  endereco,
  json,
  personagem,
  servidor,
  type Respostas,
} from '../teste/apoio.tsx';
import { PRAZO_PARA_DESFAZER_MS } from './Personagens.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const DAVI = personagem();
/** Num caso, mas não em uso. */
const KAEL = personagem(
  {
    id: 'chr_kael',
    emUso: false,
    campanhaId: 'cmp_2',
    campanha: { id: 'cmp_2', nome: 'Maré de Concreto', encerrado: false },
    atualizadoEm: '2026-11-23T12:00:00.000Z',
  },
  { nome: 'Kael Duarte', perfil: 'analista' },
);
/** Sem caso. */
const RUI = personagem(
  { id: 'chr_rui', emUso: false, campanhaId: null, campanha: null },
  { nome: 'Rui Batista', ocupacao: 'Policial', perfil: 'vigilante', impeto: 0 },
);
/** Caso encerrado. */
const LIA = personagem(
  {
    id: 'chr_lia',
    emUso: true,
    campanhaId: 'cmp_3',
    campanha: { id: 'cmp_3', nome: 'Ala 13', encerrado: true },
    atualizadoEm: '2026-11-01T12:00:00.000Z',
  },
  { nome: 'Lia Fontana', perfil: 'analista', impeto: 0 },
);

function montar(lista = [DAVI, KAEL, RUI, LIA], extra: Respostas = {}) {
  const chamadas = servidor({
    'GET /api/me/personagens': json(200, { personagens: lista }),
    'GET /api/campanhas': json(200, {
      campanhas: [
        caso(),
        caso({ id: 'cmp_2', nome: 'Maré de Concreto' }),
        caso({
          id: 'cmp_4',
          nome: 'Cripta',
          sistema: { id: 'sys_x', nome: 'Cripta d20', tipo: 'inventado' },
        }),
      ],
    }),
    ...extra,
  });
  return chamadas;
}

const cartao = (nome: string) => screen.getByRole('article', { name: nome });

describe('Personagens', () => {
  it('mostra os cartões com caso, sistema, perfil, atributos e recursos', async () => {
    montar();
    abrir('/personagens');

    const davi = await screen.findByRole('article', { name: 'Davi' });
    expect(within(davi).getByText('Em uso')).toBeDefined();
    expect(within(davi).getByText('Davi Rocha · Mecânico · nível 2')).toBeDefined();
    expect(within(davi).getByText('O Sinal de Santa Ermida')).toBeDefined();
    expect(within(davi).getByText('Ordem Paranormal II')).toBeDefined();
    expect(within(davi).getByText('Executor')).toBeDefined();
    expect(within(davi).getByRole('img', { name: 'd8 de atributo: 8' })).toBeDefined();
    expect(within(davi).getByRole('meter', { name: 'PV' }).getAttribute('aria-valuenow')).toBe(
      '12',
    );
  });

  it('cada cartão tem a ação certa: jogar, usar ou levar para um caso', async () => {
    montar();
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });

    expect(
      within(cartao('Davi')).getByRole('link', { name: 'Jogar na mesa' }).getAttribute('href'),
    ).toBe('/campanhas/cmp_1/mesa');
    expect(within(cartao('Kael')).getByRole('button', { name: 'Usar este' })).toBeDefined();
    expect(within(cartao('Kael')).queryByRole('link', { name: 'Jogar na mesa' })).toBeNull();
    expect(within(cartao('Rui')).getByRole('button', { name: 'Levar para um caso' })).toBeDefined();
    expect(within(cartao('Rui')).getByText(/Sem caso. Leve Rui/)).toBeDefined();
    // Caso encerrado: sem mesa, sem "em uso".
    expect(within(cartao('Lia')).queryByRole('link', { name: 'Jogar na mesa' })).toBeNull();
    expect(within(cartao('Lia')).queryByText('Em uso')).toBeNull();
    expect(within(cartao('Lia')).getByText('Ala 13 · encerrado')).toBeDefined();
    expect(
      within(cartao('Davi')).getByRole('link', { name: 'Abrir ficha' }).getAttribute('href'),
    ).toBe('/personagens/chr_davi/ficha');
  });

  it('filtra por caso e ordena por nome ou por jogados recentemente', async () => {
    montar();
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });
    const nomes = () =>
      screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby'));

    // Jogados recentemente: Kael (23/11), Davi e Rui (22/11), Lia (01/11).
    expect(nomes()).toEqual(['pers-chr_kael', 'pers-chr_davi', 'pers-chr_rui', 'pers-chr_lia']);

    fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'nome' } });
    expect(nomes()).toEqual(['pers-chr_davi', 'pers-chr_kael', 'pers-chr_lia', 'pers-chr_rui']);

    const filtros = screen.getByRole('group', { name: 'Filtrar por caso' });
    fireEvent.click(within(filtros).getByRole('button', { name: /Sem caso/ }));
    expect(nomes()).toEqual(['pers-chr_rui']);
    fireEvent.click(within(filtros).getByRole('button', { name: /Encerrados/ }));
    expect(nomes()).toEqual(['pers-chr_lia']);
    fireEvent.click(within(filtros).getByRole('button', { name: /Maré de Concreto/ }));
    expect(nomes()).toEqual(['pers-chr_kael']);
    expect(within(filtros).getByRole('button', { name: /Todos/ }).textContent).toContain('4');
  });

  it('"Usar este" põe o personagem em uso no caso dele', async () => {
    const chamadas = montar([DAVI, KAEL], {
      'PUT /api/campanhas/cmp_2/meu-personagem': json(200, { campanha: {} }),
    });
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Kael' });

    fireEvent.click(within(cartao('Kael')).getByRole('button', { name: 'Usar este' }));

    await waitFor(() => {
      expect(chamadas).toContainEqual({
        metodo: 'PUT',
        url: '/api/campanhas/cmp_2/meu-personagem',
        corpo: { personagemId: 'chr_kael' },
      });
    });
    expect(await screen.findByText('Kael em uso')).toBeDefined();
  });

  it('"Levar para um caso" lista só os casos em curso do mesmo sistema', async () => {
    const chamadas = montar([RUI], {
      'PUT /api/campanhas/cmp_2/meu-personagem': json(200, { campanha: {} }),
    });
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Rui' });

    fireEvent.click(screen.getByRole('button', { name: 'Levar para um caso' }));
    const janela = await screen.findByRole('dialog', { name: 'Levar Rui para um caso' });
    expect(within(janela).queryByRole('button', { name: 'Cripta' })).toBeNull();
    fireEvent.click(within(janela).getByRole('button', { name: 'Maré de Concreto' }));

    await waitFor(() => {
      expect(chamadas).toContainEqual({
        metodo: 'PUT',
        url: '/api/campanhas/cmp_2/meu-personagem',
        corpo: { personagemId: 'chr_rui' },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Rui em uso')).toBeDefined();
  });

  it('o menu duplica o personagem, sem caso', async () => {
    const chamadas = montar([DAVI], { 'POST /api/personagens': json(201, { personagem: DAVI }) });
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações para Davi' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicar' }));

    await waitFor(() => {
      const post = chamadas.find((c) => c.metodo === 'POST');
      expect(post?.corpo).toMatchObject({
        sistemaId: 'sys_op2',
        ficha: { nome: 'Davi Rocha (cópia)' },
      });
    });
  });

  it('o menu abre e fecha pelo teclado', async () => {
    montar([DAVI]);
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });
    const botao = screen.getByRole('button', { name: 'Mais ações para Davi' });

    fireEvent.click(botao);
    const itens = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(itens[0]);
    fireEvent.keyDown(itens[0] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(itens[1]);
    fireEvent.keyDown(itens[1] as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });
});

describe('Remover', () => {
  async function pedirRemocao() {
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações para Davi' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remover' }));
    return screen.findByRole('alertdialog', { name: 'Confirmar remoção de Davi' });
  }

  it('pede confirmação no cartão, explicando o que some; "Manter" desiste', async () => {
    const chamadas = montar([DAVI]);
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });

    const confirma = await pedirRemocao();
    expect(confirma.textContent).toContain(
      'A ficha, a foto, o token e as pistas guardadas somem. O caso O Sinal de Santa Ermida mantém o histórico.',
    );
    expect(document.activeElement).toBe(within(confirma).getByRole('button', { name: 'Manter' }));

    fireEvent.click(within(confirma).getByRole('button', { name: 'Manter' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
  });

  it('remove com aviso de sucesso e "Desfazer" por 5 s', async () => {
    const chamadas = montar([DAVI, KAEL], {
      'DELETE /api/personagens/chr_davi': json(204),
    });
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });
    const confirma = await pedirRemocao();

    vi.useFakeTimers();
    fireEvent.click(within(confirma).getByRole('button', { name: 'Remover' }));

    expect(screen.queryByRole('article', { name: 'Davi' })).toBeNull();
    expect(screen.getByText('Davi removido')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PRAZO_PARA_DESFAZER_MS);
    });
    expect(chamadas).toContainEqual({
      metodo: 'DELETE',
      url: '/api/personagens/chr_davi',
      corpo: undefined,
    });
  });

  it('"Desfazer" traz o personagem de volta e não apaga nada', async () => {
    const chamadas = montar([DAVI, KAEL]);
    abrir('/personagens');
    await screen.findByRole('article', { name: 'Davi' });
    const confirma = await pedirRemocao();

    vi.useFakeTimers();
    fireEvent.click(within(confirma).getByRole('button', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(screen.getByRole('article', { name: 'Davi' })).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(PRAZO_PARA_DESFAZER_MS * 2);
    });
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
  });
});

describe('Primeiro acesso (vazio)', () => {
  it('depois do convite: aviso verde, estado vazio e as três etapas', async () => {
    montar([]);
    abrir('/personagens?aceito=cmp_1');

    expect(
      await screen.findByText((_, el) =>
        el?.className === 'grow'
          ? el.textContent ===
            'Convite aceito. Você agora joga em O Sinal de Santa Ermida. Falta só o personagem.'
          : false,
      ),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Ninguém sobreviveu ainda' })).toBeDefined();
    expect(screen.getByText(/Crie um personagem para O Sinal de Santa Ermida/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Criar com passo a passo' }).getAttribute('href')).toBe(
      '/personagens/novo?caso=cmp_1',
    );
    expect(screen.getByRole('link', { name: 'Ficha em branco' }).getAttribute('href')).toBe(
      '/personagens/novo/ficha?caso=cmp_1',
    );
    expect(screen.getByText('1 · Perfil')).toBeDefined();
    expect(screen.getByText('2 · Atributos e perícias')).toBeDefined();
    expect(screen.getByText('3 · Foto e token')).toBeDefined();
  });

  it('sem convite, o vazio não fala de caso', async () => {
    montar([]);
    abrir('/personagens');

    expect(await screen.findByText(/Crie o seu primeiro personagem/)).toBeDefined();
    expect(screen.queryByText(/Convite aceito/)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Criar com passo a passo' }));
    await waitFor(() => {
      expect(endereco()).toBe('/personagens/novo');
    });
  });
});
