// Atributos e perícias de Ordem Paranormal II: a lista única, usada pela ficha, pelas regras e
// pelo config do sistema (sistemas.ts). Referência: docs/regras-do-jogo.md, "Atributos e perícias".

export const ATRIBUTOS_OP2 = [
  { id: 'fisico', nome: 'Físico', sigla: 'FÍS' },
  { id: 'mente', nome: 'Mente', sigla: 'MEN' },
  { id: 'emocao', nome: 'Emoção', sigla: 'EMO' },
] as const;

export type AtributoOp2 = (typeof ATRIBUTOS_OP2)[number]['id'];
export const IDS_DOS_ATRIBUTOS_OP2 = ATRIBUTOS_OP2.map((a) => a.id) as [
  AtributoOp2,
  ...AtributoOp2[],
];

/** As 20 perícias, agrupadas pelo atributo. O id é o nome sem acento, em minúsculas. */
export const PERICIAS_OP2 = [
  { id: 'acrobacia', nome: 'Acrobacia', atributo: 'fisico' },
  { id: 'atletismo', nome: 'Atletismo', atributo: 'fisico' },
  { id: 'crime', nome: 'Crime', atributo: 'fisico' },
  { id: 'furtividade', nome: 'Furtividade', atributo: 'fisico' },
  { id: 'luta', nome: 'Luta', atributo: 'fisico' },
  { id: 'pontaria', nome: 'Pontaria', atributo: 'fisico' },
  { id: 'vigor', nome: 'Vigor', atributo: 'fisico' },
  { id: 'aptidao', nome: 'Aptidão', atributo: 'mente' },
  { id: 'maquinas', nome: 'Máquinas', atributo: 'mente' },
  { id: 'medicina', nome: 'Medicina', atributo: 'mente' },
  { id: 'ocultismo', nome: 'Ocultismo', atributo: 'mente' },
  { id: 'percepcao', nome: 'Percepção', atributo: 'mente' },
  { id: 'pesquisa', nome: 'Pesquisa', atributo: 'mente' },
  { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'mente' },
  { id: 'tecnologia', nome: 'Tecnologia', atributo: 'mente' },
  { id: 'disciplina', nome: 'Disciplina', atributo: 'emocao' },
  { id: 'enganacao', nome: 'Enganação', atributo: 'emocao' },
  { id: 'intimidacao', nome: 'Intimidação', atributo: 'emocao' },
  { id: 'intuicao', nome: 'Intuição', atributo: 'emocao' },
  { id: 'persuasao', nome: 'Persuasão', atributo: 'emocao' },
] as const satisfies readonly { id: string; nome: string; atributo: AtributoOp2 }[];

export type PericiaOp2 = (typeof PERICIAS_OP2)[number]['id'];
export const IDS_DAS_PERICIAS_OP2 = PERICIAS_OP2.map((p) => p.id) as [PericiaOp2, ...PericiaOp2[]];

/** O atributo de uma perícia: Máquinas → Mente. */
export function atributoDaPericia(pericia: PericiaOp2): AtributoOp2 {
  const achada = PERICIAS_OP2.find((p) => p.id === pericia);
  if (!achada) throw new Error(`Perícia desconhecida: ${pericia}`);
  return achada.atributo;
}

export function nomeDaPericia(pericia: PericiaOp2): string {
  return PERICIAS_OP2.find((p) => p.id === pericia)?.nome ?? pericia;
}

export function nomeDoAtributo(atributo: AtributoOp2): string {
  return ATRIBUTOS_OP2.find((a) => a.id === atributo)?.nome ?? atributo;
}
