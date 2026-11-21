// Dados que precisam existir antes de qualquer caso. Pode rodar quantas vezes quiser:
// a linha é inserida uma vez e, depois, só atualizada com o config atual.
import { CONFIG_OP2, esquemaConfigOp2, ID_OP2 } from '@membrana/shared';
import type { Banco } from './index.ts';
import { gameSystems } from './schema.ts';

export function semear(db: Banco) {
  const config = esquemaConfigOp2.parse(CONFIG_OP2);
  db.insert(gameSystems)
    .values({ id: ID_OP2, nome: 'Ordem Paranormal II', tipo: 'op2', config })
    .onConflictDoUpdate({
      target: gameSystems.id,
      set: { nome: 'Ordem Paranormal II', tipo: 'op2', config },
    })
    .run();
}
