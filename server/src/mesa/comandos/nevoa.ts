// Névoa da Membrana: o mestre diz o quanto ela está densa na cena, de 0 a 100. É só visual: não
// esconde token nem prop e não barra movimento (isso é o breu). Vale sem mapa na mesa, como clima.
import { podeConduzirMesa } from '@membrana/shared';
import { Recusa, type Tratadores } from './contexto.ts';

export const tratadoresDaNevoa: Tratadores = {
  'mist.set'(ctx, { nivel }) {
    if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe na névoa.');
    ctx.estado.nevoa = nivel;
    return [{ type: 'mist.changed', nivel }];
  },
};
