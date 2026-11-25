import { describe, expect, it } from 'vitest';
import {
  TIPOS_DE_COMANDO,
  validarComando,
  type ComandoDaMesa,
  type EventosDoCliente,
} from './mesa.ts';

const motivo = (entrada: unknown) => {
  const r = validarComando(entrada);
  if (r.ok) throw new Error('era para recusar');
  return r.motivo;
};

describe('validarComando', () => {
  it('aceita um comando dentro do contrato', () => {
    const r = validarComando({ type: 'token.move', tokenId: 'tok_1', x: 500, y: 340 });
    expect(r).toEqual({
      ok: true,
      comando: { type: 'token.move', tokenId: 'tok_1', x: 500, y: 340 },
    });
  });

  it('recusa campo errado, com o motivo em português', () => {
    expect(motivo({ type: 'token.move', tokenId: 'tok_1', x: 'longe', y: 340 })).toBe(
      'A posição precisa ser um número.',
    );
    expect(motivo({ type: 'token.move', tokenId: 'tok_1', x: -5, y: 340 })).toBe(
      'A posição não pode ser negativa.',
    );
    expect(motivo({ type: 'token.move', x: 1, y: 2 })).toBe('Falta o campo token.');
  });

  it('recusa campo que não está no contrato', () => {
    expect(motivo({ type: 'token.move', tokenId: 'tok_1', x: 1, y: 2, dono: 'eu' })).toBe(
      'Campo desconhecido: dono.',
    );
  });

  it('recusa comando desconhecido e o que nem é um objeto', () => {
    expect(motivo({ type: 'token.teleport', tokenId: 'tok_1' })).toBe('Comando desconhecido.');
    expect(motivo({})).toBe('Comando desconhecido.');
    expect(motivo(null)).toBe('Comando inválido.');
    expect(motivo('token.move')).toBe('Comando inválido.');
    expect(motivo([{ type: 'round.end' }])).toBe('Comando inválido.');
  });

  it('sem mensagem própria no schema, a recusa sai numa mensagem padrão em português', () => {
    const forma = { tipo: 'retangulo', x: 0, y: 0, largura: 0, altura: 10 };
    expect(motivo({ type: 'darkness.add', forma })).toBe('O campo largura está fora do limite.');
    expect(motivo({ type: 'darkness.remove', tudo: false })).toBe('O campo tudo está errado.');
    expect(motivo({ type: 'token.delete', tokenId: 7 })).toBe('O campo token está errado.');
  });

  it('update sem nada para mudar é recusado', () => {
    expect(motivo({ type: 'token.update', tokenId: 'tok_1' })).toBe('Diga o que mudar.');
    expect(motivo({ type: 'prop.update', propId: 'prp_1' })).toBe('Diga o que mudar.');
  });

  it('darkness.remove: uma área ou tudo, nunca os dois nem nenhum', () => {
    expect(validarComando({ type: 'darkness.remove', formaId: 'nev_1' }).ok).toBe(true);
    expect(validarComando({ type: 'darkness.remove', tudo: true }).ok).toBe(true);
    expect(motivo({ type: 'darkness.remove' })).toBe('Diga qual área remover, ou remova tudo.');
    expect(motivo({ type: 'darkness.remove', formaId: 'nev_1', tudo: true })).toBe(
      'Diga qual área remover, ou remova tudo.',
    );
  });

  it('breu: polígono precisa de 3 pontos', () => {
    const forma = {
      tipo: 'poligono',
      pontos: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    expect(motivo({ type: 'darkness.add', forma })).toBe('Um polígono tem pelo menos 3 pontos.');
    expect(motivo({ type: 'darkness.add', forma: { tipo: 'circulo' } })).toBe(
      'Desenhe um retângulo ou um polígono.',
    );
  });

  it('imagem do token: um arquivo enviado pelo app ou um modelo de NPC', () => {
    const base = { type: 'token.create', nome: 'Vulto', x: 1, y: 1 };
    expect(validarComando({ ...base, imagem: 'npc:cultista' }).ok).toBe(true);
    expect(validarComando({ type: 'token.update', tokenId: 'tok_1', imagem: 'npc:corvo' }).ok).toBe(
      true,
    );
    expect(motivo({ ...base, imagem: 'npc:dragao' })).toBe(
      'Use uma imagem enviada pelo app ou um modelo de NPC.',
    );
    // Prop pronto não é imagem de token.
    expect(motivo({ ...base, imagem: 'pronto:caixote' })).toBe(
      'Use uma imagem enviada pelo app ou um modelo de NPC.',
    );
    expect(validarComando({ ...base, imagem: `${'a'.repeat(64)}.webp` }).ok).toBe(true);
    expect(motivo({ ...base, imagem: '../../etc/passwd' })).toBe(
      'Use uma imagem enviada pelo app ou um modelo de NPC.',
    );
  });

  it('os testes da mesa usam o mesmo pedido da ficha, com o personagem', () => {
    expect(
      validarComando({ type: 'test.resolve', personagemId: 'chr_1', periciaId: 'luta' }).ok,
    ).toBe(true);
    expect(motivo({ type: 'test.resolve', personagemId: 'chr_1', periciaId: 'voar' })).toBe(
      'Escolha uma das perícias da ficha.',
    );
  });

  it('o contrato tem todos os comandos da arquitetura', () => {
    expect([...TIPOS_DE_COMANDO].sort()).toEqual(
      [
        'token.move',
        'token.drag',
        'token.create',
        'token.update',
        'token.delete',
        'token.gather',
        'prop.create',
        'prop.update',
        'prop.delete',
        'prop.drag',
        'darkness.add',
        'darkness.reveal',
        'darkness.remove',
        'mist.set',
        'map.activate',
        'map.grid',
        'room.update',
        'clue.create',
        'clue.update',
        'clue.delete',
        'clue.send',
        'clue.revoke',
        'clue.take',
        'clue.present',
        'dice.roll',
        'test.resolve',
        'test.report',
        'poi.investigate',
        'audio.play',
        'audio.stop',
        'audio.volume',
        'chat.send',
        'round.end',
      ].sort(),
    );
  });
});

describe('névoa da Membrana', () => {
  it('mist.set: um inteiro de 0 a 100', () => {
    expect(validarComando({ type: 'mist.set', nivel: 0 }).ok).toBe(true);
    expect(validarComando({ type: 'mist.set', nivel: 100 }).ok).toBe(true);
    expect(motivo({ type: 'mist.set', nivel: 101 })).toBe('O nível da névoa vai de 0 a 100.');
    expect(motivo({ type: 'mist.set', nivel: -1 })).toBe('O nível da névoa vai de 0 a 100.');
    expect(motivo({ type: 'mist.set', nivel: 50.5 })).toBe('O nível da névoa é um número inteiro.');
  });
});

describe('tipos para o client', () => {
  // Estas linhas só existem para o `tsc` (pnpm typecheck): o client não compila fora do contrato.
  it('comando fora do contrato não compila', () => {
    const emitir: EventosDoCliente['cmd'] = () => undefined;
    const certo: ComandoDaMesa = { type: 'token.move', tokenId: 'tok_1', x: 1, y: 2 };
    emitir(certo, () => undefined);
    // @ts-expect-error: comando que não existe
    emitir({ type: 'token.teleport', tokenId: 'tok_1' }, () => undefined);
    // @ts-expect-error: campo com o tipo errado
    emitir({ type: 'token.move', tokenId: 'tok_1', x: '1', y: 2 }, () => undefined);
    // @ts-expect-error: falta um campo obrigatório
    emitir({ type: 'chat.send' }, () => undefined);
    expect(true).toBe(true);
  });
});
