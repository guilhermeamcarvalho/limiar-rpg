// Pistas no inventário de um personagem para a tela Ficha (#89, RF-47):
//   GET  /api/personagens/:id/pistas                     lista o inventário (sem vazar pistas não apresentadas a outros jogadores)
//   POST /api/personagens/:id/pistas/:pistaId/apresentar apresenta ao grupo pela mesma `Mesa.aplicar`, avisando a sala ao vivo
import type { FastifyInstance } from 'fastify';
import type { PistaDoPersonagem } from '@membrana/shared';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi } from '../erros.ts';
import { acessoAo, campanhasDo, carregar, PERSONAGEM_NAO_ENCONTRADO } from './dados.ts';

export function rotasDePistasDoPersonagem(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/personagens/:id/pistas', (request) => {
    const linha = carregar(app.db, request.params.id);
    const usuario = usuarioLogado(request);
    const acesso = acessoAo(app.db, usuario, linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.podeVer) {
      throw new ErroDaApi(
        403,
        'FICHA_OCULTA',
        'Neste caso, o mestre não deixou os jogadores verem as fichas uns dos outros.',
      );
    }

    const podeVerSecretas = acesso.ehDono || acesso.podeEditar;
    const pistas: PistaDoPersonagem[] = [];
    const vistas = new Set<string>();

    for (const campanhaId of campanhasDo(app.db, linha.personagem)) {
      const mesa = app.mesas.obter(campanhaId);
      for (const posse of mesa.estado.comAlguem) {
        if (posse.personagemId !== linha.personagem.id) continue;
        if (!podeVerSecretas && !posse.apresentada) continue;
        if (vistas.has(posse.pistaId)) continue;
        const pista = mesa.estado.pistas.find((p) => p.id === posse.pistaId);
        const titulo = pista?.titulo ?? posse.titulo;
        const texto = pista?.texto ?? posse.texto;
        const imagem = pista !== undefined ? (pista.imagem ?? null) : (posse.imagem ?? null);
        if (titulo === undefined || texto === undefined) continue;
        vistas.add(posse.pistaId);
        pistas.push({
          id: posse.pistaId,
          campanhaId,
          titulo,
          texto,
          imagem,
          apresentada: posse.apresentada,
          em: posse.em,
        });
      }
    }

    return { pistas };
  });

  app.post<{ Params: { id: string; pistaId: string } }>(
    '/personagens/:id/pistas/:pistaId/apresentar',
    (request) => {
      const linha = carregar(app.db, request.params.id);
      const usuario = usuarioLogado(request);
      const acesso = acessoAo(app.db, usuario, linha);
      if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
      if (!acesso.ehDono) {
        throw new ErroDaApi(
          403,
          'SO_O_DONO',
          'Só quem joga com este personagem pode apresentar as pistas dele.',
        );
      }

      const { pistaId } = request.params;
      const campanhaId = campanhasDo(app.db, linha.personagem).find((cid) =>
        app.mesas
          .obter(cid)
          .estado.comAlguem.some(
            (c) => c.pistaId === pistaId && c.personagemId === linha.personagem.id,
          ),
      );
      if (!campanhaId) {
        throw new ErroDaApi(
          404,
          'PISTA_NAO_ENCONTRADA',
          'Esta pista não está no inventário deste personagem.',
        );
      }

      const mesa = app.mesas.obter(campanhaId);
      const r = mesa.aplicar(usuario, { type: 'clue.present', pistaId });
      if (!r.ok) throw new ErroDaApi(400, 'DADOS_INVALIDOS', r.motivo);

      app.mesa.emitir({
        type: 'mesa.aplicados',
        campanhaId,
        eventos: r.eventos,
        antes: r.antes,
        depois: r.depois,
      });

      const apresentado = r.eventos.find((e) => e.type === 'clue.presented');
      const item = apresentado?.item;
      return {
        pista: {
          id: pistaId,
          campanhaId,
          titulo: item?.titulo ?? 'Pista',
          texto: item?.texto ?? '',
          imagem: item?.imagem ?? null,
          apresentada: true,
          em: item?.em ?? new Date().toISOString(),
        } satisfies PistaDoPersonagem,
      };
    },
  );
}
