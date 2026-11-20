import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErroDaApi } from '../auth/api.ts';
import { Async, useCarga } from './Async.tsx';
import { Button } from './Button.tsx';
import { useEnvio } from './useEnvio.ts';

afterEach(cleanup);

/** Promessa que o teste resolve ou rejeita quando quiser. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

function Bloco({ buscar, chave = 'x' }: { buscar: () => Promise<string[]>; chave?: string }) {
  const uso = useCarga(chave, buscar);
  return (
    <Async
      uso={uso}
      falha="A agenda não carregou."
      esqueleto={<p>esqueleto</p>}
      vazio={{ se: (l) => l.length === 0, mostrar: <p>Nada marcado.</p> }}
    >
      {(lista) => <p>{lista.join(', ')}</p>}
    </Async>
  );
}

describe('Async', () => {
  it('mostra o esqueleto (marcado como ocupado) e depois o conteúdo', async () => {
    const pedido = adiada<string[]>();
    render(<Bloco buscar={() => pedido.promessa} />);

    expect(screen.getByText('esqueleto').closest('[aria-busy="true"]')).not.toBeNull();
    await act(async () => {
      pedido.resolver(['sexta', 'sábado']);
      await pedido.promessa;
    });

    expect(screen.getByText('sexta, sábado')).toBeDefined();
    expect(screen.queryByText('esqueleto')).toBeNull();
  });

  it('mostra o estado vazio', async () => {
    render(<Bloco buscar={() => Promise.resolve([])} />);
    expect(await screen.findByText('Nada marcado.')).toBeDefined();
  });

  it('erro de rede mostra o bloco de erro; "tentar de novo" refaz só esta busca', async () => {
    let chamadas = 0;
    const buscar = () => {
      chamadas++;
      return chamadas === 1
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(['sexta']);
    };
    render(<Bloco buscar={buscar} />);

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('A agenda não carregou.');
    expect(alerta.textContent).toContain('O resto da página funciona.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('sexta')).toBeDefined();
    expect(chamadas).toBe(2);
  });

  it('404 mostra o que o servidor disse, sem "tentar de novo" (não adiantaria)', async () => {
    render(
      <Bloco
        buscar={() =>
          Promise.reject(new ErroDaApi(404, 'CASO_NAO_ENCONTRADO', 'Não encontramos este caso.'))
        }
      />,
    );

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('Não encontramos este caso.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('descarta a resposta antiga quando a chave muda', async () => {
    const antiga = adiada<string[]>();
    const { rerender } = render(<Bloco chave="a" buscar={() => antiga.promessa} />);
    rerender(<Bloco chave="b" buscar={() => Promise.resolve(['nova'])} />);

    expect(await screen.findByText('nova')).toBeDefined();
    await act(async () => {
      antiga.resolver(['antiga']);
      await antiga.promessa;
    });
    expect(screen.queryByText('antiga')).toBeNull();
  });
});

describe('useEnvio', () => {
  it('dois cliques seguidos enviam uma vez só', async () => {
    const pedido = adiada<undefined>();
    let envios = 0;
    function Formulario() {
      const envio = useEnvio(async () => {
        envios++;
        await pedido.promessa;
      });
      return (
        <Button loading={envio.enviando} onClick={() => void envio.enviar()}>
          Abrir o caso
        </Button>
      );
    }
    render(<Formulario />);
    const botao = screen.getByRole('button', { name: 'Abrir o caso' });

    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      pedido.resolver(undefined);
      await pedido.promessa;
    });

    expect(envios).toBe(1);
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });
});
