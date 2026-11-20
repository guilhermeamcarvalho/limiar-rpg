import { describe, expect, it } from 'vitest';
import { proximaSessaoDa } from './agenda.ts';
import { esquemaEdicaoDeCampanha, esquemaNovaCampanha } from './schemas/campanha.ts';

// Quinta-feira, 19/11/2026, 20h00 no fuso local.
const QUINTA_20H = new Date(2026, 10, 19, 20, 0);

describe('proximaSessaoDa', () => {
  it('sexta às 21h, vista na quinta, é amanhã', () => {
    expect(proximaSessaoDa({ diaDaSemana: 5, horario: '21:00' }, QUINTA_20H)).toEqual(
      new Date(2026, 10, 20, 21, 0),
    );
  });

  it('hoje, num horário que ainda não passou, é hoje', () => {
    expect(proximaSessaoDa({ diaDaSemana: 4, horario: '21:30' }, QUINTA_20H)).toEqual(
      new Date(2026, 10, 19, 21, 30),
    );
  });

  it('hoje, num horário que já passou, é daqui a uma semana', () => {
    expect(proximaSessaoDa({ diaDaSemana: 4, horario: '19:00' }, QUINTA_20H)).toEqual(
      new Date(2026, 10, 26, 19, 0),
    );
  });

  it('atravessa o fim do mês', () => {
    expect(proximaSessaoDa({ diaDaSemana: 2, horario: '19:30' }, QUINTA_20H)).toEqual(
      new Date(2026, 10, 24, 19, 30),
    );
    expect(
      proximaSessaoDa({ diaDaSemana: 1, horario: '10:00' }, new Date(2026, 10, 30, 11, 0)),
    ).toEqual(new Date(2026, 11, 7, 10, 0));
  });
});

describe('esquemas de campanha', () => {
  it('ao criar, os campos que faltam ganham o padrão', () => {
    expect(esquemaNovaCampanha.parse({ nome: 'Caso' })).toEqual({
      nome: 'Caso',
      sistemaId: 'sys_op2',
      tom: 'horror-investigativo',
      formato: 'campanha-curta',
      nivelInicial: 1,
      dtPadrao: 7,
      rodadas: true,
      dadosFisicos: true,
      fichasVisiveis: false,
    });
  });

  it('ao editar, o que não veio fica de fora (não volta ao padrão)', () => {
    expect(esquemaEdicaoDeCampanha.parse({ nome: 'Novo nome' })).toEqual({ nome: 'Novo nome' });
  });

  it('agenda com horário inválido aponta o campo', () => {
    const r = esquemaNovaCampanha.safeParse({
      nome: 'Caso',
      agenda: { diaDaSemana: 5, horario: '25:00', frequencia: 'semanal' },
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['agenda', 'horario']);
  });
});
