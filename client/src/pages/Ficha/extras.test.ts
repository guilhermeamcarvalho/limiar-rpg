import { describe, expect, it } from 'vitest';
import { fichaDoDavi } from '@membrana/shared';
import { bonusDaPericia, depoisDoTeste, NADA_ARMADO, previaDoTeste } from './extras.ts';

const comGambiarra = { impeto: false, habilidades: ['gambiarra'] };

describe('bônus da perícia', () => {
  it('Gambiarra aparece só em Máquinas e Crime, e só enquanto dá para usar', () => {
    const davi = fichaDoDavi();
    expect(bonusDaPericia(davi, 'maquinas', NADA_ARMADO)).toEqual([
      { tipo: 'd4', origem: 'Gambiarra', armado: false, habilidade: 'gambiarra' },
    ]);
    expect(bonusDaPericia(davi, 'luta', comGambiarra)).toEqual([]);
    expect(bonusDaPericia({ ...davi, usadasNaCena: ['gambiarra'] }, 'crime', comGambiarra)).toEqual(
      [],
    );
    expect(bonusDaPericia({ ...davi, pv: 1 }, 'crime', comGambiarra)).toEqual([]);
  });

  it('Ímpeto ligado vale em qualquer perícia, se houver Ímpeto', () => {
    const davi = fichaDoDavi();
    const ligado = { impeto: true, habilidades: [] };
    expect(bonusDaPericia(davi, 'luta', ligado)).toEqual([
      { tipo: 'd4', origem: 'Ímpeto', armado: true },
    ]);
    expect(bonusDaPericia({ ...davi, impeto: 0 }, 'luta', ligado)).toEqual([]);
    expect(bonusDaPericia({ ...davi, perfil: 'analista' }, 'luta', ligado)).toEqual([]);
  });
});

describe('prévia do teste', () => {
  it('monta a descrição e o pedido com a Ajuda e os bônus ligados', () => {
    const p = previaDoTeste(fichaDoDavi(), 'maquinas', {
      dt: 12,
      ajuda: true,
      armados: { impeto: true, habilidades: ['gambiarra'] },
    });
    expect(p.descricao).toBe(
      'Testar Máquinas: d6 de atributo, d12 de perícia, d4 de Ímpeto e d4 de Gambiarra',
    );
    expect(p.pedido).toEqual({
      periciaId: 'maquinas',
      dt: 12,
      ajuda: true,
      impeto: true,
      habilidades: ['gambiarra'],
    });
  });

  it('sem nada ligado, o pedido leva só a perícia e a DT', () => {
    const p = previaDoTeste(fichaDoDavi(), 'maquinas', {
      dt: 7,
      ajuda: false,
      armados: NADA_ARMADO,
    });
    expect(p.descricao).toBe('Testar Máquinas: d6 de atributo e d10 de perícia');
    expect(p.pedido).toEqual({ periciaId: 'maquinas', dt: 7 });
  });
});

describe('depois do teste', () => {
  it('desliga o Ímpeto e a habilidade usada; a que não valia continua ligada', () => {
    const armados = { impeto: true, habilidades: ['gambiarra'] };
    expect(depoisDoTeste(armados, { periciaId: 'luta', impeto: true })).toEqual({
      impeto: false,
      habilidades: ['gambiarra'],
    });
    expect(depoisDoTeste(armados, { periciaId: 'crime', habilidades: ['gambiarra'] })).toEqual(
      NADA_ARMADO,
    );
  });
});
