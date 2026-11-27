import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ComandoDaMesa,
  EventoDaMesa,
  Membro,
  PersonagemNaMesa,
  RegistroDeTeste,
  RespostaDoComando,
} from '@membrana/shared';
import { Chat, interpretarEntradaDoChat, LOTE_DO_CHAT } from './Chat.tsx';
import { filtrarAcontecimentos, LOTE_DO_REGISTRO, Registro } from './Registro.tsx';

afterEach(() => {
  cleanup();
});

const MEMBROS: Membro[] = [
  { id: 'usr_ana', nome: 'Helena', papel: 'mestre' },
  { id: 'usr_bia', nome: 'Bia', papel: 'jogador' },
  { id: 'usr_caio', nome: 'Caio', papel: 'jogador' },
];

const PERSONAGENS: PersonagemNaMesa[] = [
  { id: 'chr_davi', donoId: 'usr_bia', nome: 'Davi Rocha', perfil: 'executor' },
  { id: 'chr_iara', donoId: 'usr_caio', nome: 'Iara Nunes', perfil: 'vigilante' },
];

function testeResolvido(
  seq: number,
  origem: 'virtual' | 'fisico' = 'virtual',
  veredito: 'sucesso' | 'falha' = 'sucesso',
): EventoDaMesa {
  const registro: RegistroDeTeste = {
    id: `tst_${String(seq)}`,
    personagemId: 'chr_davi',
    personagemNome: 'Davi',
    campanhaId: 'cmp_1',
    autor: { id: 'usr_bia', nome: 'Bia' },
    periciaId: 'furtividade',
    atributo: 'fisico',
    origem,
    resultado: {
      dados: [
        { tipo: 'd8', valor: 2, papel: 'atributo', descartado: false },
        { tipo: 'd4', valor: 1, papel: 'pericia', descartado: false },
      ],
      total: veredito === 'sucesso' ? 9 : 3,
      dt: 7,
      ra: 2,
      rb: 1,
      veredito,
      informado: origem === 'fisico',
    },
    falhaCritica: null,
    efeitos: [],
    em: '2026-11-26T21:43:00.000Z',
  };
  return { type: 'test.resolved', registro, seq };
}

describe('interpretarEntradaDoChat', () => {
  it('converte /r e /rs em dice.roll e texto comum em chat.send', () => {
    expect(interpretarEntradaDoChat('/r 2d6 + 1')).toEqual({
      ok: true,
      comando: { type: 'dice.roll', expressao: '2d6+1' },
    });
    expect(interpretarEntradaDoChat('/rs d20')).toEqual({
      ok: true,
      comando: { type: 'dice.roll', expressao: 'd20', secreta: true },
    });
    expect(interpretarEntradaDoChat('/r')).toEqual({
      ok: false,
      motivo: 'Diga o que rolar depois de /r, como /r 2d6+1.',
    });
    expect(interpretarEntradaDoChat('Olha os faders', { para: 'usr_caio' })).toEqual({
      ok: true,
      comando: { type: 'chat.send', texto: 'Olha os faders', para: 'usr_caio' },
    });
    expect(interpretarEntradaDoChat('O ar esfria.', { narracao: true, para: 'usr_caio' })).toEqual({
      ok: true,
      comando: { type: 'chat.send', texto: 'O ar esfria.', narracao: true },
    });
  });
});

