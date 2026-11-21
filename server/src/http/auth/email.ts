// Cadastro e entrada por e-mail e senha. A sessão é a mesma do Discord (sessao.ts).
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { esquemaCadastro, esquemaEntrar } from '@membrana/shared';
import type { Banco } from '../../db/index.ts';
import { identities, users } from '../../db/schema.ts';
import { ErroDaApi, validar } from '../erros.ts';
import { conferirSenha, gerarHash, hashParaComparar } from './senha.ts';
import { criarSessao, gravarCookie } from './sessao.ts';

/** #14: cinco tentativas por minuto, contadas por IP e, à parte, por e-mail. */
export const LIMITE_DE_TENTATIVAS = 5;
export const JANELA_DAS_TENTATIVAS_MS = 60_000;

const MUITAS_TENTATIVAS = new ErroDaApi(
  429,
  'MUITAS_TENTATIVAS',
  'Depois de 5 tentativas, espere 1 minuto.',
);

const CREDENCIAIS = new ErroDaApi(401, 'CREDENCIAIS', 'E-mail ou senha não conferem.');

function emailDoCorpo(request: FastifyRequest): string {
  const corpo = request.body as { email?: unknown } | undefined;
  return typeof corpo?.email === 'string' ? corpo.email.trim().toLowerCase() : '';
}

function contaPorEmail(db: Banco, email: string) {
  return db
    .select({ id: users.id, nome: users.nome, email: users.email, hash: identities.senhaHash })
    .from(identities)
    .innerJoin(users, eq(users.id, identities.userId))
    .where(and(eq(identities.provedor, 'email'), eq(identities.idExterno, email)))
    .get();
}

function emailEmUso(db: Banco, email: string): boolean {
  const naConta = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  return Boolean(naConta) || Boolean(contaPorEmail(db, email));
}

export function rotasDeEmail(app: FastifyInstance) {
  const porIp = app.createRateLimit({
    max: LIMITE_DE_TENTATIVAS,
    timeWindow: JANELA_DAS_TENTATIVAS_MS,
    keyGenerator: (request) => `entrar:ip:${request.ip}`,
  });
  const porEmail = app.createRateLimit({
    max: LIMITE_DE_TENTATIVAS,
    timeWindow: JANELA_DAS_TENTATIVAS_MS,
    keyGenerator: (request) => `entrar:email:${emailDoCorpo(request)}`,
  });

  /** Conta a tentativa nos dois limites; passou de 5 em qualquer um, 429. */
  async function limitarTentativas(request: FastifyRequest) {
    // `isExceeded` diz se estourou; `isAllowed` é só a lista de liberados do plugin.
    const resultados = await Promise.all([porIp(request), porEmail(request)]);
    if (resultados.some((r) => !r.isAllowed && r.isExceeded)) throw MUITAS_TENTATIVAS;
  }

  app.post('/auth/cadastro', async (request, reply) => {
    const dados = validar(esquemaCadastro, request.body);
    if (emailEmUso(app.db, dados.email)) {
      throw new ErroDaApi(409, 'EMAIL_EM_USO', 'Este e-mail já tem conta.', {
        email: 'Este e-mail já tem conta. Entre com ele ou com o Discord.',
      });
    }

    const senhaHash = await gerarHash(dados.senha);
    const usuario = app.db.transaction((tx) => {
      const criado = tx
        .insert(users)
        .values({ nome: dados.nome, email: dados.email })
        .returning({ id: users.id, nome: users.nome, email: users.email })
        .get();
      tx.insert(identities)
        .values({ userId: criado.id, provedor: 'email', idExterno: dados.email, senhaHash })
        .run();
      return criado;
    });

    gravarCookie(reply, app.config, criarSessao(app.db, usuario.id, dados.manter), dados.manter);
    return reply.status(201).send({ usuario });
  });

  app.post('/auth/entrar', { preHandler: limitarTentativas }, async (request, reply) => {
    const dados = validar(esquemaEntrar, request.body);
    const conta = contaPorEmail(app.db, dados.email);

    // Sem conta, confere contra um hash qualquer: a resposta leva o mesmo tempo e não revela
    // se o e-mail existe. A mensagem é a mesma para e-mail e para senha errados.
    const confere = await conferirSenha(dados.senha, conta?.hash ?? (await hashParaComparar()));
    if (!conta || !confere) throw CREDENCIAIS;

    const usuario = { id: conta.id, nome: conta.nome, email: conta.email };
    gravarCookie(reply, app.config, criarSessao(app.db, conta.id, dados.manter), dados.manter);
    return { usuario };
  });
}
