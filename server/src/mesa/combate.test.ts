import { afterEach, describe, expect, it } from 'vitest';
import type { ParticipanteDoCombate } from '@membrana/shared';
import { bancoDeTeste, casoDeTeste } from '../teste/apoio.ts';
import { Mesas } from './mesas.ts';
import { projetarEstado } from './projecao.ts';

const bancos: { close: () => void }[] = [];
afterEach(() => {
  for (const banco of bancos.splice(0)) banco.close();
});

function montar() {
  const { db, sqlite } = bancoDeTeste();
  const pessoas = casoDeTeste({ db });
  const mesas = new Mesas(db);
  bancos.push({
    close: () => {
      mesas.salvarTudo();
      sqlite.close();
    },
  });
  return { db, mesas, mesa: mesas.obter(pessoas.caso), ...pessoas };
}

const PARTICIPANTES: ParticipanteDoCombate[] = [
  {
    id: 'p_bia',
    tipo: 'jogador',
    nome: 'Bia',
    tokenId: 'tok_bia',
    donoId: 'usr_bia',
    personagemId: 'chr_bia',
    iniciativa: 11,
    oculto: false,
    incapacitado: false,
    condicoes: [],
  },
  {
    id: 'p_zumbi',
    tipo: 'npc',
    nome: 'Zumbi de Sangue',
    tokenId: 'tok_zumbi',
    donoId: null,
    personagemId: null,
    iniciativa: 14,
    oculto: true,
    incapacitado: false,
    condicoes: [],
  },
  {
    id: 'p_caio',
    tipo: 'jogador',
    nome: 'Caio',
    tokenId: 'tok_caio',
    donoId: 'usr_caio',
    personagemId: 'chr_caio',
    iniciativa: 7,
    oculto: false,
    incapacitado: false,
    condicoes: [],
  },
];

function comDonos(biaId: string, caioId: string): ParticipanteDoCombate[] {
  return PARTICIPANTES.map((p) =>
    p.id === 'p_bia' ? { ...p, donoId: biaId } : p.id === 'p_caio' ? { ...p, donoId: caioId } : p,
  );
}

describe('Modo de combate na mesa', () => {
  it('apenas o mestre inicia o combate, ordena por iniciativa e esconde NPC oculto do jogador', () => {
    const { mesa, ana, bia, caio } = montar();
    const lista = comDonos(bia.id, caio.id);

    const recusa = mesa.aplicar(bia, { type: 'combat.start', participantes: lista });
    expect(recusa.ok).toBe(false);

    const inicio = mesa.aplicar(ana, { type: 'combat.start', participantes: lista });
    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;

    expect(inicio.depois.combate).toMatchObject({
      ativo: true,
      rodada: 1,
      turnoIndex: 0,
    });
    expect(inicio.depois.combate?.participantes.map((p) => p.nome)).toEqual([
      'Zumbi de Sangue',
      'Bia',
      'Caio',
    ]);
    expect(inicio.eventos.map((e) => e.type)).toEqual(['combat.updated', 'combat.started']);

    // Jogador não vê o inimigo oculto na projeção e turnoIndex oculto fica -1
    const visaoBia = projetarEstado(
      { id: bia.id, papel: 'jogador', personagemId: 'chr_bia' },
      inicio.depois,
    );
    expect(visaoBia.combate?.participantes.map((p) => p.nome)).toEqual(['Bia', 'Caio']);
    expect(visaoBia.combate?.turnoIndex).toBe(-1);
  });

  it('avança turnos, vira rodada ao fechar ciclo e permite jogador encerrar o próprio turno', () => {
    const { mesa, ana, bia, caio } = montar();
    const lista = comDonos(bia.id, caio.id);
    mesa.aplicar(ana, { type: 'combat.start', participantes: lista });

    // Turno 0 (Zumbi) -> Turno 1 (Bia)
    const t1 = mesa.aplicar(ana, { type: 'combat.nextTurn' });
    expect(t1.ok && t1.depois.combate?.turnoIndex).toBe(1);

    // Caio não pode encerrar o turno de Bia
    const recusaCaio = mesa.aplicar(caio, { type: 'combat.finishTurn' });
    expect(recusaCaio.ok).toBe(false);

    // Bia encerra seu próprio turno -> Turno 2 (Caio)
    const t2 = mesa.aplicar(bia, { type: 'combat.finishTurn' });
    expect(t2.ok && t2.depois.combate?.turnoIndex).toBe(2);

    // Mestre avança além do último -> Rodada 2, Turno 0
    const t3 = mesa.aplicar(ana, { type: 'combat.nextTurn' });
    expect(t3.ok).toBe(true);
    if (!t3.ok) return;
    expect(t3.depois.combate?.rodada).toBe(2);
    expect(t3.depois.combate?.turnoIndex).toBe(0);
    expect(t3.eventos.map((e) => e.type)).toEqual(['combat.updated', 'combat.roundChanged']);

    // Voltar turno volta para Rodada 1, Turno 2
    const voltar = mesa.aplicar(ana, { type: 'combat.prevTurn' });
    expect(voltar.ok && voltar.depois.combate?.rodada).toBe(1);
    expect(voltar.ok && voltar.depois.combate?.turnoIndex).toBe(2);
  });

  it('persiste combate ao recarregar, adiciona/remove participantes e encerra', () => {
    const { db, mesas, caso, mesa, ana, bia, caio } = montar();
    const lista = comDonos(bia.id, caio.id);
    mesa.aplicar(ana, { type: 'combat.start', participantes: lista });
    mesas.salvarTudo();

    // Simula recarregar do banco em nova instância de Mesas
    const mesasRecarregadas = new Mesas(db);
    const mesaRecarregada = mesasRecarregadas.obter(caso);
    expect(mesaRecarregada.estado.combate?.ativo).toBe(true);

    const add = mesaRecarregada.aplicar(ana, {
      type: 'combat.addParticipant',
      participante: {
        id: 'p_cultista',
        tipo: 'npc',
        nome: 'Cultista',
        tokenId: null,
        donoId: null,
        personagemId: null,
        iniciativa: 12,
        oculto: false,
        incapacitado: false,
        condicoes: [],
      },
    });
    expect(add.ok && add.depois.combate?.participantes.map((p) => p.nome)).toEqual([
      'Zumbi de Sangue',
      'Cultista',
      'Bia',
      'Caio',
    ]);

    const rem = mesaRecarregada.aplicar(ana, {
      type: 'combat.removeParticipant',
      id: 'p_cultista',
    });
    expect(rem.ok && rem.depois.combate?.participantes.length).toBe(3);

    const fim = mesaRecarregada.aplicar(ana, { type: 'combat.end' });
    expect(fim.ok).toBe(true);
    if (!fim.ok) return;
    expect(fim.depois.combate).toBeNull();
    expect(fim.eventos.map((e) => e.type)).toEqual(['combat.updated', 'combat.ended']);
  });
});
