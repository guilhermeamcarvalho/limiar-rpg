import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import {
  fichaDoDavi,
  LIMITE_DA_IMAGEM,
  urlDoArquivo,
  type CampanhaDetalhe,
  type Personagem,
} from '@membrana/shared';
import type { EventoDaMesa } from '../../mesa/index.ts';
import { appDeTeste, pessoaLogada } from '../../teste/apoio.ts';
import { CACHE_DOS_ARQUIVOS } from './arquivos.ts';

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

type Pessoa = ReturnType<typeof pessoaLogada>;

/** Mestre Ana e jogadora Bia no Sinal; Bia tem a Davi no caso. Estranho não é de lá. */
async function mesaPronta() {
  pasta = mkdtempSync(join(tmpdir(), 'membrana-uploads-'));
  app = await appDeTeste({ discord: null, env: { UPLOADS_DIR: pasta } });
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
    payload: { nome: 'O Sinal de Santa Ermida' },
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
    payload: { campanhaId: caso, ficha: fichaDoDavi() },
  });
  const davi = criado.json<{ personagem: Personagem }>().personagem;
  eventos.length = 0;
  return { a, eventos, ana, bia, caio, estranho, caso, davi, pasta };
}

interface Arquivo {
  nome: string;
  tipo: string;
  conteudo: Buffer;
}

