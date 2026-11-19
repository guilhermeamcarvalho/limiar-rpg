// Sessão por cookie: vale para o login por Discord e por e-mail.
// O cookie leva um token aleatório; o banco guarda só o hash dele, com dono e validade.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../../config.ts';
import type { Banco } from '../../db/index.ts';
import { sessions, users } from '../../db/schema.ts';
import { ErroDaApi } from '../erros.ts';

export const COOKIE_DA_SESSAO = 'limiar_sessao';

const DIA = 24 * 60 * 60 * 1000;
/** Com "manter conectado": 30 dias, renovados quando passar da metade. */
export const DURACAO_LONGA_MS = 30 * DIA;
/** Sem "manter conectado": o cookie some ao fechar o navegador, e o servidor aceita no máximo 1 dia. */
export const DURACAO_CURTA_MS = DIA;

export interface Usuario {
  id: string;
  nome: string;
  email: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Quem está logado nesta requisição, ou `null`. Preenchido antes de qualquer rota. */
    usuario: Usuario | null;
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export function criarSessao(db: Banco, userId: string, manter: boolean, agora = Date.now()) {
  // Aproveita para limpar as vencidas: são poucas, e assim a tabela não cresce à toa.
  db.delete(sessions)
    .where(lt(sessions.expiraEm, new Date(agora)))
    .run();

  const token = randomBytes(32).toString('base64url');
  db.insert(sessions)
    .values({
      id: hash(token),
      userId,
      manter,
      expiraEm: new Date(agora + (manter ? DURACAO_LONGA_MS : DURACAO_CURTA_MS)),
    })
    .run();
  return token;
}

/** Dono da sessão, se ela existir e não tiver vencido. Renova as longas que passaram da metade. */
export function buscarSessao(db: Banco, token: string, agora = Date.now()): Usuario | null {
  const id = hash(token);
  const [achada] = db
    .select({
      usuario: { id: users.id, nome: users.nome, email: users.email },
      expiraEm: sessions.expiraEm,
      manter: sessions.manter,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiraEm, new Date(agora))))
    .all();
  if (!achada) return null;

  if (achada.manter && achada.expiraEm.getTime() - agora < DURACAO_LONGA_MS / 2) {
    db.update(sessions)
      .set({ expiraEm: new Date(agora + DURACAO_LONGA_MS) })
      .where(eq(sessions.id, id))
      .run();
  }
  return achada.usuario;
}

export function apagarSessao(db: Banco, token: string) {
  db.delete(sessions)
    .where(eq(sessions.id, hash(token)))
    .run();
}

function opcoesDoCookie(config: Config) {
  return {
    path: '/',
    httpOnly: true, // JavaScript da página não lê o cookie
    sameSite: 'lax' as const, // outro site não manda o cookie num POST
    secure: config.NODE_ENV === 'production',
  };
}

export function gravarCookie(reply: FastifyReply, config: Config, token: string, manter: boolean) {
  reply.setCookie(COOKIE_DA_SESSAO, token, {
    ...opcoesDoCookie(config),
    // Sem maxAge, é cookie de sessão do navegador: some ao fechá-lo.
    ...(manter && { maxAge: DURACAO_LONGA_MS / 1000 }),
  });
}

export function limparCookie(reply: FastifyReply, config: Config) {
  reply.clearCookie(COOKIE_DA_SESSAO, opcoesDoCookie(config));
}

/** Preenche `request.usuario` em toda requisição que trouxer o cookie. */
export function registrarSessao(app: FastifyInstance) {
  app.decorateRequest('usuario', null);
  app.addHook('onRequest', (request, _reply, pronto) => {
    const token = request.cookies[COOKIE_DA_SESSAO];
    request.usuario = token ? buscarSessao(app.db, token) : null;
    pronto();
  });
}

/** Use como `preHandler` nas rotas que exigem login: sem sessão válida, responde 401. */
export function exigirLogin(request: FastifyRequest) {
  if (!request.usuario) {
    throw new ErroDaApi(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.');
  }
  return Promise.resolve();
}

/** O usuário logado, em rota que já passou pelo `exigirLogin`. */
export function usuarioLogado(request: FastifyRequest): Usuario {
  if (!request.usuario) {
    throw new ErroDaApi(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.');
  }
  return request.usuario;
}
