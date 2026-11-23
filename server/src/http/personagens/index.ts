// Personagens. Registrado com o prefixo /api. Todas as rotas exigem login.
//   POST   /api/personagens          cria (num caso ou só na lista de quem criou)
//   GET    /api/me/personagens       os personagens de quem pediu
//   GET    /api/personagens/:id      o dono, o mestre do caso e, se o caso deixar, os outros jogadores
//   PUT    /api/personagens/:id      troca a ficha: o dono ou o mestre do caso
//   DELETE /api/personagens/:id      só o dono; leva junto foto, token e pistas guardadas
//   POST   /api/personagens/:id/testes, GET …/testes   testes de perícia e histórico (testes.ts)
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { esquemaEdicaoDePersonagem, esquemaNovoPersonagem, ID_OP2 } from '@membrana/shared';
import { characters, gameSystems } from '../../db/schema.ts';
import { exigirLogin, usuarioLogado } from '../auth/sessao.ts';
import { campanhaVisivel } from '../campanhas/dados.ts';
import { ErroDaApi, validar } from '../erros.ts';
import { rotasDeTestes } from './testes.ts';
import {
  acessoAo,
  avisarMesa,
  apagarArquivos,
  campanhasDo,
  carregar,
  casoPermiteFisico,
  listarDoDono,
  paraApi,
  PERSONAGEM_NAO_ENCONTRADO,
  usarNoCaso,
  validarFicha,
} from './dados.ts';

/** Num caso que só aceita dados virtuais, a ficha não entra no modo físico (RF-83). */
const FISICO_DESLIGADO = new ErroDaApi(422, 'FICHA_INVALIDA', 'A ficha tem campos inválidos.', {
  'ficha.modoDados': 'O mestre deste caso não permite dados físicos.',
});

/** O sistema escolhido, ou 400 no campo. */
function sistema(app: FastifyInstance, id: string) {
  const linha = app.db
    .select({ id: gameSystems.id, tipo: gameSystems.tipo })
    .from(gameSystems)
    .where(eq(gameSystems.id, id))
    .get();
  if (!linha) {
    throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
      sistemaId: 'Escolha um sistema que exista.',
    });
  }
  return linha;
}

export const rotas: FastifyPluginAsync = (app) => {
  app.addHook('preHandler', exigirLogin);
  rotasDeTestes(app);

  app.post('/personagens', (request, reply) => {
    const usuario = usuarioLogado(request);
    const dados = validar(esquemaNovoPersonagem, request.body);

    // Num caso, o personagem usa o sistema do caso; fora dele, o pedido diz qual.
    let sistemaId = dados.sistemaId ?? ID_OP2;
    const campanhaId = dados.campanhaId ?? null;
    if (campanhaId) {
      const { campanha } = campanhaVisivel(app.db, campanhaId, usuario);
      if (dados.sistemaId !== undefined && dados.sistemaId !== campanha.systemId) {
        throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
          sistemaId: 'O personagem usa o sistema do caso.',
        });
      }
      sistemaId = campanha.systemId;
    }
    const { tipo } = sistema(app, sistemaId);
    const ficha = validarFicha(tipo, dados.ficha);
    if (ficha.modoDados === 'fisico' && !casoPermiteFisico(app.db, campanhaId))
      throw FISICO_DESLIGADO;

    // Criar e pôr em uso no caso vão juntos: não fica personagem criado pela metade.
    const id = app.db.transaction((tx) => {
      const criado = tx
        .insert(characters)
        .values({ ownerId: usuario.id, campaignId: campanhaId, systemId: sistemaId, ficha })
        .returning({ id: characters.id })
        .get();
      if (campanhaId && dados.usarNoCaso) usarNoCaso(tx, campanhaId, usuario.id, criado.id);
      return criado.id;
    });
    if (campanhaId) avisarMesa(app, [campanhaId], id);
    return reply.status(201).send({ personagem: paraApi(carregar(app.db, id)) });
  });

  app.get('/me/personagens', (request) => ({
    personagens: listarDoDono(app.db, usuarioLogado(request).id),
  }));

  app.get<{ Params: { id: string } }>('/personagens/:id', (request) => {
    const linha = carregar(app.db, request.params.id);
    const acesso = acessoAo(app.db, usuarioLogado(request), linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.podeVer) {
      throw new ErroDaApi(
        403,
        'FICHA_OCULTA',
        'Neste caso, o mestre não deixou os jogadores verem as fichas uns dos outros.',
      );
    }
    return { personagem: paraApi(linha) };
  });

  app.put<{ Params: { id: string } }>('/personagens/:id', (request) => {
    const linha = carregar(app.db, request.params.id);
    const acesso = acessoAo(app.db, usuarioLogado(request), linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.podeEditar) {
      throw new ErroDaApi(
        403,
        'SO_O_DONO_OU_MESTRE',
        'Só quem joga com este personagem ou o mestre do caso pode mudar a ficha.',
      );
    }
    const dados = validar(esquemaEdicaoDePersonagem, request.body);
    const ficha = validarFicha(linha.tipo, dados.ficha);
    // Ficha que já estava no modo físico (o caso mudou depois) pode ser salva como está.
    const virouFisica =
      ficha.modoDados === 'fisico' &&
      (linha.personagem.ficha as { modoDados?: unknown }).modoDados !== 'fisico';
    if (virouFisica && !casoPermiteFisico(app.db, linha.personagem.campaignId)) {
      throw FISICO_DESLIGADO;
    }

    app.db
      .update(characters)
      .set({ ficha, atualizadoEm: new Date() })
      .where(eq(characters.id, linha.personagem.id))
      .run();
    avisarMesa(app, campanhasDo(app.db, linha.personagem), linha.personagem.id);
    return { personagem: paraApi(carregar(app.db, linha.personagem.id)) };
  });

  app.delete<{ Params: { id: string } }>('/personagens/:id', async (request, reply) => {
    const linha = carregar(app.db, request.params.id);
    const acesso = acessoAo(app.db, usuarioLogado(request), linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.ehDono) {
      throw new ErroDaApi(403, 'SO_O_DONO', 'Só quem criou o personagem pode removê-lo.');
    }

    const campanhas = campanhasDo(app.db, linha.personagem);
    // Quem o usava num caso fica sem personagem (memberships.character_id vira nulo pela chave
    // estrangeira). As pistas guardadas (clue_holders, Fase 2) saem junto pela mesma via, com
    // ON DELETE CASCADE.
    app.db.delete(characters).where(eq(characters.id, linha.personagem.id)).run();
    await apagarArquivos(app.db, app.config.UPLOADS_DIR, linha.personagem);
    avisarMesa(app, campanhas, linha.personagem.id, true);
    return reply.status(204).send();
  });

  return Promise.resolve();
};
