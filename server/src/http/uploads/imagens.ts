// Foto e token: o sharp confere se é imagem de verdade, desvira (EXIF), tira os metadados (inclusive
// a localização) e converte para WebP. O arquivo é salvo com o hash do conteúdo no nome, então a
// mesma imagem enviada duas vezes vira um arquivo só.
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { eq, or } from 'drizzle-orm';
import sharp, { type Metadata } from 'sharp';
import {
  LADO_DO_TOKEN,
  LADO_MAXIMO_DO_MAPA,
  type Recorte,
  type TipoDeImagem,
} from '@membrana/shared';
import type { Banco } from '../../db/index.ts';
import { characters, clues, maps, props, tokens } from '../../db/schema.ts';
import { ErroDaApi } from '../erros.ts';

/** A foto da ficha fica com no máximo isto no lado maior. */
export const LADO_MAXIMO_DA_FOTO = 1024;
/** Imagem com mais pixels que isso nem é aberta (uma "bomba" de 5 MB pode ter 1 bilhão). */
const PIXELS_MAXIMOS = 40_000_000;
/** O mapa pode vir maior (8000 × 8000 são 64 milhões): é reduzido para 4096 px de qualquer jeito. */
const PIXELS_MAXIMOS_DO_MAPA = 100_000_000;
const QUALIDADE = 82;

/** Formatos que entram. SVG, PDF, TIFF e afins são recusados, mesmo que o sharp os leia. */
const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

/** Nome dos arquivos gerados: o sha-256 do conteúdo em hexadecimal, em WebP. */
export const NOME_DE_ARQUIVO = /^[0-9a-f]{64}\.webp$/;

const NAO_E_IMAGEM = new ErroDaApi(
  415,
  'NAO_E_IMAGEM',
  'Este arquivo não é uma imagem que dê para usar. Envie um JPG, PNG ou WebP.',
);

/** Confere o arquivo antes de mexer nele: é imagem, num formato aceito, e não é animada. */
async function conferir(entrada: Buffer, pixelsMaximos = PIXELS_MAXIMOS) {
  let info: Metadata;
  try {
    info = await sharp(entrada, { animated: true, limitInputPixels: pixelsMaximos }).metadata();
  } catch {
    throw NAO_E_IMAGEM;
  }
  if (!FORMATOS_ACEITOS.has(info.format)) throw NAO_E_IMAGEM;
  if ((info.pages ?? 1) > 1) {
    throw new ErroDaApi(
      415,
      'IMAGEM_ANIMADA',
      'Imagem animada (como um GIF) não serve: envie uma imagem parada.',
    );
  }
}

/** O quadrado do recorte em pixels, dentro da imagem. */
function quadrado(largura: number, altura: number, recorte: Recorte) {
  const lado = Math.max(
    1,
    Math.min(Math.round(recorte.lado * Math.min(largura, altura)), largura, altura),
  );
  const left = Math.min(Math.round(recorte.x * largura), largura - lado);
  const top = Math.min(Math.round(recorte.y * altura), altura - lado);
  return { left, top, width: lado, height: lado };
}

/**
 * Converte a imagem enviada. A foto fica com até 1024 px no lado maior; o token vira 256 × 256,
 * do `recorte` pedido ou, sem ele, do centro. A saída nunca leva metadados.
 */
export async function converterImagem(
  entrada: Buffer,
  tipo: TipoDeImagem,
  recorte?: Recorte,
): Promise<Buffer> {
  await conferir(entrada);
  const abrir = () => sharp(entrada, { limitInputPixels: PIXELS_MAXIMOS }).autoOrient();
  try {
    if (tipo === 'foto') {
      return await abrir()
        .resize(LADO_MAXIMO_DA_FOTO, LADO_MAXIMO_DA_FOTO, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: QUALIDADE })
        .toBuffer();
    }
    if (!recorte) {
      return await abrir()
        .resize(LADO_DO_TOKEN, LADO_DO_TOKEN, { fit: 'cover' })
        .webp({ quality: QUALIDADE })
        .toBuffer();
    }
    // O recorte foi escolhido na imagem já desvirada: desvira primeiro, recorta depois.
    const { data, info } = await abrir().raw().toBuffer({ resolveWithObject: true });
    return await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .extract(quadrado(info.width, info.height, recorte))
      .resize(LADO_DO_TOKEN, LADO_DO_TOKEN)
      .webp({ quality: QUALIDADE })
      .toBuffer();
  } catch {
    // Passou na conferência mas quebrou no meio (arquivo truncado, por exemplo).
    throw NAO_E_IMAGEM;
  }
}

