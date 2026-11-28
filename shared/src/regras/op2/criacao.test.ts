import { describe, expect, it } from 'vitest';
import { esquemaFichaOp2, type FichaOp2 } from '../../schemas/ficha-op2.ts';
import { esquemaDaFicha } from '../../schemas/personagem.ts';
import {
  OCUPACOES_OP2,
  PASSOS_DE_PERICIA,
  avisosDaCriacao,
  basesDasPericias,
  comRecursosCheios,
  fichaNova,
  infoDoPerfil,
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
    expect(ocupacaoConhecida('Acadêmico')?.id).toBe('academico');
    expect(ocupacaoConhecida('  AGENTE DE SAÚDE ')?.id).toBe('agente de saude');
    expect(ocupacaoConhecida('Astronauta')).toBeNull();
  });

  it('cada uma das 17 ocupações sugere duas perícias que existem', () => {
    expect(OCUPACOES_OP2.length).toBe(17);
    for (const o of OCUPACOES_OP2) {
      expect(new Set(o.pericias).size).toBe(2);
      for (const p of o.pericias) expect(IDS_DAS_PERICIAS_OP2).toContain(p);
    }
  });

  it('descreve as perícias sugeridas', () => {
    const investigador = ocupacaoConhecida('Investigador');
    expect(investigador && textoDoBonus(investigador)).toBe('Sugeridas: Percepção e Pesquisa');
  });

  it('todas as perícias começam em d4 e podem chegar a d8 na criação', () => {
    const bases = basesDasPericias('Acadêmico');
    expect(bases.aptidao).toBe('d4');
    expect(bases.pesquisa).toBe('d4');
    expect(bases.luta).toBe('d4');
    expect(limiteDaPericia(bases.aptidao)).toBe('d8');
    expect(limiteDaPericia(bases.luta)).toBe('d8');
  });
});

describe('passos', () => {
  it('atributos: cada passo acima de d4 conta 1', () => {
    expect(passosEmAtributos(atributos('d4', 'd4', 'd4'))).toBe(0);
    expect(passosEmAtributos(atributos('d8', 'd8', 'd6'))).toBe(5);
    expect(passosEmAtributos(atributos('d4', 'd8', 'd10'))).toBe(5);
  });

  it('perícias: contam a partir de d4', () => {
    const ficha = fichaNova({ ocupacao: 'Acadêmico' });
    expect(passosEmPericias(ficha.pericias, ficha.ocupacao)).toBe(0);
    expect(passosEmPericias({ ...ficha.pericias, aptidao: 'd8', luta: 'd6' }, ficha.ocupacao)).toBe(
      3,
    );
  });
});

describe('avisos (RF-09)', () => {
  it('ficha dentro da regra não tem aviso', () => {
    const ficha = comRecursosCheios({
      ...fichaNova({ ocupacao: 'Acadêmico' }),
      atributos: atributos('d8', 'd8', 'd6'),
    });
    expect(avisosDaCriacao(ficha)).toEqual([]);
  });

  it('atributo acima de d10 avisa no atributo', () => {
    const ficha = { ...fichaNova(), atributos: atributos('d4', 'd12', 'd4') };
    expect(avisosDaCriacao(ficha)).toEqual([
      { campo: 'atributos.mente', mensagem: 'Mente d12 passa do limite da criação (d10).' },
    ]);
  });

  it('passos de atributo a mais sem compensar em perícias avisam', () => {
    const demais = { ...fichaNova(), atributos: atributos('d8', 'd8', 'd8') };
    expect(avisosDaCriacao(demais)).toEqual([]);
    // 6 passos em atributos + 7 passos em perícias = 13 > 12 (5+7)
    const base = fichaNova();
    const estourado = {
      ...base,
      atributos: atributos('d8', 'd8', 'd8'),
      pericias: {
        ...base.pericias,
        luta: 'd8',
        crime: 'd8',
        vigor: 'd8',
        pontaria: 'd6',
      },
    } as FichaOp2;
    expect(avisosDaCriacao(estourado).map((a) => a.campo)).toContain('atributos');
  });

  it('perícia acima do limite e passos de perícia a mais avisam', () => {
    const base = fichaNova({ ocupacao: 'Acadêmico' });
    const ficha = {
      ...base,
      atributos: atributos('d8', 'd8', 'd6'),
      pericias: {
        ...base.pericias,
        maquinas: 'd10',
        luta: 'd10',
        crime: 'd8',
        vigor: 'd8',
        pontaria: 'd8',
      },
    } as FichaOp2;
    expect(avisosDaCriacao(ficha).map((a) => a.campo)).toEqual([
      'pericias.luta',
      'pericias.maquinas',
      'pericias',
    ]);
    expect(avisosDaCriacao(ficha).at(-1)?.mensagem).toContain(
      `As perícias usam 12 passos; no nível 1 a regra dá ${String(PASSOS_DE_PERICIA)}`,
    );
  });

  it('o Davi do protótipo (nível 2) sai da regra de criação, mas é uma ficha válida', () => {
    expect(avisosDaCriacao(fichaDoDavi()).length).toBeGreaterThan(0);
    expect(esquemaFichaOp2.safeParse(fichaDoDavi()).success).toBe(true);
  });
});

describe('ficha nova', () => {
  it('é válida pelo schema, com PV e PD cheios e calculados (PV + PD = 24 no nível 1)', () => {
    const ficha = fichaNova({
      nome: 'Bianca Moreira',
      ocupacao: 'Investigador',
      perfil: 'analista',
    });
    expect(esquemaFichaOp2.parse(ficha)).toEqual(ficha);
    // Físico d4 -> PV = 4 + 4 = 8; PD = 24 - 8 = 16.
    expect(ficha).toMatchObject({ pv: 8, pvMax: 8, pd: 16, pdMax: 16, nex: 0 });
    expect(ficha.pericias.pesquisa).toBe('d4');
  });

  it('Ocultista começa com NEX 1 e −2 PD', () => {
    const ficha = fichaNova({ nome: 'Arthur', ocupacao: 'Ocultista', perfil: 'analista' });
    expect(ficha).toMatchObject({ pvMax: 8, pdMax: 14, nex: 1 });
  });

  it('recalcula os recursos quando os atributos mudam', () => {
    const ficha = comRecursosCheios({ ...fichaNova(), atributos: atributos('d8', 'd8', 'd8') });
    expect(ficha).toMatchObject({ pv: 12, pvMax: 12, pd: 12, pdMax: 12 });
  });
});

describe('perfis e sistemas', () => {
  it('cada perfil tem a sua habilidade oficial', () => {
    expect(infoDoPerfil('executor').habilidade).toBe('Ímpeto');
    expect(infoDoPerfil('analista').habilidade).toBe('Plano');
    expect(infoDoPerfil('vigilante').habilidade).toBe('Reflexo');
  });

  it('só Ordem Paranormal II tem ficha por enquanto', () => {
    expect(esquemaDaFicha('op2')).toBe(esquemaFichaOp2);
    expect(esquemaDaFicha('inventado')).toBeNull();
  });
});
