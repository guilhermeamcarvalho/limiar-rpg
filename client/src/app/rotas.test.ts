import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarModulo } from './rotas.tsx';

afterEach(() => {
  sessionStorage.clear();
});

const falhaDeChunk = () =>
  Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

describe('carregarModulo (página de uma versão anterior, depois de um deploy)', () => {
  it('na primeira falha, recarrega a página uma vez e não mostra erro', async () => {
    const recarregar = vi.fn();
    const espera = carregarModulo(falhaDeChunk, recarregar);

    await vi.waitFor(() => {
      expect(recarregar).toHaveBeenCalledTimes(1);
    });
    const resultado = await Promise.race([
      espera.then(() => 'resolveu'),
      Promise.resolve('pendente'),
    ]);
    expect(resultado).toBe('pendente');
  });

  it('se falhar de novo depois de recarregar, o erro segue (sem laço de recargas)', async () => {
    sessionStorage.setItem('limiar.recarregou-por-versao', '1');
    const recarregar = vi.fn();

    await expect(carregarModulo(falhaDeChunk, recarregar)).rejects.toThrow('dynamically imported');
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('carregou: limpa a marca, para o próximo deploy poder recarregar de novo', async () => {
    sessionStorage.setItem('limiar.recarregou-por-versao', '1');
    await expect(carregarModulo(() => Promise.resolve({ ok: 1 }))).resolves.toEqual({ ok: 1 });
    expect(sessionStorage.getItem('limiar.recarregou-por-versao')).toBeNull();
  });
});
