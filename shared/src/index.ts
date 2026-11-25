// Código usado pelo client e pelo server: regras, schemas e permissões entram aqui.

export const NOME_DO_APP = 'MEMBRANA';

/** Monta o título de uma página, como "Casos · MEMBRANA". Sem página, só o nome do app. */
export function tituloDaPagina(pagina?: string): string {
  return pagina ? `${pagina} · ${NOME_DO_APP}` : NOME_DO_APP;
}

export * from './sistemas.ts';
export * from './senha.ts';
export * from './conta.ts';
export * from './permissoes.ts';
export * from './schemas/campanha.ts';
export * from './schemas/convite.ts';
export * from './codigo.ts';
export * from './agenda.ts';
export * from './privacidade.ts';
export * from './schemas/ficha-op2.ts';
export * from './schemas/personagem.ts';
export * from './schemas/teste-op2.ts';
export * from './regras/dados.ts';
export * from './regras/op2/index.ts';
export * from './schemas/mesa.ts';
export * from './mesa/breu.ts';
export * from './mesa/prontos.ts';
