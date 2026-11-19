import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button, Icon, NOMES_DOS_ICONES } from './index.ts';

afterEach(cleanup);

describe('Icon', () => {
  it('é decorativo por padrão: o leitor de tela o ignora', () => {
    const { container } = render(<Icon name="dice" />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
  });

  it('com `label`, vira imagem com nome', () => {
    render(<Icon name="lock" label="Só o mestre vê" />);

    expect(screen.getByRole('img', { name: 'Só o mestre vê' })).toBeDefined();
  });

  it('herda a cor do texto: traço em currentColor e nenhum desenho com cor própria', () => {
    for (const nome of NOMES_DOS_ICONES) {
      const { container, unmount } = render(<Icon name={nome} />);
      const svg = container.querySelector('svg');

      expect(svg?.getAttribute('stroke'), nome).toBe('currentColor');
      expect(svg?.getAttribute('fill'), nome).toBe('none');
      expect(svg?.children.length, nome).toBeGreaterThan(0);
      for (const forma of svg?.children ?? []) {
        expect(forma.getAttribute('stroke'), nome).toBeNull();
        expect(forma.getAttribute('fill'), nome).toBeNull();
      }
      unmount();
    }
  });

  it('traz todos os ícones do canvas', () => {
    expect(NOMES_DOS_ICONES).toHaveLength(62);
    for (const nome of ['home', 'folder', 'users', 'map', 'book', 'eye', 'dice', 'clue', 'hand'])
      expect(NOMES_DOS_ICONES).toContain(nome);
    for (const nome of ['ruler', 'pin', 'fog', 'door', 'shield'])
      expect(NOMES_DOS_ICONES).toContain(nome);
  });

  it('botão só com ícone é anunciado pelo aria-label, não pelo desenho', () => {
    render(<Button icon={<Icon name="gear" />} aria-label="Configurações" />);

    expect(screen.getByRole('button').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeDefined();
  });
});
