// Modo de combate: controle exclusivo do mestre (iniciar, encerrar, avançar/voltar turno,
// gerenciar participantes), além de `combat.finishTurn` para o jogador no próprio turno.
import {
  podeConduzirMesa,
  type EstadoDoCombate,
  type EventoDaMesaSemSeq,
  type ParticipanteDoCombate,
} from '@membrana/shared';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';

function exigirMestre(ctx: Contexto) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) {
    throw new Recusa('Só o mestre controla o modo de combate.');
  }
}

function exigirCombateAtivo(ctx: Contexto): EstadoDoCombate {
  const c = ctx.estado.combate;
  if (!c || !c.ativo || c.participantes.length === 0) {
    throw new Recusa('Não há combate ativo nesta mesa.');
  }
  return c;
}

function ordenarPorIniciativa(lista: ParticipanteDoCombate[]): ParticipanteDoCombate[] {
  return [...lista].sort((a, b) => b.iniciativa - a.iniciativa);
}

/** Avança para o próximo turno (pulando incapacitados se houver outros aptos). */
function avancarTurno(combate: EstadoDoCombate): {
  combate: EstadoDoCombate;
  mudouRodada: boolean;
} {
  const n = combate.participantes.length;
  const algumAtivo = combate.participantes.some((p) => !p.incapacitado);
  let idx = combate.turnoIndex;
  let rodada = combate.rodada;
  let mudouRodada = false;

  for (let tentativa = 0; tentativa < n; tentativa++) {
    idx += 1;
    if (idx >= n) {
      idx = 0;
      rodada += 1;
      mudouRodada = true;
    }
    if (!algumAtivo || !combate.participantes[idx]?.incapacitado) break;
  }

  return {
    combate: { ...combate, rodada, turnoIndex: idx },
    mudouRodada,
  };
}

/** Volta para o turno anterior (decrementando rodada se passar do índice 0, mínimo 1). */
function voltarTurno(combate: EstadoDoCombate): { combate: EstadoDoCombate; mudouRodada: boolean } {
  const n = combate.participantes.length;
  const algumAtivo = combate.participantes.some((p) => !p.incapacitado);
  let idx = combate.turnoIndex;
  let rodada = combate.rodada;
  let mudouRodada = false;

  for (let tentativa = 0; tentativa < n; tentativa++) {
    idx -= 1;
    if (idx < 0) {
      if (rodada <= 1) {
        idx = 0;
        break;
      }
      idx = n - 1;
      rodada -= 1;
      mudouRodada = true;
    }
    if (!algumAtivo || !combate.participantes[idx]?.incapacitado) break;
  }

  return {
    combate: { ...combate, rodada, turnoIndex: idx },
    mudouRodada,
  };
}

