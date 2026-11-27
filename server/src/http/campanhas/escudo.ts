// Rotas do Escudo do mestre (#82, #83, #87): lê e edita salas, POIs e pistas usando a mesma
// `Mesa` em memória, então qualquer edição aqui vai na hora para quem está na mesa ao vivo.
import type { FastifyInstance } from 'fastify';
import { podeEditarCampanha } from '@membrana/shared';
import { personagensNaMesa } from '../../mesa/dados.ts';
import { projetarEstado } from '../../mesa/projecao.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi } from '../erros.ts';
import { campanhaVisivel } from './dados.ts';

function exigirMestreDoCaso(app: FastifyInstance, campanhaId: string, usuario: { id: string }) {
  const encontrada = campanhaVisivel(app.db, campanhaId, usuario);
  if (!podeEditarCampanha(usuario, encontrada.comMembros)) {
    throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso abre o escudo.');
  }
  return encontrada;
}

export function rotaEscudo(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/:id/escudo', (request) => {
    const usuario = usuarioLogado(request);
    const { campanha } = exigirMestreDoCaso(app, request.params.id, usuario);
    const mesa = app.mesas.obter(request.params.id);
    const visao = projetarEstado(
      { id: usuario.id, papel: 'mestre', personagemId: null },
      mesa.estado,
    );
    return {
      campanha: { id: campanha.id, nome: campanha.nome },
      mapa: visao.mapa,
      salas: visao.salas ?? [],
      pois: visao.pois,
      pistas: visao.pistas,
      inventario: visao.inventario,
      personagens: personagensNaMesa(app.db, campanha.id),
    };
  });

  app.post<{ Params: { id: string } }>('/:id/escudo/comandos', (request) => {
    const usuario = usuarioLogado(request);
    const { id } = request.params;
    exigirMestreDoCaso(app, id, usuario);
    const mesa = app.mesas.obter(id);
    const r = mesa.aplicar(usuario, request.body);
    if (!r.ok) throw new ErroDaApi(400, 'DADOS_INVALIDOS', r.motivo);
    app.mesa.emitir({
      type: 'mesa.aplicados',
      campanhaId: id,
      eventos: r.eventos,
      antes: r.antes,
      depois: r.depois,
    });
    const visao = projetarEstado(
      { id: usuario.id, papel: 'mestre', personagemId: null },
      mesa.estado,
    );
    return {
      mapa: visao.mapa,
      salas: visao.salas ?? [],
      pois: visao.pois,
      pistas: visao.pistas,
      inventario: visao.inventario,
    };
  });
}
