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

/** "Mecânico · nível 2 · 34 anos · Santa Ermida": a linha abaixo do nome, na ficha. */
export function linhaDaFicha(
  ficha: Pick<FichaOp2, 'ocupacao' | 'nivel' | 'idade' | 'origem'>,
): string {
  return [
    ficha.ocupacao.trim(),
    `nível ${String(ficha.nivel)}`,
    ficha.idade === null ? '' : `${String(ficha.idade)} anos`,
    ficha.origem.trim(),
  ]
    .filter(Boolean)
    .join(' · ');
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** "Salva agora", "Salva há 2 min", "Salva há 3 h", "Salva em 12/11". */
export function textoDeSalva(salvaEm: number, agora: number): string {
  const passou = Math.max(0, agora - salvaEm);
  if (passou < MINUTO) return 'Salva agora';
  if (passou < HORA) return `Salva há ${String(Math.floor(passou / MINUTO))} min`;
  if (passou < 24 * HORA) return `Salva há ${String(Math.floor(passou / HORA))} h`;
  const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  return `Salva em ${data.format(new Date(salvaEm))}`;
}

const comCaso = (caminho: string, caso?: string | null) =>
  caso ? `${caminho}?${new URLSearchParams({ caso }).toString()}` : caminho;

/** A criação guiada, já para um caso se houver. */
export const linkDeCriar = (caso?: string | null) => comCaso('/personagens/novo', caso);

/** A ficha em branco, já para um caso se houver. */
export const linkDaFichaEmBranco = (caso?: string | null) =>
  comCaso('/personagens/novo/ficha', caso);

export const linkDaFicha = (id: string) => `/personagens/${encodeURIComponent(id)}/ficha`;
