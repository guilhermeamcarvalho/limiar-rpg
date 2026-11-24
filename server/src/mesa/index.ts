// O canal por onde as rotas HTTP avisam a mesa ao vivo de uma mudança (como uma ficha editada).
// O socket.ts ouve aqui e repassa para a sala da campanha, com número de sequência.
// A mesa em si: Mesa.ts (estado e comandos), projecao.ts (o que cada um recebe), socket.ts.
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
