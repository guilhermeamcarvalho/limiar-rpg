import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { urlDoArquivo, type MapaDoCaso } from '@membrana/shared';
import { maps, tokens } from '../../db/schema.ts';
import {
  appDeTeste,
  casoDeTeste,
  formulario,
  mapaDeTeste,
  type ArquivoDeTeste,
} from '../../teste/apoio.ts';

// Sem o cache, o sharp não segura o arquivo aberto depois de ler (o Windows não deixa apagar).
sharp.cache(false);

let app: FastifyInstance | undefined;
let pasta: string | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  if (pasta) rmSync(pasta, { recursive: true, force: true });
  pasta = undefined;
});

async function montar() {
  pasta = mkdtempSync(join(tmpdir(), 'membrana-mapas-'));
  app = await appDeTeste({ discord: null, env: { UPLOADS_DIR: pasta } });
  await app.ready();
  return { a: app, pasta, ...casoDeTeste(app) };
}

type Pessoa = ReturnType<typeof casoDeTeste>['ana'];

async function jpeg(largura: number, altura: number, nome = 'porao.jpg'): Promise<ArquivoDeTeste> {
  const conteudo = await sharp({
    create: { width: largura, height: altura, channels: 3, background: '#335' },
  })
    .jpeg({ quality: 50 })
    .toBuffer();
  return { nome, tipo: 'image/jpeg', conteudo };
}

function enviarMapa(
  a: FastifyInstance,
  quem: Pessoa,
  caso: string,
  arquivo?: ArquivoDeTeste,
  campos: Record<string, string> = {},
) {
  return a.inject({
    method: 'POST',
    url: `/api/campanhas/${caso}/mapas`,
    cookies: quem.cookies,
    ...formulario(campos, arquivo),
  });
}

describe('enviar mapa', () => {
  it('mapa de 8000 px chega com 4096 px, em WebP, com o nome do arquivo', async () => {
    const { a, pasta, caso, ana } = await montar();
    const r = await enviarMapa(a, ana, caso, await jpeg(8000, 5000, 'porao-da-radio.jpg'));
    expect(r.statusCode).toBe(201);
    const { mapa } = r.json<{ mapa: MapaDoCaso }>();
    expect(mapa).toMatchObject({
      nome: 'porao-da-radio',
      largura: 4096,
      altura: 2560,
      grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
      ativo: false,
    });
    expect(mapa.imagem).toMatch(/^[0-9a-f]{64}\.webp$/);
    const salvo = await sharp(join(pasta, mapa.imagem)).metadata();
    expect([salvo.format, salvo.width, salvo.height]).toEqual(['webp', 4096, 2560]);
  });

  it('mapa pequeno não é ampliado; o nome pode vir no campo', async () => {
    const { a, caso, ana } = await montar();
    const r = await enviarMapa(a, ana, caso, await jpeg(1200, 800), { nome: 'Rádio, 2º andar' });
    expect(r.json<{ mapa: MapaDoCaso }>().mapa).toMatchObject({
      nome: 'Rádio, 2º andar',
      largura: 1200,
      altura: 800,
    });
  });

  it('acima de 20 MB: o aviso do artboard Componentes', async () => {
    const { a, caso, ana } = await montar();
    const grande = {
      nome: 'enorme.png',
      tipo: 'image/png',
      conteudo: Buffer.alloc(21 * 1024 * 1024, 1),
    };
    const r = await enviarMapa(a, ana, caso, grande);
    expect(r.statusCode).toBe(413);
    expect(r.json()).toEqual({
      erro: { codigo: 'MAPA_GRANDE', mensagem: 'Mapa acima de 20 MB. Reduza para 4096 px.' },
    });
  });

  it('o limite do mapa é 20 MB, não os 5 MB da foto', async () => {
    const { a, caso, ana } = await montar();
    // 6 MB que não são imagem: passam do tamanho e param na conferência da imagem.
    const r = await enviarMapa(a, ana, caso, {
      nome: 'x.png',
      tipo: 'image/png',
      conteudo: Buffer.alloc(6 * 1024 * 1024, 1),
    });
    expect(r.statusCode).toBe(415);
    expect(r.json<{ erro: { codigo: string } }>().erro.codigo).toBe('NAO_E_IMAGEM');
  });

  it('sem arquivo, campo destacado', async () => {
    const { a, caso, ana } = await montar();
    const r = await enviarMapa(a, ana, caso);
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ erro: { campos: { arquivo: 'Escolha uma imagem.' } } });
  });

  it('só o mestre envia; quem é de fora nem sabe que o caso existe', async () => {
    const { a, caso, bia, estranho } = await montar();
    const imagem = await jpeg(100, 100);
    expect((await enviarMapa(a, bia, caso, imagem)).statusCode).toBe(403);
    expect((await enviarMapa(a, estranho, caso, imagem)).statusCode).toBe(404);
    expect(a.db.select().from(maps).all()).toEqual([]);
  });
});

