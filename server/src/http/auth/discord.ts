// Entrar com Discord (OAuth 2, escopos identify e email).
// 1. GET /api/auth/discord: gera o `state`, guarda num cookie assinado e manda para o Discord.
// 2. GET /api/auth/discord/callback: confere o `state`, troca o código pelo perfil,
//    acha ou cria a conta, abre a sessão e volta para a página de onde a pessoa veio.
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Config } from '../../config.ts';
import type { Banco } from '../../db/index.ts';
import { identities, users } from '../../db/schema.ts';
import { criarSessao, gravarCookie } from './sessao.ts';

export interface PerfilDiscord {
  id: string;
  nome: string;
  email: string | null;
  emailVerificado: boolean;
}

/** O que o servidor precisa do Discord. Nos testes, entra um falso no lugar. */
export interface ClienteDiscord {
  urlDeAutorizacao(state: string, redirectUri: string): string;
  trocarCodigo(codigo: string, redirectUri: string): Promise<PerfilDiscord>;
}

const API = 'https://discord.com/api/v10';

const respostaDoToken = z.object({ access_token: z.string() });
const respostaDoPerfil = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullish(),
  email: z.string().nullish(),
  verified: z.boolean().nullish(),
});

export function clienteDiscordReal(clientId: string, clientSecret: string): ClienteDiscord {
  return {
    urlDeAutorizacao(state, redirectUri) {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'identify email',
        state,
        redirect_uri: redirectUri,
        prompt: 'none', // quem já autorizou antes não vê a tela de consentimento de novo
      });
      return `https://discord.com/oauth2/authorize?${params.toString()}`;
    },

    async trocarCodigo(codigo, redirectUri) {
      const token = await fetch(`${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: codigo,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!token.ok) throw new Error(`Discord recusou o código (${String(token.status)})`);
      const { access_token } = respostaDoToken.parse(await token.json());

      const perfil = await fetch(`${API}/users/@me`, {
        headers: { authorization: `Bearer ${access_token}` },
      });
      if (!perfil.ok) throw new Error(`Discord não devolveu o perfil (${String(perfil.status)})`);
      const dados = respostaDoPerfil.parse(await perfil.json());
      return {
        id: dados.id,
        nome: dados.global_name ?? dados.username,
        email: dados.email?.toLowerCase() ?? null,
        emailVerificado: dados.verified === true,
      };
    },
  };
}

/**
 * Acha a conta ligada a este Discord. Se não houver, liga a uma conta que já use o mesmo
 * e-mail (só se o Discord confirmou o e-mail) ou cria uma conta nova.
 */
export function contaDoDiscord(db: Banco, perfil: PerfilDiscord): string {
  return db.transaction((tx) => {
    const [ligada] = tx
      .select({ userId: identities.userId })
      .from(identities)
      .where(and(eq(identities.provedor, 'discord'), eq(identities.idExterno, perfil.id)))
      .all();
    if (ligada) return ligada.userId;

    const email = perfil.emailVerificado ? perfil.email : null;
    const [mesmoEmail] = email
      ? tx.select({ id: users.id }).from(users).where(eq(users.email, email)).all()
      : [];
    const userId =
      mesmoEmail?.id ??
      tx.insert(users).values({ nome: perfil.nome, email }).returning({ id: users.id }).get().id;

    tx.insert(identities).values({ userId, provedor: 'discord', idExterno: perfil.id }).run();
    return userId;
  });
}

const COOKIE_DO_OAUTH = 'limiar_oauth';
const CAMINHO_DO_OAUTH = '/api/auth/discord';

const estadoGuardado = z.object({ state: z.string(), manter: z.boolean(), voltar: z.string() });

/** Só caminhos deste site: "/casos/1" sim; "//outro.com" e "https://…" não (redirecionamento aberto). */
export function caminhoSeguro(voltar: unknown): string {
  return typeof voltar === 'string' && /^\/(?![/\\])/.test(voltar) ? voltar : '/';
}

function voltarParaEntrar(reply: FastifyReply, erro: string) {
  return reply.redirect(`/entrar?erro=${erro}`);
}

export function rotasDoDiscord(
  app: FastifyInstance,
  config: Config,
  discord: ClienteDiscord | null,
) {
  const redirectUri = `${config.BASE_URL}${CAMINHO_DO_OAUTH}/callback`;
  const cookieDoOauth = {
    path: CAMINHO_DO_OAUTH,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production',
    signed: true,
  };

  app.get<{ Querystring: { manter?: string; voltar?: string } }>(
    '/auth/discord',
    (request, reply) => {
      if (!discord) return voltarParaEntrar(reply, 'discord-indisponivel');

      const state = randomBytes(16).toString('base64url');
      const guardado = {
        state,
        manter: request.query.manter === '1',
        voltar: caminhoSeguro(request.query.voltar),
      };
      reply.setCookie(COOKIE_DO_OAUTH, JSON.stringify(guardado), { ...cookieDoOauth, maxAge: 600 });
      return reply.redirect(discord.urlDeAutorizacao(state, redirectUri));
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/auth/discord/callback',
    async (request, reply) => {
      const bruto = request.cookies[COOKIE_DO_OAUTH];
      reply.clearCookie(COOKIE_DO_OAUTH, cookieDoOauth);
      if (!discord) return voltarParaEntrar(reply, 'discord-indisponivel');

      // O cookie é assinado: se alguém mexeu nele, `valid` vem falso.
      const assinado = bruto ? request.unsignCookie(bruto) : null;
      const guardado =
        assinado?.valid && assinado.value
          ? estadoGuardado.safeParse(JSON.parse(assinado.value))
          : null;
      if (!guardado?.success || guardado.data.state !== request.query.state) {
        request.log.warn('login com Discord recusado: state ausente ou diferente');
        return voltarParaEntrar(reply, 'estado-invalido');
      }
      if (request.query.error || !request.query.code) {
        return voltarParaEntrar(reply, 'discord-cancelado');
      }

      let perfil: PerfilDiscord;
      try {
        perfil = await discord.trocarCodigo(request.query.code, redirectUri);
      } catch (erro) {
        request.log.error({ err: erro }, 'falha ao falar com o Discord');
        return voltarParaEntrar(reply, 'discord-falhou');
      }

      const userId = contaDoDiscord(app.db, perfil);
      const token = criarSessao(app.db, userId, guardado.data.manter);
      gravarCookie(reply, config, token, guardado.data.manter);
      return reply.redirect(guardado.data.voltar);
    },
  );
}
