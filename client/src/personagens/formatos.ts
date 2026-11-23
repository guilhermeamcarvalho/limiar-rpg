// Como os personagens aparecem nas telas: cores do perfil, textos e links.
import type { FichaOp2, PerfilOp2 } from '@membrana/shared';

/** A cor de cada perfil: no anel do avatar e na etiqueta. */
export const TOM_DO_PERFIL = {
  executor: 'red',
  analista: 'blue',
  vigilante: 'green',
} as const satisfies Record<PerfilOp2, 'red' | 'blue' | 'green'>;

export const NOME_DO_PERFIL: Record<PerfilOp2, string> = {
  executor: 'Executor',
  analista: 'Analista',
  vigilante: 'Vigilante',
};

/** "Davi Rocha" → "Davi". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** "Davi Rocha · Mecânico · nível 2". */
export function descricaoDaFicha(ficha: Pick<FichaOp2, 'nome' | 'ocupacao' | 'nivel'>): string {
  return [ficha.nome.trim(), ficha.ocupacao.trim(), `nível ${String(ficha.nivel)}`]
    .filter(Boolean)
    .join(' · ');
}

const comCaso = (caminho: string, caso?: string | null) =>
  caso ? `${caminho}?${new URLSearchParams({ caso }).toString()}` : caminho;

/** A criação guiada, já para um caso se houver. */
export const linkDeCriar = (caso?: string | null) => comCaso('/personagens/novo', caso);

/** A ficha em branco, já para um caso se houver. */
export const linkDaFichaEmBranco = (caso?: string | null) =>
  comCaso('/personagens/novo/ficha', caso);

export const linkDaFicha = (id: string) => `/personagens/${encodeURIComponent(id)}/ficha`;
