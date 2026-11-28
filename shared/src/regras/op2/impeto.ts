// Barra de perfil de Ordem 2:
// - Executor: Ímpeto (falhar em teste enche 1; 1 = +d4 no teste, 3 = +1 passo em atributo na cena).
// - Analista: Plano (observar/planejar sem testar enche 1; 1 = +d4 no teste, 3 = +1 passo em atributo).
// - Vigilante: Reflexo (ser atacado/surpreendido enche 1; 1 = +d4 em esquiva, 3 = ação fora do turno).
import { IMPETO_MAXIMO, type FichaOp2, type PerfilOp2 } from '../../schemas/ficha-op2.ts';
import { ErroDeRegra } from '../dados.ts';
import { adicionarModificador } from './passos.ts';
import type { AtributoOp2 } from './pericias.ts';
import { falhou, type ExtraDeTeste, type Veredito } from './teste.ts';

export interface RecursoDoPerfilInfo {
  nome: 'Ímpeto' | 'Plano' | 'Reflexo';
  podeSubirAtributo: boolean;
  rotuloTeste: string;
  descricao: string;
}

const RECURSOS_POR_PERFIL: Record<PerfilOp2, RecursoDoPerfilInfo> = {
  executor: {
    nome: 'Ímpeto',
    podeSubirAtributo: true,
    rotuloTeste: 'Ímpeto',
    descricao:
      'Cada falha enche um espaço. Gaste 1 para somar +d4 num teste, ou 3 para subir um atributo um passo até o fim da cena.',
  },
  analista: {
    nome: 'Plano',
    podeSubirAtributo: true,
    rotuloTeste: 'Plano',
    descricao:
      'Gastar ação importante observando ou planejando (sem testar) enche 1 espaço. Gaste 1 para somar +d4 num teste, ou 3 para subir um atributo um passo até o fim da cena.',
  },
  vigilante: {
    nome: 'Reflexo',
    podeSubirAtributo: false,
    rotuloTeste: 'Reflexo (esquiva)',
    descricao:
      'Ser atacado ou surpreendido enche 1 espaço. Gaste 1 para somar +d4 em esquiva, ou 3 para realizar uma ação importante fora do seu turno.',
  },
};

export const recursoDoPerfil = (perfil: PerfilOp2): RecursoDoPerfilInfo =>
  RECURSOS_POR_PERFIL[perfil];

export const maximoDaBarraDePerfil = (ficha: Pick<FichaOp2, 'perfil' | 'nivel'>): number =>
  ficha.perfil === 'executor' && ficha.nivel >= 7 ? 4 : IMPETO_MAXIMO;

/** Mantido para compatibilidade: indica se o perfil usa a barra (todos os 3 perfis usam). */
export const temImpeto = (ficha: FichaOp2): boolean => ficha.perfil.length > 0;

function exigirSaldo(ficha: FichaOp2, quanto: number) {
  const nome = recursoDoPerfil(ficha.perfil).nome;
  if (ficha.impeto < quanto) {
    throw new ErroDeRegra(
      'impeto',
      `${nome} insuficiente: precisa de ${String(quanto)}, tem ${String(ficha.impeto)}.`,
    );
  }
}

/** Depois de um teste: se falhou, apenas o Executor enche um espaço automaticamente. */
export function registrarResultadoNoImpeto(ficha: FichaOp2, veredito: Veredito): FichaOp2 {
  if (ficha.perfil !== 'executor' || !falhou(veredito)) return ficha;
  const max = maximoDaBarraDePerfil(ficha);
  return { ...ficha, impeto: Math.min(max, ficha.impeto + 1) };
}

/** Gasta 1 da barra do perfil: devolve a ficha e o d4 dourado para somar ao teste. */
export function gastarImpetoNoTeste(ficha: FichaOp2): { ficha: FichaOp2; extra: ExtraDeTeste } {
  exigirSaldo(ficha, 1);
  const { nome } = recursoDoPerfil(ficha.perfil);
  return {
    ficha: { ...ficha, impeto: ficha.impeto - 1 },
    extra: { tipo: 'd4', origem: nome },
  };
}

/** Gasta 3 (Executor ou Analista): o atributo sobe um passo até o fim da cena. */
export function gastarImpetoNoAtributo(ficha: FichaOp2, atributo: AtributoOp2): FichaOp2 {
  const info = recursoDoPerfil(ficha.perfil);
  if (!info.podeSubirAtributo) {
    throw new ErroDeRegra(
      'impeto',
      'O Vigilante gasta 3 de Reflexo para agir fora do turno, não para subir atributo.',
    );
  }
  exigirSaldo(ficha, IMPETO_MAXIMO);
  const comMod = adicionarModificador(ficha, {
    alvo: atributo,
    passos: 1,
    origem: info.nome,
    duracao: 'cena',
  });
  return { ...comMod, impeto: ficha.impeto - IMPETO_MAXIMO, impetoAtributo: atributo };
}
