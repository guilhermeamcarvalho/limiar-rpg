// `pnpm --filter @limiar/server sentry:teste`: manda um erro forçado ao Sentry e diz o id do evento.
// Serve para conferir o DSN e a versão (release) depois de configurar o servidor (#29).
// Em produção, veja docs/servidor.md, seção "Sentry".
import * as Sentry from '@sentry/node';
import { versaoDoApp } from '../app.ts';
import { carregarConfig, ErroDeConfig } from '../config.ts';
import { encerrarObservabilidade, iniciarObservabilidade } from '../observabilidade.ts';

let config;
try {
  config = carregarConfig();
} catch (erro) {
  if (!(erro instanceof ErroDeConfig)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const versao = versaoDoApp(config);
if (!iniciarObservabilidade({ dsn: config.SENTRY_DSN, versao, ambiente: config.NODE_ENV })) {
  console.error('SENTRY_DSN não está definida: nada foi enviado.');
  process.exit(1);
}

const id = Sentry.captureException(
  new Error(`Teste do Sentry: erro forçado em ${new Date().toISOString()}`),
);
await encerrarObservabilidade();
console.log(
  `Erro de teste enviado. Evento ${id}, versão limiar@${versao}, ambiente ${config.NODE_ENV}.`,
);
