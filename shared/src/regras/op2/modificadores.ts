// Habilidades como dados, não como caso especial na tela: cada uma diz o dado que soma, as perícias
// em que vale, o custo, o limite de uso e de quem é. Trocar a regra provisória pelo texto do
// manual é mudar dados aqui. Referência: docs/regras-do-jogo.md, "Perfis e ocupações".
import type { FichaOp2, PerfilOp2 } from '../../schemas/ficha-op2.ts';
import { ErroDeRegra, type Dado } from '../dados.ts';
import { nomeDaPericia, type PericiaOp2 } from './pericias.ts';
import { MAX_DADOS_NO_TESTE, type TesteOp2 } from './teste.ts';

export interface Habilidade {
  id: string;
  nome: string;
  /** O dado que soma ao teste, dourado. */
  dado: Dado;
  pericias: readonly PericiaOp2[];
  custo: { pv?: number; pd?: number };
  /** "cena": uma vez por cena. `null`: sem limite. */
  limite: 'cena' | null;
  /** Quem tem: uma ocupação (id sem acento, e o nome para as mensagens) ou um perfil. */
  de: { ocupacao: string; nomeDaOcupacao: string } | { perfil: PerfilOp2 };
}

/** Mecânico: uma vez por cena, gaste 2 PV para +d4 num teste de Máquinas ou Crime. */
export const GAMBIARRA = {
  id: 'gambiarra',
  nome: 'Gambiarra',
  dado: 'd4',
  pericias: ['maquinas', 'crime'],
  custo: { pv: 2 },
  limite: 'cena',
  de: { ocupacao: 'mecanico', nomeDaOcupacao: 'Mecânico' },
} as const satisfies Habilidade;

export const HABILIDADES_OP2: readonly Habilidade[] = [GAMBIARRA];

const paraId = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export function temHabilidade(ficha: FichaOp2, hab: Habilidade): boolean {
  return 'perfil' in hab.de
    ? ficha.perfil === hab.de.perfil
    : paraId(ficha.ocupacao) === hab.de.ocupacao;
}

/** As habilidades que a ficha tem, pela ocupação e pelo perfil. */
export function habilidadesDaFicha(ficha: FichaOp2): Habilidade[] {
  return HABILIDADES_OP2.filter((h) => temHabilidade(ficha, h));
}

/** "Máquinas ou Crime". */
function listaDePericias(pericias: readonly PericiaOp2[]): string {
  const nomes = pericias.map(nomeDaPericia);
  return nomes.length > 1
    ? `${nomes.slice(0, -1).join(', ')} ou ${String(nomes.at(-1))}`
    : nomes.join('');
}

/**
 * Usa a habilidade num teste: confere se a ficha tem a habilidade, se vale para a perícia, se
 * ainda dá para usar nesta cena e se há PV ou PD para pagar. Devolve a ficha já paga e o teste
 * com o dado a mais.
 */
export function aplicarModificador(
  ficha: FichaOp2,
  teste: TesteOp2,
  hab: Habilidade,
): { ficha: FichaOp2; teste: TesteOp2 } {
  if (!temHabilidade(ficha, hab)) {
    const dono = 'perfil' in hab.de ? `do perfil ${hab.de.perfil}` : `de ${hab.de.nomeDaOcupacao}`;
    throw new ErroDeRegra('habilidade', `${hab.nome} é uma habilidade ${dono}.`);
  }
  if (!teste.periciaId || !hab.pericias.includes(teste.periciaId)) {
    throw new ErroDeRegra('periciaId', `${hab.nome} só vale em ${listaDePericias(hab.pericias)}.`);
  }
  if (hab.limite === 'cena' && ficha.usadasNaCena.includes(hab.id)) {
    throw new ErroDeRegra('habilidade', `${hab.nome} já foi usada nesta cena.`);
  }
  const custoPv = hab.custo.pv ?? 0;
  const custoPd = hab.custo.pd ?? 0;
  if (ficha.pv < custoPv) {
    throw new ErroDeRegra(
      'pv',
      `${hab.nome} custa ${String(custoPv)} PV, e só há ${String(ficha.pv)}.`,
    );
  }
  if (ficha.pd < custoPd) {
    throw new ErroDeRegra(
      'pd',
      `${hab.nome} custa ${String(custoPd)} PD, e só há ${String(ficha.pd)}.`,
    );
  }
  if (teste.extras.length >= MAX_DADOS_NO_TESTE - 2) {
    throw new ErroDeRegra('extras', 'O teste já tem o máximo de dados.');
  }

  return {
    ficha: {
      ...ficha,
      pv: ficha.pv - custoPv,
      pd: ficha.pd - custoPd,
      usadasNaCena: hab.limite === 'cena' ? [...ficha.usadasNaCena, hab.id] : ficha.usadasNaCena,
    },
    teste: { ...teste, extras: [...teste.extras, { tipo: hab.dado, origem: hab.nome }] },
  };
}
