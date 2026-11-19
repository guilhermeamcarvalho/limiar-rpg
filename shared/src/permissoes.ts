// Quem pode o quê. Toda decisão de "pode ou não pode" mora aqui, em funções puras,
// usadas pelas rotas e pela mesa. Esconder um botão na tela não conta como permissão.
// Referência: "Matriz de permissões" em docs/produto-e-funcionalidades.md.

export type Papel = 'mestre' | 'jogador';

/** Quem pede. `null` é quem não entrou. */
export type Quem = { id: string } | null;

export interface CampanhaComMembros {
  id: string;
  membros: readonly { userId: string; papel: Papel }[];
  /** O mestre pode deixar os jogadores verem as fichas uns dos outros. */
  fichasVisiveis?: boolean;
}

export interface PersonagemMinimo {
  donoId: string;
  campanhaId: string;
}

/** O papel da pessoa nesta campanha, ou `null` se ela não participa. */
export function papelNa(quem: Quem, campanha: CampanhaComMembros): Papel | null {
  if (!quem) return null;
  return campanha.membros.find((m) => m.userId === quem.id)?.papel ?? null;
}

export function ehMestre(quem: Quem, campanha: CampanhaComMembros): boolean {
  return papelNa(quem, campanha) === 'mestre';
}

/** Só quem participa vê a campanha. */
export function podeVerCampanha(quem: Quem, campanha: CampanhaComMembros): boolean {
  return papelNa(quem, campanha) !== null;
}

/** Nome, gancho, sistema e regras: só o mestre. */
export function podeEditarCampanha(quem: Quem, campanha: CampanhaComMembros): boolean {
  return ehMestre(quem, campanha);
}

/** Criar e revogar convites: só o mestre. */
export function podeConvidar(quem: Quem, campanha: CampanhaComMembros): boolean {
  return ehMestre(quem, campanha);
}

/** O mestre edita qualquer ficha da campanha; o jogador, só a própria. */
export function podeEditarFicha(
  quem: Quem,
  personagem: PersonagemMinimo,
  campanha: CampanhaComMembros,
): boolean {
  if (personagem.campanhaId !== campanha.id) return false;
  const papel = papelNa(quem, campanha);
  if (papel === 'mestre') return true;
  return papel === 'jogador' && personagem.donoId === quem?.id;
}

/** Ver a ficha de outro jogador só se a campanha permitir. */
export function podeVerFicha(
  quem: Quem,
  personagem: PersonagemMinimo,
  campanha: CampanhaComMembros,
): boolean {
  if (podeEditarFicha(quem, personagem, campanha)) return true;
  return (
    personagem.campanhaId === campanha.id &&
    campanha.fichasVisiveis === true &&
    podeVerCampanha(quem, campanha)
  );
}
