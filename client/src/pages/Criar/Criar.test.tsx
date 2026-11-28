import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { esquemaFichaOp2, fichaNova, type FichaOp2 } from '@membrana/shared';
import { abrir, detalhe, json, MARTA, servidor, type Chamada } from '../../teste/apoio.tsx';
import { RASCUNHO_VAZIO, fichaDoRascunho, lerRascunho } from './rascunho.ts';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const proximo = () => screen.getByRole('button', { name: /^Próximo/ });
const titulo = (nome: string) => screen.findByRole('heading', { name: nome, level: 1 });

function montar() {
  return servidor({
    'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe({ nivelInicial: 1 }) }),
    'POST /api/personagens': (c: Chamada) =>
      json(201, {
        personagem: {
          id: 'chr_novo',
          ficha: (c.corpo as { ficha: FichaOp2 }).ficha,
          atualizadoEm: '2026-11-23T12:00:00.000Z',
        },
      }),
  });
}

async function ateAtributos() {
  await titulo('Que tipo de sobrevivente');
  fireEvent.click(screen.getByRole('radio', { name: /Analista/ }));
  fireEvent.click(proximo());
  await titulo('O que fazia antes disso');
  fireEvent.click(screen.getByRole('radio', { name: /Investigador/ }));
  fireEvent.click(proximo());
  await titulo('Do que é feito');
}

describe('Criação guiada', () => {
  it('mostra o caso e o nível, e não avança sem escolher o perfil', async () => {
    montar();
    abrir('/personagens/novo?caso=cmp_1');

    await titulo('Que tipo de sobrevivente');
    expect(await screen.findByText('O Sinal de Santa Ermida')).toBeDefined();
    expect(screen.getByText('Passo 1 de 5')).toBeDefined();
    fireEvent.click(proximo());

    expect(screen.getByText('Escolha um perfil.')).toBeDefined();
    expect(screen.getByText('Corrija 1 campo para continuar.')).toBeDefined();
    expect(screen.getByText('Passo 1 de 5')).toBeDefined();
  });

  it('perfil e ocupação mostram a habilidade e as sugeridas; o painel acompanha', async () => {
    montar();
    abrir('/personagens/novo');
    await titulo('Que tipo de sobrevivente');

    expect(screen.getByText('Plano')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: /Analista/ }));
    fireEvent.click(proximo());
    await titulo('O que fazia antes disso');
    expect(screen.getByText('Sugeridas: Percepção e Pesquisa')).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: /Investigador/ }));

    const painel = screen.getByRole('complementary', { name: 'Ficha até agora' });
    expect(within(painel).getByText('Analista')).toBeDefined();
    expect(within(painel).getByText('Investigador')).toBeDefined();
    expect(within(painel).getByRole('meter', { name: 'PV' }).getAttribute('aria-valuemax')).toBe(
      '8',
    );
  });

  it('atributos: passos, PV e PD ao vivo, aviso verde e aviso dourado sem bloquear', async () => {
    montar();
    abrir('/personagens/novo');
    await ateAtributos();

    expect(screen.getByText(/Faltam usar 5 passos/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Físico' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Emoção' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Emoção' }));
    expect(
      screen.getByText('Todos os passos foram usados. PV 10 e PD 14 calculados.'),
    ).toBeDefined();
    expect(screen.getAllByText('d8 · +2 passos', { selector: '.lab' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));
    expect(
      screen.getByText(
        'Mente d12 passa do limite da criação (d10). Dá para salvar assim; o mestre verá o aviso na ficha.',
      ),
    ).toBeDefined();
    // Fora da regra não bloqueia.
    fireEvent.click(proximo());
    await titulo('O que sabe fazer');
  });

  it('os botões de atributo são botões de verdade, alcançáveis pelo teclado', async () => {
    montar();
    abrir('/personagens/novo');
    await ateAtributos();

    const subir = screen.getByRole('button', { name: 'Subir Físico' });
    expect(subir.tagName).toBe('BUTTON');
    expect(subir.getAttribute('tabindex')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Baixar Físico' }).disabled).toBe(
      true,
    );
  });

  it('voltar um passo mantém as escolhas', async () => {
    montar();
    abrir('/personagens/novo');
    await ateAtributos();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ocupação' }));
    await titulo('O que fazia antes disso');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Investigador/ }).checked).toBe(
      true,
    );
    fireEvent.click(proximo());
    await titulo('Do que é feito');
    expect(screen.getByRole('img', { name: 'd6 de atributo: 6' })).toBeDefined();
  });

  it('sair e voltar recupera o rascunho', async () => {
    montar();
    const tela = abrir('/personagens/novo?caso=cmp_1');
    // Enquanto o caso carrega, o Próximo fica desabilitado: espera o caso antes de avançar.
    await screen.findByText('O Sinal de Santa Ermida');
    await ateAtributos();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Físico' }));
    tela.unmount();

    abrir('/personagens/novo?caso=cmp_1');

    await titulo('Do que é feito');
    expect(screen.getByRole('img', { name: 'd6 de atributo: 6' })).toBeDefined();
    expect(lerRascunho(MARTA.id, 'cmp_1')).toMatchObject({
      perfil: 'analista',
      ocupacao: 'investigador',
      atributos: { fisico: 'd6' },
    });
  });

  it('perícias: todas começam em d4 e os 7 passos são contados', async () => {
    montar();
    abrir('/personagens/novo');
    await ateAtributos();
    fireEvent.click(proximo());
    await titulo('O que sabe fazer');

    expect(screen.getByText('0 de 7 passos usados.')).toBeDefined();
    expect(screen.getAllByText('sugerida')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Luta' }));
    expect(screen.getByText('1 de 7 passos usados.')).toBeDefined();
  });

  it('cria, põe em uso no caso e a tela final mostra o nome certo', async () => {
    const chamadas = montar();
    abrir('/personagens/novo?caso=cmp_1');
    await screen.findByText('O Sinal de Santa Ermida');
    await ateAtributos();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Mente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Emoção' }));
    fireEvent.click(proximo());
    await titulo('O que sabe fazer');
    fireEvent.click(proximo());
    await titulo('Os toques finais');

    // Sem nome não cria.
    fireEvent.click(screen.getByRole('button', { name: 'Criar personagem' }));
    expect(await screen.findByText('Dê um nome ao personagem.')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText('Nome', { selector: '.criar-corpo input' }), {
      target: { value: 'Bianca Moreira' },
    });
    fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '29' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar personagem' }));

    expect(await screen.findByRole('heading', { name: 'Bianca Moreira', level: 1 })).toBeDefined();
    expect(screen.getByText(/Já está em uso em O Sinal de Santa Ermida/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Jogar na mesa' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/mesa',
    );
    const post = chamadas.find((c) => c.metodo === 'POST');
    expect(post?.corpo).toMatchObject({
      campanhaId: 'cmp_1',
      usarNoCaso: true,
      ficha: {
        nome: 'Bianca Moreira',
        idade: 29,
        perfil: 'analista',
        ocupacao: 'Investigador',
        atributos: { fisico: 'd4', mente: 'd6', emocao: 'd6' },
        pericias: { pesquisa: 'd4', persuasao: 'd4', luta: 'd4' },
        pvMax: 8,
        pdMax: 16,
      },
    });
    // O rascunho some depois de criar.
    expect(lerRascunho(MARTA.id, 'cmp_1')).toEqual(RASCUNHO_VAZIO);
  });
});

