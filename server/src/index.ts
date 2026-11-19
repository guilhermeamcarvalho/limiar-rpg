// O Node 26 roda este arquivo direto: os tipos são removidos na carga, sem etapa de build.
import { criarApp } from './app.ts';

const app = criarApp({ logger: true });

const porta = Number(process.env['PORT'] ?? 3000);
await app.listen({ port: porta, host: '127.0.0.1' });
