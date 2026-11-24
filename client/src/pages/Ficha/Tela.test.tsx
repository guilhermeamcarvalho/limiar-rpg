import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FichaOp2, Personagem, RegistroDeTeste } from '@membrana/shared';
import {
  abrir,
  detalhe,
  json,
  MARTA,
  personagem,
  servidor,
  type Chamada,
  type Respostas,
} from '../../teste/apoio.tsx';
import { ListaDePistas, novoIdDeItem } from './Abas.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Corpo = { ficha: FichaOp2 };

/** O servidor devolve a ficha que recebeu, como o PUT de verdade. */
const ecoar = (base: Personagem) => (c: Chamada) =>
  json(200, {
    personagem: {
      ...base,
      ficha: (c.corpo as Corpo).ficha,
      atualizadoEm: new Date().toISOString(),
    },
  });

function registro(campos: Partial<RegistroDeTeste> = {}): RegistroDeTeste {
  return {
    id: 'tst_1',
    personagemId: 'chr_davi',
    campanhaId: 'cmp_1',
    autor: { id: MARTA.id, nome: 'Marta' },
    periciaId: 'maquinas',
    atributo: 'mente',
    origem: 'virtual',
    resultado: {
      dados: [
        { tipo: 'd6', valor: 5, papel: 'atributo', descartado: false },
        { tipo: 'd10', valor: 9, papel: 'pericia', descartado: false },
        { tipo: 'd4', valor: 3, papel: 'bonus', origem: 'Gambiarra', descartado: false },
      ],
      total: 17,
      dt: 7,
      ra: 9,
      rb: 3,
      veredito: 'sucesso',
      informado: false,
    },
    falhaCritica: null,
    efeitos: ['Gambiarra usada: −2 PV.'],
    em: '2026-11-23T14:00:00.000Z',
    ...campos,
  };
}

/** Abre a ficha do Davi (da Marta, no Sinal). Devolve as chamadas feitas ao servidor. */
async function abrirDavi(ficha: Partial<FichaOp2> = {}, rotas: Respostas = {}, campos = {}) {
  const davi = personagem(campos, ficha);
  const chamadas = servidor({
    'GET /api/personagens/chr_davi': json(200, { personagem: davi }),
    'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe() }),
    'PUT /api/personagens/chr_davi': ecoar(davi),
    ...rotas,
  });
  abrir('/personagens/chr_davi/ficha');
  await screen.findByRole('heading', { name: davi.ficha.nome });
  return { chamadas, davi };
}

const ultimoPut = (chamadas: Chamada[]) =>
  (chamadas.filter((c) => c.metodo === 'PUT').at(-1)?.corpo as Corpo | undefined)?.ficha;

