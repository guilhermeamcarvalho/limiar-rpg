import { describe, expect, it } from 'vitest';
import type { PropNaMesa, TokenNaMesa } from '@membrana/shared';
import {
  criarLimitador,
  dentroDoMapa,
  destinoDaSeta,
  girar,
  podeArrastar,
  proximaOrdem,
  rotacaoNormal,
  rotuloDoToken,
  tamanhoDoProp,
} from './interacao.ts';

const token = (campos: Partial<TokenNaMesa> = {}): TokenNaMesa => ({
  id: 'tok_1',
  nome: 'Davi Rocha',
  imagem: null,
  x: 100,
  y: 100,
  tamanho: 1,
  oculto: false,
  personagemId: 'chr_1',
  donoId: 'usr_bia',
  ...campos,
});

describe('interações do palco', () => {
  it('o arrasto manda no máximo 20 vezes por segundo', () => {
    const pode = criarLimitador();
    const enviados = Array.from({ length: 100 }, (_, i) => i * 10).filter((t) => pode(t));
    // 1 s de movimento, um evento a cada 10 ms: só 20 passam.
    expect(enviados).toHaveLength(20);
    expect(enviados.slice(0, 3)).toEqual([0, 50, 100]);
  });

  it('a posição não sai do mapa', () => {
    const mapa = { largura: 1000, altura: 800 };
    expect(dentroDoMapa({ x: -5, y: 900 }, mapa)).toEqual({ x: 0, y: 800 });
    expect(dentroDoMapa({ x: 10, y: 20 }, mapa)).toEqual({ x: 10, y: 20 });
  });

  it('as setas movem uma célula; outra tecla não move', () => {
    expect(destinoDaSeta('ArrowRight', { x: 100, y: 100 }, 50)).toEqual({ x: 150, y: 100 });
    expect(destinoDaSeta('ArrowUp', { x: 100, y: 100 }, 50)).toEqual({ x: 100, y: 50 });
    expect(destinoDaSeta('a', { x: 100, y: 100 }, 50)).toBeNull();
  });

  it('girar soma 45 graus e dá a volta; a rotação fica entre 0 e 359,9', () => {
    expect(girar(0)).toBe(45);
    expect(girar(315)).toBe(0);
    expect(rotacaoNormal(-90)).toBe(270);
    expect(rotacaoNormal(359.99)).toBe(0);
    expect(rotacaoNormal(721.26)).toBe(1.3);
  });

  it('redimensionar multiplica o tamanho, entre 0,1 e 20 células', () => {
    expect(tamanhoDoProp(2, 1.5)).toBe(3);
    expect(tamanhoDoProp(2, -0.5)).toBe(1);
    expect(tamanhoDoProp(10, 5)).toBe(20);
    expect(tamanhoDoProp(1, 0.01)).toBe(0.1);
  });

  it('trazer à frente fica acima de todos', () => {
    const prop = (ordem: number): PropNaMesa => ({
      id: `p${String(ordem)}`,
      imagem: 'pronto:caixote',
      x: 0,
      y: 0,
      tamanho: 1,
      rotacao: 0,
      travado: false,
      ordem,
    });
    expect(proximaOrdem([prop(0), prop(4), prop(2)])).toBe(5);
    expect(proximaOrdem([])).toBe(0);
  });

  it('o rótulo mostra de quem é o token', () => {
    const nomes = { usr_bia: 'Bia' };
    expect(rotuloDoToken(token(), nomes, 'usr_caio')).toBe('Davi Rocha · de Bia');
    expect(rotuloDoToken(token(), nomes, 'usr_bia')).toBe('Davi Rocha · seu');
    expect(rotuloDoToken(token({ donoId: null, nome: 'Vulto' }), nomes, 'usr_bia')).toBe('Vulto');
  });

  it('jogador arrasta só o próprio token; o mestre, qualquer um', () => {
    expect(podeArrastar(token(), 'usr_bia', false)).toBe(true);
    expect(podeArrastar(token(), 'usr_caio', false)).toBe(false);
    expect(podeArrastar(token({ donoId: null }), 'usr_caio', false)).toBe(false);
    expect(podeArrastar(token({ donoId: null }), 'usr_ana', true)).toBe(true);
  });
});