describe('rascunho', () => {
  it('a ficha da criação tem a mesma estrutura da ficha em branco e passa no schema', () => {
    const r = {
      ...RASCUNHO_VAZIO,
      perfil: 'vigilante' as const,
      ocupacao: 'policial',
      nome: 'Rui',
    };
    const criada = fichaDoRascunho(r, 2);
    const emBranco = fichaNova({ nivel: 2 });

    expect(Object.keys(criada).sort()).toEqual(Object.keys(emBranco).sort());
    expect(esquemaFichaOp2.safeParse(criada).success).toBe(true);
    expect(criada.pericias.pontaria).toBe('d4');
    expect(criada.nivel).toBe(2);
  });

  it('rascunho estragado volta ao padrão campo a campo', () => {
    localStorage.setItem(
      `membrana.criar.rascunho.v1:${MARTA.id}:sem-caso`,
      JSON.stringify({ passo: 99, perfil: 'mago', atributos: { fisico: 'd20', mente: 'd8' } }),
    );
    expect(lerRascunho(MARTA.id, null)).toMatchObject({
      passo: 4,
      perfil: null,
      atributos: { fisico: 'd4', mente: 'd8', emocao: 'd4' },
    });
  });
});

describe('Criação no celular (#56)', () => {
  it('o cabeçalho diz o passo, e a barra do app sai para os botões fixos', async () => {
    montar();
    abrir('/personagens/novo');
    await titulo('Que tipo de sobrevivente');
    const topo = document.querySelector('header.m-top') as HTMLElement;
    expect(within(topo).getByText('Passo 1 de 5 · Perfil')).toBeDefined();
    expect(within(topo).getByRole('link', { name: 'Fechar' }).getAttribute('href')).toBe(
      '/personagens',
    );
    expect(document.querySelector('.m-tabbar')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Analista/ }));
    fireEvent.click(proximo());
    await titulo('O que fazia antes disso');
    expect(within(topo).getByText('Passo 2 de 5 · Ocupação')).toBeDefined();

    // No passo 2, a seta volta um passo em vez de sair.
    fireEvent.click(within(topo).getByRole('button', { name: 'Voltar para Perfil' }));
    await titulo('Que tipo de sobrevivente');
  });
});
