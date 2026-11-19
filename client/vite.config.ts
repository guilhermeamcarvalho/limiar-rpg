import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento, as chamadas a /api vão para o servidor Fastify.
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
