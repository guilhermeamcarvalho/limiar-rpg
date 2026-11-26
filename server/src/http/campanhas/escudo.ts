// Rotas do Escudo do mestre (#82, #83): lê e edita salas e POIs usando a mesma `Mesa` em
// memória, então qualquer edição aqui vai na hora para quem está na mesa ao vivo.
import type { FastifyInstance } from 'fastify';
import { podeEditarCampanha } from '@membrana/shared';
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
    return {
      campanha: { id: campanha.id, nome: campanha.nome },
      mapa: mesa.estado.mapa,
      salas: mesa.estado.salas,
      pois: mesa.estado.pois,
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
    return {
      mapa: mesa.estado.mapa,
      salas: mesa.estado.salas,
      pois: mesa.estado.pois,
    };
  });
}
