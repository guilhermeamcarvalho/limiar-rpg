// Erros do servidor no Sentry (plano gratuito). Sem SENTRY_DSN, tudo aqui vira nada: o dev e os
// testes não mandam nada para fora. Nunca vão dados pessoais: nem usuário, nem cookie, nem corpo
// do pedido, nem o código de convite que aparece na URL.
import * as Sentry from '@sentry/node';
import type { Breadcrumb, ErrorEvent } from '@sentry/node';
import { anonimizarUrl } from '@membrana/shared';

let ligado = false;

/** Só estes cabeçalhos ajudam a depurar sem dizer quem é a pessoa. */
const CABECALHOS_PERMITIDOS = new Set(['user-agent', 'content-type', 'accept', 'content-length']);

/** Limpa o evento antes de sair do servidor. Exportado para os testes. */
export function limparEvento<E extends ErrorEvent>(evento: E): E {
  delete evento.user;
  delete evento.server_name; // nome da máquina: não ajuda e expõe o servidor
  if (evento.request) {
    const { request } = evento;
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    delete request.env;
    if (request.url) request.url = anonimizarUrl(request.url);
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([nome]) =>
          CABECALHOS_PERMITIDOS.has(nome.toLowerCase()),
        ),
      );
    }
  }
  if (evento.breadcrumbs) evento.breadcrumbs = evento.breadcrumbs.map(limparRastro);
  return evento;
}

/** Rastro (breadcrumb) de requisição: fica só o método, a URL anonimizada e o status. */
export function limparRastro(rastro: Breadcrumb): Breadcrumb {
  if (!rastro.data) return rastro;
  const { url, method, status_code: status } = rastro.data as Record<string, unknown>;
  return {
    ...rastro,
    data: {
      ...(typeof url === 'string' && { url: anonimizarUrl(url) }),
      ...(method !== undefined && { method }),
      ...(status !== undefined && { status_code: status }),
    },
  };
}

export interface OpcoesDeObservabilidade {
  /** Sem DSN, nada é enviado. */
  dsn: string | undefined;
  /** Vai como `release`: o erro no Sentry diz em que versão aconteceu. */
  versao: string;
  ambiente: string;
}

/** Liga o Sentry, se houver DSN. Devolve se ligou. Chame uma vez, antes de subir o app. */
export function iniciarObservabilidade({ dsn, versao, ambiente }: OpcoesDeObservabilidade) {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    release: `membrana@${versao}`,
    environment: ambiente,
    // O padrão do SDK coleta usuário, cookies, cabeçalhos, corpos e query. Aqui, nada disso;
    // o `limparEvento` ainda passa por cima de cada evento, por garantia.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: [...CABECALHOS_PERMITIDOS] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
    },
    includeServerName: false,
    // Só erros; desempenho fica de fora para caber no plano gratuito.
    tracesSampleRate: 0,
    beforeSend: limparEvento,
    beforeBreadcrumb: limparRastro,
  });
  ligado = true;
  return true;
}

/** Manda um erro inesperado, com a rota (já anonimizada) como etiqueta. */
export function registrarErro(erro: unknown, contexto: { metodo?: string; url?: string } = {}) {
  if (!ligado) return;
  Sentry.withScope((escopo) => {
    if (contexto.metodo) escopo.setTag('metodo', contexto.metodo);
    if (contexto.url) escopo.setTag('rota', anonimizarUrl(contexto.url));
    Sentry.captureException(erro);
  });
}

/** Espera os envios pendentes (até 2 s) antes de o processo terminar. */
export async function encerrarObservabilidade() {
  if (ligado) await Sentry.close(2000);
}
