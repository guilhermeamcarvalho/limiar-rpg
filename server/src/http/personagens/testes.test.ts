import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  fichaDoDavi,
  type CampanhaDetalhe,
  type FichaOp2,
  type Personagem,
  type RegistroDeTeste,
} from '@membrana/shared';
import { eq } from 'drizzle-orm';
import { campaigns, testLog } from '../../db/schema.ts';
import type { EventoDaMesa } from '../../mesa/index.ts';
import { appDeTeste, pessoaLogada } from '../../teste/apoio.ts';
import { LIMITE_DO_HISTORICO } from './testes.ts';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Os valores que os próximos dados vão dar, na ordem em que o servidor rola. [valor, faces]. */
const fila: [number, number][] = [];
function sorteio() {
  const proximo = fila.shift();
  if (!proximo) throw new Error('O teste rolou mais dados do que o previsto.');
  return (proximo[0] - 0.5) / proximo[1];
}
const rolar = (...pares: [number, number][]) => {
  fila.length = 0;
  fila.push(...pares);
};

type Pessoa = ReturnType<typeof pessoaLogada>;

/** Mestre Ana, jogadoras Bia e Caio no Sinal (DT padrão 9); Bia tem a Davi no caso. */
async function mesaPronta(ficha: FichaOp2 = fichaDoDavi()) {
  app = await appDeTeste({ discord: null, sorteio });
  await app.ready();
  const a = app;
  const eventos: EventoDaMesa[] = [];
  a.mesa.ouvir((e) => eventos.push(e));
  const ana = pessoaLogada(a, 'Ana');
  const bia = pessoaLogada(a, 'Bia');
  const caio = pessoaLogada(a, 'Caio');
  const estranho = pessoaLogada(a, 'Estranho');

  const r = await a.inject({
    method: 'POST',
    url: '/api/campanhas',
    cookies: ana.cookies,
    payload: { nome: 'O Sinal de Santa Ermida', dtPadrao: 9 },
  });
  const caso = r.json<{ campanha: CampanhaDetalhe }>().campanha.id;
  for (const jogador of [bia, caio]) {
    const c = await a.inject({
      method: 'POST',
      url: `/api/campanhas/${caso}/convites`,
      cookies: ana.cookies,
      payload: {},
    });
    const { codigo } = c.json<{ convite: { codigo: string } }>().convite;
    await a.inject({
      method: 'POST',
      url: `/api/convites/${codigo}/aceitar`,
      cookies: jogador.cookies,
    });
  }
  const criado = await a.inject({
    method: 'POST',
    url: '/api/personagens',
    cookies: bia.cookies,
    payload: { campanhaId: caso, ficha },
  });
  const davi = criado.json<{ personagem: Personagem }>().personagem;
  eventos.length = 0;
  return { a, eventos, ana, bia, caio, estranho, caso, davi };
}

function testar(a: FastifyInstance, quem: Pessoa, id: string, payload: object) {
  return a.inject({
    method: 'POST',
    url: `/api/personagens/${id}/testes`,
    cookies: quem.cookies,
    payload,
  });
}

async function historico(a: FastifyInstance, quem: Pessoa, id: string) {
  const r = await a.inject({
    method: 'GET',
    url: `/api/personagens/${id}/testes`,
    cookies: quem.cookies,
  });
  return { status: r.statusCode, testes: r.json<{ testes: RegistroDeTeste[] }>().testes };
}

type Resposta = { teste: RegistroDeTeste; personagem: Personagem };

