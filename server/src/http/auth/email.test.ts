import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { schema } from '../../db/index.ts';
import { redefinirSenha, senhaProvisoria } from '../../scripts/reset-senha.ts';
import { appDeTeste } from '../../teste/apoio.ts';
import { JANELA_DAS_TENTATIVAS_MS, LIMITE_DE_TENTATIVAS } from './email.ts';
import { conferirSenha, gerarHash } from './senha.ts';

const MARTA = {
  nome: 'Marta Quintela',
  email: 'marta@exemplo.com',
  senha: 'mare-de-concreto',
  aceite: true,
};

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
  app = undefined;
});

async function montar() {
  app = await appDeTeste({ discord: null });
  await app.ready();
  return app;
}

function cadastrar(a: FastifyInstance, dados: Record<string, unknown> = MARTA) {
  return a.inject({ method: 'POST', url: '/api/auth/cadastro', payload: dados });
}

function entrar(a: FastifyInstance, email: string, senha: string, ip = '10.0.0.1') {
  return a.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, senha },
    remoteAddress: ip,
  });
}

const sessao = (r: { cookies: { name: string; value: string }[] }) =>
  r.cookies.find((c) => c.name === 'membrana_sessao')?.value;

describe('senha', () => {
  it('gera Argon2id no formato padrão e confere', async () => {
    const hash = await gerarHash('mare-de-concreto');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
    expect(await conferirSenha('mare-de-concreto', hash)).toBe(true);
    expect(await conferirSenha('outra-senha-qualquer', hash)).toBe(false);
    expect(await conferirSenha('mare-de-concreto', 'lixo')).toBe(false);
  });

  it('a mesma senha gera hashes diferentes (sal aleatório)', async () => {
    expect(await gerarHash('igual-igual')).not.toBe(await gerarHash('igual-igual'));
  });
});

describe('POST /api/auth/cadastro', () => {
  it('cria a conta, guarda só o hash e já entra', async () => {
    const a = await montar();

    const resposta = await cadastrar(a);

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json()).toEqual({
      usuario: {
        id: expect.stringMatching(/^usr_/) as string,
        nome: MARTA.nome,
        email: MARTA.email,
      },
    });
    expect(resposta.body).not.toContain(MARTA.senha);
    const [identidade] = a.db.select().from(schema.identities).all();
    expect(identidade?.senhaHash).toMatch(/^\$argon2id\$/);
    expect(identidade?.senhaHash).not.toContain(MARTA.senha);

    const eu = await a.inject({
      method: 'GET',
      url: '/api/me',
      cookies: { membrana_sessao: sessao(resposta) ?? '' },
    });
    expect(eu.statusCode).toBe(200);
  });

  it('e-mail já usado dá erro claro no campo e-mail', async () => {
    const a = await montar();
    await cadastrar(a);

    const resposta = await cadastrar(a, { ...MARTA, email: 'MARTA@exemplo.com', nome: 'Outra' });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({
      erro: {
        codigo: 'EMAIL_EM_USO',
        campos: { email: expect.stringContaining('já tem conta') as string },
      },
    });
  });

  it('e-mail de uma conta que só usa Discord também conta como usado', async () => {
    const a = await montar();
    a.db.insert(schema.users).values({ nome: 'Marta', email: MARTA.email }).run();

    expect((await cadastrar(a)).statusCode).toBe(409);
  });

  it('campos inválidos voltam com a mensagem de cada um', async () => {
    const resposta = await cadastrar(await montar(), { ...MARTA, senha: 'curta', aceite: false });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        campos: {
          senha: expect.stringContaining('10') as string,
          aceite: expect.any(String) as string,
        },
      },
    });
  });
});

