// Lê as seções do Arquivo, escritas em Markdown simples. É um leitor pequeno de propósito: só o
// que o conteúdo usa (parágrafos, listas, tabelas e **negrito**), sem biblioteca. O formato está
// descrito em index.ts.
import type { NomeDoIcone } from '../ui/index.ts';

export type Bloco =
  | { tipo: 'p'; texto: string }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

export type TomDoSelo = 'gold' | undefined;

export interface Entrada {
  /** "itens/lanterna-tatica": único no Arquivo inteiro. */
  id: string;
  titulo: string;
  categoria: string;
  resumo: string;
  selo: string | null;
  etiquetas: string[];
  blocos: Bloco[];
}

export interface Secao {
  id: string;
  titulo: string;
  icone: NomeDoIcone;
  ordem: number;
  intro: Bloco[];
  entradas: Entrada[];
}

/** O selo dourado marca o que é raro ou provisório; o resto usa o padrão. */
export function tomDoSelo(selo: string): TomDoSelo {
  return /^(raro|provisória)$/i.test(selo) ? 'gold' : undefined;
}

/** "Lanterna tática" → "lanterna-tatica". */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const META = /^([a-z]+):\s*(.*)$/;

const celulas = (linha: string) =>
  linha
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/** Junta as linhas de um trecho em blocos. */
function blocosDe(linhas: string[]): Bloco[] {
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = (linhas[i] ?? '').trim();
    if (linha === '') {
      i++;
      continue;
    }
    if (linha.startsWith('|')) {
      const tabela: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('|')) {
        tabela.push(linhas[i] ?? '');
        i++;
      }
      const [cabecalho = '', , ...resto] = tabela;
      blocos.push({ tipo: 'tabela', cabecalho: celulas(cabecalho), linhas: resto.map(celulas) });
      continue;
    }
    if (linha.startsWith('- ')) {
      const itens: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('- ')) {
        itens.push((linhas[i] ?? '').trim().slice(2));
        i++;
      }
      blocos.push({ tipo: 'lista', itens });
      continue;
    }
    const paragrafo: string[] = [];
    while (i < linhas.length) {
      const l = (linhas[i] ?? '').trim();
      if (l === '' || l.startsWith('|') || l.startsWith('- ')) break;
      paragrafo.push(l);
      i++;
    }
    blocos.push({ tipo: 'p', texto: paragrafo.join(' ') });
  }
  return blocos;
}

/** Separa as linhas "chave: valor" logo depois de um título (até a primeira linha de texto). */
function separarMeta(linhas: string[]): { meta: Map<string, string>; corpo: string[] } {
  const meta = new Map<string, string>();
  let i = 0;
  while (i < linhas.length && (linhas[i] ?? '').trim() === '') i++;
  while (i < linhas.length) {
    const achou = META.exec((linhas[i] ?? '').trim());
    if (!achou) break;
    meta.set(achou[1] ?? '', (achou[2] ?? '').trim());
    i++;
  }
  return { meta, corpo: linhas.slice(i) };
}

/** Lê uma seção. `id` vem do nome do arquivo ("itens.md" → "itens"). */
export function lerSecao(id: string, fonte: string): Secao {
  const linhas = fonte.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const titulo = linhas.findIndex((l) => l.startsWith('# '));
  if (titulo === -1) throw new Error(`${id}.md: falta o título "# ..."`);

  // Os trechos: o que vem antes da primeira entrada e uma lista por "## ".
  const trechos: { titulo: string; linhas: string[] }[] = [];
  let atual = { titulo: (linhas[titulo] ?? '').slice(2).trim(), linhas: [] as string[] };
  for (const linha of linhas.slice(titulo + 1)) {
    if (linha.startsWith('## ')) {
      trechos.push(atual);
      atual = { titulo: linha.slice(3).trim(), linhas: [] };
    } else {
      atual.linhas.push(linha);
    }
  }
  trechos.push(atual);

  const [cabeca, ...resto] = trechos;
  if (!cabeca) throw new Error(`${id}.md: vazio`);
  const { meta, corpo } = separarMeta(cabeca.linhas);
  const vistos = new Set<string>();

  return {
    id,
    titulo: cabeca.titulo,
    icone: (meta.get('icone') ?? 'book') as NomeDoIcone,
    ordem: Number(meta.get('ordem') ?? 99),
    intro: blocosDe(corpo),
    entradas: resto.map((t) => {
      const e = separarMeta(t.linhas);
      const entradaId = `${id}/${slug(t.titulo)}`;
      if (vistos.has(entradaId)) throw new Error(`${id}.md: "${t.titulo}" aparece duas vezes`);
      vistos.add(entradaId);
      return {
        id: entradaId,
        titulo: t.titulo,
        categoria: e.meta.get('categoria') ?? '',
        resumo: e.meta.get('resumo') ?? '',
        selo: e.meta.get('selo') ?? null,
        etiquetas: (e.meta.get('etiquetas') ?? '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean),
        blocos: blocosDe(e.corpo),
      };
    }),
  };
}

/** Minúsculas e sem acento, para a busca achar "pericia" em "Perícia". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function textoDosBlocos(blocos: Bloco[]): string {
  return blocos
    .map((b) =>
      b.tipo === 'p'
        ? b.texto
        : b.tipo === 'lista'
          ? b.itens.join(' ')
          : [...b.cabecalho, ...b.linhas.flat()].join(' '),
    )
    .join(' ');
}

/** Todo o texto de uma entrada, já normalizado, para a busca. */
export function textoDaEntrada(e: Entrada): string {
  return normalizar(
    [e.titulo, e.categoria, e.resumo, e.selo ?? '', ...e.etiquetas, textoDosBlocos(e.blocos)]
      .join(' ')
      .replace(/\*\*/g, ''),
  );
}

/** A entrada tem todas as palavras da busca (em qualquer ordem). Busca vazia acha tudo. */
export function combina(textoNormalizado: string, busca: string): boolean {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  return palavras.every((p) => textoNormalizado.includes(p));
}
