import { describe, expect, it } from 'vitest';
import {
  ehImagemPronta,
  ehMapaPronto,
  ehNpcPronto,
  ehPistaPronta,
  ehPropPronto,
  validarComando,
} from '../schemas/mesa.ts';
import {
  CATEGORIAS_DE_NPCS,
  CATEGORIAS_DE_PISTAS,
  CATEGORIAS_DE_PROPS,
  MAPAS_PRONTOS,
  NPCS_PRONTOS,
  PISTAS_PRONTAS,
  PROPS_PRONTOS,
} from './prontos.ts';

describe('catálogo da arte pronta', () => {
  it('ids únicos, cada um com o prefixo do seu tipo', () => {
    const ids = [...PROPS_PRONTOS, ...NPCS_PRONTOS, ...PISTAS_PRONTAS, ...MAPAS_PRONTOS].map(
      (i) => i.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROPS_PRONTOS.every((p) => p.id.startsWith('pronto:'))).toBe(true);
    expect(NPCS_PRONTOS.every((n) => n.id.startsWith('npc:'))).toBe(true);
    expect(PISTAS_PRONTAS.every((p) => p.id.startsWith('pista:'))).toBe(true);
    expect(MAPAS_PRONTOS.every((m) => m.id.startsWith('mapa:'))).toBe(true);
  });

  it('grande variedade: dezenas de props e de modelos, pistas genéricas e uma dúzia de mapas', () => {
    expect(PROPS_PRONTOS.length).toBeGreaterThanOrEqual(50);
    expect(NPCS_PRONTOS.length).toBeGreaterThanOrEqual(30);
    expect(PISTAS_PRONTAS.length).toBeGreaterThanOrEqual(12);
    expect(MAPAS_PRONTOS.length).toBeGreaterThanOrEqual(12);
  });

  it('os cinco props de antes continuam com o mesmo id', () => {
    for (const id of ['caixote', 'contorno', 'papel', 'mancha', 'radio']) {
      expect(ehPropPronto(`pronto:${id}`)).toBe(true);
    }
  });

  it('toda categoria usada está na lista de categorias, e toda categoria tem item', () => {
    expect([...new Set(PROPS_PRONTOS.map((p) => p.categoria))].sort()).toEqual(
      [...CATEGORIAS_DE_PROPS].sort(),
    );
    expect([...new Set(NPCS_PRONTOS.map((n) => n.categoria))].sort()).toEqual(
      [...CATEGORIAS_DE_NPCS].sort(),
    );
    expect([...new Set(PISTAS_PRONTAS.map((p) => p.categoria))].sort()).toEqual(
      [...CATEGORIAS_DE_PISTAS].sort(),
    );
  });

  it('o tamanho inicial do prop cabe no que o contrato aceita (até 20 células)', () => {
    expect(PROPS_PRONTOS.every((p) => p.tamanho > 0 && p.tamanho <= 20)).toBe(true);
  });

  it('a célula do mapa vale para a grade e o mapa cabe no limite da mesa', () => {
    // Mapa externo (design/prontos/externos) pode não ter um número inteiro de células.
    for (const m of MAPAS_PRONTOS) {
      expect(Number.isInteger(m.celula)).toBe(true);
      expect(m.celula).toBeGreaterThanOrEqual(10);
      expect(m.celula).toBeLessThanOrEqual(500);
      expect(Math.max(m.largura, m.altura)).toBeLessThanOrEqual(4096);
    }
  });

  it('cada tipo reconhece só os seus ids', () => {
    expect(ehNpcPronto('npc:cultista')).toBe(true);
    expect(ehNpcPronto('pronto:caixote')).toBe(false);
    expect(ehMapaPronto('mapa:hospital')).toBe(true);
    expect(ehMapaPronto('npc:cultista')).toBe(false);
    expect(ehPistaPronta('pista:carta')).toBe(true);
    expect(ehPistaPronta('pronto:papel')).toBe(false);
    expect(ehImagemPronta('pista:fita-cassete')).toBe(true);
    expect(ehImagemPronta('mapa:radio')).toBe(true);
    expect(ehImagemPronta(`${'a'.repeat(64)}.webp`)).toBe(false);
  });

  it('o prop pronto e a pista pronta entram na mesa pelo contrato', () => {
    expect(
      validarComando({ type: 'prop.create', imagem: 'pronto:circulo-ritual', x: 1, y: 1 }).ok,
    ).toBe(true);
    expect(validarComando({ type: 'prop.create', imagem: 'npc:cultista', x: 1, y: 1 }).ok).toBe(
      false,
    );
    expect(
      validarComando({
        type: 'clue.create',
        titulo: 'Fita 33',
        texto: 'Chiado e uma voz.',
        imagem: 'pista:fita-cassete',
        x: 10,
        y: 10,
      }).ok,
    ).toBe(true);
    expect(
      validarComando({
        type: 'clue.create',
        titulo: 'Fita 33',
        texto: 'Chiado e uma voz.',
        imagem: 'npc:cultista',
        x: 10,
        y: 10,
      }).ok,
    ).toBe(false);
  });
});
