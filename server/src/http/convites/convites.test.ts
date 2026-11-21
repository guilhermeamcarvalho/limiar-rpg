import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { CampanhaDetalhe, ConviteDoMestre, ConvitePublico } from '@membrana/shared';
import { schema } from '../../db/index.ts';
import { appDeTeste, pessoaLogada } from '../../teste/apoio.ts';
import { gerarCodigo, palavraDoNome } from './index.ts';

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
  app = undefined;
});

type Pessoa = ReturnType<typeof pessoaLogada>;

/** App com a Ana mestrando "O Sinal de Santa Ermida". */
async function cenario() {
  app = await appDeTeste({ discord: null });
  await app.ready();
  const a = app;
  const ana = pessoaLogada(a, 'Ana Duarte');
  const r = await a.inject({
    method: 'POST',
    url: '/api/campanhas',
    cookies: ana.cookies,
    payload: { nome: 'O Sinal de Santa Ermida' },
  });
  const { campanha } = r.json<{ campanha: CampanhaDetalhe }>();
  return { a, ana, campanha };
}

async function convidar(a: FastifyInstance, quem: Pessoa, id: string, dados = {}) {
  const r = await a.inject({
    method: 'POST',
    url: `/api/campanhas/${id}/convites`,
    cookies: quem.cookies,
    payload: dados,
  });
  return { resposta: r, ...r.json<{ convite: ConviteDoMestre; link: string }>() };
}

function aceitar(a: FastifyInstance, quem: Pessoa, codigo: string) {
  return a.inject({
    method: 'POST',
    url: `/api/convites/${codigo}/aceitar`,
    cookies: quem.cookies,
  });
}

function ver(a: FastifyInstance, codigo: string, quem?: Pessoa) {
  return a.inject({
    method: 'GET',
    url: `/api/convites/${codigo}`,
    ...(quem && { cookies: quem.cookies }),
  });
}

describe('código', () => {
  it.each([
    ['O Sinal de Santa Ermida', 'ERMIDA'],
    ['Maré de Concreto', 'CONCRETO'],
    ['Ação!', 'ACAO'],
    ['Extraordinariamente longo', 'EXTRAORD'],
    ['?!', 'CASO'],
  ])('%s → %s', (nome, palavra) => {
    expect(palavraDoNome(nome)).toBe(palavra);
  });

  it('palavra, hífen e 4 caracteres sem 0/O/1/I/L', () => {
    for (let i = 0; i < 50; i++)
      expect(gerarCodigo('Santa Ermida')).toMatch(/^ERMIDA-[A-HJKMNP-Z2-9]{4}$/);
  });
});

describe('POST /api/campanhas/:id/convites', () => {
  it('o mestre cria o convite com vagas, validade e link', async () => {
    const { a, ana, campanha } = await cenario();

    const { resposta, convite, link } = await convidar(a, ana, campanha.id, {
      vagas: 3,
      expiraEmDias: 2,
    });

    expect(resposta.statusCode).toBe(201);
    expect(convite).toMatchObject({ vagas: 3, usados: 0, expirado: false, entraram: [] });
    expect(link).toBe(`http://localhost:5173/c/${convite.codigo}`);
    const dias = (new Date(convite.expiraEm).getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeCloseTo(2, 1);
  });

  it('jogador não convida (403); quem não participa recebe 404', async () => {
    const { a, ana, campanha } = await cenario();
    const bia = pessoaLogada(a, 'Bia');
    await aceitar(a, bia, (await convidar(a, ana, campanha.id)).convite.codigo);

    expect((await convidar(a, bia, campanha.id)).resposta.statusCode).toBe(403);
    expect((await convidar(a, pessoaLogada(a, 'X'), campanha.id)).resposta.statusCode).toBe(404);
  });
});

describe('GET /api/convites/:codigo', () => {
  it('mostra o cartão sem precisar de login, e aceita o código em minúsculas', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id, { vagas: 3 });

    const r = await ver(a, convite.codigo.toLowerCase());

    expect(r.statusCode).toBe(200);
    expect(r.json<{ convite: ConvitePublico }>().convite).toEqual({
      codigo: convite.codigo,
      estado: 'valido',
      vagasRestantes: 3,
      campanha: { id: campanha.id, numero: 1, nome: 'O Sinal de Santa Ermida', gancho: null },
      mestre: { nome: 'Ana Duarte' },
      sistema: { nome: 'Ordem Paranormal II' },
      proximaSessao: null,
    });
  });

  it('logado, diz se já participa', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id);

    const r = await ver(a, convite.codigo, ana);

    expect(r.json<{ convite: ConvitePublico }>().convite.jaParticipa).toBe(true);
  });

  it('código inexistente: 404 com o erro no campo código', async () => {
    const { a } = await cenario();

    const r = await ver(a, 'NADA-AAAA');

    expect(r.statusCode).toBe(404);
    expect(r.json()).toMatchObject({
      erro: { codigo: 'CONVITE_NAO_ENCONTRADO', campos: { codigo: expect.any(String) as string } },
    });
  });
});