describe('POST /api/auth/entrar', () => {
  it('entra com e-mail e senha, sem diferenciar maiúsculas no e-mail', async () => {
    const a = await montar();
    await cadastrar(a);

    const resposta = await entrar(a, ' Marta@Exemplo.com', MARTA.senha);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ usuario: { nome: MARTA.nome } });
    expect(sessao(resposta)).toBeDefined();
  });

  it('senha errada e e-mail inexistente dão a mesma resposta genérica', async () => {
    const a = await montar();
    await cadastrar(a);

    const senhaErrada = await entrar(a, MARTA.email, 'senha-errada-aqui');
    const semConta = await entrar(a, 'ninguem@exemplo.com', MARTA.senha, '10.0.0.2');

    for (const r of [senhaErrada, semConta]) {
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual({
        erro: { codigo: 'CREDENCIAIS', mensagem: 'E-mail ou senha não conferem.' },
      });
      expect(sessao(r)).toBeUndefined();
    }
  });

  it('a senha nunca aparece na resposta', async () => {
    const a = await montar();
    await cadastrar(a);

    const resposta = await entrar(a, MARTA.email, MARTA.senha);

    expect(resposta.body).not.toContain(MARTA.senha);
  });
});

describe('limite de tentativas (#14)', () => {
  it('a 6ª tentativa em 1 minuto recebe 429 com a mensagem do canvas', async () => {
    const a = await montar();

    for (let i = 0; i < LIMITE_DE_TENTATIVAS; i++) {
      expect((await entrar(a, MARTA.email, `errada-${String(i)}`)).statusCode).toBe(401);
    }
    const sexta = await entrar(a, MARTA.email, 'errada-6');

    expect(sexta.statusCode).toBe(429);
    expect(sexta.json()).toEqual({
      erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Depois de 5 tentativas, espere 1 minuto.' },
    });
  });

  it('conta por e-mail mesmo trocando de IP', async () => {
    const a = await montar();

    for (let i = 0; i < LIMITE_DE_TENTATIVAS; i++)
      await entrar(a, MARTA.email, 'x', `10.1.0.${String(i)}`);

    expect((await entrar(a, MARTA.email, 'x', '10.9.9.9')).statusCode).toBe(429);
  });

  it('conta por IP mesmo trocando de e-mail', async () => {
    const a = await montar();

    for (let i = 0; i < LIMITE_DE_TENTATIVAS; i++) await entrar(a, `p${String(i)}@x.com`, 'x');

    expect((await entrar(a, 'outro@x.com', 'x')).statusCode).toBe(429);
  });

  it('volta ao normal depois de 1 minuto', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval'] });
    const a = await montar();
    for (let i = 0; i <= LIMITE_DE_TENTATIVAS; i++) await entrar(a, MARTA.email, 'x');
    expect((await entrar(a, MARTA.email, 'x')).statusCode).toBe(429);

    vi.advanceTimersByTime(JANELA_DAS_TENTATIVAS_MS + 1000);

    expect((await entrar(a, MARTA.email, 'x')).statusCode).toBe(401);
  });
});

describe('reset-senha', () => {
  it('troca a senha e derruba as sessões abertas', async () => {
    const a = await montar();
    const antiga = sessao(await cadastrar(a)) ?? '';
    const nova = senhaProvisoria();

    expect(await redefinirSenha(a.db, ' MARTA@exemplo.com ', nova)).toBe(MARTA.nome);

    const comAntiga = await a.inject({
      method: 'GET',
      url: '/api/me',
      cookies: { membrana_sessao: antiga },
    });
    expect(comAntiga.statusCode).toBe(401);
    expect((await entrar(a, MARTA.email, MARTA.senha)).statusCode).toBe(401);
    expect((await entrar(a, MARTA.email, nova, '10.0.0.3')).statusCode).toBe(200);
  });

  it('dá e-mail e senha a quem só entrava pelo Discord', async () => {
    const a = await montar();
    a.db.insert(schema.users).values({ nome: 'Caio', email: 'caio@exemplo.com' }).run();

    const nova = senhaProvisoria();
    expect(await redefinirSenha(a.db, 'caio@exemplo.com', nova)).toBe('Caio');
    expect((await entrar(a, 'caio@exemplo.com', nova)).statusCode).toBe(200);
  });

  it('e-mail sem conta devolve null', async () => {
    expect(await redefinirSenha((await montar()).db, 'ninguem@x.com', 'qualquer-coisa')).toBeNull();
  });

  it('senha provisória legível: 14 caracteres, sem 0/O/1/l/I', () => {
    const senha = senhaProvisoria();
    expect(senha).toHaveLength(14);
    expect(senha).not.toMatch(/[0O1lI]/);
  });
});
