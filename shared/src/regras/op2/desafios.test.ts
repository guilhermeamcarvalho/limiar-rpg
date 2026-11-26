import { describe, expect, it } from 'vitest';
import { ErroDeRegra } from '../dados.ts';
import {
  aplicarTentativaDeDesafio,
  criarEstadoDoDesafio,
  liberarDesafio,
  TENTATIVAS_MAXIMAS_PADRAO,
  tentativasDeDestrancar,
} from './desafios.ts';

describe('desafios de acesso (#84)', () => {
  it('define tentativas por dado de Crime e usa o mesmo teto padrão', () => {
    expect(TENTATIVAS_MAXIMAS_PADRAO).toBe(4);
    expect(tentativasDeDestrancar('d4')).toBe(1);
    expect(tentativasDeDestrancar('d8')).toBe(3);
    expect(tentativasDeDestrancar('d12')).toBe(5);
  });

  it('esgotar as tentativas trava o ponto até o mestre liberar', () => {
    let estado = criarEstadoDoDesafio('destrancar', { tentativasMaximas: 2 });
    estado = aplicarTentativaDeDesafio(estado, { sucesso: false, dica: 'baixo' });
    expect(estado.travado).toBe(false);
    expect(estado.tentativasUsadas).toBe(1);

    estado = aplicarTentativaDeDesafio(estado, { sucesso: false, dica: 'alto' });
    expect(estado.travado).toBe(true);
    expect(estado.resolvido).toBe(false);

    expect(() => aplicarTentativaDeDesafio(estado, { sucesso: true })).toThrow(ErroDeRegra);

    estado = liberarDesafio(estado);
    expect(estado.travado).toBe(false);
    expect(estado.tentativasUsadas).toBe(0);

    estado = aplicarTentativaDeDesafio(estado, { sucesso: true });
    expect(estado.resolvido).toBe(true);
    expect(aplicarTentativaDeDesafio(estado, { sucesso: false })).toBe(estado);
  });

  it('arrombar soma progresso até atingir a meta', () => {
    expect(criarEstadoDoDesafio('arrombar').meta).toBe(12);

    let estado = criarEstadoDoDesafio('arrombar', { meta: 15 });
    estado = aplicarTentativaDeDesafio(estado, { sucesso: false });
    expect(estado.progresso).toBe(0);

    estado = aplicarTentativaDeDesafio(estado, { sucesso: true, valorObtido: 8 });
    expect(estado.resolvido).toBe(false);
    expect(estado.progresso).toBe(8);

    estado = aplicarTentativaDeDesafio(estado, { sucesso: true, valorObtido: 9 });
    expect(estado.progresso).toBe(15);
    expect(estado.resolvido).toBe(true);
  });
});
