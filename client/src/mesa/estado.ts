// A mesa como o navegador a conhece: o que o servidor mandou, evento por evento. Função pura, sem
// React: cada evento devolve um estado novo (ou o mesmo, se não mudou nada).
// O servidor já filtrou o que esta pessoa pode ver; aqui só se aplica.
import type { EventoDaMesa, PresencaNaMesa, VisaoDaMesa } from '@membrana/shared';

export interface MesaNoCliente {
  /** Nulo até o primeiro `mesa.estado`. */
  visao: VisaoDaMesa | null;
  /** O número do último evento aplicado. */
  seq: number;
  online: PresencaNaMesa[];
  /** Tokens e props no meio de um arrasto de outra pessoa: a posição provisória, que não grava. */
  arrastando: Record<string, { x: number; y: number }>;
}

export const MESA_VAZIA: MesaNoCliente = { visao: null, seq: 0, online: [], arrastando: {} };

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
    return { ...mesa, visao: evento.estado, seq: evento.seq, arrastando: {} };
  }
  // Atrasado (de antes do último estado completo): já está contado nele.
  if (evento.seq < mesa.seq) return mesa;
  const seq = evento.seq;
  if (evento.type === 'presence.changed') return { ...mesa, seq, online: evento.online };

  const { visao } = mesa;
  if (!visao) return { ...mesa, seq };

  switch (evento.type) {
    case 'token.moved':
      return {
        ...mesa,
        seq,
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
        arrastando: { ...mesa.arrastando, [evento.tokenId]: { x: evento.x, y: evento.y } },
      };
    case 'token.changed':
      return {
        ...mesa,
        seq,
        arrastando: semArrasto(mesa.arrastando, evento.tokenId),
        visao: { ...visao, tokens: trocar(visao.tokens, evento.tokenId, evento.token) },
      };
    case 'prop.dragging':
      return {
        ...mesa,
        seq,
        arrastando: { ...mesa.arrastando, [evento.propId]: { x: evento.x, y: evento.y } },
      };
    case 'prop.changed':
      return {
        ...mesa,
        seq,
        arrastando: semArrasto(mesa.arrastando, evento.propId),
        visao: {
          ...visao,
          props: trocar(visao.props, evento.propId, evento.prop).sort((a, b) => a.ordem - b.ordem),
        },
      };
    case 'darkness.changed':
      return { ...mesa, seq, visao: { ...visao, breu: evento.breu } };
    case 'mist.changed':
      return { ...mesa, seq, visao: { ...visao, nevoa: evento.nivel } };
    case 'map.activated':
      // O mapa novo, com tudo o que está sobre ele, chega logo depois num `mesa.estado`.
      return { ...mesa, seq };
    case 'map.changed':
      return { ...mesa, seq, visao: { ...visao, mapa: evento.mapa } };
    case 'round.started':
      return { ...mesa, seq, visao: { ...visao, rodada: { numero: evento.numero } } };
    case 'clue.changed':
      return {
        ...mesa,
        seq,
        visao: { ...visao, pistas: trocar(visao.pistas, evento.pistaId, evento.pista) },
      };
    case 'audio.changed':
      return { ...mesa, seq, visao: { ...visao, trilha: evento.trilha } };
    default:
      // Ficha, chat, dados, testes, pistas na mão e salas: as telas deles chegam nas próximas issues.
      return { ...mesa, seq };
  }
}
