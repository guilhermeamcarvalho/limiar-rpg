// Mapa: o mestre troca o mapa da mesa (para todos ao mesmo tempo) e ajusta a grade do ativo.
// Na troca, o mapa que sai é gravado antes (Mesa.ts) e o que entra vem do banco, com os tokens,
// os props e o breu dele.
import { podeConduzirMesa } from '@membrana/shared';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre mexe no mapa.');
}

export const tratadoresDoMapa: Tratadores = {
  'map.activate'(ctx, { mapaId }) {
    exigirMestre(ctx);
    // Já é o mapa da mesa: nada a trocar (e reler do banco perderia o que ainda não foi salvo).
    if (ctx.estado.mapa?.id === mapaId) return [];
    const conteudo = ctx.mapa(mapaId);
    if (!conteudo) throw new Recusa('Esse mapa não existe mais.');
    ctx.estado.mapa = conteudo.mapa;
    ctx.estado.tokens = conteudo.tokens;
    ctx.estado.props = conteudo.props;
    ctx.estado.breu = conteudo.breu;
    ctx.estado.salas = conteudo.salas;
    ctx.estado.pois = conteudo.pois;
    return [{ type: 'map.activated', mapa: conteudo.mapa }];
  },

  'map.grid'(ctx, { grade }) {
    exigirMestre(ctx);
    const mapa = exigirMapa(ctx);
    mapa.grade = grade;
    return [{ type: 'map.changed', mapa }];
  },

  'board.ping'(ctx, { x, y }) {
    const mapa = exigirMapa(ctx);
    return [
      {
        type: 'board.pinged',
        autorId: ctx.quem.id,
        x: Math.min(mapa.largura, Math.max(0, x)),
        y: Math.min(mapa.altura, Math.max(0, y)),
      },
    ];
  },
};
