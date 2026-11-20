// Gerar o código e gravar um convite. Usado pela rota de convites e ao abrir um caso novo.
import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Banco } from '../../db/index.ts';
import { invites } from '../../db/schema.ts';

const DIA = 24 * 60 * 60 * 1000;

/** Sem letras e números que se confundem (0/O, 1/I/L): a pessoa pode ditar o código. */
const SUFIXO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PALAVRAS_VAZIAS = new Set([
  'DE',
  'DA',
  'DO',
  'DAS',
  'DOS',
  'NO',
  'NA',
  'NOS',
  'NAS',
  'UM',
  'UMA',
]);

/** A palavra mais longa do nome, sem acento: "O Sinal de Santa Ermida" → ERMIDA. */
export function palavraDoNome(nome: string): string {
  const palavras = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p));
  const maior = palavras.reduce((a, b) => (b.length >= a.length ? b : a), '');
  return (maior || 'CASO').slice(0, 8);
}

export function gerarCodigo(nome: string): string {
  const sufixo = Array.from({ length: 4 }, () => SUFIXO[randomInt(SUFIXO.length)]).join('');
  return `${palavraDoNome(nome)}-${sufixo}`;
}

/**
 * Grava um convite novo e devolve o código. Aceita a transação de quem chama, para o convite
 * nascer junto com o caso.
 */
export function inserirConvite(
  db: Pick<Banco, 'select' | 'insert'>,
  dados: {
    campaignId: string;
    nomeDoCaso: string;
    vagas: number;
    expiraEmDias: number;
    criadoPor: string;
  },
): string {
  // Código repetido é raríssimo, mas a coluna é única: tenta de novo com outro sufixo.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo(dados.nomeDoCaso);
    if (db.select().from(invites).where(eq(invites.codigo, codigo)).get()) continue;
    db.insert(invites)
      .values({
        codigo,
        campaignId: dados.campaignId,
        vagas: dados.vagas,
        expiraEm: new Date(Date.now() + dados.expiraEmDias * DIA),
        criadoPor: dados.criadoPor,
      })
      .run();
    return codigo;
  }
  throw new Error('Não deu para gerar um código de convite único');
}
