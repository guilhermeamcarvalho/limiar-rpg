import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { CampanhaDetalhe, CampanhaNaLista } from '@limiar/shared';
import { appDeTeste, pessoaLogada } from '../../teste/apoio.ts';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function montar() {
  app = await appDeTeste({ discord: null });
  await app.ready();
  return app;
}

type Pessoa = ReturnType<typeof pessoaLogada>;

async function criar(a: FastifyInstance, quem: Pessoa, dados: Record<string, unknown>) {
  const r = await a.inject({
    method: 'POST',
    url: '/api/campanhas',
    cookies: quem.cookies,
    payload: dados,
  });
  return { resposta: r, campanha: r.json<{ campanha: CampanhaDetalhe }>().campanha };
}

async function lista(a: FastifyInstance, quem: Pessoa) {
  const r = await a.inject({ method: 'GET', url: '/api/campanhas', cookies: quem.cookies });
  return r.json<{ campanhas: CampanhaNaLista[] }>().campanhas;
}

/** Põe alguém como jogador direto pelo convite, como faria o fluxo de verdade. */
async function entrarComoJogador(a: FastifyInstance, mestre: Pessoa, jogador: Pessoa, id: string) {
  const convite = await a.inject({
    method: 'POST',
    url: `/api/campanhas/${id}/convites`,
    cookies: mestre.cookies,
    payload: {},
  });
  const { convite: c } = convite.json<{ convite: { codigo: string } }>();
  await a.inject({
    method: 'POST',
    url: `/api/convites/${c.codigo}/aceitar`,
    cookies: jogador.cookies,
  });
}

describe('POST /api/campanhas', () => {
  it('cria o caso e quem criou vira mestre, na mesma transação', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');

    const { resposta, campanha } = await criar(a, ana, {
      nome: 'O Sinal de Santa Ermida',
      gancho: 'A rádio voltou a transmitir às 3h33.',
      proximaSessao: '2026-11-21T21:00:00-03:00',
    });

    expect(resposta.statusCode).toBe(201);
    expect(campanha).toMatchObject({
      nome: 'O Sinal de Santa Ermida',
      numero: 1,
      papel: 'mestre',
      rodadas: true,
      sistema: { id: 'sys_op2', nome: 'Ordem Paranormal II', tipo: 'op2' },
      proximaSessao: '2026-11-22T00:00:00.000Z',
      contagens: { jogadores: 0 },
      membros: [{ id: ana.id, nome: 'Ana', papel: 'mestre' }],
    });
  });

  it('numera os casos em sequência', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');

    await criar(a, ana, { nome: 'Primeiro' });
    const { campanha } = await criar(a, ana, { nome: 'Segundo' });

    expect(campanha.numero).toBe(2);
  });

  it('recusa nome vazio e sistema que não existe, campo a campo', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');

    const semNome = await criar(a, ana, { nome: '  ' });
    const semSistema = await criar(a, ana, { nome: 'Caso', sistemaId: 'sys_nada' });

    expect(semNome.resposta.statusCode).toBe(400);
    expect(semNome.resposta.json()).toMatchObject({
      erro: { campos: { nome: 'Dê um nome ao caso.' } },
    });
    expect(semSistema.resposta.json()).toMatchObject({
      erro: { campos: { sistemaId: expect.any(String) as string } },
    });
  });

  it('sem login, 401', async () => {
    const r = await (
      await montar()
    ).inject({ method: 'POST', url: '/api/campanhas', payload: { nome: 'X' } });
    expect(r.statusCode).toBe(401);
  });
});