export const tratadoresDeCombate: Tratadores = {
  'combat.start'(ctx, cmd) {
    exigirMestre(ctx);
    const ordenados = ordenarPorIniciativa(cmd.participantes);
    const primeiroAtivo = ordenados.findIndex((p) => !p.incapacitado);
    const novo: EstadoDoCombate = {
      ativo: true,
      rodada: 1,
      turnoIndex: primeiroAtivo >= 0 ? primeiroAtivo : 0,
      participantes: ordenados,
    };
    ctx.estado.combate = novo;
    return [
      { type: 'combat.updated', combate: novo },
      { type: 'combat.started', rodada: 1, participantes: ordenados.length },
    ];
  },

  'combat.end'(ctx) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const rodadaFinal = atual.rodada;
    ctx.estado.combate = null;
    return [
      { type: 'combat.updated', combate: null },
      { type: 'combat.ended', rodada: rodadaFinal },
    ];
  },

  'combat.nextTurn'(ctx) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const { combate, mudouRodada } = avancarTurno(atual);
    ctx.estado.combate = combate;
    const eventos: EventoDaMesaSemSeq[] = [{ type: 'combat.updated', combate }];
    if (mudouRodada) eventos.push({ type: 'combat.roundChanged', rodada: combate.rodada });
    return eventos;
  },

  'combat.prevTurn'(ctx) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const { combate, mudouRodada } = voltarTurno(atual);
    ctx.estado.combate = combate;
    const eventos: EventoDaMesaSemSeq[] = [{ type: 'combat.updated', combate }];
    if (mudouRodada) eventos.push({ type: 'combat.roundChanged', rodada: combate.rodada });
    return eventos;
  },

  'combat.finishTurn'(ctx) {
    const atual = exigirCombateAtivo(ctx);
    const daVez = atual.participantes[atual.turnoIndex];
    const ehDoJogador =
      daVez &&
      (daVez.donoId === ctx.quem.id ||
        (ctx.personagemId !== null && daVez.personagemId === ctx.personagemId));
    if (!podeConduzirMesa(ctx.quem, ctx.campanha) && !ehDoJogador) {
      throw new Recusa('Não é o seu turno para encerrar.');
    }
    const { combate, mudouRodada } = avancarTurno(atual);
    ctx.estado.combate = combate;
    const eventos: EventoDaMesaSemSeq[] = [{ type: 'combat.updated', combate }];
    if (mudouRodada) eventos.push({ type: 'combat.roundChanged', rodada: combate.rodada });
    return eventos;
  },

  'combat.addParticipant'(ctx, cmd) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    if (atual.participantes.some((p) => p.id === cmd.participante.id)) {
      throw new Recusa('Este participante já está no combate.');
    }
    const ativoId = atual.participantes[atual.turnoIndex]?.id;
    const novaLista = ordenarPorIniciativa([...atual.participantes, cmd.participante]);
    const novoIdx = ativoId ? novaLista.findIndex((p) => p.id === ativoId) : 0;
    const combate: EstadoDoCombate = {
      ...atual,
      participantes: novaLista,
      turnoIndex: novoIdx >= 0 ? novoIdx : 0,
    };
    ctx.estado.combate = combate;
    return [{ type: 'combat.updated', combate }];
  },

  'combat.removeParticipant'(ctx, cmd) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const idxRemovido = atual.participantes.findIndex((p) => p.id === cmd.id);
    if (idxRemovido < 0) throw new Recusa('Participante não encontrado no combate.');
    const restantes = atual.participantes.filter((p) => p.id !== cmd.id);
    if (restantes.length === 0) {
      ctx.estado.combate = null;
      return [
        { type: 'combat.updated', combate: null },
        { type: 'combat.ended', rodada: atual.rodada },
      ];
    }
    let novoIdx = atual.turnoIndex;
    if (idxRemovido < atual.turnoIndex) novoIdx -= 1;
    if (novoIdx >= restantes.length) novoIdx = 0;
    const combate: EstadoDoCombate = { ...atual, participantes: restantes, turnoIndex: novoIdx };
    ctx.estado.combate = combate;
    return [{ type: 'combat.updated', combate }];
  },

  'combat.updateParticipant'(ctx, cmd) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const alvo = atual.participantes.find((p) => p.id === cmd.id);
    if (!alvo) throw new Recusa('Participante não encontrado no combate.');
    const ativoId = atual.participantes[atual.turnoIndex]?.id;
    const atualizados = atual.participantes.map((p) =>
      p.id === cmd.id
        ? {
            ...p,
            ...(cmd.iniciativa !== undefined && { iniciativa: cmd.iniciativa }),
            ...(cmd.oculto !== undefined && { oculto: cmd.oculto }),
            ...(cmd.incapacitado !== undefined && { incapacitado: cmd.incapacitado }),
            ...(cmd.condicoes !== undefined && { condicoes: cmd.condicoes }),
          }
        : p,
    );
    const listaFinal =
      cmd.iniciativa !== undefined ? ordenarPorIniciativa(atualizados) : atualizados;
    const novoIdx = ativoId ? listaFinal.findIndex((p) => p.id === ativoId) : 0;
    const combate: EstadoDoCombate = {
      ...atual,
      participantes: listaFinal,
      turnoIndex: novoIdx >= 0 ? novoIdx : 0,
    };
    ctx.estado.combate = combate;
    return [{ type: 'combat.updated', combate }];
  },

  'combat.reorder'(ctx, cmd) {
    exigirMestre(ctx);
    const atual = exigirCombateAtivo(ctx);
    const porId = new Map(atual.participantes.map((p) => [p.id, p]));
    const reordenados: ParticipanteDoCombate[] = [];
    for (const pid of cmd.ordem) {
      const p = porId.get(pid);
      if (p) {
        reordenados.push(p);
        porId.delete(pid);
      }
    }
    for (const resto of porId.values()) reordenados.push(resto);
    const ativoId = atual.participantes[atual.turnoIndex]?.id;
    const novoIdx = ativoId ? reordenados.findIndex((p) => p.id === ativoId) : 0;
    const combate: EstadoDoCombate = {
      ...atual,
      participantes: reordenados,
      turnoIndex: novoIdx >= 0 ? novoIdx : 0,
    };
    ctx.estado.combate = combate;
    return [{ type: 'combat.updated', combate }];
  },
};
