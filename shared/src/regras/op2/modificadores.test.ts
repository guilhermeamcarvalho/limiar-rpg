import { describe, expect, it } from 'vitest';
import { ErroDeRegra } from '../dados.ts';
import { fichaDoDavi } from './exemplos.ts';
import { maximosDeRecursos, montarTeste } from './ficha.ts';
import {
  aplicarModificador,
  GAMBIARRA,
  habilidadesDaFicha,
  type Habilidade,
} from './modificadores.ts';
import { adicionarModificador, fimDaCena } from './passos.ts';

function erroDe(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErroDeRegra) return e;
    throw e;
  }
  throw new Error('não lançou');
}

const maquinas = () => montarTeste(fichaDoDavi(), 'maquinas');

describe('Gambiarra (Mecânico)', () => {
  it('é a habilidade do Davi, pela ocupação (com ou sem acento)', () => {
    expect(habilidadesDaFicha(fichaDoDavi()).map((h) => h.id)).toEqual(['gambiarra']);
    expect(habilidadesDaFicha({ ...fichaDoDavi(), ocupacao: ' mecanico ' })).toHaveLength(1);
    expect(habilidadesDaFicha({ ...fichaDoDavi(), ocupacao: 'Jornalista' })).toEqual([]);
  });

  it('soma um d4 dourado e desconta 2 PV', () => {
    const { ficha, teste } = aplicarModificador(fichaDoDavi(), maquinas(), GAMBIARRA);
    expect(ficha.pv).toBe(10);
    expect(ficha.usadasNaCena).toEqual(['gambiarra']);
    expect(teste.extras).toEqual([{ tipo: 'd4', origem: 'Gambiarra' }]);
  });

  it('vale em Crime também, mas Gambiarra em Luta é recusada', () => {
    expect(() =>
      aplicarModificador(fichaDoDavi(), montarTeste(fichaDoDavi(), 'crime'), GAMBIARRA),
    ).not.toThrow();
    const e = erroDe(() =>
      aplicarModificador(fichaDoDavi(), montarTeste(fichaDoDavi(), 'luta'), GAMBIARRA),
    );
    expect([e.campo, e.message]).toEqual(['periciaId', 'Gambiarra só vale em Máquinas ou Crime.']);
  });

  it('teste sem perícia (como uma rolagem solta) também é recusado', () => {
    const { atributo, pericia, extras, dt } = maquinas();
    const semPericia = { atributo, pericia, extras, dt };
    expect(erroDe(() => aplicarModificador(fichaDoDavi(), semPericia, GAMBIARRA)).campo).toBe(
      'periciaId',
    );
  });

  it('segunda Gambiarra na mesma cena é recusada; depois do fim da cena, pode de novo', () => {
    const primeira = aplicarModificador(fichaDoDavi(), maquinas(), GAMBIARRA);
    const e = erroDe(() => aplicarModificador(primeira.ficha, maquinas(), GAMBIARRA));
    expect(e.message).toBe('Gambiarra já foi usada nesta cena.');
    expect(() =>
      aplicarModificador(fimDaCena(primeira.ficha), maquinas(), GAMBIARRA),
    ).not.toThrow();
  });

  it('sem 2 PV, não dá para pagar', () => {
    const e = erroDe(() => aplicarModificador({ ...fichaDoDavi(), pv: 1 }, maquinas(), GAMBIARRA));
    expect([e.campo, e.message]).toEqual(['pv', 'Gambiarra custa 2 PV, e só há 1.']);
  });

  it('quem não é Mecânico não usa', () => {
    const jornalista = { ...fichaDoDavi(), ocupacao: 'Jornalista' };
    expect(erroDe(() => aplicarModificador(jornalista, maquinas(), GAMBIARRA)).message).toBe(
      'Gambiarra é uma habilidade de Mecânico.',
    );
  });

  it('teste já com dois bônus não recebe um terceiro', () => {
    const cheio = {
      ...maquinas(),
      extras: [
        { tipo: 'd4' as const, origem: 'a' },
        { tipo: 'd4' as const, origem: 'b' },
      ],
    };
    expect(erroDe(() => aplicarModificador(fichaDoDavi(), cheio, GAMBIARRA)).campo).toBe('extras');
  });
});

