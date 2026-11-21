// Convites que a pessoa abriu (pelo link ou pelo código) e ainda não aceitou nem recusou.
// Ficam só neste navegador: o servidor não tem convite "endereçado" a alguém, só o código.
// Por isso a lista é só um lembrete. A Central confere cada código no servidor antes de mostrar.
import { useSyncExternalStore } from 'react';
import { codigoBemFormado, normalizarCodigo } from '@membrana/shared';

const CHAVE = 'membrana.convites-pendentes.v1';
const MAXIMO = 10;
const VAZIA: readonly string[] = [];

let atual: readonly string[] | null = null;
const ouvintes = new Set<() => void>();

function ler(): readonly string[] {
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    if (!Array.isArray(bruto)) return VAZIA;
    return bruto.filter((c): c is string => typeof c === 'string' && codigoBemFormado(c));
  } catch {
    return VAZIA;
  }
}

function gravar(lista: readonly string[]) {
  atual = lista;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Navegador sem armazenamento (aba anônima, cota cheia): vale só até fechar a página.
  }
  ouvintes.forEach((avisar) => {
    avisar();
  });
}

function lista(): readonly string[] {
  atual ??= ler();
  return atual;
}

export function guardarConvitePendente(codigo: string) {
  const c = normalizarCodigo(codigo);
  if (!codigoBemFormado(c)) return;
  const agora = lista();
  if (agora.includes(c)) return;
  gravar([c, ...agora].slice(0, MAXIMO));
}

export function esquecerConvitePendente(codigo: string) {
  const c = normalizarCodigo(codigo);
  const agora = lista();
  if (agora.includes(c)) gravar(agora.filter((x) => x !== c));
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  // Outra aba aceitou ou recusou: relê do armazenamento.
  const aoMudarEmOutraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return;
    atual = ler();
    avisar();
  };
  window.addEventListener('storage', aoMudarEmOutraAba);
  return () => {
    ouvintes.delete(avisar);
    window.removeEventListener('storage', aoMudarEmOutraAba);
  };
}

/** Os códigos guardados, do mais novo para o mais antigo. */
export function useConvitesPendentes(): readonly string[] {
  return useSyncExternalStore(assinar, lista, () => VAZIA);
}

/** Só para os testes: esquece o que está em memória e relê do armazenamento. */
export function reiniciarConvitesPendentes() {
  atual = null;
}
