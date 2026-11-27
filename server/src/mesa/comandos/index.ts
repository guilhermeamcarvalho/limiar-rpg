// Todos os tratadores, por tipo de comando. Comando do contrato sem tratador ainda (pistas, salas,
// pontos de interesse e trilha: chegam na Fase 3) é recusado com aviso.
import type { ComandoValidado, EventoDaMesaSemSeq } from '@membrana/shared';
import { tratadoresDoChat } from './chat.ts';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';
import { tratadoresDeDados } from './dados.ts';
import { tratadoresDeInvestigacao } from './investigar.ts';
import { tratadoresDoMapa } from './mapa.ts';
import { tratadoresDoBreu } from './breu.ts';
import { tratadoresDaNevoa } from './nevoa.ts';
import { tratadoresDePistas } from './pistas.ts';
import { tratadoresDeProps } from './props.ts';
import { tratadoresDaRodada } from './rodada.ts';
import { tratadoresDeSalas } from './salas.ts';
import { tratadoresDeTestes } from './testes.ts';
import { tratadoresDeTokens } from './tokens.ts';

const TRATADORES: Tratadores = {
  ...tratadoresDeTokens,
  ...tratadoresDeProps,
  ...tratadoresDoBreu,
  ...tratadoresDaNevoa,
  ...tratadoresDaRodada,
  ...tratadoresDeInvestigacao,
  ...tratadoresDeSalas,
  ...tratadoresDePistas,
  ...tratadoresDoMapa,
  ...tratadoresDeDados,
  ...tratadoresDeTestes,
  ...tratadoresDoChat,
};

export function tratar(ctx: Contexto, comando: ComandoValidado): EventoDaMesaSemSeq[] {
  const tratador = TRATADORES[comando.type];
  if (!tratador) throw new Recusa('Este comando ainda não está disponível na mesa.');
  // O TypeScript não liga o tipo do comando ao do tratador num acesso por chave: o mapa
  // `Tratadores` garante que cada tratador recebe o comando do próprio tipo.
  return tratador(ctx, comando as never);
}

export { Recusa, type Contexto } from './contexto.ts';
