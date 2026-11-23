import { describe, expect, it } from 'vitest';
import { esquemaFichaOp2, type FichaOp2 } from '../../schemas/ficha-op2.ts';
import {
  OCUPACOES_OP2,
  PASSOS_DE_PERICIA,
  avisosDaCriacao,
  basesDasPericias,
  comRecursosCheios,
  fichaNova,
  limiteDaPericia,
  ocupacaoConhecida,
  passosEmAtributos,
  passosEmPericias,
  textoDoBonus,
} from './criacao.ts';
import { fichaDoDavi } from './exemplos.ts';
import { IDS_DAS_PERICIAS_OP2 } from './pericias.ts';

const atributos = (fisico: string, mente: string, emocao: string) =>
  ({ fisico, mente, emocao }) as FichaOp2['atributos'];

describe('ocupações', () => {
  it('acha a ocupação pelo texto, sem ligar para acento e maiúsculas', () => {
    expect(ocupacaoConhecida('Mecânico')?.id).toBe('mecanico');
    expect(ocupacaoConhecida('  JORNALISTA ')?.id).toBe('jornalista');
    expect(ocupacaoConhecida('Astronauta')).toBeNull();
  });

  it('cada ocupação dá bônus em duas perícias que existem', () => {
    for (const o of OCUPACOES_OP2) {
      expect(new Set(o.pericias).size).toBe(2);
      for (const p of o.pericias) expect(IDS_DAS_PERICIAS_OP2).toContain(p);
    }
  });

  it('descreve o bônus', () => {
    const jornalista = ocupacaoConhecida('Jornalista');
    expect(jornalista && textoDoBonus(jornalista)).toBe('+1 passo em Pesquisa e Persuasão');
  });

  it('as perícias da ocupação começam em d6 e podem chegar a d10', () => {
    const bases = basesDasPericias('Mecânico');
    expect(bases.maquinas).toBe('d6');
    expect(bases.crime).toBe('d6');
    expect(bases.luta).toBe('d4');
    expect(limiteDaPericia(bases.maquinas)).toBe('d10');
    expect(limiteDaPericia(bases.luta)).toBe('d8');
  });
});

describe('passos', () => {
  it('atributos: cada passo acima de d6 conta 1, e d4 devolve 1', () => {
    expect(passosEmAtributos(atributos('d6', 'd6', 'd6'))).toBe(0);
    expect(passosEmAtributos(atributos('d8', 'd8', 'd6'))).toBe(2);
    expect(passosEmAtributos(atributos('d4', 'd8', 'd10'))).toBe(2);
  });

  it('perícias: contam a partir do dado de partida da ocupação', () => {
    const ficha = fichaNova({ ocupacao: 'Mecânico' });
    expect(passosEmPericias(ficha.pericias, ficha.ocupacao)).toBe(0);
    expect(
      passosEmPericias({ ...ficha.pericias, maquinas: 'd8', luta: 'd6' }, ficha.ocupacao),
    ).toBe(2);
    // Abaixo da partida não devolve passo.
    expect(passosEmPericias({ ...ficha.pericias, maquinas: 'd4' }, ficha.ocupacao)).toBe(0);
  });
});

describe('avisos (RF-09)', () => {
  it('ficha dentro da regra não tem aviso', () => {
    const ficha = comRecursosCheios({
      ...fichaNova({ ocupacao: 'Mecânico' }),
      atributos: atributos('d8', 'd8', 'd6'),
    });
    expect(avisosDaCriacao(ficha)).toEqual([]);
  });

  it('atributo acima de d8 avisa no atributo', () => {
    const ficha = { ...fichaNova(), atributos: atributos('d6', 'd10', 'd6') };
    expect(avisosDaCriacao(ficha)).toEqual([
      { campo: 'atributos.mente', mensagem: 'Mente d10 passa do limite da criação (d8).' },
    ]);
  });

  it('passos de atributo a mais e dois d4 avisam', () => {
    const ficha = { ...fichaNova(), atributos: atributos('d4', 'd4', 'd8') };
    expect(avisosDaCriacao(ficha).map((a) => a.mensagem)).toEqual([
      'Só um atributo pode baixar para d4.',
    ]);
    const demais = { ...fichaNova(), atributos: atributos('d8', 'd8', 'd8') };
    expect(avisosDaCriacao(demais).map((a) => a.mensagem)).toEqual([
      'Os atributos usam 3 passos; a regra dá 2.',
    ]);
  });

  it('perícia acima do limite e passos de perícia a mais avisam', () => {
    const base = fichaNova({ ocupacao: 'Mecânico' });
    const ficha = {
      ...base,
      pericias: {
        ...base.pericias,
        maquinas: 'd10',
        luta: 'd10',
        crime: 'd8',
        vigor: 'd8',
        pontaria: 'd8',
      },
    } as FichaOp2;
    expect(avisosDaCriacao(ficha).map((a) => a.campo)).toEqual(['pericias.luta', 'pericias']);
    expect(avisosDaCriacao(ficha).at(-1)?.mensagem).toBe(
      `As perícias usam 10 passos; a regra dá ${String(PASSOS_DE_PERICIA)}.`,
    );
  });

  it('o Davi do protótipo (nível 2) sai da regra de criação, mas é uma ficha válida', () => {
    expect(avisosDaCriacao(fichaDoDavi()).length).toBeGreaterThan(0);
    expect(esquemaFichaOp2.safeParse(fichaDoDavi()).success).toBe(true);
  });
});

describe('ficha nova', () => {
  it('é válida pelo schema, com PV e PD cheios e calculados', () => {
    const ficha = fichaNova({ nome: 'Bianca Moreira', ocupacao: 'Jornalista', perfil: 'analista' });
    expect(esquemaFichaOp2.parse(ficha)).toEqual(ficha);
    // PV = 4 + 6; PD = 6 + 6.
    expect(ficha).toMatchObject({ pv: 10, pvMax: 10, pd: 12, pdMax: 12 });
    expect(ficha.pericias.pesquisa).toBe('d6');
  });

  it('recalcula os recursos quando os atributos mudam', () => {
    const ficha = comRecursosCheios({ ...fichaNova(), atributos: atributos('d8', 'd8', 'd8') });
    expect(ficha).toMatchObject({ pv: 12, pvMax: 12, pd: 16, pdMax: 16 });
  });
});
