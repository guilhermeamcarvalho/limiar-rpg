import { describe, expect, it } from 'vitest';
import {
  OCUPACOES_OP2,
  PERFIS_INFO_OP2,
  PERICIAS_OP2,
  TABELA_FALHA_CRITICA,
} from '@membrana/shared';
import { NOMES_DOS_ICONES } from '../ui/index.ts';
import { SECOES, TEXTO_DE_BUSCA } from './index.ts';
import { combina, lerSecao, normalizar, slug } from './markdown.ts';

const secao = (id: string) => {
  const s = SECOES.find((x) => x.id === id);
  if (!s) throw new Error(`sem a seção ${id}`);
  return s;
};
const titulos = (id: string) => secao(id).entradas.map((e) => e.titulo);

describe('leitor de Markdown', () => {
  const fonte = `<!-- comentário -->
# Itens

icone: key
ordem: 4

Abertura com **negrito**.

## Lanterna tática

categoria: Luz
resumo: 1 espaço
selo: Comum
etiquetas: 1 espaço; Percepção sem penalidade

Primeiro parágrafo
continua aqui.

- um
- dois

| d8 | Resultado |
| --- | --- |
| 1 | Vexame |

## Corda
`;

  it('lê título, metadados, parágrafos, listas e tabelas', () => {
    const s = lerSecao('itens', fonte);
    expect(s).toMatchObject({ id: 'itens', titulo: 'Itens', icone: 'key', ordem: 4 });
    expect(s.intro).toEqual([{ tipo: 'p', texto: 'Abertura com **negrito**.' }]);
    expect(s.entradas[0]).toEqual({
      id: 'itens/lanterna-tatica',
      titulo: 'Lanterna tática',
      categoria: 'Luz',
      resumo: '1 espaço',
      selo: 'Comum',
      etiquetas: ['1 espaço', 'Percepção sem penalidade'],
      blocos: [
        { tipo: 'p', texto: 'Primeiro parágrafo continua aqui.' },
        { tipo: 'lista', itens: ['um', 'dois'] },
        { tipo: 'tabela', cabecalho: ['d8', 'Resultado'], linhas: [['1', 'Vexame']] },
      ],
    });
    expect(s.entradas[1]).toMatchObject({ titulo: 'Corda', categoria: '', selo: null });
  });

  it('recusa arquivo sem título e entrada repetida', () => {
    expect(() => lerSecao('x', 'texto solto')).toThrow(/falta o título/);
    expect(() => lerSecao('x', '# X\n\n## A\n\n## A\n')).toThrow(/duas vezes/);
  });

  it('a busca ignora acento e maiúscula e pede todas as palavras', () => {
    expect(slug('Perícia de Ação!')).toBe('pericia-de-acao');
    expect(normalizar('PERCEPÇÃO')).toBe('percepcao');
    expect(combina('lanterna tatica luz', 'Tática  LANTERNA')).toBe(true);
    expect(combina('lanterna tatica luz', 'lanterna uv')).toBe(false);
    expect(combina('qualquer coisa', '   ')).toBe(true);
  });
});

describe('conteúdo do Arquivo', () => {
  it('tem as sete seções, em ordem, com ícones que existem', () => {
    expect(SECOES.map((s) => s.titulo)).toEqual([
      'Testes e dados',
      'Perfis e habilidades',
      'As 20 perícias',
      'Itens',
      'Ameaças',
      'Falha crítica',
      'Regras da casa',
    ]);
    for (const s of SECOES) {
      expect(NOMES_DOS_ICONES).toContain(s.icone);
      expect(s.entradas.length).toBeGreaterThan(0);
      for (const e of s.entradas) expect(e.blocos.length, e.id).toBeGreaterThan(0);
    }
  });

  it('as perícias, os perfis, as ocupações e a falha crítica batem com as regras do shared', () => {
    expect(titulos('pericias')).toEqual(PERICIAS_OP2.map((p) => p.nome));
    expect(titulos('perfis-e-habilidades')).toEqual([
      ...PERFIS_INFO_OP2.map((p) => p.nome),
      ...OCUPACOES_OP2.map((o) => o.nome),
    ]);
    expect(titulos('falha-critica')).toEqual(TABELA_FALHA_CRITICA.map((l) => l.nome));
  });

  it('buscar "lanterna" acha os 3 itens', () => {
    const achados = [...TEXTO_DE_BUSCA]
      .filter(([, t]) => combina(t, 'lanterna'))
      .map(([e]) => e.id);
    expect(achados).toEqual([
      'itens/lanterna-tatica',
      'itens/lanterna-de-cabeca',
      'itens/lanterna-uv',
    ]);
  });
});