/** Monta o corpo multipart/form-data à mão, como o navegador manda. */
function formulario(campos: Record<string, string>, arquivo?: Arquivo) {
  const fronteira = '----membrana-teste';
  const partes: Buffer[] = [];
  for (const [nome, valor] of Object.entries(campos)) {
    partes.push(
      Buffer.from(
        `--${fronteira}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
      ),
    );
  }
  if (arquivo) {
    partes.push(
      Buffer.from(
        `--${fronteira}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.tipo}\r\n\r\n`,
      ),
      arquivo.conteudo,
      Buffer.from('\r\n'),
    );
  }
  partes.push(Buffer.from(`--${fronteira}--\r\n`));
  return {
    payload: Buffer.concat(partes),
    headers: { 'content-type': `multipart/form-data; boundary=${fronteira}` },
  };
}

function enviar(
  a: FastifyInstance,
  quem: Pessoa,
  id: string,
  campos: Record<string, string>,
  arquivo?: Arquivo,
) {
  return a.inject({
    method: 'POST',
    url: `/api/personagens/${id}/imagem`,
    cookies: quem.cookies,
    ...formulario(campos, arquivo),
  });
}

const fundo = (largura = 800, altura = 600, cor = '#c33') =>
  sharp({ create: { width: largura, height: altura, channels: 3, background: cor } });

/** JPEG com a localização no EXIF (latitude sul), como sai de um celular. */
async function jpegComGps(largura = 800, altura = 600): Promise<Arquivo> {
  const conteudo = await fundo(largura, altura)
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '23/1 32/1 0/1' } })
    .toBuffer();
  return { nome: 'davi.jpg', tipo: 'image/jpeg', conteudo };
}

/** O ponteiro do bloco de GPS no EXIF (tag 0x8825, little-endian). */
const PONTEIRO_DO_GPS = Buffer.from([0x25, 0x88]);

type Resposta = { personagem: Personagem };

async function baixar(a: FastifyInstance, quem: Pessoa, nome: string) {
  return a.inject({ method: 'GET', url: urlDoArquivo(nome), cookies: quem.cookies });
}

describe('POST /api/personagens/:id/imagem', () => {
  it('foto: converte para WebP, tira o GPS, grava com o hash e avisa a mesa', async () => {
    const { a, eventos, bia, caso, davi, pasta } = await mesaPronta();
    const jpeg = await jpegComGps(2000, 1500);
    expect((await sharp(jpeg.conteudo).metadata()).exif?.includes(PONTEIRO_DO_GPS)).toBe(true);

    const r = await enviar(a, bia, davi.id, { tipo: 'foto' }, jpeg);

    expect(r.statusCode).toBe(200);
    const { personagem } = r.json<Resposta>();
    expect(personagem.foto).toMatch(/^[0-9a-f]{64}\.webp$/);
    const salvo = await sharp(join(pasta, String(personagem.foto))).metadata();
    expect(salvo).toMatchObject({ format: 'webp', width: 1024, height: 768 });
    expect(salvo.exif).toBeUndefined();
    expect(eventos).toEqual([
      { type: 'character.changed', campanhaId: caso, personagemId: davi.id, removido: false },
    ]);
  });

  it('token: 256 × 256 do recorte pedido', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    // Metade esquerda vermelha, metade direita azul: o recorte da direita sai azul.
    const metade = await fundo(400, 600, '#00f').png().toBuffer();
    const conteudo = await fundo(800, 600, '#f00')
      .composite([{ input: metade, left: 400, top: 0 }])
      .png()
      .toBuffer();

    const r = await enviar(
      a,
      bia,
      davi.id,
      { tipo: 'token', recorte: JSON.stringify({ x: 0.5, y: 0, lado: 0.5 }) },
      { nome: 'davi.png', tipo: 'image/png', conteudo },
    );

    const { personagem } = r.json<Resposta>();
    const token = sharp(join(pasta, String(personagem.tokenImg)));
    expect(await token.metadata()).toMatchObject({ width: 256, height: 256 });
    const { dominant } = await token.stats();
    expect(dominant.b).toBeGreaterThan(200);
    expect(dominant.r).toBeLessThan(50);
  });

  it('"Usar a foto": o token sai da foto que já está no personagem', async () => {
    const { a, bia, davi } = await mesaPronta();
    await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps());

    const r = await enviar(a, bia, davi.id, { tipo: 'token', usarFoto: 'sim' });

    expect(r.statusCode).toBe(200);
    const { personagem } = r.json<Resposta>();
    expect(personagem.tokenImg).toMatch(/\.webp$/);
    expect(personagem.tokenImg).not.toBe(personagem.foto);
  });

  it('"Usar a foto" sem foto é recusado', async () => {
    const { a, bia, davi } = await mesaPronta();
    const r = await enviar(a, bia, davi.id, { tipo: 'token', usarFoto: 'sim' });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ erro: { codigo: 'SEM_FOTO' } });
  });

  it('GIF animado é recusado com mensagem', async () => {
    const { a, bia, davi } = await mesaPronta();
    const quadros = [
      await fundo(40, 40, '#f00').png().toBuffer(),
      await fundo(40, 40, '#00f').png().toBuffer(),
    ];
    const gif = await sharp(quadros, { join: { animated: true } })
      .gif()
      .toBuffer();

    const r = await enviar(
      a,
      bia,
      davi.id,
      { tipo: 'foto' },
      { nome: 'davi.gif', tipo: 'image/gif', conteudo: gif },
    );

    expect(r.statusCode).toBe(415);
    expect(r.json()).toEqual({
      erro: {
        codigo: 'IMAGEM_ANIMADA',
        mensagem: 'Imagem animada (como um GIF) não serve: envie uma imagem parada.',
      },
    });
  });

  it('PDF e SVG são recusados com mensagem', async () => {
    const { a, bia, davi } = await mesaPronta();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n');
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );

    for (const arquivo of [
      { nome: 'ficha.pdf', tipo: 'application/pdf', conteudo: pdf },
      { nome: 'davi.svg', tipo: 'image/svg+xml', conteudo: svg },
    ]) {
      const r = await enviar(a, bia, davi.id, { tipo: 'foto' }, arquivo);
      expect(r.statusCode).toBe(415);
      expect(r.json()).toMatchObject({
        erro: {
          codigo: 'NAO_E_IMAGEM',
          mensagem: 'Este arquivo não é uma imagem que dê para usar. Envie um JPG, PNG ou WebP.',
        },
      });
    }
  });

  it('imagem acima de 5 MB é recusada com mensagem', async () => {
    const { a, bia, davi } = await mesaPronta();
    const grande = Buffer.alloc(LIMITE_DA_IMAGEM + 1, 0);

    const r = await enviar(
      a,
      bia,
      davi.id,
      { tipo: 'foto' },
      { nome: 'grande.jpg', tipo: 'image/jpeg', conteudo: grande },
    );

    expect(r.statusCode).toBe(413);
    expect(r.json()).toMatchObject({
      erro: { codigo: 'IMAGEM_GRANDE', mensagem: expect.stringContaining('5 MB') as string },
    });
  });

  it('sem arquivo, sem tipo ou com recorte estragado é 400', async () => {
    const { a, bia, davi } = await mesaPronta();
    const semArquivo = await enviar(a, bia, davi.id, { tipo: 'foto' });
    expect(semArquivo.json()).toMatchObject({
      erro: { campos: { arquivo: 'Escolha uma imagem.' } },
    });
    const jpeg = await jpegComGps();
    const semTipo = await enviar(a, bia, davi.id, {}, jpeg);
    expect(semTipo.json()).toMatchObject({
      erro: { campos: { tipo: 'Diga se é a foto ou o token.' } },
    });
    const recorte = await enviar(a, bia, davi.id, { tipo: 'token', recorte: '{"x":2}' }, jpeg);
    expect(recorte.json()).toMatchObject({
      erro: { campos: { recorte: 'O recorte do token veio estragado.' } },
    });
  });

  it('pedido que não é multipart é 415', async () => {
    const { a, bia, davi } = await mesaPronta();
    const r = await a.inject({
      method: 'POST',
      url: `/api/personagens/${davi.id}/imagem`,
      cookies: bia.cookies,
      payload: { tipo: 'foto' },
    });
    expect(r.statusCode).toBe(415);
  });

  it('o mestre pode trocar; outro jogador recebe 403 e quem é de fora, 404', async () => {
    const { a, ana, caio, estranho, davi } = await mesaPronta();
    const jpeg = await jpegComGps();
    expect((await enviar(a, ana, davi.id, { tipo: 'foto' }, jpeg)).statusCode).toBe(200);
    expect((await enviar(a, caio, davi.id, { tipo: 'foto' }, jpeg)).statusCode).toBe(403);
    expect((await enviar(a, estranho, davi.id, { tipo: 'foto' }, jpeg)).statusCode).toBe(404);
  });

  it('trocar a foto apaga a antiga; tirar a foto apaga o arquivo', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    const primeira = (
      await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps())
    ).json<Resposta>().personagem.foto;
    const segunda = (
      await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps(600, 600))
    ).json<Resposta>().personagem.foto;
    expect(segunda).not.toBe(primeira);
    expect(readdirSync(pasta)).toEqual([segunda]);

    const r = await a.inject({
      method: 'DELETE',
      url: `/api/personagens/${davi.id}/imagem/foto`,
      cookies: bia.cookies,
    });
    expect(r.json<Resposta>().personagem.foto).toBeNull();
    expect(readdirSync(pasta)).toEqual([]);

    const ruim = await a.inject({
      method: 'DELETE',
      url: `/api/personagens/${davi.id}/imagem/capa`,
      cookies: bia.cookies,
    });
    expect(ruim.statusCode).toBe(400);
  });

  it('a mesma imagem em dois personagens vira um arquivo só, que fica enquanto um usar', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    const outro = (
      await a.inject({
        method: 'POST',
        url: '/api/personagens',
        cookies: bia.cookies,
        payload: { ficha: fichaDoDavi() },
      })
    ).json<Resposta>().personagem;
    const jpeg = await jpegComGps();
    await enviar(a, bia, davi.id, { tipo: 'foto' }, jpeg);
    await enviar(a, bia, outro.id, { tipo: 'foto' }, jpeg);
    expect(readdirSync(pasta)).toHaveLength(1);

    await a.inject({
      method: 'DELETE',
      url: `/api/personagens/${davi.id}/imagem/foto`,
      cookies: bia.cookies,
    });
    expect(readdirSync(pasta)).toHaveLength(1);
  });
});

describe('GET /api/arquivos/:nome', () => {
  it('quem é do caso recebe a imagem, com cache longo e privado', async () => {
    const { a, bia, caio, ana, davi } = await mesaPronta();
    const { foto } = (
      await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps())
    ).json<Resposta>().personagem;

    for (const quem of [bia, caio, ana]) {
      const r = await baixar(a, quem, String(foto));
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toBe('image/webp');
      expect(r.headers['cache-control']).toBe(CACHE_DOS_ARQUIVOS);
      expect(r.rawPayload.subarray(8, 12).toString()).toBe('WEBP');
    }
  });

  it('usuário de fora recebe 404; sem login, 401', async () => {
    const { a, bia, estranho, davi } = await mesaPronta();
    const { foto } = (
      await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps())
    ).json<Resposta>().personagem;

    const fora = await baixar(a, estranho, String(foto));
    expect(fora.statusCode).toBe(404);
    expect(fora.json()).toMatchObject({ erro: { codigo: 'ARQUIVO_NAO_ENCONTRADO' } });
    const anonimo = await a.inject({ method: 'GET', url: urlDoArquivo(String(foto)) });
    expect(anonimo.statusCode).toBe(401);
  });

  it('personagem sem caso: só o dono vê', async () => {
    const { a, bia, ana } = await mesaPronta();
    const solto = (
      await a.inject({
        method: 'POST',
        url: '/api/personagens',
        cookies: bia.cookies,
        payload: { ficha: fichaDoDavi() },
      })
    ).json<Resposta>().personagem;
    const { foto } = (
      await enviar(a, bia, solto.id, { tipo: 'foto' }, await jpegComGps(300, 300))
    ).json<Resposta>().personagem;

    expect((await baixar(a, bia, String(foto))).statusCode).toBe(200);
    expect((await baixar(a, ana, String(foto))).statusCode).toBe(404);
  });

  it('nome fora do formato ou arquivo sumido do disco é 404', async () => {
    const { a, bia, davi, pasta } = await mesaPronta();
    expect((await baixar(a, bia, '../membrana.db')).statusCode).toBe(404);
    expect((await baixar(a, bia, `${'a'.repeat(64)}.webp`)).statusCode).toBe(404);

    const { foto } = (
      await enviar(a, bia, davi.id, { tipo: 'foto' }, await jpegComGps())
    ).json<Resposta>().personagem;
    rmSync(join(pasta, String(foto)));
    expect(existsSync(join(pasta, String(foto)))).toBe(false);
    expect((await baixar(a, bia, String(foto))).statusCode).toBe(404);
  });
});