/**
 * Converte o mapa enviado: desvira, tira os metadados e deixa o lado maior com no máximo 4096 px,
 * em WebP. Devolve a imagem e o tamanho final, que a mesa usa como o tamanho do mapa.
 */
export async function converterMapa(
  entrada: Buffer,
): Promise<{ imagem: Buffer; largura: number; altura: number }> {
  await conferir(entrada, PIXELS_MAXIMOS_DO_MAPA);
  try {
    const { data, info } = await sharp(entrada, { limitInputPixels: PIXELS_MAXIMOS_DO_MAPA })
      .autoOrient()
      .resize(LADO_MAXIMO_DO_MAPA, LADO_MAXIMO_DO_MAPA, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE })
      .toBuffer({ resolveWithObject: true });
    return { imagem: data, largura: info.width, altura: info.height };
  } catch {
    throw NAO_E_IMAGEM;
  }
}

/** O prop do mestre: até 1024 px no lado maior, em WebP, mantendo o fundo transparente. */
export const LADO_MAXIMO_DO_PROP = 1024;
/** A foto ou documento da pista: até 1600 px no lado maior (legível ao ampliar), sem metadados. */
export const LADO_MAXIMO_DA_PISTA = 1600;

export async function converterProp(entrada: Buffer): Promise<Buffer> {
  await conferir(entrada);
  try {
    return await sharp(entrada, { limitInputPixels: PIXELS_MAXIMOS })
      .autoOrient()
      .resize(LADO_MAXIMO_DO_PROP, LADO_MAXIMO_DO_PROP, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE, alphaQuality: 100 })
      .toBuffer();
  } catch {
    throw NAO_E_IMAGEM;
  }
}

export async function converterPista(entrada: Buffer): Promise<Buffer> {
  await conferir(entrada);
  try {
    return await sharp(entrada, { limitInputPixels: PIXELS_MAXIMOS })
      .autoOrient()
      .resize(LADO_MAXIMO_DA_PISTA, LADO_MAXIMO_DA_PISTA, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: QUALIDADE, alphaQuality: 100 })
      .toBuffer();
  } catch {
    throw NAO_E_IMAGEM;
  }
}

/** Grava a imagem convertida em `pasta` e devolve o nome (`<hash>.webp`). */
export async function salvarImagem(pasta: string, imagem: Buffer): Promise<string> {
  const nome = `${createHash('sha256').update(imagem).digest('hex')}.webp`;
  await mkdir(pasta, { recursive: true });
  try {
    await writeFile(join(pasta, nome), imagem, { flag: 'wx' });
  } catch (e) {
    // Já existe: é o mesmo conteúdo (o nome é o hash), então serve como está.
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  return nome;
}

/**
 * Apaga o arquivo se nada usa mais ele: nenhum personagem (foto ou token), mapa, token ou prop no
 * banco, nem a mesa em memória (`naMesa`), que pode ter algo que ainda não foi salvo.
 */
export async function apagarSeLivre(
  db: Banco,
  pasta: string,
  nome: string | null,
  naMesa: (nome: string) => boolean,
) {
  // Prop pronto (`pronto:caixote`) não é arquivo: não há o que apagar.
  if (!nome || !NOME_DE_ARQUIVO.test(nome) || naMesa(nome)) return;
  const usos = [
    db
      .select({ id: characters.id })
      .from(characters)
      .where(or(eq(characters.foto, nome), eq(characters.tokenImg, nome)))
      .get(),
    db.select({ id: maps.id }).from(maps).where(eq(maps.imagem, nome)).get(),
    db.select({ id: tokens.id }).from(tokens).where(eq(tokens.imagem, nome)).get(),
    db.select({ id: props.id }).from(props).where(eq(props.imagem, nome)).get(),
    db.select({ id: clues.id }).from(clues).where(eq(clues.imagem, nome)).get(),
  ];
  if (usos.every((uso) => uso === undefined))
    await rm(join(pasta, basename(nome)), { force: true });
}
