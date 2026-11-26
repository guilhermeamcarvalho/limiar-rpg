// A mesa como o navegador a conhece: o que o servidor mandou, evento por evento. Função pura, sem
// React: cada evento devolve um estado novo (ou o mesmo, se não mudou nada).
// O servidor já filtrou o que esta pessoa pode ver; aqui só se aplica.
import type {
  EventoDaMesa,
  PresencaNaMesa,
  RegistroDeTeste,
  TipoDeEvento,
  VisaoDaMesa,
} from '@membrana/shared';

/** Eventos que ficam gravados em `session_log` (Chat e Acontecimentos). */
const TIPOS_REGISTRADOS: ReadonlySet<TipoDeEvento> = new Set([
  'chat.message',
  'dice.rolled',
  'test.resolved',
  'clue.presented',
  'map.activated',
  'audio.changed',
  'round.started',
]);

export function ehEventoRegistrado(evento: EventoDaMesa): boolean {
  return TIPOS_REGISTRADOS.has(evento.type);
}

/**
 * Une eventos vindos de `GET /api/campanhas/:id/registro` com os que chegaram ao vivo pelo
 * Socket.IO, sem nunca repetir o mesmo `seq` e mantendo a ordem crescente (#72).
 */
export function mesclarEventosRegistrados(
  atuais: readonly EventoDaMesa[],
  novos: readonly EventoDaMesa[],
): EventoDaMesa[] {
  const porSeq = new Map<number, EventoDaMesa>();
  for (const evento of atuais) {
    if (ehEventoRegistrado(evento)) porSeq.set(evento.seq, evento);
  }
  let mudou = false;
  for (const evento of novos) {
    if (!ehEventoRegistrado(evento)) continue;
    if (!porSeq.has(evento.seq)) mudou = true;
    porSeq.set(evento.seq, evento);
  }
  if (!mudou && porSeq.size === atuais.length) return atuais as EventoDaMesa[];
  return [...porSeq.values()].sort((a, b) => a.seq - b.seq);
}

export interface MesaNoCliente {
  /** Nulo até o primeiro `mesa.estado`. */
  visao: VisaoDaMesa | null;
  /** O número do último evento aplicado. */
  seq: number;
  online: PresencaNaMesa[];
  /** Tokens e props no meio de um arrasto de outra pessoa: a posição provisória, que não grava. */
  arrastando: Record<string, { x: number; y: number }>;
  /** Eventos registrados que chegaram ao vivo nesta conexão, sem repetição de `seq`. */
  eventos: EventoDaMesa[];
  /** O último teste resolvido ao vivo na mesa, para o cartão no canto do mapa (#70). */
  ultimoTeste: { seq: number; registro: RegistroDeTeste } | null;
  /** O último ponto marcado no mapa ao vivo (#79). */
  ultimoPulso: { seq: number; autorId: string; x: number; y: number } | null;
  /** Contador por personagem: sobe a cada `character.changed`, para recarregar a ficha aberta. */
  versaoPersonagens: Record<string, number>;
}

export const MESA_VAZIA: MesaNoCliente = {
  visao: null,
  seq: 0,
  online: [],
  arrastando: {},
  eventos: [],
  ultimoTeste: null,
  ultimoPulso: null,
  versaoPersonagens: {},
};

function semArrasto(arrastando: MesaNoCliente['arrastando'], tokenId: string) {
  if (!(tokenId in arrastando)) return arrastando;
  return Object.fromEntries(Object.entries(arrastando).filter(([id]) => id !== tokenId));
}

/** Troca o item de mesmo id (ou acrescenta); `null` remove. */
function trocar<T extends { id: string }>(lista: T[], id: string, item: T | null): T[] {
  if (item === null) return lista.filter((x) => x.id !== id);
  return lista.some((x) => x.id === id)
    ? lista.map((x) => (x.id === id ? item : x))
    : [...lista, item];
}

