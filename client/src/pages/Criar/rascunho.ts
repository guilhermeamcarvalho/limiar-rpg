// Rascunho da criação guiada. Fica no navegador, por pessoa e por caso, salvo a cada mudança:
// sair e voltar recupera as escolhas. O personagem de verdade nasce no servidor ao criar.
// A ficha sai de `fichaNova` do shared, a mesma da ficha em branco: as duas dão a mesma estrutura.
import {
  DADOS,
  IDS_DAS_PERICIAS_OP2,
  OCUPACOES_OP2,
  PERFIS_OP2,
  basesDasPericias,
  comRecursosCheios,
  esquemaFichaOp2,
  fichaNova,
  mudarPasso,
  type Dado,
  type FichaOp2,
  type PerfilOp2,
  type PericiaOp2,
} from '@membrana/shared';

export const PASSOS = [
  { id: 'perfil', nome: 'Perfil' },
  { id: 'ocupacao', nome: 'Ocupação' },
  { id: 'atributos', nome: 'Atributos' },
  { id: 'pericias', nome: 'Perícias' },
  { id: 'toques', nome: 'Toques finais' },
] as const;
export const ULTIMO = PASSOS.length - 1;

/** "outra": a pessoa escreve a ocupação, sem habilidade nem bônus. */
export const OUTRA = 'outra';

export interface Rascunho {
  passo: number;
  perfil: PerfilOp2 | null;
  /** O id de uma ocupação conhecida, `OUTRA` ou vazio. */
  ocupacao: string;
  ocupacaoLivre: string;
  atributos: FichaOp2['atributos'];
  /** Passos dados em cada perícia, a partir do dado de partida da ocupação. */
  passosDasPericias: Partial<Record<PericiaOp2, number>>;
  nome: string;
  /** Como a pessoa digitou; vazio é "sem idade". */
  idade: string;
  origem: string;
  /** Quem rola nos testes (RF-83). */
  modoDados: FichaOp2['modoDados'];
}

export const RASCUNHO_VAZIO: Rascunho = {
  passo: 0,
  perfil: null,
  ocupacao: '',
  ocupacaoLivre: '',
  atributos: { fisico: 'd6', mente: 'd6', emocao: 'd6' },
  passosDasPericias: {},
  nome: '',
  idade: '',
  origem: '',
  modoDados: 'virtual',
};

const chave = (userId: string, caso: string | null) =>
  `membrana.criar.rascunho.v1:${userId}:${caso ?? 'sem-caso'}`;

const ehDado = (v: unknown): v is Dado => (DADOS as readonly unknown[]).includes(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';

/** Lê o rascunho guardado, campo a campo: o que estiver estragado volta ao padrão. */
export function lerRascunho(userId: string, caso: string | null): Rascunho {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chave(userId, caso)) ?? 'null');
    if (!bruto || typeof bruto !== 'object') return RASCUNHO_VAZIO;
    const l = bruto as Record<string, unknown>;
    const atributos = { ...RASCUNHO_VAZIO.atributos };
    if (l['atributos'] && typeof l['atributos'] === 'object') {
      const a = l['atributos'] as Record<string, unknown>;
      for (const id of ['fisico', 'mente', 'emocao'] as const) {
        if (ehDado(a[id])) atributos[id] = a[id];
      }
    }
    const passosDasPericias: Rascunho['passosDasPericias'] = {};
    if (l['passosDasPericias'] && typeof l['passosDasPericias'] === 'object') {
      const p = l['passosDasPericias'] as Record<string, unknown>;
      for (const id of IDS_DAS_PERICIAS_OP2) {
        const n = p[id];
        if (Number.isInteger(n) && (n as number) > 0) passosDasPericias[id] = n as number;
      }
    }
    const passo = l['passo'];
    const perfil = l['perfil'];
    const ocupacao = l['ocupacao'];
    return {
      passo: Number.isInteger(passo) ? Math.min(Math.max(passo as number, 0), ULTIMO) : 0,
      perfil: (PERFIS_OP2 as readonly unknown[]).includes(perfil) ? (perfil as PerfilOp2) : null,
      ocupacao:
        ehTexto(ocupacao) && (ocupacao === OUTRA || OCUPACOES_OP2.some((o) => o.id === ocupacao))
          ? ocupacao
          : '',
      ocupacaoLivre: ehTexto(l['ocupacaoLivre']) ? l['ocupacaoLivre'] : '',
      atributos,
      passosDasPericias,
      nome: ehTexto(l['nome']) ? l['nome'] : '',
      idade: ehTexto(l['idade']) ? l['idade'] : '',
      origem: ehTexto(l['origem']) ? l['origem'] : '',
      modoDados: l['modoDados'] === 'fisico' ? 'fisico' : 'virtual',
    };
  } catch {
    return RASCUNHO_VAZIO;
  }
}

