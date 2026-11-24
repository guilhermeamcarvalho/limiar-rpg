// Névoa: o mestre cobre e revela; cada comando manda a lista inteira de áreas (é curta).
// Cobrir (ou revelar) o mapa inteiro troca a lista por essa forma só: o que estava embaixo não
// conta mais, e a lista não cresce a cada "cobrir tudo".
import { cobreOMapa, podeConduzirMesa, type FormaDaNevoa } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe na névoa.');
  // A névoa é do mapa: sem mapa na mesa, não há o que cobrir.
  return exigirMapa(ctx);
}

const mudou = (ctx: Contexto) => [{ type: 'fog.changed' as const, nevoa: ctx.estado.nevoa }];

function empilhar(ctx: Contexto, modo: 'cobrir' | 'revelar', forma: FormaDaNevoa) {
  const mapa = exigirMestre(ctx);
  const area = { id: novoId('nev'), modo, forma };
  if (cobreOMapa(forma, mapa)) {
    // Revelar tudo é limpar; cobrir tudo é uma área só.
    ctx.estado.nevoa = modo === 'cobrir' ? [area] : [];
  } else {
    ctx.estado.nevoa.push(area);
  }
  return mudou(ctx);
}

export const tratadoresDaNevoa: Tratadores = {
  'fog.add'(ctx, { forma }) {
    return empilhar(ctx, 'cobrir', forma);
  },

  'fog.reveal'(ctx, { forma }) {
    return empilhar(ctx, 'revelar', forma);
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