export function aplicarEvento(mesa: MesaNoCliente, evento: EventoDaMesa): MesaNoCliente {
  // O estado completo sempre vale: é o que chega ao entrar, ao voltar de uma queda e ao trocar de mapa.
  if (evento.type === 'mesa.estado') {
    return { ...mesa, visao: evento.estado, seq: evento.seq, arrastando: {}, ultimoPulso: null };
  }

  const eventos = ehEventoRegistrado(evento)
    ? mesclarEventosRegistrados(mesa.eventos, [evento])
    : mesa.eventos;

  if (evento.type === 'character.changed') {
    const atual = mesa.versaoPersonagens[evento.personagemId] ?? 0;
    return {
      ...mesa,
      seq: Math.max(mesa.seq, evento.seq),
      eventos,
      versaoPersonagens: { ...mesa.versaoPersonagens, [evento.personagemId]: atual + 1 },
    };
  }

  if (evento.type === 'test.resolved') {
    return {
      ...mesa,
      seq: Math.max(mesa.seq, evento.seq),
      eventos,
      ultimoTeste: { seq: evento.seq, registro: evento.registro },
    };
  }

  // Atrasado (de antes do último estado completo): o estado já está contado nele; só preserva registro.
  if (evento.seq < mesa.seq) {
    return eventos === mesa.eventos ? mesa : { ...mesa, eventos };
  }

  const seq = evento.seq;
  if (evento.type === 'presence.changed') return { ...mesa, seq, eventos, online: evento.online };

  const { visao } = mesa;
  if (!visao) return { ...mesa, seq, eventos };

  switch (evento.type) {
    case 'token.moved':
      return {
        ...mesa,
        seq,
        eventos,
        arrastando: semArrasto(mesa.arrastando, evento.tokenId),
        visao: {
          ...visao,
          tokens: visao.tokens.map((t) =>
            t.id === evento.tokenId ? { ...t, x: evento.x, y: evento.y } : t,
          ),
        },
      };
    case 'token.dragging':
      return {
        ...mesa,
        seq,
        eventos,
        arrastando: { ...mesa.arrastando, [evento.tokenId]: { x: evento.x, y: evento.y } },
      };
    case 'token.changed':
      return {
        ...mesa,
        seq,
        eventos,
        arrastando: semArrasto(mesa.arrastando, evento.tokenId),
        visao: { ...visao, tokens: trocar(visao.tokens, evento.tokenId, evento.token) },
      };
    case 'prop.dragging':
      return {
        ...mesa,
        seq,
        eventos,
        arrastando: { ...mesa.arrastando, [evento.propId]: { x: evento.x, y: evento.y } },
      };
    case 'prop.changed':
      return {
        ...mesa,
        seq,
        eventos,
        arrastando: semArrasto(mesa.arrastando, evento.propId),
        visao: {
          ...visao,
          props: trocar(visao.props, evento.propId, evento.prop).sort((a, b) => a.ordem - b.ordem),
        },
      };
    case 'darkness.changed':
      return { ...mesa, seq, eventos, visao: { ...visao, breu: evento.breu } };
    case 'mist.changed':
      return { ...mesa, seq, eventos, visao: { ...visao, nevoa: evento.nivel } };
    case 'map.activated':
      // O mapa novo, com tudo o que está sobre ele, chega logo depois num `mesa.estado`.
      return { ...mesa, seq, eventos, ultimoPulso: null };
    case 'board.pinged':
      return {
        ...mesa,
        seq,
        eventos,
        ultimoPulso: { seq, autorId: evento.autorId, x: evento.x, y: evento.y },
      };
    case 'map.changed':
      return { ...mesa, seq, eventos, visao: { ...visao, mapa: evento.mapa } };
    case 'round.started':
      return {
        ...mesa,
        seq,
        eventos,
        visao: { ...visao, rodada: { numero: evento.numero, agiram: [] } },
      };
    case 'round.acted': {
      const agiram = visao.rodada.agiram.includes(evento.userId)
        ? visao.rodada.agiram
        : [...visao.rodada.agiram, evento.userId];
      return { ...mesa, seq, eventos, visao: { ...visao, rodada: { ...visao.rodada, agiram } } };
    }
    case 'clue.changed':
      return {
        ...mesa,
        seq,
        eventos,
        visao: { ...visao, pistas: trocar(visao.pistas, evento.pistaId, evento.pista) },
      };
    case 'clue.received':
    case 'clue.presented': {
      const existe = visao.inventario.some(
        (i) => i.pistaId === evento.item.pistaId && i.personagemId === evento.item.personagemId,
      );
      const inventario = existe
        ? visao.inventario.map((i) =>
            i.pistaId === evento.item.pistaId && i.personagemId === evento.item.personagemId
              ? evento.item
              : i,
          )
        : [...visao.inventario, evento.item];
      return { ...mesa, seq, eventos, visao: { ...visao, inventario } };
    }
    case 'clue.revoked':
      return {
        ...mesa,
        seq,
        eventos,
        visao: {
          ...visao,
          inventario: visao.inventario.filter(
            (i) => !(i.pistaId === evento.pistaId && i.personagemId === evento.personagemId),
          ),
        },
      };
    case 'audio.changed':
      return { ...mesa, seq, eventos, visao: { ...visao, trilha: evento.trilha } };
    default:
      return { ...mesa, seq, eventos };
  }
}
