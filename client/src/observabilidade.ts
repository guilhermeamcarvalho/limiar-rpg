// Erros do navegador no Sentry (plano gratuito). O DSN e a versão entram no build
// (VITE_SENTRY_DSN e VITE_LIMIAR_VERSAO, ver deploy/deploy.sh); sem DSN, nada é enviado,
// como no `pnpm dev` e nos testes. Nunca vão dados pessoais: nem usuário, nem cookie,
// nem o que a pessoa digitou, nem o código de convite da URL.
import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { anonimizarUrl } from '@limiar/shared';

/** Rastros que podem carregar o que a pessoa escreveu: ficam de fora. */
const RASTROS_DESCARTADOS = new Set(['console', 'ui.input']);

export function limparRastro(rastro: Breadcrumb): Breadcrumb | null {
  if (rastro.category && RASTROS_DESCARTADOS.has(rastro.category)) return null;
  const data = rastro.data as Record<string, unknown> | undefined;
  if (!data) return rastro;
  const limpos: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(data)) {
    // Navegação e requisições: só a URL anonimizada, o método e o status.
    if (['url', 'from', 'to'].includes(chave) && typeof valor === 'string') {
      limpos[chave] = anonimizarUrl(valor);
    } else if (['method', 'status_code'].includes(chave)) {
      limpos[chave] = valor;
    }
  }
  return { ...rastro, data: limpos };
}

export function limparEvento<E extends ErrorEvent>(evento: E): E {
  delete evento.user;
  if (evento.request) {
    evento.request = {
      ...(evento.request.url && { url: anonimizarUrl(evento.request.url) }),
    };
  }
  if (evento.breadcrumbs) {
    evento.breadcrumbs = evento.breadcrumbs
      .map(limparRastro)
      .filter((r): r is Breadcrumb => r !== null);
  }
  return evento;
}

export function iniciarObservabilidade(
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN,
  versao: string = import.meta.env.VITE_LIMIAR_VERSAO ?? 'dev',
) {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    release: `limiar@${versao}`,
    environment: import.meta.env.MODE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Só erros: sem desempenho e sem gravação de tela.
    tracesSampleRate: 0,
    beforeSend: limparEvento,
    beforeBreadcrumb: limparRastro,
  });
  // Para conferir a instalação: abrir qualquer página com ?testar-sentry=1 manda um erro de teste.
  if (new URLSearchParams(window.location.search).has('testar-sentry')) {
    Sentry.captureException(new Error(`Teste do Sentry (navegador), versão ${versao}`));
  }
  return true;
}

export const BarreiraDeErro = Sentry.ErrorBoundary;