describe('a mesma estrutura serve para outras habilidades', () => {
  // Foco mental (Cientista), provisória: num teste mental, gaste 2 PD para receber +d4. Sem limite.
  const focoMental: Habilidade = {
    id: 'foco-mental',
    nome: 'Foco mental',
    dado: 'd4',
    pericias: ['pesquisa'],
    custo: { pd: 2 },
    limite: null,
    de: { perfil: 'analista' },
  };
  const analista = () => ({ ...fichaDoDavi(), perfil: 'analista' as const });
  const pesquisa = () => montarTeste(analista(), 'pesquisa');

  it('habilidade de perfil, paga em PD e sem limite por cena', () => {
    const uma = aplicarModificador(analista(), pesquisa(), focoMental);
    const duas = aplicarModificador(uma.ficha, pesquisa(), focoMental);
    expect([uma.ficha.pd, duas.ficha.pd]).toEqual([8, 6]);
    expect(duas.ficha.usadasNaCena).toEqual([]);
  });

  it('mensagens: perfil errado, perícia única e PD insuficiente', () => {
    expect(erroDe(() => aplicarModificador(fichaDoDavi(), pesquisa(), focoMental)).message).toBe(
      'Foco mental é uma habilidade do perfil analista.',
    );
    expect(
      erroDe(() => aplicarModificador(analista(), montarTeste(analista(), 'luta'), focoMental))
        .message,
    ).toBe('Foco mental só vale em Pesquisa.');
    expect(
      erroDe(() => aplicarModificador({ ...analista(), pd: 1 }, pesquisa(), focoMental)).campo,
    ).toBe('pd');
  });
});

describe('montarTeste e recursos (exemplos das regras)', () => {
  it('Máquinas do Davi: Mente d6 + Máquinas d10, DT 7', () => {
    expect(maquinas()).toEqual({
      atributo: 'd6',
      pericia: 'd10',
      extras: [],
      dt: 7,
      periciaId: 'maquinas',
    });
  });

  it('a Ajuda sobe o dado da perícia; a DT pode vir do mestre', () => {
    expect(montarTeste(fichaDoDavi(), 'maquinas', { ajuda: true, dt: 10 })).toMatchObject({
      pericia: 'd12',
      dt: 10,
    });
  });

  it('o teste usa o dado com os modificadores da cena (Machucado tira um passo de Físico)', () => {
    const machucado = adicionarModificador(fichaDoDavi(), {
      alvo: 'fisico',
      passos: -1,
      origem: 'Machucado',
      duracao: 'cena',
    });
    expect(montarTeste(machucado, 'luta').atributo).toBe('d6');
  });

  it('PV = 4 + máximo de Físico; PD = 24 - PV no nível 1', () => {
    expect(maximosDeRecursos(fichaDoDavi().atributos)).toEqual({ pvMax: 12, pdMax: 12 });
    expect(maximosDeRecursos({ fisico: 'd6', mente: 'd8', emocao: 'd8' })).toEqual({
      pvMax: 10,
      pdMax: 14,
    });
    expect(maximosDeRecursos({ fisico: 'd12', mente: 'd4', emocao: 'd4' })).toEqual({
      pvMax: 16,
      pdMax: 8,
    });
  });

  it('Ajuda dá +1 passo em d4–d8 e +2 passos em d10–d12', () => {
    expect(montarTeste(fichaDoDavi(), 'luta', { ajuda: true }).pericia).toBe('d10');
    expect(montarTeste(fichaDoDavi(), 'maquinas', { ajuda: true }).pericia).toBe('d12');
  });
});
