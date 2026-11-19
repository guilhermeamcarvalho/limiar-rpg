// Convites. Registrado com o prefixo /api.
//   POST /api/campanhas/:id/convites      o mestre cria (vagas, validade)
//   GET  /api/convites/:codigo            qualquer um com o código vê o cartão do convite
//   POST /api/convites/:codigo/aceitar    quem está logado entra no caso como jogador
import { randomInt } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  esquemaNovoConvite,
  normalizarCodigo,
  podeConvidar,
  type ConvitePublico,
  type EstadoDoConvite,
} from '@limiar/shared';
import type { Banco } from '../../db/index.ts';
import { campaigns, gameSystems, invites, memberships, users } from '../../db/schema.ts';
import { exigirLogin, usuarioLogado } from '../auth/sessao.ts';
import { campanhaVisivel, convitesDoMestre } from '../campanhas/dados.ts';
import { ErroDaApi, validar } from '../erros.ts';

const DIA = 24 * 60 * 60 * 1000;

/** Sem letras e números que se confundem (0/O, 1/I/L): a pessoa pode ditar o código. */
const SUFIXO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PALAVRAS_VAZIAS = new Set([
  'DE',
  'DA',
  'DO',
  'DAS',
  'DOS',
  'NO',
  'NA',
  'NOS',
  'NAS',
  'UM',
  'UMA',
]);

/** A palavra mais longa do nome, sem acento: "O Sinal de Santa Ermida" → ERMIDA. */
export function palavraDoNome(nome: string): string {
  const palavras = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p));
  const maior = palavras.reduce((a, b) => (b.length >= a.length ? b : a), '');
  return (maior || 'CASO').slice(0, 8);
}

export function gerarCodigo(nome: string): string {
  const sufixo = Array.from({ length: 4 }, () => SUFIXO[randomInt(SUFIXO.length)]).join('');
  return `${palavraDoNome(nome)}-${sufixo}`;
}

const NAO_ENCONTRADO = new ErroDaApi(
  404,
  'CONVITE_NAO_ENCONTRADO',
  'Código não encontrado. Confira com o mestre.',
  { codigo: 'Código não encontrado. Confira com o mestre.' },
);

function estado(convite: { vagas: number; usados: number; expiraEm: Date }, agora: number) {
  if (convite.expiraEm.getTime() <= agora) return 'expirado' satisfies EstadoDoConvite;
  if (convite.usados >= convite.vagas) return 'esgotado' satisfies EstadoDoConvite;
  return 'valido' satisfies EstadoDoConvite;
}

function buscarPorCodigo(db: Banco, codigo: string) {
  return db
    .select({
      convite: invites,
      campanha: {
        id: campaigns.id,
        numero: campaigns.numero,
        nome: campaigns.nome,
        gancho: campaigns.gancho,
        proximaSessao: campaigns.proximaSessao,
      },
      mestre: { nome: users.nome },
      sistema: { nome: gameSystems.nome },
    })
    .from(invites)
    .innerJoin(campaigns, eq(campaigns.id, invites.campaignId))
    .innerJoin(gameSystems, eq(gameSystems.id, campaigns.systemId))
    .innerJoin(users, eq(users.id, campaigns.criadoPor))
    .where(eq(invites.codigo, normalizarCodigo(codigo)))
    .get();
}

function jaParticipa(db: Pick<Banco, 'select'>, campaignId: string, userId: string): boolean {
  return Boolean(
    db
      .select({ papel: memberships.papel })
      .from(memberships)
      .where(and(eq(memberships.campaignId, campaignId), eq(memberships.userId, userId)))
      .get(),
  );
}

