// GET /api/campanhas/:id/registro: devolve os eventos importantes da sessão (`session_log`)
// filtrados pelo papel de quem pediu (`projetarRegistro`), mais os personagens do caso para
// identificar autores, avatares e pistas na mesa (#72).
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { RespostaDoRegistro } from '@membrana/shared';
import { memberships } from '../../db/schema.ts';
import { lerRegistroDaSessao, personagensNaMesa } from '../../mesa/dados.ts';
import { projetarRegistro, type Espectador } from '../../mesa/projecao.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { campanhaVisivel } from './dados.ts';

export function rotaRegistro(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/:id/registro', (request): RespostaDoRegistro => {
    const usuario = usuarioLogado(request);
    const campanhaId = request.params.id;
    campanhaVisivel(app.db, campanhaId, usuario);

    const participacao = app.db
      .select({ papel: memberships.papel, personagemId: memberships.characterId })
      .from(memberships)
      .where(and(eq(memberships.campaignId, campanhaId), eq(memberships.userId, usuario.id)))
      .get();

    const quem: Espectador = {
      id: usuario.id,
      papel: participacao?.papel ?? 'jogador',
      personagemId: participacao?.personagemId ?? null,
    };

    return {
      eventos: projetarRegistro(quem, lerRegistroDaSessao(app.db, campanhaId)),
      personagens: personagensNaMesa(app.db, campanhaId),
    };
  });
}
