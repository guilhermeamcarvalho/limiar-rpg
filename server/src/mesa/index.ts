// Mesa ao vivo (Socket.IO): comandos do cliente, eventos do servidor. A mesa entra na Fase 2.
// Já existe o canal por onde as rotas HTTP avisam a mesa de uma mudança (como uma ficha editada):
// a Fase 2 só precisa ouvir aqui e repassar para a sala da campanha.
import type { EventoPersonagemMudou } from '@membrana/shared';

/** Eventos que nascem fora da mesa (numa rota HTTP) e vão para a sala de uma campanha. */
export type EventoDaMesa = EventoPersonagemMudou;

export type OuvinteDaMesa = (evento: EventoDaMesa) => void;

export interface AvisosDaMesa {
  emitir(evento: EventoDaMesa): void;
  /** Devolve a função que para de ouvir. */
  ouvir(ouvinte: OuvinteDaMesa): () => void;
}

export function criarAvisosDaMesa(): AvisosDaMesa {
  const ouvintes = new Set<OuvinteDaMesa>();
  return {
    emitir(evento) {
      for (const ouvinte of ouvintes) ouvinte(evento);
    },
    ouvir(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}