export const rotas: FastifyPluginAsync = (app) => {
  // Contra quem tenta adivinhar códigos: 30 consultas por minuto por IP.
  const porIp = app.createRateLimit({
    max: 30,
    timeWindow: 60_000,
    keyGenerator: (request) => `convite:${request.ip}`,
  });
  async function limitar(request: FastifyRequest) {
    const r = await porIp(request);
    if (!r.isAllowed && r.isExceeded) {
      throw new ErroDaApi(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Espere 1 minuto.');
    }
  }

  app.post<{ Params: { id: string } }>(
    '/campanhas/:id/convites',
    { preHandler: exigirLogin },
    (request, reply) => {
      const usuario = usuarioLogado(request);
      const { campanha, comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
      if (!podeConvidar(usuario, comMembros)) {
        throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso pode convidar.');
      }
      const dados = validar(esquemaNovoConvite, request.body ?? {});

      // Código repetido é raríssimo, mas a coluna é única: tenta de novo com outro sufixo.
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const codigo = gerarCodigo(campanha.nome);
        if (app.db.select().from(invites).where(eq(invites.codigo, codigo)).get()) continue;
        app.db
          .insert(invites)
          .values({
            codigo,
            campaignId: campanha.id,
            vagas: dados.vagas,
            expiraEm: new Date(Date.now() + dados.expiraEmDias * DIA),
            criadoPor: usuario.id,
          })
          .run();
        const convite = convitesDoMestre(app.db, campanha.id).find((c) => c.codigo === codigo);
        return reply.status(201).send({ convite, link: `${app.config.BASE_URL}/c/${codigo}` });
      }
      throw new Error('Não deu para gerar um código de convite único');
    },
  );

  app.get<{ Params: { id: string } }>(
    '/campanhas/:id/convites',
    { preHandler: exigirLogin },
    (request) => {
      const usuario = usuarioLogado(request);
      const { comMembros } = campanhaVisivel(app.db, request.params.id, usuario);
      if (!podeConvidar(usuario, comMembros)) {
        throw new ErroDaApi(403, 'SO_O_MESTRE', 'Só o mestre deste caso vê os convites.');
      }
      return { convites: convitesDoMestre(app.db, request.params.id) };
    },
  );

  app.get<{ Params: { codigo: string } }>(
    '/convites/:codigo',
    { preHandler: limitar },
    (request): { convite: ConvitePublico } => {
      const achado = buscarPorCodigo(app.db, request.params.codigo);
      if (!achado) throw NAO_ENCONTRADO;
      const { convite, campanha, mestre, sistema } = achado;
      return {
        convite: {
          codigo: convite.codigo,
          estado: estado(convite, Date.now()),
          vagasRestantes: Math.max(0, convite.vagas - convite.usados),
          campanha: {
            id: campanha.id,
            numero: campanha.numero,
            nome: campanha.nome,
            gancho: campanha.gancho,
          },
          mestre,
          sistema,
          proximaSessao: campanha.proximaSessao?.toISOString() ?? null,
          ...(request.usuario && {
            jaParticipa: jaParticipa(app.db, campanha.id, request.usuario.id),
          }),
        },
      };
    },
  );

  app.post<{ Params: { codigo: string } }>(
    '/convites/:codigo/aceitar',
    { preHandler: [exigirLogin, limitar] },
    (request) => {
      const usuario = usuarioLogado(request);
      const achado = buscarPorCodigo(app.db, request.params.codigo);
      if (!achado) throw NAO_ENCONTRADO;
      const { convite, campanha } = achado;

      // Tudo numa transação: duas pessoas aceitando a última vaga ao mesmo tempo não passam juntas.
      app.db.transaction((tx) => {
        if (jaParticipa(tx, campanha.id, usuario.id)) {
          throw new ErroDaApi(409, 'JA_PARTICIPA', 'Você já está neste caso.');
        }
        const atual = estado(convite, Date.now());
        if (atual === 'expirado') {
          throw new ErroDaApi(
            410,
            'CONVITE_EXPIRADO',
            'Este convite expirou. Peça um novo ao mestre.',
          );
        }
        const ocupou = tx
          .update(invites)
          .set({ usados: sql`${invites.usados} + 1` })
          .where(and(eq(invites.id, convite.id), sql`${invites.usados} < ${invites.vagas}`))
          .run();
        if (atual === 'esgotado' || ocupou.changes === 0) {
          throw new ErroDaApi(
            409,
            'CONVITE_ESGOTADO',
            'As vagas deste convite acabaram. Peça um novo ao mestre.',
          );
        }
        tx.insert(memberships)
          .values({
            campaignId: campanha.id,
            userId: usuario.id,
            papel: 'jogador',
            inviteId: convite.id,
            entrouEm: new Date(),
          })
          .run();
      });

      return { campanha: { id: campanha.id, nome: campanha.nome } };
    },
  );

  return Promise.resolve();
};
