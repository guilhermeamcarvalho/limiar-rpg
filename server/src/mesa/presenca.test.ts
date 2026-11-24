import { describe, expect, it } from 'vitest';
import type { PresencaNaMesa } from '@membrana/shared';
import { Presenca } from './presenca.ts';

const ana: PresencaNaMesa = { id: 'usr_ana', nome: 'Ana', papel: 'mestre', personagemId: null };
const bia: PresencaNaMesa = { id: 'usr_bia', nome: 'Bia', papel: 'jogador', personagemId: 'chr_1' };
const caio: PresencaNaMesa = { id: 'usr_caio', nome: 'Caio', papel: 'jogador', personagemId: null };

describe('Presenca', () => {
  it('a mesma pessoa em duas abas conta uma vez; o mestre vem primeiro', () => {
    const p = new Presenca();
    p.entrar('cmp_1', 's1', caio);
    p.entrar('cmp_1', 's2', bia);
    p.entrar('cmp_1', 's3', bia);
    p.entrar('cmp_1', 's4', ana);
    expect(p.online('cmp_1').map((x) => x.nome)).toEqual(['Ana', 'Bia', 'Caio']);
    p.sair('cmp_1', 's2');
    expect(p.online('cmp_1').map((x) => x.nome)).toEqual(['Ana', 'Bia', 'Caio']);
    p.sair('cmp_1', 's3');
    expect(p.online('cmp_1').map((x) => x.nome)).toEqual(['Ana', 'Caio']);
  });

  it('a mesa fica aberta enquanto houver uma conexão do mestre, desde a primeira', () => {
    const p = new Presenca();
    const cedo = new Date('2026-11-24T20:00:00Z');
    expect(p.mesaAbertaDesde('cmp_1')).toBeNull();
    p.entrar('cmp_1', 's1', bia, cedo);
    expect(p.mesaAbertaDesde('cmp_1')).toBeNull();
    p.entrar('cmp_1', 's2', ana, cedo);
    p.entrar('cmp_1', 's3', ana, new Date('2026-11-24T21:00:00Z'));
    p.sair('cmp_1', 's2');
    expect(p.mesaAbertaDesde('cmp_1')).toEqual(cedo);
    p.sair('cmp_1', 's3');
    expect(p.mesaAbertaDesde('cmp_1')).toBeNull();
    expect(p.mesaAbertaDesde('cmp_2')).toBeNull();
  });

  it('sair de uma mesa que não existe não quebra; cada campanha é separada', () => {
    const p = new Presenca();
    p.sair('cmp_x', 's1');
    p.entrar('cmp_1', 's1', ana);
    expect(p.online('cmp_2')).toEqual([]);
    expect(p.mesaAbertaDesde('cmp_2')).toBeNull();
  });
});
