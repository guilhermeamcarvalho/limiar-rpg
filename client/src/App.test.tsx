import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App.tsx';

afterEach(cleanup);

describe('App', () => {
  it('mostra o nome do app e ajusta o título da aba', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'LIMIAR' })).toBeDefined();
    expect(document.title).toBe('Central · LIMIAR');
  });
});
