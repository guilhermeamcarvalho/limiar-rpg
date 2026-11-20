import { describe, expect, it } from 'vitest';
import { caso } from '../teste/apoio.tsx';
import { agendaEmTexto, casoParaContinuar, linkDaCampanha, numeroDoCaso } from './formatos.ts';

describe('formatos de caso', () => {
  it('número com três dígitos', () => {
    expect(numeroDoCaso(17)).toBe('017');
    expect(numeroDoCaso(null)).toBe('—');
  });

  it('agenda em texto, com o gênero do dia', () => {
    expect(agendaEmTexto({ diaDaSemana: 5, horario: '21:00', frequencia: 'semanal' })).toBe(
      'Toda sexta, 21h00',
    );
    expect(agendaEmTexto({ diaDaSemana: 6, horario: '15:30', frequencia: 'semanal' })).toBe(
      'Todo sábado, 15h30',
    );
    expect(agendaEmTexto({ diaDaSemana: 2, horario: '19:30', frequencia: 'quinzenal' })).toBe(
      'Terça, a cada 15 dias, 19h30',
    );
    expect(agendaEmTexto({ diaDaSemana: 0, horario: '10:00', frequencia: 'mensal' })).toBe(
      'Um domingo por mês, 10h00',
    );
  });

  it('link de dentro do caso leva o personagem na URL', () => {
    expect(linkDaCampanha('cmp_1', 'mesa', 'chr_9')).toBe('/campanhas/cmp_1/mesa?personagem=chr_9');
    expect(linkDaCampanha('cmp_1', 'ficha')).toBe('/campanhas/cmp_1/ficha');
  });

  it('continuar: a sessão futura mais próxima; sem nenhuma, o mais recente; nunca um encerrado', () => {
    const agora = Date.parse('2026-11-19T12:00:00Z');
    const lista = [
      caso({ id: 'novo', proximaSessao: null }),
      caso({ id: 'passou', proximaSessao: '2026-11-18T21:00:00.000Z' }),
      caso({ id: 'longe', proximaSessao: '2026-11-30T21:00:00.000Z' }),
      caso({ id: 'perto', proximaSessao: '2026-11-21T00:00:00.000Z' }),
      caso({ id: 'fim', situacao: 'encerrado', proximaSessao: '2026-11-20T00:00:00.000Z' }),
    ];
    expect(casoParaContinuar(lista, agora)?.id).toBe('perto');
    expect(
      casoParaContinuar(
        [lista[0], lista[1]].filter((c) => c !== undefined),
        agora,
      )?.id,
    ).toBe('novo');
    expect(casoParaContinuar([caso({ situacao: 'encerrado' })], agora)).toBeNull();
  });
});
