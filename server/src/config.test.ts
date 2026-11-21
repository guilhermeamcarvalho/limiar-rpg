import { describe, expect, it } from 'vitest';
import { carregarConfig, ErroDeConfig } from './config.ts';
import { ENV_DE_TESTE } from './teste/apoio.ts';

function erroDe(env: NodeJS.ProcessEnv): string {
  try {
    carregarConfig(env);
  } catch (erro) {
    if (erro instanceof ErroDeConfig) return erro.message;
    throw erro;
  }
  throw new Error('a configuração deveria ter falhado');
}

describe('carregarConfig', () => {
  it('aceita o mínimo e preenche os padrões', () => {
    const config = carregarConfig(ENV_DE_TESTE);

    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.DATABASE_PATH.replaceAll('\\', '/')).toMatch(/data\/membrana\.db$/);
    expect(config.UPLOADS_DIR.replaceAll('\\', '/')).toMatch(/data\/uploads$/);
  });

  it('faltar variável obrigatória impede de subir, dizendo qual', () => {
    const mensagem = erroDe({ NODE_ENV: 'test' });

    expect(mensagem).toContain('o servidor não vai subir');
    expect(mensagem).toContain('SESSION_SECRET: obrigatória e não foi definida');
    expect(mensagem).toContain('BASE_URL: obrigatória e não foi definida');
  });

  it('variável vazia conta como ausente', () => {
    expect(erroDe({ ...ENV_DE_TESTE, SESSION_SECRET: '' })).toContain(
      'SESSION_SECRET: obrigatória e não foi definida',
    );
  });

  it('explica valores errados', () => {
    const mensagem = erroDe({ ...ENV_DE_TESTE, SESSION_SECRET: 'curto', PORT: 'abc' });

    expect(mensagem).toContain('SESSION_SECRET: precisa ter pelo menos 32 caracteres');
    expect(mensagem).toContain('PORT:');
  });

  it('Discord: as duas variáveis juntas ou nenhuma', () => {
    expect(() => carregarConfig(ENV_DE_TESTE)).not.toThrow();
    expect(() =>
      carregarConfig({ ...ENV_DE_TESTE, DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 'x' }),
    ).not.toThrow();
    expect(erroDe({ ...ENV_DE_TESTE, DISCORD_CLIENT_ID: '123' })).toContain('vão juntas');
  });
});
