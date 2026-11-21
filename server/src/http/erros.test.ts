import { afterEach, describe, expect, it, vi } from 'vitest';
import { appDeTeste } from '../teste/apoio.ts';
import { ErroDaApi } from './erros.ts';

const registrarErro = vi.hoisted(() => vi.fn());
vi.mock('../observabilidade.ts', () => ({ registrarErro }));

afterEach(() => {
  registrarErro.mockClear();
});

describe('tratador de erros', () => {
  it('erro inesperado vira 500 genérico e vai para o Sentry com a rota', async () => {
    const app = await appDeTeste({ discord: null });
    app.get('/api/explode', () => {
      throw new Error('banco sumiu');
    });

    const r = await app.inject({ method: 'GET', url: '/api/explode?email=marta@exemplo.com' });
    await app.close();

    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
    });
    expect(registrarErro).toHaveBeenCalledTimes(1);
    expect(registrarErro).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'banco sumiu' }),
      {
        metodo: 'GET',
        url: '/api/explode?email=marta@exemplo.com',
      },
    );
  });

  it('erro esperado (4xx) não vai para o Sentry', async () => {
    const app = await appDeTeste({ discord: null });
    app.get('/api/recusa', () => {
      throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre.');
    });

    const r = await app.inject({ method: 'GET', url: '/api/recusa' });
    await app.close();

    expect(r.statusCode).toBe(403);
    expect(registrarErro).not.toHaveBeenCalled();
  });
});
