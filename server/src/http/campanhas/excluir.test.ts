import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  campaigns,
  characters,
  invites,
  maps,
  memberships,
  props,
  sessionLog,
  tableStates,
  testLog,
  tokens,
} from '../../db/schema.ts';
import { appDeTeste, casoDeTeste, mapaDeTeste } from '../../teste/apoio.ts';

let app: FastifyInstance | undefined;
let pasta: string | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  if (pasta) rmSync(pasta, { recursive: true, force: true });
  pasta = undefined;
});

const arquivo = (letra: string) => `${letra.repeat(64)}.webp`;

async function montar() {
  pasta = mkdtempSync(join(tmpdir(), 'membrana-excluir-'));
  app = await appDeTeste({ discord: null, env: { UPLOADS_DIR: pasta } });
  await app.ready();
  const pessoas = casoDeTeste(app);
  return { a: app, pasta, ...pessoas };
}

type Montado = Awaited<ReturnType<typeof montar>>;

function excluir(
  m: Montado,
  quem: Montado['ana'],
  corpo: unknown = { nome: 'O Sinal de Santa Ermida' },
) {
  return m.a.inject({
    method: 'DELETE',
    url: `/api/campanhas/${m.caso}`,
    cookies: quem.cookies,
    payload: corpo as Record<string, unknown>,
  });
}

const existe = (m: Montado) =>
  m.a.db.select().from(campaigns).where(eq(campaigns.id, m.caso)).get() !== undefined;

describe('excluir o caso', () => {
  it('jogador não exclui; quem não é do caso nem sabe que ele existe', async () => {
    const m = await montar();
    const doJogador = await excluir(m, m.bia);
    expect(doJogador.statusCode).toBe(403);
    expect(doJogador.json<{ erro: { mensagem: string } }>().erro.mensagem).toBe(
      'Só o mestre deste caso pode excluí-lo.',
    );
    expect((await excluir(m, m.estranho)).statusCode).toBe(404);
    expect(existe(m)).toBe(true);
  });

  it('nome digitado errado (ou nenhum) não apaga nada', async () => {
    const m = await montar();
    const errado = await excluir(m, m.ana, { nome: 'O Sinal' });
    expect(errado.statusCode).toBe(400);
    expect(errado.json()).toMatchObject({
      erro: { campos: { nome: 'Digite o nome do caso exatamente como está.' } },
    });
    expect((await excluir(m, m.ana, {})).statusCode).toBe(400);
    expect(existe(m)).toBe(true);
  });

  it('apaga tudo do caso; personagens e histórico de testes ficam, sem o caso', async () => {
    const m = await montar();
    const db = m.a.db;
    const mapa = mapaDeTeste(m.a, m.caso, { ativo: true });
    db.insert(tokens).values({ mapId: mapa.id, nome: 'Vulto', x: 1, y: 1 }).run();
    db.insert(props)
      .values({ mapId: mapa.id, imagem: arquivo('c'), x: 1, y: 1 })
      .run();
    db.insert(invites)
      .values({
        codigo: 'SINAL-AB12',
        campaignId: m.caso,
        vagas: 2,
        expiraEm: new Date(Date.now() + 86_400_000),
        criadoPor: m.ana.id,
      })
      .run();
    db.insert(testLog)
      .values({ characterId: m.davi, campaignId: m.caso, origem: 'virtual', registro: {} })
      .run();
    m.a.mesas.obter(m.caso).aplicar(m.ana, { type: 'round.end' });
    m.a.mesas.salvarTudo();
    expect(db.select().from(sessionLog).all()).toHaveLength(1);

    // Espaços nas pontas não contam.
    const r = await excluir(m, m.ana, { nome: '  O Sinal de Santa Ermida ' });
    expect(r.statusCode).toBe(204);

    expect(existe(m)).toBe(false);
    for (const tabela of [memberships, invites, maps, tokens, props, tableStates, sessionLog]) {
      expect(db.select().from(tabela).all()).toEqual([]);
    }
    expect(db.select().from(characters).where(eq(characters.id, m.davi)).get()).toMatchObject({
      ownerId: m.bia.id,
      campaignId: null,
    });
    expect(db.select().from(testLog).get()).toMatchObject({
      characterId: m.davi,
      campaignId: null,
    });
  });

  it('apaga as imagens da mesa que ficaram sem uso, e só elas', async () => {
    const m = await montar();
    const db = m.a.db;
    for (const letra of ['a', 'c', 'd', 'e']) writeFileSync(join(m.pasta, arquivo(letra)), 'x');
    // "a" é o mapa; "c", um prop; "d", um token que só existe na mesa em memória;
    // "e" também é a foto de um personagem: fica.
    const mapa = mapaDeTeste(m.a, m.caso, { ativo: true, imagem: arquivo('a') });
    db.insert(props)
      .values({ mapId: mapa.id, imagem: arquivo('c'), x: 1, y: 1 })
      .run();
    db.insert(tokens)
      .values({ mapId: mapa.id, nome: 'Foto', imagem: arquivo('e'), x: 1, y: 1 })
      .run();
    db.update(characters)
      .set({ foto: arquivo('e') })
      .where(eq(characters.id, m.davi))
      .run();
    m.a.mesas
      .obter(m.caso)
      .aplicar(m.ana, { type: 'token.create', nome: 'Novo', x: 2, y: 2, imagem: arquivo('d') });

    expect((await excluir(m, m.ana)).statusCode).toBe(204);
    const sobrou = (letra: string) => existsSync(join(m.pasta, arquivo(letra)));
    expect([sobrou('a'), sobrou('c'), sobrou('d')]).toEqual([false, false, false]);
    expect(sobrou('e')).toBe(true);
  });

  it('a mesa sai da memória sem salvar o que estava pendente', async () => {
    const m = await montar();
    mapaDeTeste(m.a, m.caso, { ativo: true });
    m.a.mesas.obter(m.caso).aplicar(m.ana, { type: 'token.create', nome: 'V', x: 1, y: 1 });
    expect(m.a.mesas.pendentes).toBe(1);

    expect((await excluir(m, m.ana)).statusCode).toBe(204);
    expect(m.a.mesas.pendentes).toBe(0);
    expect(m.a.mesas.existente(m.caso)).toBeUndefined();
    // Ao fechar, nada tenta gravar o caso que não existe mais.
    m.a.mesas.salvarTudo();
    expect(m.a.db.select().from(tableStates).all()).toEqual([]);
  });

  it('o caso some da lista de quem participava', async () => {
    const m = await montar();
    expect((await excluir(m, m.ana)).statusCode).toBe(204);
    const lista = await m.a.inject({
      method: 'GET',
      url: '/api/campanhas',
      cookies: m.bia.cookies,
    });
    expect(lista.json()).toEqual({ campanhas: [] });
  });
});
