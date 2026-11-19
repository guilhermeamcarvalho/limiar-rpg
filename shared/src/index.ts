// Código usado pelo client e pelo server: regras, schemas e permissões entram aqui.

export const NOME_DO_APP = 'LIMIAR';

/** Monta o título de uma página, como "Casos · LIMIAR". Sem página, só o nome do app. */
export function tituloDaPagina(pagina?: string): string {
  return pagina ? `${pagina} · ${NOME_DO_APP}` : NOME_DO_APP;
}

export * from './sistemas.ts';
