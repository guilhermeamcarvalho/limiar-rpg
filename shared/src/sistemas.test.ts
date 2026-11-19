import { describe, expect, it } from 'vitest';
import {
  CONFIG_OP2,
  esquemaConfigInventado,
  esquemaConfigOp2,
  esquemaDoConfig,
  type ConfigOp2,
} from './sistemas.ts';

describe('Ordem Paranormal II', () => {
  it('o config passa no schema', () => {
    expect(esquemaConfigOp2.parse(CONFIG_OP2)).toEqual(CONFIG_OP2);
  });

  it('tem 3 atributos e 20 perícias, como em docs/regras-do-jogo.md', () => {
    expect(CONFIG_OP2.atributos.map((a) => a.nome)).toEqual(['Físico', 'Mente', 'Emoção']);
    expect(CONFIG_OP2.pericias).toHaveLength(20);

    const porAtributo = (id: string) => CONFIG_OP2.pericias.filter((p) => p.atributo === id).length;
    expect([porAtributo('fisico'), porAtributo('mente'), porAtributo('emocao')]).toEqual([7, 8, 5]);
  });

  it('ids das perícias sem acento', () => {
    const ids = CONFIG_OP2.pericias.map((p) => p.id);
    expect(ids).toContain('aptidao');
    expect(ids).toContain('maquinas');
    expect(ids).toContain('enganacao');
    expect(ids.every((id) => /^[a-z]+$/.test(id))).toBe(true);
  });

  it('PV = 4 + máximo de Físico; PD = máximo de Mente + máximo de Emoção', () => {
    expect(CONFIG_OP2.recursos.pv).toMatchObject({ base: 4, somaMaximoDe: ['fisico'] });
    expect(CONFIG_OP2.recursos.pd).toMatchObject({ base: 0, somaMaximoDe: ['mente', 'emocao'] });
  });
});

describe('esquemaConfigOp2', () => {
  const comPericias = (pericias: ConfigOp2['pericias']): ConfigOp2 => ({ ...CONFIG_OP2, pericias });

  it('recusa perícia ligada a atributo que não existe', () => {
    const resultado = esquemaConfigOp2.safeParse(
      comPericias([{ id: 'sorte', nome: 'Sorte', atributo: 'carisma' }]),
    );

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('"carisma"');
  });

  it('recusa atributo repetido', () => {
    const fisico = { id: 'fisico', nome: 'Físico' };
    const config = { ...CONFIG_OP2, atributos: [fisico, fisico] };
    expect(esquemaConfigOp2.safeParse(config).success).toBe(false);
  });

  it('recusa perícia repetida', () => {
    const luta = { id: 'luta', nome: 'Luta', atributo: 'fisico' };
    expect(esquemaConfigOp2.safeParse(comPericias([luta, luta])).success).toBe(false);
  });

  it('recusa recurso somando atributo que não existe', () => {
    const config = {
      ...CONFIG_OP2,
      recursos: { ...CONFIG_OP2.recursos, pv: { nome: 'PV', base: 4, somaMaximoDe: ['forca'] } },
    };
    expect(esquemaConfigOp2.safeParse(config).success).toBe(false);
  });
});

describe('RPG inventado', () => {
  it('aceita os quatro campos do formulário', () => {
    const config = {
      versao: 1,
      dadoPrincipal: '1d20',
      atributos: ['Força', 'Astúcia', 'Espírito'],
      regrasDaCasa: 'Crítico no 20 natural.',
    };
    expect(esquemaConfigInventado.safeParse(config).success).toBe(true);
    expect(esquemaDoConfig('inventado').safeParse(config).success).toBe(true);
    expect(esquemaDoConfig('op2').safeParse(config).success).toBe(false);
  });

  it('recusa dado principal desconhecido', () => {
    expect(
      esquemaConfigInventado.safeParse({
        versao: 1,
        dadoPrincipal: '3d8',
        atributos: ['Força'],
        regrasDaCasa: '',
      }).success,
    ).toBe(false);
  });
});
