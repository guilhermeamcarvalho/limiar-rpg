import { defineConfig } from 'vitest/config';

// Um projeto por pacote: `pnpm test` roda os três juntos e mostra o nome de cada um.
export default defineConfig({
  test: {
    // Cobertura só do shared: é onde ficam as regras do jogo e as permissões.
    coverage: {
      provider: 'v8',
      include: ['shared/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html'],
      // As regras do jogo e a ficha ficam em 100%: são o que decide uma sessão. Abaixo disso,
      // o CI reprova (pnpm test:coverage).
      thresholds: {
        'shared/src/regras/**/*.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'shared/src/schemas/ficha-op2.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
    projects: [
      {
        test: { name: 'shared', root: './shared', environment: 'node' },
      },
      {
        test: {
          name: 'server',
          root: './server',
          environment: 'node',
          // Montar o app pela primeira vez (importar Fastify e afins) passa de 5 s numa máquina lenta.
          testTimeout: 15000,
        },
      },
      {
        extends: './client/vite.config.ts',
        test: {
          name: 'client',
          root: './client',
          environment: 'jsdom',
          setupFiles: ['./src/teste/setup.ts'],
          // A primeira importação de cada página (lazy) é lenta: mais folga que os 5 s padrão.
          testTimeout: 15000,
        },
      },
    ],
  },
});