describe('Chat', () => {
  it('exibe os quatro tipos do artboard 10: narração, fala comum, sussurro e resultados', () => {
    const eventos: EventoDaMesa[] = [
      {
        type: 'chat.message',
        id: 'msg_1',
        autorId: 'usr_ana',
        texto: 'O ar do corredor esfria de repente.',
        para: null,
        narracao: true,
        em: '2026-11-26T21:40:00.000Z',
        seq: 1,
      },
      {
        type: 'chat.message',
        id: 'msg_2',
        autorId: 'usr_caio',
        texto: 'Davi, olha os faders.',
        para: null,
        narracao: false,
        em: '2026-11-26T21:41:00.000Z',
        seq: 2,
      },
      {
        type: 'chat.message',
        id: 'msg_3',
        autorId: 'usr_ana',
        texto: 'Você ouve seu nome.',
        para: 'usr_bia',
        narracao: false,
        em: '2026-11-26T21:42:00.000Z',
        seq: 3,
      },
      testeResolvido(4, 'fisico', 'falha'),
      {
        type: 'dice.rolled',
        autorId: 'usr_bia',
        expressao: '2d6+1',
        dados: [4, 5],
        total: 10,
        secreta: false,
        seq: 5,
      },
    ];

    const { container } = render(
      <Chat
        eventos={eventos}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={() => Promise.resolve({ ok: true })}
      />,
    );

    expect(container.querySelector('.narr')?.textContent).toBe(
      'O ar do corredor esfria de repente.',
    );
    expect(screen.getByText('Davi, olha os faders.')).toBeDefined();
    expect(container.querySelector('.msg.sussurro')?.textContent).toContain(
      'Helena · só para você',
    );
    expect(container.querySelector('.rmsg.ko')?.textContent).toContain('dados físicos');
    expect(screen.getByText('Davi · 2d6+1')).toBeDefined();
  });

  it('envia /r 2d6 pelo campo de mensagem e limpa o campo ao confirmar', async () => {
    const enviados: ComandoDaMesa[] = [];
    const enviar = vi.fn((cmd: ComandoDaMesa): Promise<RespostaDoComando> => {
      enviados.push(cmd);
      return Promise.resolve({ ok: true });
    });

    render(
      <Chat
        eventos={[]}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={enviar}
      />,
    );

    const campo = screen.getByPlaceholderText('Fale como Davi… (/r para rolar)');
    fireEvent.change(campo, { target: { value: '/r 2d6+1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(enviados).toEqual([{ type: 'dice.roll', expressao: '2d6+1' }]);
    });
    expect((campo as HTMLInputElement).value).toBe('');
  });

  it('rola até o fim ao chegar mensagem, mas não pula se a pessoa estiver lendo acima', () => {
    const inicial: EventoDaMesa[] = [
      {
        type: 'chat.message',
        id: 'msg_1',
        autorId: 'usr_caio',
        texto: 'Primeira',
        para: null,
        narracao: false,
        em: '2026-11-26T21:40:00.000Z',
        seq: 1,
      },
    ];

    const { rerender } = render(
      <Chat
        eventos={inicial}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={() => Promise.resolve({ ok: true })}
      />,
    );

    const lista = screen.getByRole('log', { name: 'Mensagens do chat' });
    Object.defineProperty(lista, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(lista, 'clientHeight', { value: 200, configurable: true });

    // No fim: acompanha a mensagem nova.
    lista.scrollTop = 400;
    fireEvent.scroll(lista);
    Object.defineProperty(lista, 'scrollHeight', { value: 720, configurable: true });
    const segunda: EventoDaMesa = {
      type: 'chat.message',
      id: 'msg_2',
      autorId: 'usr_caio',
      texto: 'Segunda',
      para: null,
      narracao: false,
      em: '2026-11-26T21:41:00.000Z',
      seq: 2,
    };
    rerender(
      <Chat
        eventos={[...inicial, segunda]}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(lista.scrollTop).toBe(720);

    // Lendo acima: não pula quando chega mensagem de outra pessoa; mostra aviso para descer.
    lista.scrollTop = 80;
    fireEvent.scroll(lista);
    Object.defineProperty(lista, 'scrollHeight', { value: 840, configurable: true });
    const terceira: EventoDaMesa = {
      type: 'chat.message',
      id: 'msg_3',
      autorId: 'usr_caio',
      texto: 'Terceira',
      para: null,
      narracao: false,
      em: '2026-11-26T21:42:00.000Z',
      seq: 3,
    };
    rerender(
      <Chat
        eventos={[...inicial, segunda, terceira]}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={() => Promise.resolve({ ok: true })}
      />,
    );
    expect(lista.scrollTop).toBe(80);
    const botaoNovas = screen.getByRole('button', { name: 'Novas mensagens abaixo' });
    fireEvent.click(botaoNovas);
    expect(lista.scrollTop).toBe(840);
  });
});

describe('Registro (Acontecimentos)', () => {
  const todosOsTipos: EventoDaMesa[] = [
    {
      type: 'chat.message',
      id: 'msg_1',
      autorId: 'usr_bia',
      texto: 'Fala que fica só no chat',
      para: null,
      narracao: false,
      em: '2026-11-26T21:00:00.000Z',
      seq: 1,
    },
    {
      type: 'chat.message',
      id: 'msg_2',
      autorId: 'usr_ana',
      texto: 'Narração que fica só no chat',
      para: null,
      narracao: true,
      em: '2026-11-26T21:01:00.000Z',
      seq: 2,
    },
    testeResolvido(3, 'virtual', 'sucesso'),
    {
      type: 'clue.presented',
      item: {
        pistaId: 'pst_1',
        personagemId: 'chr_iara',
        apresentada: true,
        em: '2026-11-26T21:05:00.000Z',
        titulo: 'Fita 33',
        texto: 'Gravada às 3h33.',
      },
      seq: 4,
    },
    {
      type: 'map.activated',
      mapa: {
        id: 'map_2',
        nome: 'Estúdio B',
        imagem: 'a.webp',
        largura: 800,
        altura: 600,
        grade: { celula: 50, deslocamentoX: 0, deslocamentoY: 0 },
      },
      seq: 5,
    },
    {
      type: 'audio.changed',
      trilha: {
        faixaId: 'Estática da madrugada',
        volume: 0.7,
        iniciadaEm: '2026-11-26T21:06:00.000Z',
      },
      seq: 6,
    },
    { type: 'round.started', numero: 2, seq: 7 },
  ];

  it('exclui conversa e narração, não repete seq e filtra por tipo', () => {
    // Mesmo passando eventos repetidos, cada seq aparece uma vez só.
    expect(
      filtrarAcontecimentos([...todosOsTipos, ...todosOsTipos.slice(0, 4)]).map((e) => e.seq),
    ).toEqual([3, 4, 5, 6, 7]);

    render(
      <Registro
        eventos={todosOsTipos}
        papel="mestre"
        membros={MEMBROS}
        personagens={PERSONAGENS}
      />,
    );

    expect(screen.queryByText('Fala que fica só no chat')).toBeNull();
    expect(screen.queryByText('Narração que fica só no chat')).toBeNull();
    // O mestre vê a origem virtual/física.
    expect(screen.getByText(/dados virtuais/)).toBeDefined();
    expect(screen.getByText(/Iara Nunes/)).toBeDefined();
    expect(screen.getByText('Fita 33')).toBeDefined();
    expect(screen.getByText('Estúdio B')).toBeDefined();
    expect(screen.getByText('Estática da madrugada')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Pistas' }));
    expect(screen.getByText('Fita 33')).toBeDefined();
    expect(screen.queryByText('Estúdio B')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trilha' }));
    expect(screen.getByText('Estática da madrugada')).toBeDefined();
    expect(screen.queryByText('Fita 33')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cenas' }));
    expect(screen.getByText('Estúdio B')).toBeDefined();
    expect(screen.getByText(/Rodada 2/)).toBeDefined();
  });

  it('mostra o mais recente primeiro, busca por texto e pagina lotes antigos no Registro', () => {
    const muitos: EventoDaMesa[] = Array.from({ length: LOTE_DO_REGISTRO + 5 }, (_, i) => ({
      type: 'round.started',
      numero: i + 1,
      seq: i + 1,
    }));

    render(
      <Registro eventos={muitos} papel="mestre" membros={MEMBROS} personagens={PERSONAGENS} />,
    );

    expect(screen.getByText(`Rodada ${String(LOTE_DO_REGISTRO + 5)}`)).toBeDefined();
    expect(screen.queryByText('Rodada 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais antigos (5)' }));
    expect(screen.getByText('Rodada 1')).toBeDefined();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no registro' }), {
      target: { value: 'rodada 3' },
    });
    expect(screen.getByText('Rodada 3')).toBeDefined();
    expect(screen.queryByText('Rodada 1')).toBeNull();
  });
});

describe('Chat com muitas mensagens', () => {
  it('pagina mensagens antigas e filtra por tipo e busca', () => {
    const muitas: EventoDaMesa[] = Array.from({ length: LOTE_DO_CHAT + 4 }, (_, i) => ({
      type: 'chat.message',
      id: `msg_${String(i + 1)}`,
      autorId: 'usr_caio',
      texto: `Mensagem ${String(i + 1)}`,
      para: null,
      narracao: false,
      em: '2026-11-26T21:40:00.000Z',
      seq: i + 1,
    }));
    muitas.push({
      type: 'dice.rolled',
      autorId: 'usr_bia',
      expressao: '2d6',
      dados: [3, 4],
      total: 7,
      secreta: false,
      seq: LOTE_DO_CHAT + 5,
    });

    render(
      <Chat
        eventos={muitas}
        meuId="usr_bia"
        papel="jogador"
        membros={MEMBROS}
        personagens={PERSONAGENS}
        meuPersonagemNome="Davi Rocha"
        enviar={() => Promise.resolve({ ok: true })}
      />,
    );

    expect(screen.queryByText('Mensagem 1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais antigas (5)' }));
    expect(screen.getByText('Mensagem 1')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Dados' }));
    expect(screen.getByText('Davi · 2d6')).toBeDefined();
    expect(screen.queryByText('Mensagem 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tudo' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no chat' }), {
      target: { value: 'Mensagem 2' },
    });
    expect(screen.getByText('Mensagem 2')).toBeDefined();
    expect(screen.queryByText('Mensagem 1')).toBeNull();
  });
});
