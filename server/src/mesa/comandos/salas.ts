// Salas e pontos de interesse (#82, #83): só o mestre cria, edita e apaga.
// As salas são secretas (jogadores nunca recebem). Os POIs vão para os jogadores só com
// número, nome, posição e se já foram totalmente descobertos.
import { podeConduzirMesa, type PoiNaMesa, type SalaNaMesa } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) {
    throw new Recusa('Só o mestre mexe nas salas e pontos de interesse.');
  }
}

function dentroDoMapa(x: number, y: number, largura: number, altura: number) {
  return {
    x: Math.min(largura, Math.max(0, x)),
    y: Math.min(altura, Math.max(0, y)),
  };
}

export const tratadoresDeSalas: Tratadores = {
  'room.create'(ctx, { nome, area, notasMestre }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const sala: SalaNaMesa = {
      id: novoId('rom'),
      nome,
      area,
      notasMestre: notasMestre ?? '',
    };
    ctx.estado.salas.push(sala);
    return [{ type: 'room.updated', salaId: sala.id, sala }];
  },

  'room.update'(ctx, { salaId, nome, notasMestre, area }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const sala = ctx.estado.salas.find((s) => s.id === salaId);
    if (!sala) throw new Recusa('Essa sala não existe neste mapa.');
    if (nome !== undefined) sala.nome = nome;
    if (notasMestre !== undefined) sala.notasMestre = notasMestre;
    if (area !== undefined) sala.area = area;
    return [{ type: 'room.updated', salaId: sala.id, sala }];
  },

  'room.delete'(ctx, { salaId }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const indice = ctx.estado.salas.findIndex((s) => s.id === salaId);
    if (indice === -1) throw new Recusa('Essa sala não existe neste mapa.');
    ctx.estado.salas.splice(indice, 1);
    const eventos: (
      | { type: 'room.updated'; salaId: string; sala: null }
      | { type: 'poi.changed'; poiId: string; poi: PoiNaMesa }
    )[] = [{ type: 'room.updated', salaId, sala: null }];
    for (const poi of ctx.estado.pois) {
      if (poi.salaId === salaId) {
        poi.salaId = null;
        eventos.push({ type: 'poi.changed', poiId: poi.id, poi });
      }
    }
    return eventos;
  },

  'poi.create'(
    ctx,
    { salaId, numero, nome, descricao, x, y, pericias, informacoes, desafio, contextoMestre },
  ) {
    exigirMestre(ctx);
    const mapa = exigirMapa(ctx);
    if (salaId && !ctx.estado.salas.some((s) => s.id === salaId)) {
      throw new Recusa('Essa sala não existe neste mapa.');
    }
    const proximo = Math.max(0, ...ctx.estado.pois.map((p) => p.numero)) + 1;
    const pos = dentroDoMapa(x, y, mapa.largura, mapa.altura);
    const poi: PoiNaMesa = {
      id: novoId('poi'),
      salaId: salaId ?? null,
      numero: numero ?? proximo,
      nome,
      descricao: descricao ?? '',
      x: pos.x,
      y: pos.y,
      pericias: pericias ?? [],
      informacoes: informacoes ?? [],
      desafio: desafio ?? null,
      contextoMestre: contextoMestre ?? '',
    };
    ctx.estado.pois.push(poi);
    return [{ type: 'poi.changed', poiId: poi.id, poi }];
  },

  'poi.update'(
    ctx,
    {
      poiId,
      salaId,
      numero,
      nome,
      descricao,
      x,
      y,
      pericias,
      informacoes,
      desafio,
      contextoMestre,
    },
  ) {
    exigirMestre(ctx);
    const mapa = exigirMapa(ctx);
    const poi = ctx.estado.pois.find((p) => p.id === poiId);
    if (!poi) throw new Recusa('Esse ponto de interesse não existe neste mapa.');
    if (salaId !== undefined) {
      if (salaId !== null && !ctx.estado.salas.some((s) => s.id === salaId)) {
        throw new Recusa('Essa sala não existe neste mapa.');
      }
      poi.salaId = salaId;
    }
    if (numero !== undefined) poi.numero = numero;
    if (nome !== undefined) poi.nome = nome;
    if (descricao !== undefined) poi.descricao = descricao;
    if (x !== undefined || y !== undefined) {
      const pos = dentroDoMapa(x ?? poi.x, y ?? poi.y, mapa.largura, mapa.altura);
      poi.x = pos.x;
      poi.y = pos.y;
    }
    if (pericias !== undefined) poi.pericias = pericias;
    if (informacoes !== undefined) poi.informacoes = informacoes;
    if (desafio !== undefined) poi.desafio = desafio;
    if (contextoMestre !== undefined) poi.contextoMestre = contextoMestre;
    return [{ type: 'poi.changed', poiId: poi.id, poi }];
  },

  'poi.delete'(ctx, { poiId }) {
    exigirMestre(ctx);
    exigirMapa(ctx);
    const indice = ctx.estado.pois.findIndex((p) => p.id === poiId);
    if (indice === -1) throw new Recusa('Esse ponto de interesse não existe neste mapa.');
    ctx.estado.pois.splice(indice, 1);
    return [{ type: 'poi.changed', poiId, poi: null }];
  },
};
