import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { esquemaFichaOp2, fichaDoDavi, fichaNova, type FichaOp2 } from '@membrana/shared';
import {
  abrir,
  detalhe,
  endereco,
  json,
  personagem,
  servidor,
  type Chamada,
} from '../../teste/apoio.tsx';
import { fichaDoRascunho, RASCUNHO_VAZIO } from '../Criar/rascunho.ts';
import { contarMudancas, daForm, errosDaFicha, paraForm } from './Edicao.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const salvarFicha = () => screen.getByRole('button', { name: 'Criar personagem' });

describe('Ficha em branco', () => {
  it('abre em edição com os valores de partida e o nível do caso', async () => {
    servidor({
      'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe({ nivelInicial: 3 }) }),
    });
    abrir('/personagens/novo/ficha?caso=cmp_1');

    expect(await screen.findByText('Ficha em branco')).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Nível').value).toBe('3');
    expect(screen.getByLabelText<HTMLSelectElement>('Físico').value).toBe('d6');
    expect(screen.getByLabelText<HTMLSelectElement>('Luta').value).toBe('d4');
    expect(screen.getByLabelText<HTMLInputElement>('PV máximo').value).toBe('10');
    expect(screen.getByText('O Sinal de Santa Ermida')).toBeDefined();
  });

  it('avisos RF-09 iguais aos da criação, sem bloquear', async () => {
    const chamadas = servidor({
      'POST /api/personagens': (c: Chamada) =>
        json(201, { personagem: { id: 'chr_1', ficha: (c.corpo as { ficha: FichaOp2 }).ficha } }),
      'GET /api/me/personagens': json(200, { personagens: [] }),
      'GET /api/campanhas': json(200, { campanhas: [] }),
    });
    abrir('/personagens/novo/ficha');
    await screen.findByText('Ficha em branco');

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rui Batista' } });
    fireEvent.change(screen.getByLabelText('Mente'), { target: { value: 'd10' } });
    expect(screen.getByText('Mente d10 passa do limite da criação (d8).')).toBeDefined();
    expect(screen.getByText('1 aviso', { exact: false })).toBeDefined();

    fireEvent.click(salvarFicha());

    await waitFor(() => {
      expect(chamadas.some((c) => c.metodo === 'POST')).toBe(true);
    });
    const post = chamadas.find((c) => c.metodo === 'POST');
    expect(post?.corpo).toMatchObject({
      sistemaId: 'sys_op2',
      ficha: { nome: 'Rui Batista', atributos: { mente: 'd10' } },
    });
    await waitFor(() => {
      expect(endereco()).toBe('/personagens');
    });
  });

  it('erro bloqueia salvar, aparece no campo e leva o foco para ele', async () => {
    const chamadas = servidor();
    abrir('/personagens/novo/ficha');
    await screen.findByText('Ficha em branco');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rui' } });
    fireEvent.change(screen.getByLabelText('PV atual'), { target: { value: '50' } });

    fireEvent.click(salvarFicha());

    expect(await screen.findByText('O PV não pode passar do máximo.')).toBeDefined();
    expect(screen.getByText('Corrija 1 campo para salvar.')).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('PV atual'));
    });
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('criar pela ficha em branco gera a mesma estrutura da criação guiada', () => {
    const emBranco = daForm(paraForm(fichaNova({ nivel: 1 })));
    const guiada = fichaDoRascunho({ ...RASCUNHO_VAZIO, perfil: 'executor', nome: 'X' }, 1);

    expect(Object.keys(emBranco).sort()).toEqual(Object.keys(guiada).sort());
    expect(Object.keys(emBranco.pericias).sort()).toEqual(Object.keys(guiada.pericias).sort());
    expect(esquemaFichaOp2.safeParse({ ...emBranco, nome: 'X' }).success).toBe(true);
  });
});

/** Abre a ficha do Davi e entra no modo de edição. */
async function editarDavi() {
  fireEvent.click(await screen.findByRole('button', { name: 'Editar ficha' }));
  return screen.findByText('Editando a ficha de Davi');
}

