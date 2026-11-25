// Todos os tratadores, por tipo de comando. Comando do contrato sem tratador ainda (pistas, dados,
// testes, chat, trilha: chegam nas próximas issues) é recusado com aviso.
import type { ComandoValidado, EventoDaMesaSemSeq } from '@membrana/shared';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';
import { tratadoresDoMapa } from './mapa.ts';
import { tratadoresDoBreu } from './breu.ts';
import { tratadoresDaNevoa } from './nevoa.ts';
import { tratadoresDeProps } from './props.ts';
import { tratadoresDaRodada } from './rodada.ts';
import { tratadoresDeTokens } from './tokens.ts';

const TRATADORES: Tratadores = {
  ...tratadoresDeTokens,
  ...tratadoresDeProps,
  ...tratadoresDoBreu,
  ...tratadoresDaNevoa,
  ...tratadoresDaRodada,
  ...tratadoresDoMapa,
};

export function tratar(ctx: Contexto, comando: ComandoValidado): EventoDaMesaSemSeq[] {
  const tratador = TRATADORES[comando.type];
  if (!tratador) throw new Recusa('Este comando ainda não está disponível na mesa.');
  // O TypeScript não liga o tipo do comando ao do tratador num acesso por chave: o mapa
  // `Tratadores` garante que cada tratador recebe o comando do próprio tipo.
  return tratador(ctx, comando as never);
}

export { Recusa, type Contexto } from './contexto.ts';