describe('POST /api/convites/:codigo/aceitar', () => {
  it('entra como jogador, ocupa uma vaga e o mestre vê quem entrou', async () => {
    const { a, ana, campanha } = await cenario();
    const bia = pessoaLogada(a, 'Bia');
    const { convite } = await convidar(a, ana, campanha.id, { vagas: 2 });

    const r = await aceitar(a, bia, convite.codigo);

    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ campanha: { id: campanha.id, nome: campanha.nome } });
    const visao = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${campanha.id}`,
      cookies: ana.cookies,
    });
    const [doMestre] = visao.json<{ campanha: CampanhaDetalhe }>().campanha.convites ?? [];
    expect(doMestre).toMatchObject({ usados: 1, entraram: [{ id: bia.id, nome: 'Bia' }] });
    expect(doMestre?.entraram[0]?.entrouEm).toEqual(expect.any(String));
  });

  it('aceitar duas vezes não cria duas participações nem gasta duas vagas', async () => {
    const { a, ana, campanha } = await cenario();
    const bia = pessoaLogada(a, 'Bia');
    const { convite } = await convidar(a, ana, campanha.id);

    await aceitar(a, bia, convite.codigo);
    const segunda = await aceitar(a, bia, convite.codigo);

    expect(segunda.statusCode).toBe(409);
    expect(segunda.json()).toMatchObject({ erro: { codigo: 'JA_PARTICIPA' } });
    expect(
      a.db.select().from(schema.memberships).where(eq(schema.memberships.userId, bia.id)).all(),
    ).toHaveLength(1);
    expect(a.db.select().from(schema.invites).get()?.usados).toBe(1);
  });

  it('o mestre não entra como jogador no próprio caso', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id);

    expect((await aceitar(a, ana, convite.codigo)).statusCode).toBe(409);
  });

  it('sem vaga: mensagem clara', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id, { vagas: 1 });
    await aceitar(a, pessoaLogada(a, 'Bia'), convite.codigo);

    const r = await aceitar(a, pessoaLogada(a, 'Caio'), convite.codigo);
    const cartao = await ver(a, convite.codigo);

    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      erro: {
        codigo: 'CONVITE_ESGOTADO',
        mensagem: 'As vagas deste convite acabaram. Peça um novo ao mestre.',
      },
    });
    expect(cartao.json<{ convite: ConvitePublico }>().convite).toMatchObject({
      estado: 'esgotado',
      vagasRestantes: 0,
    });
  });

  it('expirado: mensagem clara', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id, { expiraEmDias: 1 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * 86_400_000);

    const r = await aceitar(a, pessoaLogada(a, 'Bia'), convite.codigo);
    const cartao = await ver(a, convite.codigo);

    expect(r.statusCode).toBe(410);
    expect(r.json()).toMatchObject({
      erro: {
        codigo: 'CONVITE_EXPIRADO',
        mensagem: 'Este convite expirou. Peça um novo ao mestre.',
      },
    });
    expect(cartao.json<{ convite: ConvitePublico }>().convite.estado).toBe('expirado');
  });

  it('sem login, 401', async () => {
    const { a, ana, campanha } = await cenario();
    const { convite } = await convidar(a, ana, campanha.id);

    const r = await a.inject({ method: 'POST', url: `/api/convites/${convite.codigo}/aceitar` });

    expect(r.statusCode).toBe(401);
  });

  it('depois de aceitar, o caso aparece na lista de quem entrou', async () => {
    const { a, ana, campanha } = await cenario();
    const bia = pessoaLogada(a, 'Bia');
    await aceitar(a, bia, (await convidar(a, ana, campanha.id)).convite.codigo);

    const r = await a.inject({ method: 'GET', url: '/api/campanhas', cookies: bia.cookies });

    expect(r.json()).toMatchObject({ campanhas: [{ id: campanha.id, papel: 'jogador' }] });
  });
});
