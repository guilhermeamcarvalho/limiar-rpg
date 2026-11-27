// Rotas do Escudo do mestre (#82, #83, #87): lê e edita salas, POIs e pistas usando a mesma
// `Mesa` em memória, então qualquer edição aqui vai na hora para quem está na mesa ao vivo.
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  esquemaNotasDoEscudo,
  modeloPadraoDoEscudo,
  podeEditarCampanha,
  type NotasDoEscudo,
} from '@membrana/shared';
import { gmNotes } from '../../db/schema.ts';
import { personagensNaMesa } from '../../mesa/dados.ts';
import { projetarEstado } from '../../mesa/projecao.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi } from '../erros.ts';
import { limparImagensDePistasOrfas } from '../uploads/imagens.ts';
import { campanhaVisivel } from './dados.ts';

function exigirMestreDoCaso(app: FastifyInstance, campanhaId: string, usuario: { id: string }) {
  const encontrada = campanhaVisivel(app.db, campanhaId, usuario);
  if (!podeEditarCampanha(usuario, encontrada.comMembros)) {
    throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso abre o escudo.');
  }
  return encontrada;
}

function carregarNotas(app: FastifyInstance, campanhaId: string): NotasDoEscudo {
  const linha = app.db
    .select({ notas: gmNotes.notas })
    .from(gmNotes)
    .where(eq(gmNotes.campaignId, campanhaId))
    .get();
  return linha ? linha.notas : modeloPadraoDoEscudo();
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
      notas: carregarNotas(app, campanha.id),
    };
  });

  app.put<{ Params: { id: string } }>('/:id/escudo/notas', (request) => {
    const usuario = usuarioLogado(request);
    const { id } = request.params;
    exigirMestreDoCaso(app, id, usuario);
    const lido = esquemaNotasDoEscudo.safeParse(request.body);
    if (!lido.success) {
      throw new ErroDaApi(
        400,
        'DADOS_INVALIDOS',
        lido.error.issues[0]?.message ?? 'Dados inválidos.',
      );
    }
    const agora = new Date();
    app.db
      .insert(gmNotes)
      .values({ campaignId: id, notas: lido.data, atualizadoEm: agora })
      .onConflictDoUpdate({
        target: gmNotes.campaignId,
        set: { notas: lido.data, atualizadoEm: agora },
      })
      .run();
    return { notas: lido.data, atualizadoEm: agora.toISOString() };
  });

  app.post<{ Params: { id: string } }>('/:id/escudo/comandos', async (request) => {
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
    await limparImagensDePistasOrfas(app.db, app.config.UPLOADS_DIR, r.antes, r.depois, (n) =>
      app.mesas.usaArquivo(n),
    );
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
