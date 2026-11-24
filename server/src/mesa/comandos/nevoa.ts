// Névoa: o mestre cobre e revela; cada comando manda a lista inteira de áreas (é curta).
import { podeConduzirMesa } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe na névoa.');
}

const mudou = (ctx: Contexto) => [{ type: 'fog.changed' as const, nevoa: ctx.estado.nevoa }];

export const tratadoresDaNevoa: Tratadores = {
  'fog.add'(ctx, { forma }) {
    exigirMestre(ctx);
    ctx.estado.nevoa.push({ id: novoId('nev'), modo: 'cobrir', forma });
    return mudou(ctx);
  },

  'fog.reveal'(ctx, { forma }) {
    exigirMestre(ctx);
    ctx.estado.nevoa.push({ id: novoId('nev'), modo: 'revelar', forma });
    return mudou(ctx);
  },

  'fog.remove'(ctx, { formaId }) {
    exigirMestre(ctx);
    if (formaId === undefined) {
      ctx.estado.nevoa = [];
      return mudou(ctx);
    }
    if (!ctx.estado.nevoa.some((a) => a.id === formaId)) {
      throw new Recusa('Essa área da névoa não existe mais.');
    }
    ctx.estado.nevoa = ctx.estado.nevoa.filter((a) => a.id !== formaId);
    return mudou(ctx);
  },
};
