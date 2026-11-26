import { describe, expect, it } from 'vitest';
import {
  AVISO_ROLAGEM_OFFLINE,
  descreverAcaoNaFila,
  ehRolagemBloqueadaOffline,
  podeEnfileirarOffline,
  segundosParaTentativa,
} from './conexao.ts';

describe('fila e regras offline da mesa (#76)', () => {
  it('enfileira movimentos e mensagens, e bloqueia rolagens offline', () => {
    expect(podeEnfileirarOffline({ type: 'token.move', tokenId: 'tok_1', x: 10, y: 20 })).toBe(
      true,
    );
    expect(podeEnfileirarOffline({ type: 'chat.send', texto: 'Oi' })).toBe(true);
    expect(podeEnfileirarOffline({ type: 'dice.roll', expressao: 'd20' })).toBe(false);

    expect(ehRolagemBloqueadaOffline({ type: 'dice.roll', expressao: 'd20' })).toBe(true);
    expect(
      ehRolagemBloqueadaOffline({
        type: 'test.resolve',
        personagemId: 'chr_1',
        periciaId: 'luta',
      }),
    ).toBe(true);
    expect(
      ehRolagemBloqueadaOffline({
        type: 'test.report',
        personagemId: 'chr_1',
        periciaId: 'luta',
        resultado: { modo: 'veredito', veredito: 'sucesso' },
      }),
    ).toBe(true);
    expect(AVISO_ROLAGEM_OFFLINE).toContain('servidor');
  });

  it('descreve movimentos e mensagens curtas para a lista da fila', () => {
    expect(
      descreverAcaoNaFila({ type: 'token.move', tokenId: 'tok_1', x: 50, y: 50 }, [
        { id: 'tok_1', nome: 'Davi' },
      ]),
    ).toBe('Mover Davi');
    expect(descreverAcaoNaFila({ type: 'chat.send', texto: 'Vou checar a mesa de som' })).toBe(
      '“Vou checar a mesa de som”',
    );
    expect(segundosParaTentativa(1)).toBe(2);
    expect(segundosParaTentativa(20)).toBe(30);
  });
});
