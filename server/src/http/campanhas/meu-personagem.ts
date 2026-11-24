// PUT /api/campanhas/:id/meu-personagem: com quem a pessoa joga neste caso.
// Substitui o "personagem em uso" do protótipo: a escolha fica em memberships.character_id, uma por
// caso, então trocar aqui não mexe em nenhum outro caso.
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { esquemaMeuPersonagem } from '@membrana/shared';
import { campaigns, characters, gameSystems } from '../../db/schema.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi, validar } from '../erros.ts';
import { usarNoCaso } from '../personagens/dados.ts';
import { campanhaVisivel, detalharPara } from './dados.ts';

function recusa(status: number, codigo: string, mensagem: string) {
  return new ErroDaApi(status, codigo, mensagem, { personagemId: mensagem });
}

/** Registrada dentro das rotas de campanha, que já exigem login. */
export function rotaMeuPersonagem(app: FastifyInstance) {
  app.put<{ Params: { id: string } }>('/:id/meu-personagem', (request) => {
    const usuario = usuarioLogado(request);
    const { campanha, comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
    const { personagemId } = validar(esquemaMeuPersonagem, request.body);

    if (personagemId !== null) {
      const escolhido = app.db
        .select({
          id: characters.id,
          ownerId: characters.ownerId,
          campaignId: characters.campaignId,
          systemId: characters.systemId,
          sistema: gameSystems.nome,
        })
        .from(characters)
        .innerJoin(gameSystems, eq(gameSystems.id, characters.systemId))
        .where(eq(characters.id, personagemId))
        .get();
      if (escolhido?.ownerId !== usuario.id) {
        throw recusa(404, 'PERSONAGEM_NAO_ENCONTRADO', 'Escolha um dos seus personagens.');
      }
      if (escolhido.systemId !== campanha.systemId) {
        const doCaso = app.db
          .select({ nome: gameSystems.nome })
          .from(gameSystems)
          .where(eq(gameSystems.id, campanha.systemId))
          .get();
        throw recusa(
          409,
          'SISTEMA_DIFERENTE',
          `Este personagem é de ${escolhido.sistema}, e este caso usa ${doCaso?.nome ?? 'outro sistema'}. ` +
            'Escolha um personagem do mesmo sistema.',
        );
      }
      if (escolhido.campaignId !== null && escolhido.campaignId !== campanha.id) {
        const outro = app.db
          .select({ nome: campaigns.nome })
          .from(campaigns)
          .where(eq(campaigns.id, escolhido.campaignId))
          .get();
        throw recusa(
          409,
          'PERSONAGEM_EM_OUTRO_CASO',
          `Este personagem já joga em "${outro?.nome ?? 'outro caso'}". Escolha outro ou crie um novo.`,
        );
      }
    }

    app.db.transaction((tx) => {
      // Personagem solto passa a pertencer ao caso: assim o mestre dele pode ver e editar a ficha.
      if (personagemId !== null) {
        tx.update(characters)
          .set({ campaignId: campanha.id })
          .where(eq(characters.id, personagemId))
          .run();
      }
      usarNoCaso(tx, campanha.id, usuario.id, personagemId);
    });

    return { campanha: detalharPara(app.db, campanha.id, usuario, comMembros, app.presenca) };
  });
}
