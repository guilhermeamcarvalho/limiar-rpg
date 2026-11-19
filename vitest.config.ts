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
    },
    projects: [
      {
        test: { name: 'shared', root: './shared', environment: 'node' },
      },
      {
        test: { name: 'server', root: './server', environment: 'node' },
      },
      {
        extends: './client/vite.config.ts',
        test: { name: 'client', root: './client', environment: 'jsdom' },
      },
    ],
  },
});
