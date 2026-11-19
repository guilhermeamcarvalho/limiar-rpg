import { describe, expect, it } from 'vitest';
import {
  ehMestre,
  papelNa,
  podeConvidar,
  podeEditarCampanha,
  podeEditarFicha,
  podeVerCampanha,
  podeVerFicha,
  type CampanhaComMembros,
} from './permissoes.ts';

const ana = { id: 'usr_ana' };
const bia = { id: 'usr_bia' };
const caio = { id: 'usr_caio' };
const estranho = { id: 'usr_estranho' };

/** Ana mestra o Sinal, onde Bia e Caio jogam. Bia mestra a Maré, onde Ana joga. */
const sinal: CampanhaComMembros = {
  id: 'cmp_sinal',
  membros: [
    { userId: ana.id, papel: 'mestre' },
    { userId: bia.id, papel: 'jogador' },
    { userId: caio.id, papel: 'jogador' },
  ],
};
const mare: CampanhaComMembros = {
  id: 'cmp_mare',
  membros: [
    { userId: bia.id, papel: 'mestre' },
    { userId: ana.id, papel: 'jogador' },
  ],
};

const fichaDaBia = { donoId: bia.id, campanhaId: sinal.id };
const fichaDaAnaNaMare = { donoId: ana.id, campanhaId: mare.id };

describe('papéis', () => {
  it('o papel é de cada campanha, não da conta', () => {
    expect(papelNa(ana, sinal)).toBe('mestre');
    expect(papelNa(ana, mare)).toBe('jogador');
    expect(papelNa(estranho, sinal)).toBeNull();
    expect(papelNa(null, sinal)).toBeNull();
  });

  it('mestre de uma campanha não tem poder em outra em que é jogador', () => {
    expect(ehMestre(ana, sinal)).toBe(true);
    expect(ehMestre(ana, mare)).toBe(false);
    expect(podeConvidar(ana, mare)).toBe(false);
    expect(podeEditarCampanha(ana, mare)).toBe(false);
    expect(podeEditarFicha(ana, { donoId: bia.id, campanhaId: mare.id }, mare)).toBe(false);
  });
});

describe('campanha', () => {
  it.each([
    ['mestre', ana, true],
    ['jogador', bia, true],
    ['quem não participa', estranho, false],
    ['quem não entrou', null, false],
  ])('%s: ver', (_, quem, pode) => {
    expect(podeVerCampanha(quem, sinal)).toBe(pode);
  });

  it.each([
    ['mestre', ana, true],
    ['jogador', bia, false],
    ['quem não participa', estranho, false],
    ['quem não entrou', null, false],
  ])('%s: convidar e editar', (_, quem, pode) => {
    expect(podeConvidar(quem, sinal)).toBe(pode);
    expect(podeEditarCampanha(quem, sinal)).toBe(pode);
  });
});

describe('ficha', () => {
  it('mestre edita qualquer ficha da campanha', () => {
    expect(podeEditarFicha(ana, fichaDaBia, sinal)).toBe(true);
  });

  it('jogador edita a própria e não a de outro', () => {
    expect(podeEditarFicha(bia, fichaDaBia, sinal)).toBe(true);
    expect(podeEditarFicha(caio, fichaDaBia, sinal)).toBe(false);
  });

  it('dono que não participa mais da campanha não edita', () => {
    const semBia = { ...sinal, membros: sinal.membros.filter((m) => m.userId !== bia.id) };
    expect(podeEditarFicha(bia, fichaDaBia, semBia)).toBe(false);
  });

  it('ficha de outra campanha nunca: nem para o mestre desta', () => {
    expect(podeEditarFicha(ana, fichaDaAnaNaMare, sinal)).toBe(false);
    expect(podeVerFicha(ana, fichaDaAnaNaMare, sinal)).toBe(false);
  });

  it('ver a ficha de outro jogador só se a campanha permitir', () => {
    expect(podeVerFicha(caio, fichaDaBia, sinal)).toBe(false);
    expect(podeVerFicha(caio, fichaDaBia, { ...sinal, fichasVisiveis: true })).toBe(true);
    expect(podeVerFicha(estranho, fichaDaBia, { ...sinal, fichasVisiveis: true })).toBe(false);
    expect(podeVerFicha(null, fichaDaBia, { ...sinal, fichasVisiveis: true })).toBe(false);
    expect(podeVerFicha(bia, fichaDaBia, sinal)).toBe(true);
  });
});
