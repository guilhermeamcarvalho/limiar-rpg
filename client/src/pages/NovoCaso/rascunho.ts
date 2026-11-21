// Rascunho do assistente "Novo caso". Fica no navegador, por pessoa, e é salvo a cada mudança:
// fechar a página e voltar mantém o que já foi escrito. Só o rascunho mora aqui; o caso de
// verdade nasce no servidor ao abrir.
import {
  DT_PADRAO,
  FORMATOS,
  FREQUENCIAS,
  ID_OP2,
  TONS,
  esquemaNovaCampanha,
  proximaSessaoDa,
  type Formato,
  type Frequencia,
  type Tom,
} from '@membrana/shared';

export const PASSOS = [
  { id: 'premissa', nome: 'Premissa', dica: 'Sistema e mistério' },
  { id: 'regras', nome: 'Regras', dica: 'Nível, DT, rodadas' },
  { id: 'agenda', nome: 'Agenda', dica: 'Quando a mesa se reúne' },
  { id: 'convites', nome: 'Convites', dica: 'Link e código' },
  { id: 'revisao', nome: 'Revisão', dica: 'Confirme e abra' },
] as const;
export type IdDoPasso = (typeof PASSOS)[number]['id'];

/** Campos como a tela os edita: números ainda como texto, do jeito que a pessoa digitou. */
export interface Rascunho {
  passo: number;
  nome: string;
  gancho: string;
  tom: Tom;
  formato: Formato;
  nivelInicial: string;
  dtPadrao: string;
  rodadas: boolean;
  dadosFisicos: boolean;
  fichasVisiveis: boolean;
  temAgenda: boolean;
  diaDaSemana: string;
  horario: string;
  frequencia: Frequencia;
  vagas: string;
  expiraEmDias: string;
}

export const RASCUNHO_VAZIO: Rascunho = {
  passo: 0,
  nome: '',
  gancho: '',
  tom: 'horror-investigativo',
  formato: 'campanha-curta',
  nivelInicial: '1',
  dtPadrao: String(DT_PADRAO),
  rodadas: true,
  dadosFisicos: true,
  fichasVisiveis: false,
  temAgenda: true,
  diaDaSemana: '5',
  horario: '21:00',
  frequencia: 'semanal',
  vagas: '4',
  expiraEmDias: '7',
};

const chave = (userId: string) => `membrana.novo-caso.rascunho.v1:${userId}`;

/** Lê o rascunho guardado, campo a campo: o que estiver estragado volta ao padrão. */
export function lerRascunho(userId: string): { rascunho: Rascunho; salvoEm: number | null } {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chave(userId)) ?? 'null');
    if (!bruto || typeof bruto !== 'object') return { rascunho: RASCUNHO_VAZIO, salvoEm: null };
    const lido = bruto as Record<string, unknown>;
    const r = { ...RASCUNHO_VAZIO };
    for (const campo of Object.keys(RASCUNHO_VAZIO) as (keyof Rascunho)[]) {
      const valor = lido[campo];
      if (typeof valor === typeof RASCUNHO_VAZIO[campo]) Object.assign(r, { [campo]: valor });
    }
    if (!(r.tom in TONS)) r.tom = RASCUNHO_VAZIO.tom;
    if (!(r.formato in FORMATOS)) r.formato = RASCUNHO_VAZIO.formato;
    if (!(r.frequencia in FREQUENCIAS)) r.frequencia = RASCUNHO_VAZIO.frequencia;
    r.passo = Number.isInteger(r.passo) ? Math.min(Math.max(r.passo, 0), PASSOS.length - 1) : 0;
    const salvoEm = typeof lido['salvoEm'] === 'number' ? lido['salvoEm'] : null;
    return { rascunho: r, salvoEm };
  } catch {
    return { rascunho: RASCUNHO_VAZIO, salvoEm: null };
  }
}

/** Grava e devolve quando gravou; `null` se o navegador não deixou (aba anônima, cota cheia). */
export function salvarRascunho(userId: string, rascunho: Rascunho): number | null {
  const agora = Date.now();
  try {
    localStorage.setItem(chave(userId), JSON.stringify({ ...rascunho, salvoEm: agora }));
    return agora;
  } catch {
    return null;
  }
}

export function apagarRascunho(userId: string) {
  try {
    localStorage.removeItem(chave(userId));
  } catch {
    // Sem armazenamento: não há o que apagar.
  }
}

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Número digitado: vazio vira NaN, para o schema recusar com a mensagem do campo. */
const numero = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto));

/** O corpo do POST /api/campanhas. */
export function montarPedido(r: Rascunho, agora: Date) {
  const agenda = r.temAgenda
    ? { diaDaSemana: numero(r.diaDaSemana), horario: r.horario, frequencia: r.frequencia }
    : null;
  const proximaSessao =
    agenda && HORARIO.test(agenda.horario) && Number.isInteger(agenda.diaDaSemana)
      ? proximaSessaoDa(agenda, agora).toISOString()
      : null;
  return {
    nome: r.nome,
    ...(r.gancho.trim() && { gancho: r.gancho }),
    sistemaId: ID_OP2,
    tom: r.tom,
    formato: r.formato,
    nivelInicial: numero(r.nivelInicial),
    dtPadrao: numero(r.dtPadrao),
    rodadas: r.rodadas,
    dadosFisicos: r.dadosFisicos,
    fichasVisiveis: r.fichasVisiveis,
    agenda,
    proximaSessao,
    convite: { vagas: numero(r.vagas), expiraEmDias: numero(r.expiraEmDias) },
  };
}

/** Em que passo cada campo do pedido é preenchido. */
export function passoDoCampo(campo: string): number {
  const raiz = campo.split('.')[0] ?? '';
  if (['nome', 'gancho', 'tom', 'formato', 'sistemaId'].includes(raiz)) return 0;
  if (['nivelInicial', 'dtPadrao', 'rodadas', 'dadosFisicos', 'fichasVisiveis'].includes(raiz))
    return 1;
  if (['agenda', 'proximaSessao'].includes(raiz)) return 2;
  if (raiz === 'convite') return 3;
  return 4;
}

/** Erros por campo ("agenda.horario" → mensagem), com as mesmas regras do servidor. */
export function validarRascunho(r: Rascunho, agora: Date): Record<string, string> {
  const resultado = esquemaNovaCampanha.safeParse(montarPedido(r, agora));
  if (resultado.success) return {};
  const erros: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    erros[problema.path.join('.') || '_'] ??= problema.message;
  }
  return erros;
}

export const errosDoPasso = (erros: Record<string, string>, passo: number) =>
  Object.keys(erros).filter((campo) => passoDoCampo(campo) === passo);
