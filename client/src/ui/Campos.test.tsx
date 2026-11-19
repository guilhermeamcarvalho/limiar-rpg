import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Die, Field, Input, ResourceBar, Segmented, Switch, Tabs } from './index.ts';

afterEach(cleanup);

describe('Field', () => {
  it('liga rótulo, dica e erro ao campo', () => {
    render(
      <Field label="Nome do caso" help="Até 60 caracteres." error="Dê um nome ao caso.">
        <Input />
      </Field>,
    );
    const campo = screen.getByRole('textbox', { name: 'Nome do caso' });

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const descricao = (campo.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    // Com erro, a dica sai de cena: só o erro descreve o campo.
    expect(descricao).toEqual(['Dê um nome ao caso.']);
  });

  it('sem erro, a dica descreve o campo e ele não é inválido', () => {
    render(
      <Field label="Nome" help="Até 60 caracteres.">
        <Input />
      </Field>,
    );
    const campo = screen.getByRole('textbox', { name: 'Nome' });

    expect(campo.getAttribute('aria-invalid')).toBeNull();
    expect(document.getElementById(campo.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Até 60 caracteres.',
    );
  });
});

function AbasDeTeste() {
  const [aba, setAba] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabs
      idBase="t"
      label="Abas"
      value={aba}
      onChange={setAba}
      items={[
        { id: 'a', label: 'Pistas' },
        { id: 'b', label: 'Inventário' },
        { id: 'c', label: 'Chat' },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('troca de aba com as setas, Home e End, levando o foco junto', () => {
    render(<AbasDeTeste />);
    const pistas = screen.getByRole('tab', { name: 'Pistas' });
    pistas.focus();

    fireEvent.keyDown(pistas, { key: 'ArrowLeft' });
    const chat = screen.getByRole('tab', { name: 'Chat' });
    expect(chat.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(chat);

    fireEvent.keyDown(chat, { key: 'Home' });
    expect(document.activeElement).toBe(pistas);
    expect(pistas.getAttribute('tabindex')).toBe('0');
    expect(chat.getAttribute('tabindex')).toBe('-1');
  });
});

describe('Segmented e Switch', () => {
  it('Segmented marca a opção com aria-pressed', () => {
    function Seg() {
      const [v, setV] = useState<'v' | 'f'>('v');
      return (
        <Segmented
          label="Dados"
          value={v}
          onChange={setV}
          options={[
            { value: 'v', label: 'Virtuais' },
            { value: 'f', label: 'Físicos' },
          ]}
        />
      );
    }
    render(<Seg />);

    fireEvent.click(screen.getByRole('button', { name: 'Físicos' }));

    expect(screen.getByRole('button', { name: 'Físicos' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Virtuais' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('Switch é um botão role="switch" com aria-checked', () => {
    function Sw() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onChange={setOn} label="Uma ação por rodada" />;
    }
    render(<Sw />);
    const chave = screen.getByRole('switch', { name: 'Uma ação por rodada' });

    fireEvent.click(chave);

    expect(chave.getAttribute('aria-checked')).toBe('true');
  });
});

describe('ResourceBar', () => {
  it('até 20 desenha caixas; acima disso vira medidor contínuo', () => {
    const { container, rerender } = render(<ResourceBar kind="pv" value={9} max={12} />);
    expect(container.querySelectorAll('.boxes i')).toHaveLength(12);
    expect(container.querySelectorAll('.boxes i.o')).toHaveLength(3);

    rerender(<ResourceBar kind="pv" value={31} max={40} />);
    expect(container.querySelector('.boxes')).toBeNull();
    const medidor = screen.getByRole('meter', { name: 'PV' });
    expect(medidor.getAttribute('aria-valuenow')).toBe('31');
    expect(medidor.getAttribute('aria-valuemax')).toBe('40');
  });
});

describe('Die', () => {
  it('diz tipo, papel, valor e se foi descartado', () => {
    render(<Die type="d10" value={9} role="pericia" discarded />);

    expect(screen.getByRole('img', { name: 'd10 de perícia: 9, descartado' })).toBeDefined();
  });
});
