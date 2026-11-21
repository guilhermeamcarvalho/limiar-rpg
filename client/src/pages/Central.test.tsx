import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ConvitePublico } from '@membrana/shared';
import { reiniciarConvitesPendentes } from '../convites/pendentes.ts';
import { abrir, caso, json, semRede, servidor } from '../teste/apoio.tsx';

const CHAVE = 'membrana.convites-pendentes.v1';
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const CONVITE: ConvitePublico = {
  codigo: 'HOSPITAL-7K2M',
  estado: 'valido',
  vagasRestantes: 2,
  campanha: { id: 'cmp_5', numero: 9, nome: 'Ala 13', gancho: 'Os pacientes acordam juntos.' },
  mestre: { nome: 'Camila Torres' },
  sistema: { nome: 'Ordem Paranormal II' },
  proximaSessao: null,
  jaParticipa: false,
};

beforeEach(() => {
  localStorage.clear();
  reiniciarConvitesPendentes();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const continuar = () => screen.findByRole('article', { name: /./ });

describe('Continuar investigação', () => {
  it('jogador: mostra o caso com sessão mais próxima e os botões Entrar na mesa e Ficha', async () => {
    servidor({
      'GET /api/campanhas': json(200, {
        campanhas: [
          caso({ id: 'cmp_2', nome: 'Sem data', proximaSessao: null }),
          caso({ id: 'cmp_1', proximaSessao: AMANHA }),
        ],
      }),
    });
    abrir('/');

    const cartao = await continuar();
    expect(within(cartao).getByRole('heading', { name: 'O Sinal de Santa Ermida' })).toBeDefined();
    expect(within(cartao).getByText('Helena Duarte')).toBeDefined();
    expect(within(cartao).getByRole('link', { name: 'Entrar na mesa' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/mesa',
    );
    expect(within(cartao).getByRole('link', { name: 'Ficha' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/ficha',
    );
    expect(within(cartao).queryByRole('link', { name: 'Escudo' })).toBeNull();
  });

  it('mestre: Abrir mesa e Escudo', async () => {
    servidor({
      'GET /api/campanhas': json(200, { campanhas: [caso({ papel: 'mestre', mestre: null })] }),
    });
    abrir('/');

    const cartao = await continuar();
    expect(within(cartao).getByRole('link', { name: 'Abrir mesa' })).toBeDefined();
    expect(within(cartao).getByRole('link', { name: 'Escudo' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/escudo',
    );
    expect(within(cartao).queryByRole('link', { name: 'Ficha' })).toBeNull();
  });

  it('sem casos, mostra o estado vazio com os dois caminhos', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/');

    expect(await screen.findByText('Nenhum caso ainda')).toBeDefined();
    expect(screen.getAllByRole('link', { name: 'Abrir novo caso' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('a lista curta mostra até 3 casos e "Ver todos" leva a Casos', async () => {
    servidor({
      'GET /api/campanhas': json(200, {
        campanhas: ['a', 'b', 'c', 'd'].map((id) => caso({ id, nome: `Caso ${id}` })),
      }),
    });
    abrir('/');

    const secao = (await screen.findByRole('heading', { name: 'Seus casos' })).closest('section');
    if (!secao) throw new Error('sem seção');
    const cartoes = within(secao)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('/casos/'));
    expect(cartoes).toHaveLength(3);
    expect(within(secao).getByRole('link', { name: 'Ver todos' }).getAttribute('href')).toBe(
      '/casos',
    );
  });
});

describe('cada bloco falha sozinho', () => {
  it('casos sem rede: o erro aparece no bloco, e os convites continuam de pé', async () => {
    localStorage.setItem(CHAVE, JSON.stringify(['HOSPITAL-7K2M']));
    let tentativas = 0;
    servidor({
      'GET /api/campanhas': () =>
        ++tentativas === 1 ? semRede() : json(200, { campanhas: [caso()] }),
      'GET /api/convites/HOSPITAL-7K2M': json(200, { convite: CONVITE }),
    });
    abrir('/');

    expect(await screen.findByText('Os seus casos não carregaram.')).toBeDefined();
    expect(screen.getByText('A agenda não carregou.')).toBeDefined();
    expect(await screen.findByText('Ala 13')).toBeDefined();

    fireEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0] as HTMLElement);
    expect(await continuar()).toBeDefined();
    expect(tentativas).toBe(2);
  });
});

describe('convites pendentes', () => {
  it('aceitar entra no caso, tira o convite da lista e recarrega os casos', async () => {
    localStorage.setItem(CHAVE, JSON.stringify(['HOSPITAL-7K2M']));
    let entrou = false;
    const chamadas = servidor({
      'GET /api/campanhas': () =>
        json(200, { campanhas: entrou ? [caso({ id: 'cmp_5', nome: 'Ala 13' })] : [] }),
      'GET /api/convites/HOSPITAL-7K2M': json(200, { convite: CONVITE }),
      'POST /api/convites/HOSPITAL-7K2M/aceitar': () => {
        entrou = true;
        return json(200, { campanha: { id: 'cmp_5', nome: 'Ala 13' } });
      },
    });
    abrir('/');

    const bloco = (await screen.findByRole('heading', { name: 'Convites' })).closest('section');
    if (!bloco) throw new Error('sem bloco');
    fireEvent.click(await within(bloco).findByRole('button', { name: 'Aceitar' }));

    expect(await screen.findByText('Você entrou no caso')).toBeDefined();
    expect(await within(bloco).findByText('Nenhum convite esperando resposta.')).toBeDefined();
    expect(JSON.parse(localStorage.getItem(CHAVE) ?? '[]')).toEqual([]);
    await waitFor(() => {
      expect(chamadas.filter((c) => c.url === '/api/campanhas')).toHaveLength(2);
    });
    expect(await continuar()).toBeDefined();
  });

  it('recusar tira o convite sem chamar o servidor', async () => {
    localStorage.setItem(CHAVE, JSON.stringify(['HOSPITAL-7K2M']));
    const chamadas = servidor({
      'GET /api/campanhas': json(200, { campanhas: [] }),
      'GET /api/convites/HOSPITAL-7K2M': json(200, { convite: CONVITE }),
    });
    abrir('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }));

    expect(await screen.findByText('Nenhum convite esperando resposta.')).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('convite que não vale mais (expirado, sumido ou de caso em que já está) some sozinho', async () => {
    localStorage.setItem(CHAVE, JSON.stringify(['HOSPITAL-7K2M', 'SUMIDO-2222', 'JAESTOU-3333']));
    servidor({
      'GET /api/campanhas': json(200, { campanhas: [] }),
      'GET /api/convites/HOSPITAL-7K2M': json(200, {
        convite: { ...CONVITE, estado: 'expirado' },
      }),
      'GET /api/convites/JAESTOU-3333': json(200, {
        convite: { ...CONVITE, codigo: 'JAESTOU-3333', jaParticipa: true },
      }),
    });
    abrir('/');

    expect(await screen.findByText('Nenhum convite esperando resposta.')).toBeDefined();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CHAVE) ?? '[]')).toEqual([]);
    });
  });
});

describe('agenda', () => {
  it('lista as sessões marcadas, da mais próxima para a mais distante', async () => {
    const depois = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    servidor({
      'GET /api/campanhas': json(200, {
        campanhas: [
          caso({ id: 'b', nome: 'Maré de Concreto', papel: 'mestre', proximaSessao: depois }),
          caso({ id: 'a', nome: 'Santa Ermida', proximaSessao: AMANHA }),
          caso({ id: 'c', nome: 'Sem data' }),
        ],
      }),
    });
    abrir('/');

    const bloco = (await screen.findByRole('heading', { name: 'Agenda' })).closest('section');
    if (!bloco) throw new Error('sem bloco');
    const itens = await within(bloco).findAllByRole('listitem');
    expect(itens.map((i) => within(i).getByText(/Ermida|Maré/).textContent)).toEqual([
      'Santa Ermida',
      'Maré de Concreto',
    ]);
    expect(within(bloco).getByText('você mestra')).toBeDefined();
  });
});
