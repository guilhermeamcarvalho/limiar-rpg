// Constantes oficiais de Ordem 2: condições, escala de DT, áreas de Aptidão e pesos de carga.

export interface CondicaoOp2 {
  id: string;
  nome: string;
  resumo: string;
}

export const CONDICOES_OP2: readonly CondicaoOp2[] = [
  {
    id: 'abalado',
    nome: 'Abalado',
    resumo: '−1 passo em testes (vira Apavorado se sofrer de novo).',
  },
  { id: 'agarrado', nome: 'Agarrado', resumo: 'Não pode se mover; −1 passo em ataques.' },
  {
    id: 'apavorado',
    nome: 'Apavorado',
    resumo: '−2 passos em testes; precisa se afastar da fonte.',
  },
  {
    id: 'caido',
    nome: 'Caído',
    resumo: '−1 passo em luta/esquiva; +1 passo contra ataques à distância.',
  },
  { id: 'cego', nome: 'Cego', resumo: 'Falha automática em testes de visão; −2 passos em Físico.' },
  {
    id: 'em-chamas',
    nome: 'Em chamas',
    resumo: 'Sofre 1d4 de dano por rodada até apagar com ação.',
  },
  { id: 'exposto', nome: 'Exposto', resumo: 'Ataques contra você ganham +1 passo.' },
  {
    id: 'inconsciente',
    nome: 'Inconsciente',
    resumo: 'Indefeso e incapaz de agir (0 PV ou nocauteado).',
  },
  { id: 'lento', nome: 'Lento', resumo: 'Deslocamento reduzido à metade.' },
  { id: 'paralisado', nome: 'Paralisado', resumo: 'Imóvel e incapaz de realizar ações físicas.' },
  {
    id: 'pertubado',
    nome: 'Perturbado',
    resumo: 'PD abaixo da metade do máximo; sujeito a surto.',
  },
  {
    id: 'sangrando',
    nome: 'Sangrando',
    resumo: 'Perde 1 PV por rodada até ser estancado (Medicina DT 7).',
  },
  {
    id: 'surpreendido',
    nome: 'Surpreendido',
    resumo: 'Não age na primeira rodada; Exposto até agir.',
  },
] as const;

export const AREAS_APTIDAO_OP2 = [
  'Artes',
  'Atualidades',
  'Burocracia',
  'Exatas',
  'Humanas',
  'Tática',
] as const;
export type AreaAptidaoOp2 = (typeof AREAS_APTIDAO_OP2)[number];

export const ESCALA_DT_OP2 = [
  { dt: 4, nome: 'Trivial' },
  { dt: 6, nome: 'Fácil' },
  { dt: 7, nome: 'Padrão' },
  { dt: 8, nome: 'Exige atenção' },
  { dt: 10, nome: 'Difícil' },
  { dt: 13, nome: 'Muito difícil' },
  { dt: 16, nome: 'Quase impossível' },
] as const;

export const PESOS_DE_ESPACO_OP2 = [
  { espacos: 0, nome: 'Desprezível' },
  { espacos: 1, nome: 'Normal' },
  { espacos: 2, nome: 'Volumoso' },
  { espacos: 5, nome: 'Pesado' },
  { espacos: 10, nome: 'Muito pesado' },
] as const;

export const XP_POR_NIVEL_MULTIPLICADOR = 30;
export const xpParaProximoNivel = (nivelAtual: number): number =>
  Math.max(1, nivelAtual) * XP_POR_NIVEL_MULTIPLICADOR;