/** Grava; sem armazenamento (aba anônima, cota cheia), segue sem rascunho. */
export function salvarRascunho(userId: string, caso: string | null, r: Rascunho) {
  try {
    localStorage.setItem(chave(userId, caso), JSON.stringify(r));
  } catch {
    // Sem armazenamento: a criação continua, só não sobrevive a sair da página.
  }
}

export function apagarRascunho(userId: string, caso: string | null) {
  try {
    localStorage.removeItem(chave(userId, caso));
  } catch {
    // Sem armazenamento: não há o que apagar.
  }
}

/** O nome da ocupação como vai para a ficha. */
export function textoDaOcupacao(r: Pick<Rascunho, 'ocupacao' | 'ocupacaoLivre'>): string {
  if (r.ocupacao === OUTRA) return r.ocupacaoLivre.trim();
  return OCUPACOES_OP2.find((o) => o.id === r.ocupacao)?.nome ?? '';
}

/** Os dados das perícias: o de partida da ocupação mais os passos dados em cada uma. */
export function periciasDoRascunho(r: Rascunho): FichaOp2['pericias'] {
  const bases = basesDasPericias(textoDaOcupacao(r));
  return Object.fromEntries(
    IDS_DAS_PERICIAS_OP2.map((id) => [id, mudarPasso(bases[id], r.passosDasPericias[id] ?? 0)]),
  ) as FichaOp2['pericias'];
}

const idadeDoTexto = (texto: string) => (texto.trim() === '' ? null : Number(texto));

/** A ficha que o rascunho vira, com PV e PD calculados. Pode ainda não passar no schema. */
export function fichaDoRascunho(r: Rascunho, nivel: number): FichaOp2 {
  return comRecursosCheios({
    ...fichaNova({
      nome: r.nome,
      nivel,
      perfil: r.perfil ?? 'executor',
      ocupacao: textoDaOcupacao(r),
    }),
    idade: idadeDoTexto(r.idade),
    origem: r.origem,
    modoDados: r.modoDados,
    atributos: r.atributos,
    pericias: periciasDoRascunho(r),
  });
}

/** Em que passo cada campo é preenchido. */
export function passoDoCampo(campo: string): number {
  const raiz = campo.split('.')[0] ?? '';
  if (raiz === 'perfil') return 0;
  if (raiz === 'ocupacao' || raiz === 'ocupacaoLivre') return 1;
  if (raiz === 'atributos') return 2;
  if (raiz === 'pericias') return 3;
  return ULTIMO;
}

/** Erros que impedem seguir: escolhas que faltam e o que o schema da ficha recusa. */
export function validarRascunho(r: Rascunho, nivel: number): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!r.perfil) erros['perfil'] = 'Escolha um perfil.';
  if (!r.ocupacao) erros['ocupacao'] = 'Escolha uma ocupação.';
  else if (r.ocupacao === OUTRA && !r.ocupacaoLivre.trim()) {
    erros['ocupacaoLivre'] = 'Escreva a ocupação.';
  }
  const resultado = esquemaFichaOp2.safeParse(fichaDoRascunho(r, nivel));
  if (!resultado.success) {
    for (const problema of resultado.error.issues) {
      const campo = problema.path.join('.') || '_';
      // A ocupação livre é o campo que a pessoa vê.
      const visivel = campo === 'ocupacao' ? 'ocupacaoLivre' : campo;
      erros[visivel] ??= problema.message;
    }
  }
  return erros;
}

export const errosDoPasso = (erros: Record<string, string>, passo: number) =>
  Object.keys(erros).filter((campo) => passoDoCampo(campo) === passo);