describe('lista e remoção de mapas', () => {
  it('a lista diz qual mapa está na mesa, pela mesa em memória', async () => {
    const { a, caso, ana, bia } = await montar();
    const primeiro = mapaDeTeste(a, caso, { nome: 'Primeiro', ativo: true });
    const segundo = mapaDeTeste(a, caso, { nome: 'Segundo' });
    const listar = async (quem: Pessoa) =>
      a.inject({ method: 'GET', url: `/api/campanhas/${caso}/mapas`, cookies: quem.cookies });

    const ativos = async () =>
      (await listar(ana))
        .json<{ mapas: MapaDoCaso[] }>()
        .mapas.filter((m) => m.ativo)
        .map((m) => m.id);
    expect(await ativos()).toEqual([primeiro.id]);

    // Trocou na mesa e ainda não salvou: a lista já mostra o novo.
    a.mesas.obter(caso).aplicar(ana, { type: 'map.activate', mapaId: segundo.id });
    expect(await ativos()).toEqual([segundo.id]);
    expect((await listar(bia)).statusCode).toBe(403);
  });

  it('mapa na mesa não pode ser apagado; os outros, sim, com os tokens e o arquivo', async () => {
    const { a, pasta, caso, ana } = await montar();
    const enviado = (await enviarMapa(a, ana, caso, await jpeg(300, 200))).json<{
      mapa: MapaDoCaso;
    }>().mapa;
    const naMesa = mapaDeTeste(a, caso, { ativo: true });
    a.db.insert(tokens).values({ mapId: enviado.id, nome: 'Vulto', x: 1, y: 1 }).run();
    const apagar = (id: string) =>
      a.inject({
        method: 'DELETE',
        url: `/api/campanhas/${caso}/mapas/${id}`,
        cookies: ana.cookies,
      });

    const recusado = await apagar(naMesa.id);
    expect(recusado.statusCode).toBe(409);
    expect(recusado.json<{ erro: { mensagem: string } }>().erro.mensagem).toBe(
      'Este mapa está na mesa. Troque de mapa antes de apagá-lo.',
    );

    expect(existsSync(join(pasta, enviado.imagem))).toBe(true);
    expect((await apagar(enviado.id)).statusCode).toBe(204);
    expect(a.db.select().from(tokens).all()).toEqual([]);
    expect(existsSync(join(pasta, enviado.imagem))).toBe(false);
    expect((await apagar(enviado.id)).statusCode).toBe(404);
  });
});

describe('imagens da mesa', () => {
  it('o arquivo do mapa: quem é do caso vê; quem é de fora, não', async () => {
    const { a, caso, ana, caio, estranho } = await montar();
    const { mapa } = (await enviarMapa(a, ana, caso, await jpeg(300, 200))).json<{
      mapa: MapaDoCaso;
    }>();
    const ver = (quem: Pessoa) =>
      a.inject({ method: 'GET', url: urlDoArquivo(mapa.imagem), cookies: quem.cookies });
    expect((await ver(caio)).statusCode).toBe(200);
    expect((await ver(estranho)).statusCode).toBe(404);
  });

  it('imagem solta sobre o mapa vira token de 256 px; vale assim que está na mesa', async () => {
    const { a, caso, ana, bia, estranho } = await montar();
    const r = await a.inject({
      method: 'POST',
      url: `/api/campanhas/${caso}/imagens`,
      cookies: bia.cookies,
      ...formulario({ uso: 'token' }, await jpeg(600, 400)),
    });
    expect(r.statusCode).toBe(201);
    const { nome } = r.json<{ nome: string }>();
    const ver = (quem: Pessoa) =>
      a.inject({ method: 'GET', url: urlDoArquivo(nome), cookies: quem.cookies });
    // Ainda não está em lugar nenhum: ninguém vê.
    expect((await ver(bia)).statusCode).toBe(404);

    // O mestre põe um token com ela na mesa; antes de salvar, quem é do caso já vê.
    mapaDeTeste(a, caso, { ativo: true });
    const feito = a.mesas
      .obter(caso)
      .aplicar(ana, { type: 'token.create', nome: 'Vulto', x: 5, y: 5, imagem: nome });
    expect(feito.ok).toBe(true);
    const visto = await ver(bia);
    expect(visto.statusCode).toBe(200);
    expect((await sharp(visto.rawPayload).metadata()).width).toBe(256);
    expect((await ver(estranho)).statusCode).toBe(404);
  });

  it('uso desconhecido é recusado; quem é de fora não envia', async () => {
    const { a, caso, bia, estranho } = await montar();
    const enviar = async (quem: Pessoa, uso: string) =>
      a.inject({
        method: 'POST',
        url: `/api/campanhas/${caso}/imagens`,
        cookies: quem.cookies,
        ...formulario({ uso }, await jpeg(50, 50)),
      });
    expect((await enviar(bia, 'mapa')).statusCode).toBe(400);
    expect((await enviar(estranho, 'token')).statusCode).toBe(404);
  });
});
