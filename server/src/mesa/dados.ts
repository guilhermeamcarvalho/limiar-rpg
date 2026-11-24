// Consultas da mesa ao vivo: o estado salvo, o registro da sessão e os personagens do caso.
import { and, eq, isNull, max, or } from 'drizzle-orm';
import type { EstadoDaMesa, EventoDaMesa } from '@membrana/shared';
import type { Banco } from '../db/index.ts';
import { campaigns, characters, memberships, sessionLog, tableStates } from '../db/schema.ts';

export interface EstadoSalvo {
  campanhaId: string;
  estado: EstadoDaMesa;
  seq: number;
}

/** O estado salvo de cada mesa de caso em curso: o que o servidor carrega ao subir. */
export function lerEstadosSalvos(db: Banco): EstadoSalvo[] {
  return db
    .select({
      campanhaId: tableStates.campaignId,
      estado: tableStates.estado,
      seq: tableStates.seq,
    })
    .from(tableStates)
    .innerJoin(campaigns, eq(campaigns.id, tableStates.campaignId))
    .where(isNull(campaigns.encerradoEm))
    .all();
}

export function lerEstadoSalvo(db: Banco, campanhaId: string): EstadoSalvo | null {
  return (
    db
      .select({
        campanhaId: tableStates.campaignId,
        estado: tableStates.estado,
        seq: tableStates.seq,
      })
      .from(tableStates)
      .where(eq(tableStates.campaignId, campanhaId))
      .get() ?? null
  );
}

export function gravarEstado(
  db: Banco,
  campanhaId: string,
  estado: EstadoDaMesa,
  seq: number,
  agora = new Date(),
) {
  db.insert(tableStates)
    .values({ campaignId: campanhaId, estado, seq, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: tableStates.campaignId,
      set: { estado, seq, atualizadoEm: agora },
    })
    .run();
}

export function registrarEventos(db: Banco, campanhaId: string, eventos: readonly EventoDaMesa[]) {
  if (eventos.length === 0) return;
  db.insert(sessionLog)
    .values(eventos.map((e) => ({ campaignId: campanhaId, seq: e.seq, tipo: e.type, dados: e })))
    .run();
}

/**
 * O maior número já gravado no registro. O registro é gravado na hora e o estado só um segundo
 * depois: depois de uma queda, a sequência continua daqui para não repetir número.
 */
export function ultimoSeqRegistrado(db: Banco, campanhaId: string): number {
  const linha = db
    .select({ seq: max(sessionLog.seq) })
    .from(sessionLog)
    .where(eq(sessionLog.campaignId, campanhaId))
    .get();
  return linha?.seq ?? 0;
}

/** O dono do personagem, se ele for deste caso: do caso, ou escolhido por alguém para jogar nele. */
export function donoDoPersonagemNoCaso(
  db: Banco,
  campanhaId: string,
  personagemId: string,
): { donoId: string } | null {
  const linha = db
    .selectDistinct({ donoId: characters.ownerId })
    .from(characters)
    .leftJoin(
      memberships,
      and(eq(memberships.characterId, characters.id), eq(memberships.campaignId, campanhaId)),
    )
    .where(
      and(
        eq(characters.id, personagemId),
        or(eq(characters.campaignId, campanhaId), eq(memberships.campaignId, campanhaId)),
      ),
    )
    .get();
  return linha ?? null;
}