describe('GET /api/campanhas', () => {
  it('a mesma pessoa aparece como Mestre num caso e Jogador noutro', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const bia = pessoaLogada(a, 'Bia');
    const { campanha: sinal } = await criar(a, ana, { nome: 'O Sinal' });
    const { campanha: mare } = await criar(a, bia, { nome: 'Maré de Concreto' });
    await entrarComoJogador(a, bia, ana, mare.id);

    const daAna = await lista(a, ana);

    expect(daAna.map((c) => [c.nome, c.papel]).sort()).toEqual([
      ['Maré de Concreto', 'jogador'],
      ['O Sinal', 'mestre'],
    ]);
    expect(daAna.find((c) => c.id === mare.id)?.contagens.jogadores).toBe(1);
    expect(daAna.find((c) => c.id === sinal.id)?.contagens.jogadores).toBe(0);
  });

  it('não mostra casos de que a pessoa não participa', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    await criar(a, ana, { nome: 'O Sinal' });

    expect(await lista(a, pessoaLogada(a, 'Estranho'))).toEqual([]);
  });
});

describe('GET /api/campanhas/:id', () => {
  it('quem não participa recebe 404, igual a um caso que não existe', async () => {
    const a = await montar();
    const { campanha } = await criar(a, pessoaLogada(a, 'Ana'), { nome: 'O Sinal' });
    const estranho = pessoaLogada(a, 'Estranho');

    const deOutro = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${campanha.id}`,
      cookies: estranho.cookies,
    });
    const inexistente = await a.inject({
      method: 'GET',
      url: '/api/campanhas/cmp_nada',
      cookies: estranho.cookies,
    });

    expect(deOutro.statusCode).toBe(404);
    expect(deOutro.json()).toEqual(inexistente.json());
  });

  it('o mestre recebe os convites; o jogador não', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const bia = pessoaLogada(a, 'Bia');
    const { campanha } = await criar(a, ana, { nome: 'O Sinal' });
    await entrarComoJogador(a, ana, bia, campanha.id);

    const paraAna = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${campanha.id}`,
      cookies: ana.cookies,
    });
    const paraBia = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${campanha.id}`,
      cookies: bia.cookies,
    });

    const visaoDaAna = paraAna.json<{ campanha: CampanhaDetalhe }>().campanha;
    const visaoDaBia = paraBia.json<{ campanha: CampanhaDetalhe }>().campanha;
    expect(visaoDaAna.convites).toHaveLength(1);
    expect(visaoDaBia.convites).toBeUndefined();
    expect(visaoDaBia.papel).toBe('jogador');
    expect(visaoDaBia.membros.map((m) => m.nome)).toEqual(['Ana', 'Bia']);
  });
});

describe('PATCH /api/campanhas/:id', () => {
  it('o mestre edita', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const { campanha } = await criar(a, ana, { nome: 'O Sinal' });

    const r = await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${campanha.id}`,
      cookies: ana.cookies,
      payload: { nome: 'O Sinal de Santa Ermida', rodadas: false, proximaSessao: null },
    });

    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      campanha: { nome: 'O Sinal de Santa Ermida', rodadas: false },
    });
  });

  it('jogador não edita (403); quem não participa nem sabe que existe (404)', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const bia = pessoaLogada(a, 'Bia');
    const { campanha } = await criar(a, ana, { nome: 'O Sinal' });
    await entrarComoJogador(a, ana, bia, campanha.id);

    const pelaBia = await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${campanha.id}`,
      cookies: bia.cookies,
      payload: { nome: 'Meu' },
    });
    const peloEstranho = await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${campanha.id}`,
      cookies: pessoaLogada(a, 'Estranho').cookies,
      payload: { nome: 'Meu' },
    });

    expect(pelaBia.statusCode).toBe(403);
    expect(peloEstranho.statusCode).toBe(404);
  });

  it('mestre de um caso não edita o outro em que é jogador', async () => {
    const a = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const bia = pessoaLogada(a, 'Bia');
    const { campanha: mare } = await criar(a, bia, { nome: 'Maré' });
    await criar(a, ana, { nome: 'O Sinal' });
    await entrarComoJogador(a, bia, ana, mare.id);

    const r = await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${mare.id}`,
      cookies: ana.cookies,
      payload: { nome: 'X' },
    });

    expect(r.statusCode).toBe(403);
  });
});
