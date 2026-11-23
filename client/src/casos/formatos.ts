// Como um caso aparece em texto: número, papel, datas, agenda e os links que levam a ele.
import { DIAS_DA_SEMANA, type Agenda, type CampanhaNaLista, type Papel } from '@membrana/shared';

/** 17 → "017". Sem número (caso antigo), "—". */
export function numeroDoCaso(numero: number | null): string {
  return numero === null ? '—' : String(numero).padStart(3, '0');
}

export const PAPEL = {
  mestre: { rotulo: 'Mestre', voce: 'você mestra', tom: 'gold' },
  jogador: { rotulo: 'Jogador', voce: 'você joga', tom: 'red' },
} as const satisfies Record<Papel, { rotulo: string; voce: string; tom: 'gold' | 'red' }>;

/** "Ordem" ou "Inventado", para a etiqueta do cartão. */
export function etiquetaDoSistema(sistema: CampanhaNaLista['sistema']): string {
  return sistema.tipo === 'op2' ? 'Ordem' : 'Inventado';
}

/** "21h" ou "21h30". */
export function hora(d: Date): string {
  const m = d.getMinutes();
  return `${String(d.getHours())}h${m ? String(m).padStart(2, '0') : ''}`;
}

/** "sex 21/11, 21h". */
export function quandoCurto(iso: string): string {
  const d = new Date(iso);
  const dia = DIAS_DA_SEMANA[d.getDay()]?.slice(0, 3).toLowerCase() ?? '';
  const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
  return `${dia} ${data}, ${hora(d)}`;
}

/** "Toda sexta, 21h00", "Sexta, a cada 15 dias, 21h00", "Uma sexta por mês, 21h00". */
export function agendaEmTexto(agenda: Agenda): string {
  const dia = (DIAS_DA_SEMANA[agenda.diaDaSemana] ?? '').toLowerCase();
  const [h = '00', m = '00'] = agenda.horario.split(':');
  const horario = `${h}h${m}`;
  // Sábado e domingo são masculinos: "todo sábado".
  const todo = agenda.diaDaSemana === 0 || agenda.diaDaSemana === 6 ? 'Todo' : 'Toda';
  const um = agenda.diaDaSemana === 0 || agenda.diaDaSemana === 6 ? 'Um' : 'Uma';
  if (agenda.frequencia === 'quinzenal') {
    return `${dia[0]?.toUpperCase() ?? ''}${dia.slice(1)}, a cada 15 dias, ${horario}`;
  }
  if (agenda.frequencia === 'mensal') return `${um} ${dia} por mês, ${horario}`;
  return `${todo} ${dia}, ${horario}`;
}

/** Só a próxima sessão que ainda não passou conta. */
export function sessaoFutura(caso: Pick<CampanhaNaLista, 'proximaSessao'>, agora = Date.now()) {
  return caso.proximaSessao !== null && new Date(caso.proximaSessao).getTime() > agora
    ? caso.proximaSessao
    : null;
}

export type PaginaDaCampanha = 'mesa' | 'escudo' | 'ficha';

/**
 * Link para dentro de um caso: /campanhas/cmp_1/mesa. O caso vai na URL e o personagem vem dele
 * (`meuPersonagem`, escolhido por caso no servidor), nunca de algo guardado no navegador.
 */
export function linkDaCampanha(id: string, pagina: PaginaDaCampanha) {
  return `/campanhas/${encodeURIComponent(id)}/${pagina}`;
}

export function linkDoDossie(id: string) {
  return `/casos/${encodeURIComponent(id)}`;
}

/** Sem acento e em minúsculas, para a busca: "Maré" acha "mare". */
export function paraBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/**
 * O caso para "Continuar investigação": dos que estão em curso, o de sessão marcada mais
 * próxima; sem nenhuma marcada, o mais recente (a lista já vem do mais novo para o mais velho).
 */
export function casoParaContinuar<T extends CampanhaNaLista>(
  casos: readonly T[],
  agora = Date.now(),
) {
  const emCurso = casos.filter((c) => c.situacao === 'em-curso');
  const comSessao = emCurso
    .filter((c) => sessaoFutura(c, agora) !== null)
    .sort((a, b) => (a.proximaSessao ?? '').localeCompare(b.proximaSessao ?? ''));
  return comSessao[0] ?? emCurso[0] ?? null;
}