describe('POST /api/personagens/:id/testes', () => {
  it('rola no servidor com a DT do caso, grava e avisa a mesa', async () => {
    const { a, eventos, bia, caso, davi } = await mesaPronta();
    rolar([5, 6], [9, 10]);

    const r = await testar(a, bia, davi.id, { periciaId: 'maquinas' });

    expect(r.statusCode).toBe(201);
    const { teste, personagem } = r.json<Resposta>();
    expect(teste).toMatchObject({
      personagemId: davi.id,
      campanhaId: caso,
      autor: { id: bia.id, nome: 'Bia' },
      periciaId: 'maquinas',
      atributo: 'mente',
      origem: 'virtual',
      resultado: { total: 14, dt: 9, veredito: 'sucesso', informado: false },
      falhaCritica: null,
      efeitos: [],
    });
    expect(teste.id).toMatch(/^tst_/);
    expect(personagem.ficha).toEqual(davi.ficha);
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: davi.id, removido: false },
    ]);
  });

  it('Ímpeto e Gambiarra: o servidor gasta, soma e grava a ficha nova', async () => {
    const { a, bia, davi } = await mesaPronta();
    rolar([5, 6], [9, 10], [3, 4], [2, 4]);

    const r = await testar(a, bia, davi.id, {
      periciaId: 'maquinas',
      dt: 7,
      impeto: true,
      habilidades: ['gambiarra'],
    });

    const { teste, personagem } = r.json<Resposta>();
    expect(teste.resultado.total).toBe(17);
    expect(teste.efeitos).toEqual(['Ímpeto gasto: +d4.', 'Gambiarra usada: −2 PV.']);
    expect(personagem.ficha).toMatchObject({ impeto: 0, pv: 10, usadasNaCena: ['gambiarra'] });

    const salvo = await a.inject({
      method: 'GET',
      url: `/api/personagens/${davi.id}`,
      cookies: bia.cookies,
    });
    expect(salvo.json<{ personagem: Personagem }>().personagem.ficha.pv).toBe(10);
  });

  it('falha do Executor enche o Ímpeto automaticamente', async () => {
    const { a, bia, davi } = await mesaPronta();
    rolar([1, 6], [2, 10]);

    const { teste, personagem } = (
      await testar(a, bia, davi.id, { periciaId: 'maquinas' })
    ).json<Resposta>();

    expect(teste.resultado.veredito).toBe('falha');
    expect(personagem.ficha.impeto).toBe(2);
    expect(teste.efeitos).toEqual(['Ímpeto +1 (2/3).']);
  });

  it('falha crítica: o servidor rola o d8 e aplica o efeito', async () => {
    const { a, bia, davi } = await mesaPronta();
    rolar([1, 6], [1, 10], [5, 8], [3, 4]);

    const { teste, personagem } = (
      await testar(a, bia, davi.id, { periciaId: 'maquinas' })
    ).json<Resposta>();

    expect(teste.falhaCritica).toEqual({
      d8: 5,
      d4: 3,
      nome: 'Acidente',
      descricao: 'Perde 3 PV.',
    });
    expect(personagem.ficha).toMatchObject({ pv: 9, impeto: 2 });
  });

  it('o mestre do caso pode testar pela ficha', async () => {
    const { a, ana, davi } = await mesaPronta();
    rolar([4, 6], [4, 10]);
    const r = await testar(a, ana, davi.id, { periciaId: 'maquinas' });
    expect(r.statusCode).toBe(201);
    expect(r.json<Resposta>().teste.autor).toEqual({ id: ana.id, nome: 'Ana' });
  });

  it('outro jogador recebe 403; quem não é do caso, 404', async () => {
    const { a, caio, estranho, davi } = await mesaPronta();
    const outro = await testar(a, caio, davi.id, { periciaId: 'maquinas' });
    expect(outro.statusCode).toBe(403);
    expect(outro.json()).toMatchObject({ erro: { codigo: 'SO_O_DONO_OU_MESTRE' } });
    const fora = await testar(a, estranho, davi.id, { periciaId: 'maquinas' });
    expect(fora.statusCode).toBe(404);
  });

  it('regra recusada é 422 no campo, sem gravar nada', async () => {
    const { a, bia, davi } = await mesaPronta({ ...fichaDoDavi(), usadasNaCena: ['gambiarra'] });

    const r = await testar(a, bia, davi.id, { periciaId: 'maquinas', habilidades: ['gambiarra'] });

    expect(r.statusCode).toBe(422);
    expect(r.json()).toEqual({
      erro: {
        codigo: 'TESTE_RECUSADO',
        mensagem: 'Gambiarra já foi usada nesta cena.',
        campos: { habilidade: 'Gambiarra já foi usada nesta cena.' },
      },
    });
    expect(a.db.select().from(testLog).all()).toEqual([]);
  });

  it('no modo de dados físicos o servidor não rola', async () => {
    const { a, bia, davi } = await mesaPronta({ ...fichaDoDavi(), modoDados: 'fisico' });
    const r = await testar(a, bia, davi.id, { periciaId: 'maquinas' });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: { codigo: 'MODO_FISICO' } });
  });

  it('pedido mal montado é 400', async () => {
    const { a, bia, davi } = await mesaPronta();
    const r = await testar(a, bia, davi.id, { periciaId: 'voar', total: 20 });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({
      erro: { campos: { periciaId: 'Escolha uma das perícias da ficha.' } },
    });
  });
});

