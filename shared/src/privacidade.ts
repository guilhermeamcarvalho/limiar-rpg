// O que pode sair do app para serviços de fora (Sentry): nada que identifique alguém.

/** Tira da URL o que identifica alguém: a query, o fragmento e os códigos de convite. */
export function anonimizarUrl(url: string): string {
  const semQuery = url.split(/[?#]/)[0] ?? '';
  return semQuery
    .replace(/\/c\/[^/]+/g, '/c/:codigo')
    .replace(/\/convites\/[^/]+/g, '/convites/:codigo');
}
