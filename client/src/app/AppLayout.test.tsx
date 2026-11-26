import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { reiniciarConvitesPendentes } from '../convites/pendentes.ts';
import { abrir, detalhe, endereco, json, servidor } from '../teste/apoio.tsx';

beforeEach(() => {
  localStorage.clear();
  reiniciarConvitesPendentes();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** As duas navegações: a de cima (computador) e a barra de baixo (celular). */
async function menus() {
  const [cima, baixo] = await screen.findAllByRole('navigation', { name: 'Principal' });
  if (!cima || !baixo) throw new Error('faltou um dos menus');
  return { cima, baixo };
}

describe('cabeçalho comum', () => {
  it('tem marca, os quatro itens, "Entrar com código", notificações e perfil', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/');

    const { cima } = await menus();
    expect(
      within(cima)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Central', 'Casos', 'Personagens', 'Arquivo']);
    expect(
      screen.getAllByRole('link', { name: 'MEMBRANA, ir para a Central' })[0]?.getAttribute('href'),
    ).toBe('/');
    expect(screen.getByRole('link', { name: /Entrar com código/ }).getAttribute('href')).toBe(
      '/convite',
    );
    expect(screen.getByRole('link', { name: 'Perfil de Marta' }).getAttribute('href')).toBe(
      '/perfil',
    );
    expect(screen.getAllByRole('button', { name: 'Notificações' }).length).toBeGreaterThan(0);
  });

  it('marca o item ativo com aria-current="page", também em subpáginas', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/casos/novo');

    const { cima } = await menus();
    expect(within(cima).getByRole('link', { name: 'Casos' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(
      within(cima).getByRole('link', { name: 'Central' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('a barra do celular tem Central, Casos, Personagens, Arquivo e Perfil', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/perfil');

    const { baixo } = await menus();
    const links = within(baixo).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Central',
      'Casos',
      'Personagens',
      'Arquivo',
      'Perfil',
    ]);
    expect(within(baixo).getByRole('link', { name: 'Perfil' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('navega pelo menu sem recarregar e chega na página', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/');

    const { cima } = await menus();
    fireEvent.click(within(cima).getByRole('link', { name: 'Arquivo' }));

    expect(await screen.findByRole('heading', { name: 'Arquivo', level: 1 })).toBeDefined();
    expect(endereco()).toBe('/arquivo');
  });

  it('tem o atalho "Pular para o conteúdo"', async () => {
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/');
    const pular = await screen.findByRole('link', { name: 'Pular para o conteúdo' });
    expect(pular.getAttribute('href')).toBe('#conteudo');
    expect(document.getElementById('conteudo')?.tagName).toBe('MAIN');
  });
});

describe('contexto da URL', () => {
  it('/campanhas/:id/escudo mostra o caso no cabeçalho e links só com o caso', async () => {
    servidor({
      'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe({ papel: 'mestre' }) }),
      'GET /api/campanhas/cmp_1/escudo': json(200, {
        campanha: { id: 'cmp_1', nome: 'O Sinal de Santa Ermida' },
        mapa: null,
        salas: [],
        pois: [],
      }),
    });
    abrir('/campanhas/cmp_1/escudo');

    expect(await screen.findByText('você mestra')).toBeDefined();
    expect(
      await screen.findByRole('heading', { name: 'Escudo do mestre', level: 1 }),
    ).toBeDefined();
    expect(screen.getAllByText('O Sinal de Santa Ermida').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Abrir mesa' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/mesa',
    );
  });

  it('/campanhas/:id/ficha diz com quem a pessoa joga, lido do caso', async () => {
    servidor({
      'GET /api/campanhas/cmp_1': json(200, {
        campanha: detalhe({ meuPersonagem: { id: 'chr_9', nome: 'Davi Rocha' } }),
      }),
    });
    abrir('/campanhas/cmp_1/ficha');

    expect(await screen.findByText(/Davi Rocha/)).toBeDefined();
  });

  it('sem personagem escolhido, a ficha avisa', async () => {
    servidor({ 'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe() }) });
    abrir('/campanhas/cmp_1/ficha');

    expect(await screen.findByText(/Você ainda não escolheu um personagem/)).toBeDefined();
  });
});

describe('notificações', () => {
  it('com convite guardado, o sino diz quantos e leva aos convites', async () => {
    localStorage.setItem('membrana.convites-pendentes.v1', JSON.stringify(['ERMIDA-3H33']));
    servidor({ 'GET /api/campanhas': json(200, { campanhas: [] }) });
    abrir('/arquivo');

    const [sino] = await screen.findAllByRole('button', { name: 'Notificações, 1 nova' });
    fireEvent.click(sino as HTMLElement);
    const janela = await screen.findByRole('dialog', { name: 'Notificações' });
    fireEvent.click(within(janela).getByRole('link', { name: 'Ver convites' }));

    await waitFor(() => {
      expect(endereco()).toBe('/');
    });
  });
});