describe('Ficha: topo, atributos, PV/PD, Ímpeto e Gambiarra (#45)', () => {
  it('mostra o topo: caso, sistema, salvamento, nome, perfil e a linha da ficha', async () => {
    await abrirDavi();
    const topo = screen.getByRole('region', { name: 'Personagem' });

    expect(within(topo).getByText('O Sinal de Santa Ermida')).toBeDefined();
    expect(within(topo).getByText('Ordem Paranormal II')).toBeDefined();
    expect(within(topo).getByText(/^Salva (há|em|agora)/)).toBeDefined();
    expect(within(topo).getByText('Executor')).toBeDefined();
    expect(within(topo).getByText('Mecânico · nível 2 · 34 anos · Santa Ermida')).toBeDefined();
    expect(within(topo).getByRole('button', { name: 'Editar ficha' })).toBeDefined();
    expect(within(topo).getByRole('link', { name: 'Jogar na mesa' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/mesa',
    );
    expect(
      within(topo).getByRole('button', { name: 'Dados virtuais' }).getAttribute('aria-pressed'),
    ).toBe('true');
    // O título da aba é gravado num efeito, que pode rodar logo depois da tela aparecer.
    await waitFor(() => {
      expect(document.title).toBe('Davi Rocha · MEMBRANA');
    });
  });

  it('mudar PV salva no servidor e mostra "Salva agora"', async () => {
    const { chamadas } = await abrirDavi();
    const topo = screen.getByRole('region', { name: 'Personagem' });
    expect(within(topo).queryByText('Salva agora')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Perder 1 PV' }));

    expect(screen.getByRole('group', { name: 'PV: 11 de 12' })).toBeDefined();
    await waitFor(() => {
      expect(ultimoPut(chamadas)?.pv).toBe(11);
    });
    expect(await within(topo).findByText('Salva agora')).toBeDefined();
  });

  it('clicar numa caixa marca até ela; na última marcada, desmarca só ela', async () => {
    const { chamadas } = await abrirDavi();
    const caixa4 = screen.getByRole('button', { name: 'PD, caixa 4' });

    fireEvent.click(caixa4);
    expect(screen.getByRole('group', { name: 'PD: 4 de 12' })).toBeDefined();
    expect(caixa4.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(caixa4);
    expect(screen.getByRole('group', { name: 'PD: 3 de 12' })).toBeDefined();

    await waitFor(() => {
      expect(ultimoPut(chamadas)?.pd).toBe(3);
    });
    expect(screen.getByRole('button', { name: 'Recuperar 1 PV' })).toHaveProperty('disabled', true);
  });

  it('se o servidor recusar, a ficha volta ao último estado salvo e diz o motivo', async () => {
    await abrirDavi(
      {},
      {
        'PUT /api/personagens/chr_davi': json(403, {
          erro: { codigo: 'SO_O_DONO_OU_MESTRE', mensagem: 'Só quem joga pode mudar a ficha.' },
        }),
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Perder 1 PV' }));

    expect(await screen.findByText(/Só quem joga pode mudar a ficha\./)).toBeDefined();
    expect(screen.getByRole('group', { name: 'PV: 12 de 12' })).toBeDefined();
  });

  it('Ímpeto e Gambiarra aparecem para o Executor mecânico', async () => {
    await abrirDavi();
    expect(screen.getByText('Ímpeto · Executor')).toBeDefined();
    expect(screen.getByRole('meter', { name: 'Ímpeto' }).getAttribute('aria-valuenow')).toBe('1');
    expect(screen.getByText('Gambiarra')).toBeDefined();
    expect(screen.getByText('1 por cena · disponível')).toBeDefined();
    expect(screen.getByText('+d4 em Máquinas ou Crime. Custa 2 PV.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Gastar 3 · +1 passo' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Ímpeto e Gambiarra só aparecem para quem tem a habilidade', async () => {
    await abrirDavi({ perfil: 'analista', ocupacao: 'Jornalista' });
    expect(screen.queryByText('Ímpeto · Executor')).toBeNull();
    expect(screen.queryByText('Gambiarra')).toBeNull();
    expect(screen.queryByRole('button', { name: /Gastar 1/ })).toBeNull();
  });

  it('Gastar 3 sobe o atributo escolhido até o fim da cena', async () => {
    const { chamadas } = await abrirDavi({ impeto: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'Gastar 3 · +1 passo' }));
    const janela = await screen.findByRole('dialog', { name: 'Subir um atributo' });
    fireEvent.click(within(janela).getByRole('button', { name: 'Mente' }));

    expect(await screen.findByText('Mente subiu um passo até o fim da cena.')).toBeDefined();
    expect(screen.getByText('d6 → d8 na cena')).toBeDefined();
    await waitFor(() => {
      expect(ultimoPut(chamadas)).toMatchObject({ impeto: 0, impetoAtributo: 'mente' });
    });
  });

  it('o seletor de dados grava o modo na ficha', async () => {
    const { chamadas } = await abrirDavi();
    fireEvent.click(screen.getByRole('button', { name: 'Dados físicos' }));
    await waitFor(() => {
      expect(ultimoPut(chamadas)?.modoDados).toBe('fisico');
    });
  });

  it('quem só pode ver não edita, não testa e não muda PV', async () => {
    await abrirDavi({}, {}, { donoId: 'usr_outro' });
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Perder 1 PV' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Testar Máquinas/ })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('Ficha: 20 perícias com prévia de teste (#46)', () => {
  it('as 20 perícias aparecem, cada uma descrevendo o teste', async () => {
    await abrirDavi();
    const pericias = screen.getAllByRole('button', { name: /^Testar / });
    expect(pericias).toHaveLength(20);
    expect(
      screen.getByRole('button', { name: 'Testar Máquinas: d6 de atributo e d10 de perícia' }),
    ).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'DT' })).toHaveProperty('value', '7');
  });

  it('em dados virtuais, clicar pede o resultado oficial ao servidor e mostra o cartão', async () => {
    const depois = personagem({}, { pv: 10, usadasNaCena: ['gambiarra'] });
    const { chamadas } = await abrirDavi(
      {},
      {
        'POST /api/personagens/chr_davi/testes': json(201, {
          teste: registro(),
          personagem: depois,
        }),
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Usar no próximo teste' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'DT' }), { target: { value: '10' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Testar Máquinas: d6 de atributo, d10 de perícia e d4 de Gambiarra',
      }),
    );

    const resultado = await screen.findByRole('region', { name: 'Resultado do teste' });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      periciaId: 'maquinas',
      dt: 10,
      habilidades: ['gambiarra'],
    });
    expect(within(resultado).getByText('17')).toBeDefined();
    expect(within(resultado).getByText('Sucesso · DT 7')).toBeDefined();
    expect(within(resultado).getByText('Gambiarra usada: −2 PV.')).toBeDefined();
    expect(within(resultado).getByText('Máquinas · Mente · agora')).toBeDefined();
    // A ficha passa a ser a que o servidor devolveu.
    expect(screen.getByRole('group', { name: 'PV: 10 de 12' })).toBeDefined();
    expect(screen.getByText('1 por cena · usada')).toBeDefined();
  });

  it('Ímpeto ligado vai no pedido e desliga depois do teste', async () => {
    const { chamadas } = await abrirDavi(
      {},
      {
        'POST /api/personagens/chr_davi/testes': json(201, {
          teste: registro({ periciaId: 'luta', atributo: 'fisico', efeitos: [] }),
          personagem: personagem({}, { impeto: 0 }),
        }),
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gastar 1 · +d4' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Testar Luta: d8 de atributo, d8 de perícia e d4 de Ímpeto',
      }),
    );

    await screen.findByRole('region', { name: 'Resultado do teste' });
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({
      periciaId: 'luta',
      dt: 7,
      impeto: true,
    });
    expect(screen.getByRole('button', { name: 'Gastar 1 · +d4' })).toHaveProperty('disabled', true);
  });

  it('erro do servidor no teste aparece como aviso e não muda a ficha', async () => {
    await abrirDavi(
      {},
      {
        'POST /api/personagens/chr_davi/testes': json(422, {
          erro: { codigo: 'TESTE_RECUSADO', mensagem: 'Gambiarra já foi usada nesta cena.' },
        }),
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Testar Máquinas/ }));
    expect(await screen.findByText('Gambiarra já foi usada nesta cena.')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Resultado do teste' })).toBeNull();
  });
});

describe('Ficha: modal de dados físicos (#50, #51)', () => {
  const URL_INFORMADO = 'POST /api/personagens/chr_davi/testes/informado';

  /** Abre a ficha no modo físico e clica em Máquinas. */
  async function abrirModal(rotas: Respostas = {}) {
    const r = await abrirDavi({ modoDados: 'fisico' }, rotas);
    fireEvent.click(screen.getByRole('button', { name: /^Testar Máquinas/ }));
    const janela = await screen.findByRole('dialog', { name: /Máquinas · Mente/ });
    return { ...r, janela };
  }

  const valor = (janela: HTMLElement, rotulo: string, texto: string) => {
    fireEvent.change(within(janela).getByLabelText(rotulo), { target: { value: texto } });
  };
  const enviar = (janela: HTMLElement) =>
    within(janela).getByRole<HTMLButtonElement>('button', { name: 'Enviar resultado' });
  const informados = (chamadas: Chamada[]) =>
    chamadas.filter((c) => c.metodo === 'POST' && c.url.endsWith('/testes/informado'));

  afterEach(() => {
    localStorage.clear();
  });

  it('mostra os dados a rolar e cancelar não envia nada', async () => {
    const { chamadas, janela } = await abrirModal();

    expect(within(janela).getByLabelText('Valor do d6 de Mente')).toBeDefined();
    expect(within(janela).getByLabelText('Valor do d10 de Máquinas')).toBeDefined();
    expect(within(janela).getByText('Aguardando os valores')).toBeDefined();
    expect(enviar(janela).disabled).toBe(true);

    fireEvent.click(within(janela).getByRole('button', { name: 'Cancelar · nada é enviado' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('d10 com 12 mostra "O d10 vai de 1 a 10" e bloqueia o envio', async () => {
    const { janela } = await abrirModal();

    valor(janela, 'Valor do d6 de Mente', '5');
    valor(janela, 'Valor do d10 de Máquinas', '12');

    expect(within(janela).getByRole('alert').textContent).toBe(
      'O d10 vai de 1 a 10. Confira o dado de Máquinas.',
    );
    expect(enviar(janela).disabled).toBe(true);
  });

  it('informar os dados: soma, veredito e envio com a origem "dados físicos"', async () => {
    const { chamadas, janela } = await abrirModal({
      [URL_INFORMADO]: json(201, {
        teste: registro({ origem: 'fisico' }),
        personagem: personagem({}, { modoDados: 'fisico' }),
      }),
    });

    valor(janela, 'Valor do d6 de Mente', '5');
    valor(janela, 'Valor do d10 de Máquinas', '9');
    expect(within(janela).getByText('5 + 9')).toBeDefined();
    expect(within(janela).getByText('14 · Sucesso')).toBeDefined();
    fireEvent.click(enviar(janela));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(informados(chamadas)[0]?.corpo).toEqual({
      periciaId: 'maquinas',
      dt: 7,
      resultado: { modo: 'dados', valores: [5, 9] },
    });
    const cartao = screen.getByRole('region', { name: 'Resultado do teste' });
    expect(within(cartao).getByText('Dados físicos')).toBeDefined();
  });

  it('falha crítica: pede o d8, o d4 do Acidente e mostra o efeito antes de enviar', async () => {
    const { chamadas, janela } = await abrirModal({
      [URL_INFORMADO]: json(201, {
        teste: registro({ origem: 'fisico' }),
        personagem: personagem({}, { modoDados: 'fisico' }),
      }),
    });

    valor(janela, 'Valor do d6 de Mente', '1');
    valor(janela, 'Valor do d10 de Máquinas', '1');
    expect(within(janela).getByText('Passo 2')).toBeDefined();
    expect(enviar(janela).disabled).toBe(true);

    fireEvent.click(within(janela).getByRole('button', { name: /^5: Acidente/ }));
    valor(janela, 'Acidente: quanto deu o d4?', '3');

    expect(within(janela).getByText('−3 PV')).toBeDefined();
    expect(within(janela).getByText(/fica com 9\/12 PV/)).toBeDefined();
    fireEvent.click(enviar(janela));
    await waitFor(() => {
      expect(informados(chamadas)).toHaveLength(1);
    });
    expect(informados(chamadas)[0]?.corpo).toMatchObject({
      resultado: { modo: 'dados', valores: [1, 1] },
      falhaCritica: { d8: 5, d4: 3 },
    });
  });

  it('só o resultado: escolhe o veredito, lembra o jeito e envia sem os números', async () => {
    const { chamadas, janela } = await abrirModal({
      [URL_INFORMADO]: json(201, {
        teste: registro({ origem: 'fisico' }),
        personagem: personagem({}, { modoDados: 'fisico' }),
      }),
    });

    fireEvent.click(within(janela).getByRole('tab', { name: 'Só o resultado' }));
    fireEvent.click(within(janela).getByRole('button', { name: 'Falha' }));
    expect(within(janela).getByText(/Ímpeto \+1 \(2\/3\)/)).toBeDefined();
    fireEvent.click(enviar(janela));

    await waitFor(() => {
      expect(informados(chamadas)).toHaveLength(1);
    });
    expect(informados(chamadas)[0]?.corpo).toEqual({
      periciaId: 'maquinas',
      dt: 7,
      resultado: { modo: 'veredito', veredito: 'falha' },
    });
    expect(localStorage.getItem('membrana.dadosFisicos.jeito')).toBe('veredito');
  });

  it('a soma informada que não combina com o veredito aparece no campo', async () => {
    const { janela } = await abrirModal();

    fireEvent.click(within(janela).getByRole('tab', { name: 'Só o resultado' }));
    fireEvent.click(within(janela).getByRole('button', { name: 'Sucesso' }));
    valor(janela, 'Soma dos 3 maiores', '5');

    expect(within(janela).getByText('5 não alcança a DT 7: é falha.')).toBeDefined();
    expect(enviar(janela).disabled).toBe(true);
  });

  it('se o servidor recusar, o modal fica aberto com o motivo', async () => {
    const { janela } = await abrirModal({
      [URL_INFORMADO]: json(409, {
        erro: { codigo: 'DADOS_FISICOS_DESLIGADOS', mensagem: 'O mestre deste caso não permite.' },
      }),
    });

    valor(janela, 'Valor do d6 de Mente', '5');
    valor(janela, 'Valor do d10 de Máquinas', '9');
    fireEvent.click(enviar(janela));

    expect(await within(janela).findByText('O mestre deste caso não permite.')).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

describe('Ficha: seletor de dados e foto (#49, #52)', () => {
  it('trocar o modo de dados grava na ficha', async () => {
    const { chamadas } = await abrirDavi();

    fireEvent.click(screen.getByRole('button', { name: 'Dados físicos' }));

    await waitFor(() => {
      expect(ultimoPut(chamadas)?.modoDados).toBe('fisico');
    });
  });

  it('caso só com dados virtuais esconde o seletor', async () => {
    servidor({
      'GET /api/personagens/chr_davi': json(200, { personagem: personagem() }),
      'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe({ dadosFisicos: false }) }),
    });
    abrir('/personagens/chr_davi/ficha');
    await screen.findByRole('heading', { name: 'Davi Rocha' });
    expect(screen.queryByRole('group', { name: 'Como rolar os dados' })).toBeNull();
  });

  it('a foto aparece no topo e o botão abre o envio', async () => {
    await abrirDavi({}, {}, { foto: `${'a'.repeat(64)}.webp` });

    const foto = screen.getByRole('img', { name: 'Davi Rocha' });
    expect(foto.querySelector('img')?.getAttribute('src')).toBe(
      `/api/arquivos/${'a'.repeat(64)}.webp`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trocar foto e token' }));
    expect(await screen.findByRole('dialog', { name: 'Foto e token' })).toBeDefined();
  });
});

describe('Ficha: abas Itens, Pistas, Anotações e Histórico (#54)', () => {
  it('as quatro abas existem; Itens mostra os espaços ocupados pelo Físico', async () => {
    await abrirDavi();
    const abas = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(abas).toEqual(['Itens4', 'Pistas0', 'Anotações', 'Histórico']);
    expect(screen.getByText('4 de 8 ocupados')).toBeDefined();
    expect(screen.getByText('Kit de ferramentas')).toBeDefined();
  });

  it('adicionar e tirar item grava a ficha', async () => {
    const { chamadas } = await abrirDavi();

    fireEvent.change(screen.getByLabelText('Novo item'), { target: { value: 'Fita "33"' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByText('Fita "33"')).toBeDefined();
    await waitFor(() => {
      expect(ultimoPut(chamadas)?.itens.map((i) => i.nome)).toContain('Fita "33"');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tirar Lanterna' }));
    await waitFor(() => {
      expect(ultimoPut(chamadas)?.itens.map((i) => i.nome)).not.toContain('Lanterna');
    });
  });

  it('item sem nome não entra; acima do limite, avisa sem bloquear', async () => {
    await abrirDavi({ atributos: { fisico: 'd4', mente: 'd6', emocao: 'd6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Dê um nome ao item.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Novo item'), { target: { value: 'Corda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByText(/Passa do limite do Físico \(4 espaços\)/)).toBeDefined();
  });

  it('anotações salvam ao sair do campo', async () => {
    const { chamadas } = await abrirDavi();
    fireEvent.click(screen.getByRole('tab', { name: 'Anotações' }));
    const campo = screen.getByRole('textbox', { name: 'Anotações' });

    fireEvent.change(campo, { target: { value: 'O turno das 3h é do Ventura.' } });
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
    fireEvent.blur(campo);

    await waitFor(() => {
      expect(ultimoPut(chamadas)?.anotacoes).toBe('O turno das 3h é do Ventura.');
    });
  });

  it('o histórico lista os testes registrados no servidor', async () => {
    await abrirDavi(
      {},
      {
        'GET /api/personagens/chr_davi/testes': json(200, {
          testes: [registro(), registro({ id: 'tst_2', periciaId: 'luta', atributo: 'fisico' })],
        }),
      },
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));

    const itens = await screen.findAllByRole('listitem');
    expect(itens.map((i) => within(i).getAllByText(/./)[0]?.textContent)).toEqual([
      'Máquinas',
      'Luta',
    ]);
    expect(screen.getAllByText('17 · Sucesso')).toHaveLength(2);
  });

  it('pistas: vazio por enquanto, com o texto de onde elas vêm', async () => {
    await abrirDavi();
    fireEvent.click(screen.getByRole('tab', { name: /Pistas/ }));
    expect(screen.getByText('Nenhuma pista ainda')).toBeDefined();
  });

  it('pistas em papel, com "nova" e "Apresentar ao grupo" (liga na Fase 3)', () => {
    render(
      <ListaDePistas
        pistas={[
          {
            id: 'p1',
            titulo: 'Fita “33”',
            texto: 'Última transmissão.',
            nova: true,
            apresentada: false,
          },
          { id: 'p2', titulo: 'Quadro', texto: 'Turno das 3h.', nova: false, apresentada: true },
        ]}
      />,
    );
    expect(screen.getByText('Fita “33” · nova')).toBeDefined();
    expect(screen.getByText('Quadro · apresentada')).toBeDefined();
    const botoes = screen.getAllByRole('button', { name: 'Apresentar ao grupo' });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toHaveProperty('disabled', true);
  });

  it('novoIdDeItem não repete um id que já existe', () => {
    const existentes = [{ id: 'item-a', nome: 'A', descricao: '' }];
    expect(novoIdDeItem(existentes, 10)).toBe('item-b');
    expect(novoIdDeItem([], 10)).toBe('item-a');
  });
});

describe('Ficha no celular (#56)', () => {
  const barra = () => screen.getByRole('navigation', { name: 'Partes da ficha' });

  it('tem cabeçalho próprio, com voltar, caso e editar, no lugar do cabeçalho do app', async () => {
    await abrirDavi();
    const topo = document.querySelector('header.m-top') as HTMLElement;
    expect(document.querySelectorAll('header.m-top')).toHaveLength(1);
    expect(within(topo).getByText('O Sinal de Santa Ermida · Ordem Paranormal II')).toBeDefined();
    expect(
      within(topo).getByRole('link', { name: 'Voltar para Personagens' }).getAttribute('href'),
    ).toBe('/personagens');

    fireEvent.click(within(topo).getByRole('button', { name: 'Editar a ficha de Davi' }));
    expect(await screen.findByText('Editando a ficha de Davi')).toBeDefined();
    // Na edição, volta o cabeçalho do app e a barra principal.
    expect(screen.queryByRole('navigation', { name: 'Partes da ficha' })).toBeNull();
  });

  it('a barra de baixo troca a barra do app: Ficha, Itens, Pistas e Mesa', async () => {
    await abrirDavi();
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1);
    expect(
      within(barra())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Ficha', 'Itens', 'Pistas']);
    expect(within(barra()).getByRole('link', { name: 'Mesa' }).getAttribute('href')).toBe(
      '/campanhas/cmp_1/mesa',
    );

    fireEvent.click(within(barra()).getByRole('button', { name: 'Pistas' }));
    expect(screen.getByRole('tab', { name: /Pistas/ }).getAttribute('aria-selected')).toBe('true');
    expect(
      within(barra()).getByRole('button', { name: 'Pistas' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('sem caso, Mesa fica desligada', async () => {
    await abrirDavi({}, {}, { campanhaId: null, campanha: null });
    expect(within(barra()).getByRole('button', { name: 'Mesa' })).toHaveProperty('disabled', true);
  });
});