describe('Edição de uma ficha salva', () => {
  it('Salvar envia, volta para a ficha com o valor novo e avisa', async () => {
    const davi = personagem();
    const chamadas = servidor({
      'GET /api/personagens/chr_davi': json(200, { personagem: davi }),
      'GET /api/campanhas/cmp_1': json(200, { campanha: detalhe() }),
      'PUT /api/personagens/chr_davi': (c: Chamada) =>
        json(200, {
          personagem: {
            ...davi,
            ficha: (c.corpo as { ficha: FichaOp2 }).ficha,
            atualizadoEm: '2026-11-24T12:00:00.000Z',
          },
        }),
    });
    abrir('/personagens/chr_davi/ficha');

    expect(await editarDavi()).toBeDefined();
    fireEvent.change(screen.getByLabelText('PV atual'), { target: { value: '7' } });
    expect(screen.getByText(/^1 mudança/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));

    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toMatchObject({ ficha: { pv: 7 } });
    });
    expect(await screen.findByText('Ficha salva')).toBeDefined();
    expect(screen.queryByText('Editando a ficha de Davi')).toBeNull();
    expect(screen.getByRole('group', { name: 'PV: 7 de 12' })).toBeDefined();
  });

  it('Cancelar volta exatamente ao estado salvo, sem enviar nada', async () => {
    const chamadas = servidor({
      'GET /api/personagens/chr_davi': json(200, { personagem: personagem() }),
    });
    abrir('/personagens/chr_davi/ficha');
    await editarDavi();

    fireEvent.change(screen.getByLabelText('PV atual'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Mente'), { target: { value: 'd10' } });
    expect(screen.getByText(/^2 mudanças/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('group', { name: 'PV: 12 de 12' })).toBeDefined();
    await editarDavi();
    expect(screen.getByLabelText<HTMLInputElement>('PV atual').value).toBe('12');
    expect(screen.getByLabelText<HTMLSelectElement>('Mente').value).toBe('d6');
    expect(screen.getByText(/^0 mudanças/)).toBeDefined();
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
  });

  it('erro bloqueia salvar, aparece no campo e leva o foco; testes ficam pausados', async () => {
    const chamadas = servidor({
      'GET /api/personagens/chr_davi': json(200, { personagem: personagem() }),
    });
    abrir('/personagens/chr_davi/ficha');
    await editarDavi();
    expect(screen.getByText(/Os testes ficam pausados/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Testar / })).toBeNull();

    fireEvent.change(screen.getByLabelText('PV atual'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));

    expect(await screen.findByText('O PV não pode passar do máximo.')).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('PV atual'));
    });
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
  });

  it('erro do servidor aparece no campo, com o foco nele', async () => {
    servidor({
      'GET /api/personagens/chr_davi': json(200, { personagem: personagem() }),
      'PUT /api/personagens/chr_davi': json(422, {
        erro: {
          codigo: 'FICHA_INVALIDA',
          mensagem: 'A ficha tem campos inválidos.',
          campos: { 'ficha.origem': 'Origem recusada pelo servidor.' },
        },
      }),
    });
    abrir('/personagens/chr_davi/ficha');
    await editarDavi();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));

    expect(await screen.findByText('Origem recusada pelo servidor.')).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Origem'));
    });
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'Outra' } });
    expect(screen.queryByText('Origem recusada pelo servidor.')).toBeNull();
  });
});

describe('funções da edição', () => {
  it('conta as mudanças campo a campo', () => {
    const salvo = paraForm(fichaDoDavi());
    const atual = {
      ...salvo,
      pv: '3',
      atributos: { ...salvo.atributos, mente: 'd8' as const },
      pericias: { ...salvo.pericias, luta: 'd10' as const, vigor: 'd8' as const },
    };
    expect(contarMudancas(salvo, salvo)).toBe(0);
    expect(contarMudancas(atual, salvo)).toBe(4);
  });

  it('número vazio é erro; idade vazia é "sem idade"', () => {
    const f = { ...paraForm(fichaDoDavi()), pvMax: '', idade: '' };
    expect(errosDaFicha(f)).toHaveProperty('pvMax');
    expect(daForm(f).idade).toBeNull();
  });
});