describe('GET /api/personagens/:id/testes', () => {
  it('devolve o histórico do mais novo para o mais antigo', async () => {
    const { a, bia, ana, davi } = await mesaPronta();
    rolar([5, 6], [9, 10]);
    await testar(a, bia, davi.id, { periciaId: 'maquinas' });
    rolar([2, 8], [3, 6]);
    await testar(a, ana, davi.id, { periciaId: 'acrobacia' });

    const { status, testes } = await historico(a, bia, davi.id);

    expect(status).toBe(200);
    expect(testes.map((t) => [t.periciaId, t.autor?.nome])).toEqual([
      ['acrobacia', 'Ana'],
      ['maquinas', 'Bia'],
    ]);
    expect(testes[0]?.resultado.total).toBe(5);
  });

  it(`guarda no máximo ${String(LIMITE_DO_HISTORICO)} na resposta`, async () => {
    const { a, bia, davi } = await mesaPronta({ ...fichaDoDavi(), impeto: 3 });
    for (let i = 0; i < LIMITE_DO_HISTORICO + 1; i += 1) {
      rolar([5, 6], [9, 10]);
      await testar(a, bia, davi.id, { periciaId: 'maquinas' });
    }
    const { testes } = await historico(a, bia, davi.id);
    expect(testes).toHaveLength(LIMITE_DO_HISTORICO);
  });

  it('segue a visibilidade da ficha: outro jogador não vê', async () => {
    const { a, caio, estranho, davi } = await mesaPronta();
    expect((await historico(a, caio, davi.id)).status).toBe(403);
    const fora = await a.inject({
      method: 'GET',
      url: `/api/personagens/${davi.id}/testes`,
      cookies: estranho.cookies,
    });
    expect(fora.statusCode).toBe(404);
  });

  it('remover o personagem apaga o histórico dele', async () => {
    const { a, bia, davi } = await mesaPronta();
    rolar([5, 6], [9, 10]);
    await testar(a, bia, davi.id, { periciaId: 'maquinas' });
    await a.inject({ method: 'DELETE', url: `/api/personagens/${davi.id}`, cookies: bia.cookies });
    expect(a.db.select().from(testLog).all()).toEqual([]);
  });
});

