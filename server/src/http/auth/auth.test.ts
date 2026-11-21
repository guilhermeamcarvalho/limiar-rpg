import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { schema } from '../../db/index.ts';
import { appDeTeste } from '../../teste/apoio.ts';
import { caminhoSeguro, type ClienteDiscord, type PerfilDiscord } from './discord.ts';
import { buscarSessao, criarSessao, DURACAO_LONGA_MS } from './sessao.ts';

const MARTA: PerfilDiscord = {
  id: '111',
  nome: 'Marta',
  email: 'marta@exemplo.com',
  emailVerificado: true,
};

/** Discord falso: aceita o código "bom" e devolve o perfil configurado. */
function discordFalso(perfil: PerfilDiscord = MARTA): ClienteDiscord {
  return {
    urlDeAutorizacao: (state) => `https://discord.test/autorizar?state=${state}`,
    trocarCodigo: (codigo) =>
      codigo === 'bom' ? Promise.resolve(perfil) : Promise.reject(new Error('código ruim')),
  };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function montar(opcoes: Parameters<typeof appDeTeste>[0] = { discord: discordFalso() }) {
  app = await appDeTeste(opcoes);
  await app.ready();
  return app;
}

/** Valor e atributos de um cookie na resposta. */
function cookie(resposta: LightMyRequestResponse, nome: string) {
  return resposta.cookies.find((c) => c.name === nome);
}

/** Começa o login e devolve o state e o cookie que o navegador guardaria. */
async function comecar(a: FastifyInstance, query = '') {
  const inicio = await a.inject({ method: 'GET', url: `/api/auth/discord${query}` });
  const local = new URL(String(inicio.headers.location));
  const oauth = cookie(inicio, 'membrana_oauth');
  return { inicio, state: local.searchParams.get('state') ?? '', oauth: oauth?.value ?? '' };
}

/** Faz o login inteiro e devolve a resposta do callback. */
async function entrar(a: FastifyInstance, query = '', codigo = 'bom') {
  const { state, oauth } = await comecar(a, query);
  return a.inject({
    method: 'GET',
    url: `/api/auth/discord/callback?code=${codigo}&state=${state}`,
    cookies: { membrana_oauth: oauth },
  });
}

function me(a: FastifyInstance, sessao: string) {
  return a.inject({ method: 'GET', url: '/api/me', cookies: { membrana_sessao: sessao } });
}

describe('GET /api/auth/discord', () => {
  it('manda para o Discord com um state e guarda o state num cookie httpOnly e assinado', async () => {
    const { inicio, state, oauth } = await comecar(await montar());

    expect(inicio.statusCode).toBe(302);
    expect(inicio.headers.location).toMatch(/^https:\/\/discord\.test\/autorizar\?state=/);
    expect(state.length).toBeGreaterThanOrEqual(20);
    expect(cookie(inicio, 'membrana_oauth')?.httpOnly).toBe(true);
    // Assinado (não cifrado): o valor segue visível, com a assinatura no fim. Adulterar invalida.
    expect(oauth).toMatch(/\}\.\S+$/);
  });

  it('sem Discord configurado, volta para /entrar avisando', async () => {
    const a = await montar({ discord: null });

    const resposta = await a.inject({ method: 'GET', url: '/api/auth/discord' });

    expect(resposta.headers.location).toBe('/entrar?erro=discord-indisponivel');
    expect((await a.inject({ method: 'GET', url: '/api/auth/opcoes' })).json()).toEqual({
      discord: false,
    });
  });
});

