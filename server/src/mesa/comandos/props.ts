// Props: imagens sobre o mapa. Todos veem; só o mestre altera. Travado, o prop não sai do lugar
// (nem muda de tamanho ou giro) até ser destravado; trazer à frente e remover continuam valendo.
import { podeConduzirMesa, type PropNaMesa } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe nos props.');
}

const TRAVADO = 'O prop está travado. Destrave para mexer nele.';

function acharProp(ctx: Contexto, propId: string): PropNaMesa {
  const prop = ctx.estado.props.find((p) => p.id === propId);
  if (!prop) throw new Recusa('Esse prop não está mais no mapa.');
  return prop;
}

export const tratadoresDeProps: Tratadores = {
  'prop.create'(ctx, { imagem, x, y, tamanho, rotacao }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const prop: PropNaMesa = {
      id: novoId('prp'),
      imagem,
      x,
      y,
      tamanho: tamanho ?? 1,
      rotacao: rotacao ?? 0,
      travado: false,
      // Novo prop fica por cima dos outros.
      ordem: Math.max(-1, ...ctx.estado.props.map((p) => p.ordem)) + 1,
    };
    ctx.estado.props.push(prop);
    return [{ type: 'prop.changed', propId: prop.id, prop }];
  },

  'prop.update'(ctx, { propId, x, y, tamanho, rotacao, travado, ordem }) {
    exigirMestre(ctx);
    const prop = acharProp(ctx, propId);
    const mexe = [x, y, tamanho, rotacao].some((v) => v !== undefined);
    // Destravar e mexer no mesmo pedido vale; mexer num travado, não.
    if (prop.travado && mexe && travado !== false) throw new Recusa(TRAVADO);
    if (x !== undefined) prop.x = x;
    if (y !== undefined) prop.y = y;
    if (tamanho !== undefined) prop.tamanho = tamanho;
    if (rotacao !== undefined) prop.rotacao = rotacao;
    if (travado !== undefined) prop.travado = travado;
    if (ordem !== undefined) prop.ordem = ordem;
    return [{ type: 'prop.changed', propId, prop }];
  },

  'prop.drag'(ctx, { propId, x, y }) {
    exigirMestre(ctx);
    if (acharProp(ctx, propId).travado) throw new Recusa(TRAVADO);
    return [{ type: 'prop.dragging', propId, x, y }];
  },

  'prop.delete'(ctx, { propId }) {
    exigirMestre(ctx);
    acharProp(ctx, propId);
    ctx.estado.props = ctx.estado.props.filter((p) => p.id !== propId);
    return [{ type: 'prop.changed', propId, prop: null }];
  },
};
