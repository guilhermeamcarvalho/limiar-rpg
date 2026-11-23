import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { fichaDoDavi, type CampanhaDetalhe, type Personagem } from '@membrana/shared';
import { characters, gameSystems, memberships } from '../../db/schema.ts';
import type { EventoDaMesa } from '../../mesa/index.ts';
import { appDeTeste, pessoaLogada } from '../../teste/apoio.ts';

let app: FastifyInstance | undefined;
let pasta: string | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  if (pasta) rmSync(pasta, { recursive: true, force: true });
  pasta = undefined;
});

async function montar() {
  pasta = mkdtempSync(join(tmpdir(), 'membrana-uploads-'));
  app = await appDeTeste({ discord: null, env: { UPLOADS_DIR: pasta } });
  await app.ready();
  const eventos: EventoDaMesa[] = [];
  app.mesa.ouvir((e) => eventos.push(e));
  return { a: app, eventos, pasta };
}

type Pessoa = ReturnType<typeof pessoaLogada>;

async function novoCaso(a: FastifyInstance, mestre: Pessoa, extra: Record<string, unknown> = {}) {
  const r = await a.inject({
    method: 'POST',
    url: '/api/campanhas',
    cookies: mestre.cookies,
    payload: { nome: 'O Sinal de Santa Ermida', ...extra },
  });
  return r.json<{ campanha: CampanhaDetalhe }>().campanha.id;
}

async function entrar(a: FastifyInstance, mestre: Pessoa, jogador: Pessoa, campanhaId: string) {
  const r = await a.inject({
    method: 'POST',
    url: `/api/campanhas/${campanhaId}/convites`,
    cookies: mestre.cookies,
    payload: {},
  });
  const { codigo } = r.json<{ convite: { codigo: string } }>().convite;
  await a.inject({
    method: 'POST',
    url: `/api/convites/${codigo}/aceitar`,
    cookies: jogador.cookies,
  });
}

async function criarPersonagem(
  a: FastifyInstance,
  quem: Pessoa,
  dados: Record<string, unknown> = {},
) {
  const r = await a.inject({
    method: 'POST',
    url: '/api/personagens',
    cookies: quem.cookies,
    payload: { ficha: fichaDoDavi(), ...dados },
  });
  return { resposta: r, personagem: r.json<{ personagem: Personagem }>().personagem };
}

/** Mestre Ana, jogadoras Bia e Caio no Sinal; Bia já tem a Davi no caso. */
async function mesaPronta() {
  const m = await montar();
  const ana = pessoaLogada(m.a, 'Ana');
  const bia = pessoaLogada(m.a, 'Bia');
  const caio = pessoaLogada(m.a, 'Caio');
  const caso = await novoCaso(m.a, ana);
  await entrar(m.a, ana, bia, caso);
  await entrar(m.a, ana, caio, caso);
  const { personagem } = await criarPersonagem(m.a, bia, { campanhaId: caso });
  m.eventos.length = 0;
  return { ...m, ana, bia, caio, caso, davi: personagem };
}

describe('POST /api/personagens', () => {
  it('cria na lista de quem pediu, com a ficha validada', async () => {
    const { a, eventos } = await montar();
    const bia = pessoaLogada(a, 'Bia');

    const { resposta, personagem } = await criarPersonagem(a, bia);

    expect(resposta.statusCode).toBe(201);
    expect(personagem).toMatchObject({
      donoId: bia.id,
      campanhaId: null,
      sistemaId: 'sys_op2',
      foto: null,
      tokenImg: null,
      ficha: { nome: 'Davi Rocha', pericias: { maquinas: 'd10' } },
    });
    expect(personagem.id).toMatch(/^chr_/);
    expect(eventos).toEqual([]);
  });

  it('num caso, usa o sistema do caso e avisa a mesa', async () => {
    const { a, eventos } = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const caso = await novoCaso(a, ana);

    const { personagem } = await criarPersonagem(a, ana, { campanhaId: caso });

    expect(personagem.campanhaId).toBe(caso);
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: personagem.id, removido: false },
    ]);
  });

  it('ficha inválida volta 422 com o campo errado', async () => {
    const { a } = await montar();
    const bia = pessoaLogada(a, 'Bia');

    const { resposta } = await criarPersonagem(a, bia, {
      ficha: { ...fichaDoDavi(), pericias: { ...fichaDoDavi().pericias, maquinas: 'd20' } },
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toMatchObject({
      erro: {
        codigo: 'FICHA_INVALIDA',
        campos: { 'ficha.pericias.maquinas': expect.any(String) as string },
      },
    });
    expect(a.db.select().from(characters).all()).toEqual([]);
  });

  it('regra entre campos (PV acima do máximo) também aponta o campo', async () => {
    const { a } = await montar();
    const bia = pessoaLogada(a, 'Bia');

    const { resposta } = await criarPersonagem(a, bia, { ficha: { ...fichaDoDavi(), pv: 50 } });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toMatchObject({
      erro: { campos: { 'ficha.pv': 'O PV não pode passar do máximo.' } },
    });
  });

  it('campo desconhecido na ficha também é 422', async () => {
    const { a } = await montar();
    const bia = pessoaLogada(a, 'Bia');

    const { resposta } = await criarPersonagem(a, bia, { ficha: { ...fichaDoDavi(), res: 1 } });

    expect(resposta.statusCode).toBe(422);
    expect(Object.keys(resposta.json<{ erro: { campos: object } }>().erro.campos)).toEqual([
      'ficha',
    ]);
  });

  it('em caso de que não participa, 404', async () => {
    const { a } = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const estranho = pessoaLogada(a, 'Estranho');
    const caso = await novoCaso(a, ana);

    const { resposta } = await criarPersonagem(a, estranho, { campanhaId: caso });

    expect(resposta.statusCode).toBe(404);
  });

  it('sistema diferente do caso é 400 no campo', async () => {
    const { a } = await montar();
    const ana = pessoaLogada(a, 'Ana');
    const caso = await novoCaso(a, ana);

    const { resposta } = await criarPersonagem(a, ana, { campanhaId: caso, sistemaId: 'sys_x' });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      erro: { campos: { sistemaId: 'O personagem usa o sistema do caso.' } },
    });
  });

  it('sem login, 401', async () => {
    const { a } = await montar();
    const r = await a.inject({ method: 'POST', url: '/api/personagens', payload: {} });
    expect(r.statusCode).toBe(401);
  });
});

