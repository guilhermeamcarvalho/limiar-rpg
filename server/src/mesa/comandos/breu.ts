// Breu: o mestre cobre e revela; cada comando manda a lista inteira de áreas (é curta).
// Cobrir (ou revelar) o mapa inteiro troca a lista por essa forma só: o que estava embaixo não
// conta mais, e a lista não cresce a cada "cobrir tudo".
import { cobreOMapa, podeConduzirMesa, type FormaDoBreu } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe no breu.');
  // O breu é do mapa: sem mapa na mesa, não há o que cobrir.
  return exigirMapa(ctx);
}

const mudou = (ctx: Contexto) => [{ type: 'darkness.changed' as const, breu: ctx.estado.breu }];

function empilhar(ctx: Contexto, modo: 'cobrir' | 'revelar', forma: FormaDoBreu) {
  const mapa = exigirMestre(ctx);
  const area = { id: novoId('nev'), modo, forma };
  if (cobreOMapa(forma, mapa)) {
    // Revelar tudo é limpar; cobrir tudo é uma área só.
    ctx.estado.breu = modo === 'cobrir' ? [area] : [];
  } else {
    ctx.estado.breu.push(area);
  }
  return mudou(ctx);
}

export const tratadoresDoBreu: Tratadores = {
  'darkness.add'(ctx, { forma }) {
    return empilhar(ctx, 'cobrir', forma);
  },

  'darkness.reveal'(ctx, { forma }) {
    return empilhar(ctx, 'revelar', forma);
  },

  'darkness.remove'(ctx, { formaId }) {
    exigirMestre(ctx);
    if (formaId === undefined) {
      ctx.estado.breu = [];
      return mudou(ctx);
    }
    if (!ctx.estado.breu.some((a) => a.id === formaId)) {
      throw new Recusa('Essa área do breu não existe mais.');
    }
    ctx.estado.breu = ctx.estado.breu.filter((a) => a.id !== formaId);
    return mudou(ctx);
  },
};
