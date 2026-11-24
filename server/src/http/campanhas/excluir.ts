// DELETE /api/campanhas/:id: o mestre exclui o caso de vez (#151). Encerrar continua existindo
// para quem só quer arquivar.
// O banco apaga em cascata membros, convites, mapas (com tokens e props), o estado da mesa e o
// registro da sessão. Personagens e o histórico de testes só perdem o vínculo com o caso: os
// personagens voltam para a lista de quem os criou.
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { confirmaExclusao, esquemaExclusaoDeCampanha, podeEditarCampanha } from '@membrana/shared';
import { campaigns, maps, props, tokens } from '../../db/schema.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi, validar } from '../erros.ts';
import { apagarSeLivre } from '../uploads/imagens.ts';
import { campanhaVisivel } from './dados.ts';

/** As imagens da mesa do caso: mapas, tokens e props, no banco e na mesa em memória. */
function imagensDoCaso(app: FastifyInstance, campanhaId: string): Set<string> {
  const mapas = app.db
    .select({ id: maps.id, imagem: maps.imagem })
    .from(maps)
    .where(eq(maps.campaignId, campanhaId))
    .all();
  const ids = mapas.map((m) => m.id);
  const imagens = new Set(mapas.map((m) => m.imagem));
  if (ids.length > 0) {
    for (const t of app.db
      .select({ imagem: tokens.imagem })
      .from(tokens)
      .where(inArray(tokens.mapId, ids))
      .all()) {
      if (t.imagem) imagens.add(t.imagem);
    }
    for (const p of app.db
      .select({ imagem: props.imagem })
      .from(props)
      .where(inArray(props.mapId, ids))
      .all()) {
      imagens.add(p.imagem);
    }
  }
  // O que ainda não foi salvo (até 1 s) só está na mesa.
  const estado = app.mesas.existente(campanhaId)?.estado;
  if (estado?.mapa) imagens.add(estado.mapa.imagem);
  for (const t of estado?.tokens ?? []) if (t.imagem) imagens.add(t.imagem);
  for (const p of estado?.props ?? []) imagens.add(p.imagem);
  return imagens;
}

export function rotaExcluir(app: FastifyInstance) {
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const usuario = usuarioLogado(request);
    const { id } = request.params;
    const { campanha, comMembros } = campanhaVisivel(app.db, id, usuario);
    if (!podeEditarCampanha(usuario, comMembros)) {
      throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso pode excluí-lo.');
    }
    const { nome } = validar(esquemaExclusaoDeCampanha, request.body ?? {});
    if (!confirmaExclusao(nome, campanha.nome)) {
      throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
        nome: 'Digite o nome do caso exatamente como está.',
      });
    }

    const imagens = imagensDoCaso(app, id);
    app.db.delete(campaigns).where(eq(campaigns.id, id)).run();
    // Quem está na mesa fica sabendo e sai; a mesa sai da memória sem salvar de novo.
    app.mesa.emitir({ type: 'campaign.deleted', campanhaId: id });
    app.mesas.descartar(id);

    for (const imagem of imagens) {
      await apagarSeLivre(app.db, app.config.UPLOADS_DIR, imagem, (n) => app.mesas.usaArquivo(n));
    }
    return reply.status(204).send();
  });
}
