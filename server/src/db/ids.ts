import { customAlphabet } from 'nanoid';

// Minúsculas e números: cabem em URL e não confundem quem lê em voz alta. 16 caracteres sobram.
const gerar = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

/** Prefixo diz o que é o id só de olhar: usr_…, cmp_…, sys_…, inv_…, chr_…, tst_…, tok_…, prp_…, nev_… */
export type PrefixoDeId = 'usr' | 'cmp' | 'sys' | 'inv' | 'chr' | 'tst' | 'tok' | 'prp' | 'nev';

export function novoId(prefixo: PrefixoDeId): string {
  return `${prefixo}_${gerar()}`;
}
