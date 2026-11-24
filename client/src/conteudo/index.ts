// O conteúdo do Arquivo (RF-80): um arquivo Markdown por seção, nesta pasta. Para editar, mude o
// .md; para criar uma seção, crie outro .md. O build junta tudo.
//
// Formato de cada arquivo:
//
//   # Título da seção
//
//   icone: key            um nome de ui/icones.tsx
//   ordem: 4              posição no menu
//
//   Texto de abertura (opcional).
//
//   ## Título da entrada
//
//   categoria: Luz        vira um filtro da seção
//   resumo: 1 espaço · ilumina 2 salas
//   selo: Comum           opcional; "Raro" e "Provisória" ficam dourados
//   etiquetas: 1 espaço; Percepção sem penalidade
//
//   Corpo em parágrafos, listas ("- ") e tabelas ("| a | b |"), com **negrito**.
//
// As linhas "chave: valor" vêm logo depois do título, antes do texto.
import { lerSecao, textoDaEntrada, type Entrada, type Secao } from './markdown.ts';

export type { Bloco, Entrada, Secao } from './markdown.ts';

const fontes = import.meta.glob<string>('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const SECOES: readonly Secao[] = Object.entries(fontes)
  .map(([caminho, fonte]) => lerSecao(caminho.replace(/^\.\/|\.md$/g, ''), fonte))
  .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));

/** O texto de busca de cada entrada, calculado uma vez. */
export const TEXTO_DE_BUSCA: ReadonlyMap<Entrada, string> = new Map(
  SECOES.flatMap((s) => s.entradas.map((e) => [e, textoDaEntrada(e)] as const)),
);