describe('POST /api/personagens/:id/testes/informado (dados físicos)', () => {
  const fisica = () => ({ ...fichaDoDavi(), modoDados: 'fisico' as const });
  const informar = (a: FastifyInstance, quem: Pessoa, id: string, payload: object) =>
    a.inject({
      method: 'POST',
      url: `/api/personagens/${id}/testes/informado`,
      cookies: quem.cookies,
      payload,
    });

  it('registra os valores informados com a origem "dados físicos" e o mestre vê', async () => {
    const { a, eventos, bia, ana, caso, davi } = await mesaPronta(fisica());

    const r = await informar(a, bia, davi.id, {
      periciaId: 'maquinas',
      resultado: { modo: 'dados', valores: [5, 9] },
    });

    expect(r.statusCode).toBe(201);
    const { teste } = r.json<Resposta>();
    expect(teste).toMatchObject({
      origem: 'fisico',
      resultado: { total: 14, dt: 9, veredito: 'sucesso', informado: true },
    });
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: davi.id, removido: false },
    ]);
    const { testes } = await historico(a, ana, davi.id);
    expect(testes.map((t) => [t.origem, t.autor?.nome])).toEqual([['fisico', 'Bia']]);
  });

  it('d10 com 12 é recusado no campo do dado, sem gravar nada', async () => {
    const { a, bia, davi } = await mesaPronta(fisica());

    const r = await informar(a, bia, davi.id, {
      periciaId: 'maquinas',
      resultado: { modo: 'dados', valores: [5, 12] },
    });

    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({
      erro: { codigo: 'TESTE_RECUSADO', campos: { 'valores.1': 'O d10 vai de 1 a 10.' } },
    });
    expect(a.db.select().from(testLog).all()).toEqual([]);
  });

  it('só o resultado, com falha crítica: aplica o d8 e o d4 informados e gasta o Ímpeto', async () => {
    const { a, bia, davi } = await mesaPronta(fisica());

    const r = await informar(a, bia, davi.id, {
      periciaId: 'maquinas',
      impeto: true,
      resultado: { modo: 'veredito', veredito: 'falhaCritica' },
      falhaCritica: { d8: 5, d4: 3 },
    });

    const { teste, personagem } = r.json<Resposta>();
    expect(teste.falhaCritica).toEqual({
      d8: 5,
      d4: 3,
      nome: 'Acidente',
      descricao: 'Perde 3 PV.',
    });
    expect(personagem.ficha).toMatchObject({ pv: 9, impeto: 1 });
  });

  it('ficha no modo virtual: quem rola é o app', async () => {
    const { a, bia, davi } = await mesaPronta();
    const r = await informar(a, bia, davi.id, {
      periciaId: 'maquinas',
      resultado: { modo: 'dados', valores: [5, 9] },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: { codigo: 'MODO_VIRTUAL' } });
  });

  it('caso que desligou os dados físicos recusa o resultado informado', async () => {
    const { a, bia, caso, davi } = await mesaPronta(fisica());
    a.db.update(campaigns).set({ dadosFisicos: false }).where(eq(campaigns.id, caso)).run();

    const r = await informar(a, bia, davi.id, {
      periciaId: 'maquinas',
      resultado: { modo: 'veredito', veredito: 'sucesso' },
    });

    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: { codigo: 'DADOS_FISICOS_DESLIGADOS' } });
  });

  it('outro jogador recebe 403 e pedido mal montado é 400', async () => {
    const { a, bia, caio, davi } = await mesaPronta(fisica());
    const corpo = { periciaId: 'maquinas', resultado: { modo: 'dados', valores: [5, 9] } };
    expect((await informar(a, caio, davi.id, corpo)).statusCode).toBe(403);
    const ruim = await informar(a, bia, davi.id, { periciaId: 'maquinas' });
    expect(ruim.statusCode).toBe(400);
  });
});

describe('modo de dados e a regra do caso', () => {
  it('num caso só com dados virtuais, a ficha não passa para o modo físico', async () => {
    const { a, bia, caso, davi } = await mesaPronta();
    a.db.update(campaigns).set({ dadosFisicos: false }).where(eq(campaigns.id, caso)).run();

    const editar = await a.inject({
      method: 'PUT',
      url: `/api/personagens/${davi.id}`,
      cookies: bia.cookies,
      payload: { ficha: { ...davi.ficha, modoDados: 'fisico' } },
    });
    expect(editar.statusCode).toBe(422);
    expect(editar.json()).toMatchObject({
      erro: { campos: { 'ficha.modoDados': 'O mestre deste caso não permite dados físicos.' } },
    });

    const criar = await a.inject({
      method: 'POST',
      url: '/api/personagens',
      cookies: bia.cookies,
      payload: { campanhaId: caso, ficha: { ...fichaDoDavi(), modoDados: 'fisico' } },
    });
    expect(criar.statusCode).toBe(422);
  });

  it('ficha que já estava no modo físico continua salvando, e pode voltar ao virtual', async () => {
    const { a, bia, caso, davi } = await mesaPronta({ ...fichaDoDavi(), modoDados: 'fisico' });
    a.db.update(campaigns).set({ dadosFisicos: false }).where(eq(campaigns.id, caso)).run();
    const salvar = (ficha: FichaOp2) =>
      a.inject({
        method: 'PUT',
        url: `/api/personagens/${davi.id}`,
        cookies: bia.cookies,
        payload: { ficha },
      });

    expect((await salvar({ ...davi.ficha, pv: 10 })).statusCode).toBe(200);
    expect((await salvar({ ...davi.ficha, modoDados: 'virtual' })).statusCode).toBe(200);
  });
});
