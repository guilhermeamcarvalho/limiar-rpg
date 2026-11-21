import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { abrir, detalhe, endereco, json, MARTA, servidor } from '../../teste/apoio.tsx';
import { textoDoSalvo } from './index.tsx';
import { RASCUNHO_VAZIO, lerRascunho, montarPedido } from './rascunho.ts';

const CHAVE = `membrana.novo-caso.rascunho.v1:${MARTA.id}`;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const proximo = () => screen.getByRole('button', { name: /^Próximo/ });
const titulo = (nome: string) => screen.findByRole('heading', { name: nome, level: 1 });

async function preencherPremissa(nome = 'Maré de Concreto') {
  fireEvent.change(await screen.findByLabelText('Nome do caso'), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText(/O gancho/), {
    target: { value: 'Um prédio afunda um andar por noite.' },
  });
}

describe('Novo caso', () => {
  it('passo inválido não avança e mostra o erro no campo', async () => {
    servidor();
    abrir('/casos/novo');

    await titulo('Todo caso começa com uma pergunta');
    fireEvent.click(proximo());

    const nome = screen.getByLabelText('Nome do caso');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Dê um nome ao caso.')).toBeDefined();
    expect(screen.getByText('Corrija 1 campo para continuar.')).toBeDefined();
    expect(screen.getByText('Passo 1 de 5 · Premissa')).toBeDefined();
  });

  it('o nome tem contador de caracteres', async () => {
    servidor();
    abrir('/casos/novo');

    await preencherPremissa('Maré de Concreto');
    expect(screen.getByText('16 de 80 caracteres')).toBeDefined();
  });

  it('não deixa pular para um passo à frente de um inválido', async () => {
    servidor();
    abrir('/casos/novo');
    await titulo('Todo caso começa com uma pergunta');

    const passos = screen.getByRole('navigation', { name: 'Passos' });
    const revisao = [...passos.querySelectorAll('button')].at(-1);
    expect(revisao?.hasAttribute('disabled')).toBe(true);
  });

  it('o rascunho é salvo a cada mudança e volta ao reabrir a página', async () => {
    servidor();
    const primeira = abrir('/casos/novo');
    await preencherPremissa();
    fireEvent.click(proximo());
    await titulo('As regras da mesa');
    fireEvent.change(screen.getByLabelText('DT padrão'), { target: { value: '9' } });

    expect(screen.getByText(/^Rascunho salvo há \d+ s$/)).toBeDefined();
    expect(JSON.parse(localStorage.getItem(CHAVE) ?? '{}')).toMatchObject({
      nome: 'Maré de Concreto',
      dtPadrao: '9',
      passo: 1,
    });

    primeira.unmount();
    abrir('/casos/novo');

    await titulo('As regras da mesa');
    expect(screen.getByLabelText<HTMLInputElement>('DT padrão').value).toBe('9');
  });

  it('abrir o caso cria a campanha com tudo do assistente e leva ao dossiê', async () => {
    const chamadas = servidor({
      'POST /api/campanhas': json(201, {
        campanha: detalhe({ id: 'cmp_novo', nome: 'Maré de Concreto' }),
      }),
      'GET /api/campanhas': json(200, { campanhas: [] }),
      'GET /api/campanhas/cmp_novo': json(200, { campanha: detalhe({ id: 'cmp_novo' }) }),
    });
    abrir('/casos/novo');

    await preencherPremissa();
    fireEvent.click(proximo());
    await titulo('As regras da mesa');
    fireEvent.change(screen.getByLabelText('Nível inicial'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('switch', { name: /Outros jogadores podem ver as fichas/ }));
    fireEvent.click(proximo());
    await titulo('Quando a mesa se reúne');
    fireEvent.change(screen.getByLabelText('Dia da semana'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Horário'), { target: { value: '15:00' } });
    fireEvent.click(proximo());
    await titulo('Chame o grupo');
    fireEvent.change(screen.getByLabelText('Vagas'), { target: { value: '5' } });
    fireEvent.click(proximo());
    await titulo('Confira e abra o caso');

    const abrirCaso = screen.getByRole('button', { name: 'Abrir o caso' });
    fireEvent.click(abrirCaso);
    fireEvent.click(abrirCaso);

    await waitFor(() => {
      expect(endereco()).toBe('/casos/cmp_novo');
    });
    const posts = chamadas.filter((c) => c.metodo === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.corpo).toMatchObject({
      nome: 'Maré de Concreto',
      gancho: 'Um prédio afunda um andar por noite.',
      sistemaId: 'sys_op2',
      nivelInicial: 2,
      dtPadrao: 7,
      rodadas: true,
      dadosFisicos: true,
      fichasVisiveis: true,
      agenda: { diaDaSemana: 6, horario: '15:00', frequencia: 'semanal' },
      convite: { vagas: 5, expiraEmDias: 7 },
    });
    const proxima = new Date((posts[0]?.corpo as { proximaSessao: string }).proximaSessao);
    expect([proxima.getDay(), proxima.getHours(), proxima.getMinutes()]).toEqual([6, 15, 0]);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('campo recusado pelo servidor volta ao passo dele com a mensagem', async () => {
    servidor({
      'POST /api/campanhas': json(400, {
        erro: {
          codigo: 'DADOS_INVALIDOS',
          mensagem: 'Confira os campos destacados.',
          campos: { nome: 'Já existe um caso com este nome.' },
        },
      }),
    });
    localStorage.setItem(CHAVE, JSON.stringify({ ...RASCUNHO_VAZIO, nome: 'Maré', passo: 4 }));
    abrir('/casos/novo');

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o caso' }));

    expect(await titulo('Todo caso começa com uma pergunta')).toBeDefined();
    expect(screen.getByText('Já existe um caso com este nome.')).toBeDefined();
  });
});

describe('rascunho', () => {
  it('rascunho estragado no armazenamento volta ao padrão, campo a campo', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ nome: 'Ok', passo: 99, tom: 'inexistente', vagas: 3, salvoEm: 'ontem' }),
    );
    const { rascunho, salvoEm } = lerRascunho(MARTA.id);
    expect(rascunho).toEqual({ ...RASCUNHO_VAZIO, nome: 'Ok', passo: 4 });
    expect(salvoEm).toBeNull();

    localStorage.setItem(CHAVE, '{não é json');
    expect(lerRascunho(MARTA.id).rascunho).toEqual(RASCUNHO_VAZIO);
  });

  it('sem dia fixo, a agenda e a próxima sessão vão nulas', () => {
    const pedido = montarPedido({ ...RASCUNHO_VAZIO, temAgenda: false }, new Date());
    expect(pedido.agenda).toBeNull();
    expect(pedido.proximaSessao).toBeNull();
  });

  it('"salvo há" conta segundos e depois minutos', () => {
    expect(textoDoSalvo(1000, 4500)).toBe('Rascunho salvo há 3 s');
    expect(textoDoSalvo(0, 125_000)).toBe('Rascunho salvo há 2 min');
  });
});