describe('GET /api/auth/discord/callback', () => {
  it('entrar leva à Central com cookie de sessão httpOnly e SameSite=Lax', async () => {
    const a = await montar();

    const resposta = await entrar(a);

    expect(resposta.statusCode).toBe(302);
    expect(resposta.headers.location).toBe('/');
    const sessao = cookie(resposta, 'membrana_sessao');
    expect(sessao?.httpOnly).toBe(true);
    expect(sessao?.sameSite).toBe('Lax');
    expect(sessao?.path).toBe('/');
    expect(sessao?.maxAge).toBeUndefined(); // sem "manter conectado": some ao fechar o navegador

    const eu = await me(a, sessao?.value ?? '');
    expect(eu.statusCode).toBe(200);
    expect(eu.json()).toEqual({
      usuario: { id: expect.stringMatching(/^usr_/) as string, nome: 'Marta', email: MARTA.email },
    });
  });

  it('volta à página de onde a pessoa veio', async () => {
    const resposta = await entrar(await montar(), '?voltar=/casos/cmp_1');

    expect(resposta.headers.location).toBe('/casos/cmp_1');
  });

  it('"manter conectado" dá cookie de 30 dias', async () => {
    const resposta = await entrar(await montar(), '?manter=1');

    expect(cookie(resposta, 'membrana_sessao')?.maxAge).toBe(DURACAO_LONGA_MS / 1000);
  });

  it('recusa state diferente do guardado', async () => {
    const a = await montar();
    const { oauth } = await comecar(a);

    const resposta = await a.inject({
      method: 'GET',
      url: '/api/auth/discord/callback?code=bom&state=forjado',
      cookies: { membrana_oauth: oauth },
    });

    expect(resposta.headers.location).toBe('/entrar?erro=estado-invalido');
    expect(cookie(resposta, 'membrana_sessao')).toBeUndefined();
    expect(a.db.select().from(schema.sessions).all()).toHaveLength(0);
  });

  it('recusa callback sem o cookie do state (outra aba, outro navegador, ataque)', async () => {
    const a = await montar();
    const { state } = await comecar(a);

    const resposta = await a.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?code=bom&state=${state}`,
    });

    expect(resposta.headers.location).toBe('/entrar?erro=estado-invalido');
  });

  it('recusa cookie do state adulterado', async () => {
    const a = await montar();
    const { state } = await comecar(a);
    const falso = JSON.stringify({ state, manter: true, voltar: '/' });

    const resposta = await a.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?code=bom&state=${state}`,
      cookies: { membrana_oauth: falso },
    });

    expect(resposta.headers.location).toBe('/entrar?erro=estado-invalido');
  });

  it('quem cancela no Discord volta para /entrar', async () => {
    const a = await montar();
    const { state, oauth } = await comecar(a);

    const resposta = await a.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?error=access_denied&state=${state}`,
      cookies: { membrana_oauth: oauth },
    });

    expect(resposta.headers.location).toBe('/entrar?erro=discord-cancelado');
  });

  it('se o Discord falhar, volta para /entrar sem sessão', async () => {
    const resposta = await entrar(await montar(), '', 'ruim');

    expect(resposta.headers.location).toBe('/entrar?erro=discord-falhou');
    expect(cookie(resposta, 'membrana_sessao')).toBeUndefined();
  });
});

describe('conta', () => {
  it('entrar de novo com o mesmo Discord usa a mesma conta', async () => {
    const a = await montar();

    await entrar(a);
    await entrar(a);

    expect(a.db.select().from(schema.users).all()).toHaveLength(1);
  });

  it('liga a uma conta que já tem o mesmo e-mail, se o Discord confirmou o e-mail', async () => {
    const a = await montar();
    a.db.insert(schema.users).values({ nome: 'Marta Q.', email: MARTA.email }).run();

    await entrar(a);

    const contas = a.db.select().from(schema.users).all();
    expect(contas).toHaveLength(1);
    expect(a.db.select().from(schema.identities).all()).toHaveLength(1);
  });

  it('e-mail não confirmado no Discord não liga conta nem é guardado', async () => {
    const a = await montar({ discord: discordFalso({ ...MARTA, emailVerificado: false }) });
    a.db.insert(schema.users).values({ nome: 'Outra', email: MARTA.email }).run();

    await entrar(a);

    const contas = a.db.select().from(schema.users).all();
    expect(contas).toHaveLength(2);
    expect(contas.find((c) => c.nome === 'Marta')?.email).toBeNull();
  });
});

describe('sessão', () => {
  it('GET /api/me sem sessão responde 401', async () => {
    const resposta = await (await montar()).inject({ method: 'GET', url: '/api/me' });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ erro: { codigo: 'NAO_AUTENTICADO' } });
  });

  it('sair apaga a sessão no servidor: o cookie antigo não vale mais', async () => {
    const a = await montar();
    const token = cookie(await entrar(a), 'membrana_sessao')?.value ?? '';

    const saida = await a.inject({
      method: 'POST',
      url: '/api/auth/sair',
      cookies: { membrana_sessao: token },
    });

    expect(saida.statusCode).toBe(204);
    expect(cookie(saida, 'membrana_sessao')?.value).toBe('');
    expect(a.db.select().from(schema.sessions).all()).toHaveLength(0);
    expect((await me(a, token)).statusCode).toBe(401);
  });

  it('o banco guarda só o hash do token, nunca o token', async () => {
    const a = await montar();
    const token = cookie(await entrar(a), 'membrana_sessao')?.value ?? '';

    const [guardada] = a.db.select().from(schema.sessions).all();
    expect(guardada?.id).not.toBe(token);
    expect(guardada?.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sessão vencida não vale; a longa é renovada quando passa da metade', async () => {
    const a = await montar();
    const [conta] = a.db.insert(schema.users).values({ nome: 'Ana' }).returning().all();
    const agora = Date.now();
    const curta = criarSessao(a.db, conta?.id ?? '', false, agora);
    const longa = criarSessao(a.db, conta?.id ?? '', true, agora);

    expect(buscarSessao(a.db, curta, agora + 2 * 24 * 3600_000)).toBeNull();

    const depois = agora + 20 * 24 * 3600_000; // 20 dias: passou da metade dos 30
    expect(buscarSessao(a.db, longa, depois)?.nome).toBe('Ana');
    expect(buscarSessao(a.db, longa, depois + 25 * 24 * 3600_000)?.nome).toBe('Ana');
  });

  it('em produção o cookie é Secure', async () => {
    const a = await montar({ discord: discordFalso(), env: { NODE_ENV: 'production' } });

    expect(cookie(await entrar(a), 'membrana_sessao')?.secure).toBe(true);
  });
});

describe('caminhoSeguro', () => {
  it.each([
    ['/casos/1', '/casos/1'],
    ['/', '/'],
    ['//malicioso.com', '/'],
    ['/\\malicioso.com', '/'],
    ['https://malicioso.com', '/'],
    ['casos', '/'],
    [undefined, '/'],
  ])('%s → %s', (entrada, saida) => {
    expect(caminhoSeguro(entrada)).toBe(saida);
  });
});
