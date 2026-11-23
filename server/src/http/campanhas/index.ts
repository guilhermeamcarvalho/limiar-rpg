// Campanhas (casos). Registrado com o prefixo /api/campanhas. Todas as rotas exigem login.
// Quem cria vira mestre daquele caso; o papel é de cada caso, não da conta.
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { esquemaEdicaoDeCampanha, esquemaNovaCampanha, podeEditarCampanha } from '@membrana/shared';
import type { Banco } from '../../db/index.ts';
import { campaigns, gameSystems, memberships } from '../../db/schema.ts';
import { exigirLogin, usuarioLogado } from '../auth/sessao.ts';
import { inserirConvite } from '../convites/dados.ts';
import { ErroDaApi, validar } from '../erros.ts';
import { rotaMeuPersonagem } from './meu-personagem.ts';
import {
  campanhaVisivel,
  convitesDoMestre,
  detalhar,
  detalharPara,
  listarDoUsuario,
  proximoNumero,
} from './dados.ts';

function exigirSistema(db: Banco, sistemaId: string) {
  const existe = db
    .select({ id: gameSystems.id })
    .from(gameSystems)
    .where(eq(gameSystems.id, sistemaId))
    .get();
  if (!existe) {
    throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', {
      sistemaId: 'Escolha um sistema que exista.',
    });
  }
}

export const rotas: FastifyPluginAsync = (app) => {
  app.addHook('preHandler', exigirLogin);

  app.get('/', (request) => ({ campanhas: listarDoUsuario(app.db, usuarioLogado(request).id) }));

  app.post('/', (request, reply) => {
    const usuario = usuarioLogado(request);
    const dados = validar(esquemaNovaCampanha, request.body);
    exigirSistema(app.db, dados.sistemaId);

    // Campanha, papel de mestre e primeiro convite nascem juntos: nunca existe caso sem mestre,
    // e uma falha no meio não deixa caso pela metade.
    const id = app.db.transaction((tx) => {
      const criada = tx
        .insert(campaigns)
        .values({
          numero: proximoNumero(tx),
          nome: dados.nome,
          gancho: dados.gancho || null,
          systemId: dados.sistemaId,
          tom: dados.tom,
          formato: dados.formato,
          nivelInicial: dados.nivelInicial,
          dtPadrao: dados.dtPadrao,
          rodadas: dados.rodadas,
          dadosFisicos: dados.dadosFisicos,
          fichasVisiveis: dados.fichasVisiveis,
          agenda: dados.agenda ?? null,
          proximaSessao: dados.proximaSessao ?? null,
          criadoPor: usuario.id,
        })
        .returning({ id: campaigns.id })
        .get();
      tx.insert(memberships)
        .values({
          campaignId: criada.id,
          userId: usuario.id,
          papel: 'mestre',
          entrouEm: new Date(),
        })
        .run();
      if (dados.convite) {
        inserirConvite(tx, {
          campaignId: criada.id,
          nomeDoCaso: dados.nome,
          vagas: dados.convite.vagas,
          expiraEmDias: dados.convite.expiraEmDias,
          criadoPor: usuario.id,
        });
      }
      return criada.id;
    });

    return reply.status(201).send({
      campanha: {
        ...detalhar(app.db, id, 'mestre', usuario.id),
        convites: convitesDoMestre(app.db, id),
      },
    });
  });

  app.get<{ Params: { id: string } }>('/:id', (request) => {
    const usuario = usuarioLogado(request);
    const { comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
    // O mestre recebe a mais os convites e quem entrou por cada um.
    return { campanha: detalharPara(app.db, request.params.id, usuario, comMembros) };
  });

  app.patch<{ Params: { id: string } }>('/:id', (request) => {
    const usuario = usuarioLogado(request);
    const { comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
    if (!podeEditarCampanha(usuario, comMembros)) {
      throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso pode mudar isso.');
    }
    const dados = validar(esquemaEdicaoDeCampanha, request.body);
    if (dados.sistemaId !== undefined) exigirSistema(app.db, dados.sistemaId);

    // Só o que veio no pedido muda; o resto do caso fica como está.
    const { sistemaId, gancho, encerrado, ...resto } = dados;
    app.db
      .update(campaigns)
      .set({
        ...resto,
        ...(gancho !== undefined && { gancho: gancho || null }),
        ...(sistemaId !== undefined && { systemId: sistemaId }),
        ...(encerrado !== undefined && { encerradoEm: encerrado ? new Date() : null }),
      })
      .where(eq(campaigns.id, request.params.id))
      .run();
    return {
      campanha: {
        ...detalhar(app.db, request.params.id, 'mestre', usuario.id),
        convites: convitesDoMestre(app.db, request.params.id),
      },
    };
  });

  rotaMeuPersonagem(app);

  return Promise.resolve();
};
