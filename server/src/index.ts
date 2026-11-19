// O Node 26 roda este arquivo direto: os tipos são removidos na carga, sem etapa de build.
import { criarApp } from './app.ts';
import { carregarConfig, ErroDeConfig } from './config.ts';
import { abrirBanco } from './db/index.ts';

let config;
try {
  config = carregarConfig();
} catch (erro) {
  if (!(erro instanceof ErroDeConfig)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db, sqlite } = abrirBanco(config.DATABASE_PATH);
const app = await criarApp({ config, db });

// systemd manda SIGTERM ao parar ou reiniciar: termina as requisições e fecha o banco direito.
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => {
    app.log.info(`${sinal} recebido, encerrando`);
    void app.close().finally(() => {
      sqlite.close();
    });
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