describe('GET /api/me/personagens', () => {
  it('lista só os personagens de quem pediu', async () => {
    const { a, bia, caio, davi } = await mesaPronta();
    await criarPersonagem(a, caio, { ficha: { ...fichaDoDavi(), nome: 'Iara' } });

    const r = await a.inject({ method: 'GET', url: '/api/me/personagens', cookies: bia.cookies });

    expect(r.json<{ personagens: Personagem[] }>().personagens.map((p) => p.id)).toEqual([davi.id]);
  });
});

describe('GET /api/personagens/:id', () => {
  it('o dono e o mestre do caso veem', async () => {
    const { a, ana, bia, davi } = await mesaPronta();
    for (const quem of [bia, ana]) {
      const r = await a.inject({
        method: 'GET',
        url: `/api/personagens/${davi.id}`,
        cookies: quem.cookies,
      });
      expect(r.statusCode).toBe(200);
      expect(r.json<{ personagem: Personagem }>().personagem.ficha.nome).toBe('Davi Rocha');
    }
  });

  it('outro jogador só vê se o caso deixar', async () => {
    const { a, ana, caio, caso, davi } = await mesaPronta();
    const ver = () =>
      a.inject({ method: 'GET', url: `/api/personagens/${davi.id}`, cookies: caio.cookies });

    const antes = await ver();
    expect(antes.statusCode).toBe(403);
    expect(antes.json()).toMatchObject({ erro: { codigo: 'FICHA_OCULTA' } });

    await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${caso}`,
      cookies: ana.cookies,
      payload: { fichasVisiveis: true },
    });
    expect((await ver()).statusCode).toBe(200);
  });

  it('quem não tem nada com o personagem recebe 404', async () => {
    const { a, davi } = await mesaPronta();
    const estranho = pessoaLogada(a, 'Estranho');
    const r = await a.inject({
      method: 'GET',
      url: `/api/personagens/${davi.id}`,
      cookies: estranho.cookies,
    });
    expect(r.statusCode).toBe(404);
    const nada = await a.inject({
      method: 'GET',
      url: '/api/personagens/chr_nada',
      cookies: estranho.cookies,
    });
    expect(nada.statusCode).toBe(404);
  });

  it('personagem fora de caso: só o dono', async () => {
    const { a, bia, ana } = await mesaPronta();
    const { personagem } = await criarPersonagem(a, bia);
    const r = await a.inject({
      method: 'GET',
      url: `/api/personagens/${personagem.id}`,
      cookies: ana.cookies,
    });
    expect(r.statusCode).toBe(404);
  });
});

describe('PUT /api/personagens/:id', () => {
  const editar = (a: FastifyInstance, quem: Pessoa, id: string, ficha: unknown) =>
    a.inject({
      method: 'PUT',
      url: `/api/personagens/${id}`,
      cookies: quem.cookies,
      payload: { ficha },
    });

  it('o dono edita e a mesa do caso fica sabendo', async () => {
    const { a, bia, caso, davi, eventos } = await mesaPronta();

    const r = await editar(a, bia, davi.id, { ...fichaDoDavi(), pv: 7 });

    expect(r.statusCode).toBe(200);
    expect(r.json<{ personagem: Personagem }>().personagem.ficha.pv).toBe(7);
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: davi.id, removido: false },
    ]);
  });

  it('o mestre do caso edita', async () => {
    const { a, ana, davi } = await mesaPronta();
    const r = await editar(a, ana, davi.id, { ...fichaDoDavi(), pd: 3 });
    expect(r.statusCode).toBe(200);
  });

  it('jogador não edita ficha de outro (403)', async () => {
    const { a, ana, caio, caso, davi, eventos } = await mesaPronta();
    // Nem com as fichas visíveis: ver não é editar.
    await a.inject({
      method: 'PATCH',
      url: `/api/campanhas/${caso}`,
      cookies: ana.cookies,
      payload: { fichasVisiveis: true },
    });

    const r = await editar(a, caio, davi.id, { ...fichaDoDavi(), pv: 0 });

    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ erro: { codigo: 'SO_O_DONO_OU_MESTRE' } });
    const guardada = a.db.select().from(characters).where(eq(characters.id, davi.id)).get();
    expect(guardada?.ficha).toMatchObject({ pv: 12 });
    expect(eventos).toEqual([]);
  });

  it('ficha inválida volta 422 com o campo errado e nada muda', async () => {
    const { a, bia, davi } = await mesaPronta();
    const r = await editar(a, bia, davi.id, { ...fichaDoDavi(), nome: '' });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({
      erro: { campos: { 'ficha.nome': 'Dê um nome ao personagem.' } },
    });
  });
});

describe('DELETE /api/personagens/:id', () => {
  const remover = (a: FastifyInstance, quem: Pessoa, id: string) =>
    a.inject({ method: 'DELETE', url: `/api/personagens/${id}`, cookies: quem.cookies });

  it('apaga foto e token do disco, solta o caso e avisa a mesa', async () => {
    const { a, bia, caso, davi, eventos, pasta } = await mesaPronta();
    writeFileSync(join(pasta, 'foto.webp'), 'x');
    writeFileSync(join(pasta, 'token.webp'), 'x');
    a.db
      .update(characters)
      .set({ foto: 'foto.webp', tokenImg: 'token.webp' })
      .where(eq(characters.id, davi.id))
      .run();
    await a.inject({
      method: 'PUT',
      url: `/api/campanhas/${caso}/meu-personagem`,
      cookies: bia.cookies,
      payload: { personagemId: davi.id },
    });

    const r = await remover(a, bia, davi.id);

    expect(r.statusCode).toBe(204);
    expect(existsSync(join(pasta, 'foto.webp'))).toBe(false);
    expect(existsSync(join(pasta, 'token.webp'))).toBe(false);
    expect(a.db.select().from(characters).all()).toEqual([]);
    const vaga = a.db.select().from(memberships).where(eq(memberships.userId, bia.id)).get();
    expect(vaga?.characterId).toBeNull();
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: davi.id, removido: true },
    ]);
  });

  it('imagem usada por outro personagem fica no disco', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    const { personagem: outro } = await criarPersonagem(a, bia);
    writeFileSync(join(pasta, 'mesma.webp'), 'x');
    for (const id of [davi.id, outro.id]) {
      a.db.update(characters).set({ foto: 'mesma.webp' }).where(eq(characters.id, id)).run();
    }

    await remover(a, bia, davi.id);

    expect(existsSync(join(pasta, 'mesma.webp'))).toBe(true);
  });

  it('nome de arquivo com ../ não sai da pasta de uploads', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    const fora = join(pasta, '..', `fora-${String(Date.now())}.txt`);
    writeFileSync(fora, 'x');
    a.db
      .update(characters)
      .set({ foto: `../${fora.split(/[\\/]/).pop() ?? ''}` })
      .where(eq(characters.id, davi.id))
      .run();

    await remover(a, bia, davi.id);

    expect(existsSync(fora)).toBe(true);
    rmSync(fora);
  });

  it('só o dono remove: nem o mestre', async () => {
    const { a, ana, caio, davi } = await mesaPronta();
    expect((await remover(a, ana, davi.id)).statusCode).toBe(403);
    expect((await remover(a, caio, davi.id)).statusCode).toBe(403);
    expect(a.db.select().from(characters).all()).toHaveLength(1);
  });
});

describe('PUT /api/campanhas/:id/meu-personagem', () => {
  const escolher = (a: FastifyInstance, quem: Pessoa, caso: string, personagemId: string | null) =>
    a.inject({
      method: 'PUT',
      url: `/api/campanhas/${caso}/meu-personagem`,
      cookies: quem.cookies,
      payload: { personagemId },
    });

  it('grava a escolha e o caso passa a mostrar o personagem', async () => {
    const { a, bia, caso, davi } = await mesaPronta();

    const r = await escolher(a, bia, caso, davi.id);

    expect(r.statusCode).toBe(200);
    expect(r.json<{ campanha: CampanhaDetalhe }>().campanha.meuPersonagem).toEqual({
      id: davi.id,
      nome: 'Davi Rocha',
    });
    const lido = await a.inject({
      method: 'GET',
      url: `/api/campanhas/${caso}`,
      cookies: bia.cookies,
    });
    expect(lido.json<{ campanha: CampanhaDetalhe }>().campanha.meuPersonagem?.id).toBe(davi.id);
  });

  it('personagem solto passa a pertencer ao caso, e o mestre o vê', async () => {
    const { a, ana, bia, caso } = await mesaPronta();
    const { personagem } = await criarPersonagem(a, bia, {
      ficha: { ...fichaDoDavi(), nome: 'Iara' },
    });

    await escolher(a, bia, caso, personagem.id);

    const r = await a.inject({
      method: 'GET',
      url: `/api/personagens/${personagem.id}`,
      cookies: ana.cookies,
    });
    expect(r.json<{ personagem: Personagem }>().personagem.campanhaId).toBe(caso);
  });

  it('trocar o personagem numa campanha não afeta outra', async () => {
    const { a, ana, bia, caso, davi } = await mesaPronta();
    const outroCaso = await novoCaso(a, ana, { nome: 'A Maré' });
    await entrar(a, ana, bia, outroCaso);
    const { personagem: iara } = await criarPersonagem(a, bia, {
      campanhaId: outroCaso,
      ficha: { ...fichaDoDavi(), nome: 'Iara' },
    });
    const { personagem: joao } = await criarPersonagem(a, bia, {
      campanhaId: caso,
      ficha: { ...fichaDoDavi(), nome: 'João' },
    });
    await escolher(a, bia, caso, davi.id);
    await escolher(a, bia, outroCaso, iara.id);

    await escolher(a, bia, caso, joao.id);

    const ver = async (id: string) =>
      (await a.inject({ method: 'GET', url: `/api/campanhas/${id}`, cookies: bia.cookies })).json<{
        campanha: CampanhaDetalhe;
      }>().campanha.meuPersonagem?.nome;
    expect(await ver(caso)).toBe('João');
    expect(await ver(outroCaso)).toBe('Iara');
  });

  it('personagem de outro sistema é recusado com mensagem clara', async () => {
    const { a, ana, bia } = await mesaPronta();
    a.db
      .insert(gameSystems)
      .values({
        id: 'sys_cripta',
        nome: 'Cripta',
        tipo: 'inventado',
        config: { versao: 1, dadoPrincipal: '1d20', atributos: ['Força'], regrasDaCasa: '' },
      })
      .run();
    const cripta = await novoCaso(a, ana, { nome: 'Cripta', sistemaId: 'sys_cripta' });
    await entrar(a, ana, bia, cripta);
    const { personagem } = await criarPersonagem(a, bia);

    const r = await escolher(a, bia, cripta, personagem.id);

    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      erro: {
        codigo: 'SISTEMA_DIFERENTE',
        mensagem:
          'Este personagem é de Ordem Paranormal II, e este caso usa Cripta. Escolha um personagem do mesmo sistema.',
        campos: { personagemId: expect.any(String) as string },
      },
    });
  });

  it('personagem que já joga em outro caso é recusado', async () => {
    const { a, ana, bia, davi } = await mesaPronta();
    const outroCaso = await novoCaso(a, ana, { nome: 'A Maré' });
    await entrar(a, ana, bia, outroCaso);

    const r = await escolher(a, bia, outroCaso, davi.id);

    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      erro: {
        codigo: 'PERSONAGEM_EM_OUTRO_CASO',
        mensagem: expect.stringContaining('O Sinal de Santa Ermida') as string,
      },
    });
  });

  it('personagem de outra pessoa é recusado', async () => {
    const { a, caio, caso, davi } = await mesaPronta();
    const r = await escolher(a, caio, caso, davi.id);
    expect(r.statusCode).toBe(404);
  });

  it('null deixa sem personagem', async () => {
    const { a, bia, caso, davi } = await mesaPronta();
    await escolher(a, bia, caso, davi.id);
    const r = await escolher(a, bia, caso, null);
    expect(r.json<{ campanha: CampanhaDetalhe }>().campanha.meuPersonagem).toBeNull();
  });

  it('quem não participa do caso recebe 404', async () => {
    const { a, caso } = await mesaPronta();
    const estranho = pessoaLogada(a, 'Estranho');
    const r = await escolher(a, estranho, caso, null);
    expect(r.statusCode).toBe(404);
  });
});
