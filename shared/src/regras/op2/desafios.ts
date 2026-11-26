// Regras dos desafios de acesso (#84): destrancar, arrombar, hack social e alcançar.
// O número máximo de tentativas fica centralizado aqui (4 por padrão) para mesa e escudo.
import { ErroDeRegra, type Dado } from '../dados.ts';

export const TENTATIVAS_MAXIMAS_PADRAO = 4;

export const TIPOS_DE_DESAFIO = ['destrancar', 'arrombar', 'hack', 'alcancar'] as const;
export type TipoDeDesafio = (typeof TIPOS_DE_DESAFIO)[number];

export interface EstadoDoDesafio {
  tipo: TipoDeDesafio;
  tentativasUsadas: number;
  tentativasMaximas: number;
  progresso: number;
  meta: number;
  travado: boolean;
  resolvido: boolean;
  ultimaDica?: 'baixo' | 'alto' | 'exato';
}

const TENTATIVAS_CRIME: Partial<Record<Dado, number>> = {
  d4: 1,
  d6: 2,
  d8: 3,
  d10: 4,
  d12: 5,
};

/** Tentativas por rodada para Destrancar conforme o dado de Crime. */
export function tentativasDeDestrancar(dadoCrime: Dado): number {
  return TENTATIVAS_CRIME[dadoCrime] ?? TENTATIVAS_MAXIMAS_PADRAO;
}

export function criarEstadoDoDesafio(
  tipo: TipoDeDesafio,
  opcoes: { tentativasMaximas?: number; meta?: number } = {},
): EstadoDoDesafio {
  const tentativasMaximas = Math.max(1, opcoes.tentativasMaximas ?? TENTATIVAS_MAXIMAS_PADRAO);
  const meta = Math.max(1, opcoes.meta ?? (tipo === 'arrombar' ? 12 : 1));
  return {
    tipo,
    tentativasUsadas: 0,
    tentativasMaximas,
    progresso: 0,
    meta,
    travado: false,
    resolvido: false,
  };
}

/** Aplica uma tentativa ao desafio; esgotar as tentativas trava o ponto até o mestre liberar. */
export function aplicarTentativaDeDesafio(
  atual: EstadoDoDesafio,
  resultado: {
    sucesso: boolean;
    valorObtido?: number;
    dica?: 'baixo' | 'alto' | 'exato';
  },
): EstadoDoDesafio {
  if (atual.travado) {
    throw new ErroDeRegra('desafio', 'Este ponto está travado. Aguarde o mestre liberar.');
  }
  if (atual.resolvido) return atual;

  const tentativasUsadas = atual.tentativasUsadas + 1;
  const ganho = resultado.sucesso ? Math.max(1, resultado.valorObtido ?? 1) : 0;
  const progresso = Math.min(atual.meta, atual.progresso + ganho);
  const resolvido = atual.tipo === 'arrombar' ? progresso >= atual.meta : resultado.sucesso;
  const travado = !resolvido && tentativasUsadas >= atual.tentativasMaximas;

  return {
    ...atual,
    tentativasUsadas,
    progresso,
    resolvido,
    travado,
    ...(resultado.dica !== undefined && { ultimaDica: resultado.dica }),
  };
}

/** O mestre libera o ponto travado, zerando as tentativas usadas. */
export function liberarDesafio(atual: EstadoDoDesafio): EstadoDoDesafio {
  return {
    ...atual,
    tentativasUsadas: 0,
    travado: false,
  };
}
