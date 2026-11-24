// Rodadas: o mestre encerra a rodada e a próxima começa. A ação por rodada entra no #73.
import { podeConduzirMesa } from '@membrana/shared';
import { Recusa, type Tratadores } from './contexto.ts';

export const tratadoresDaRodada: Tratadores = {
  'round.end'(ctx) {
    if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre passa a rodada.');
    ctx.estado.rodada.numero += 1;
    return [{ type: 'round.started', numero: ctx.estado.rodada.numero }];
  },
};
