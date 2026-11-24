// Apoio para os testes de página: servidor falso por rota e o app montado num MemoryRouter.
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import {
  fichaDoDavi,
  type CampanhaDetalhe,
  type CampanhaNaLista,
  type FichaOp2,
  type PersonagemNaLista,
} from '@membrana/shared';
import { Rotas } from '../app/rotas.tsx';
import { SessaoProvider } from '../auth/sessao.tsx';
import { ToastProvider } from '../ui/index.ts';

export const MARTA = { id: 'usr_1', nome: 'Marta', email: 'marta@exemplo.com' };

export interface Chamada {
  metodo: string;
  url: string;
  corpo: unknown;
}

type Resposta = { status: number; corpo?: unknown } | Promise<never>;
/**
 * Responde a "GET /api/campanhas" e afins; o que não estiver aqui cai no 404.
 * Falha de rede vai sempre como função (`() => semRede()`), para não nascer rejeitada.
 */
export type Respostas = Record<string, Resposta | ((c: Chamada) => Resposta)>;

export const json = (status: number, corpo?: unknown): Resposta => ({ status, corpo });
/** Falha de rede: o fetch rejeita, como sem conexão. */
export const semRede = (): Resposta => Promise.reject(new TypeError('Failed to fetch'));

/** Instala um fetch falso. Já responde /api/me com a Marta logada. Devolve as chamadas feitas. */
export function servidor(rotas: Respostas = {}) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    // JSON vira objeto; formulário (envio de imagem) vira os campos, com o arquivo pelo nome e tipo.
    const corpo: unknown =
      typeof init?.body === 'string'
        ? JSON.parse(init.body)
        : init?.body instanceof FormData
          ? Object.fromEntries(
              [...init.body.entries()].map(([k, v]) => [
                k,
                typeof v === 'string' ? v : { nome: v.name, tipo: v.type },
              ]),
            )
          : undefined;
    const chamada = { metodo, url, corpo };
    chamadas.push(chamada);
    const todas: Respostas = { 'GET /api/me': json(200, { usuario: MARTA }), ...rotas };
    const achada = todas[`${metodo} ${url}`];
    const r = typeof achada === 'function' ? achada(chamada) : achada;
    const final = await (r ??
      json(404, { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Não achei.' } }));
    return new Response(final.status === 204 ? null : JSON.stringify(final.corpo ?? {}), {
      status: final.status,
    });
  });
  return chamadas;
}

/** Mostra a URL atual, para conferir navegações. */
function Endereco() {
  const local = useLocation();
  return <output data-testid="endereco">{`${local.pathname}${local.search}`}</output>;
}

export function abrir(caminho: string) {
  return render(
    <ToastProvider>
      <SessaoProvider>
        <MemoryRouter initialEntries={[caminho]}>
          <Rotas />
          <Endereco />
        </MemoryRouter>
      </SessaoProvider>
    </ToastProvider>,
  );
}

export const endereco = () => screen.getByTestId('endereco').textContent;

/** Um caso na lista, com valores comuns que cada teste ajusta. */
export function caso(campos: Partial<CampanhaNaLista> = {}): CampanhaNaLista {
  return {
    id: 'cmp_1',
    numero: 17,
    nome: 'O Sinal de Santa Ermida',
    gancho: 'A rádio voltou a transmitir às 3h33.',
    papel: 'jogador',
    sistema: { id: 'sys_op2', nome: 'Ordem Paranormal II', tipo: 'op2' },
    mestre: { id: 'usr_9', nome: 'Helena Duarte' },
    situacao: 'em-curso',
    agenda: null,
    proximaSessao: null,
    contagens: { jogadores: 3 },
    mesaAbertaDesde: null,
    ...campos,
  };
}

export function detalhe(campos: Partial<CampanhaDetalhe> = {}): CampanhaDetalhe {
  return {
    ...caso(),
    tom: 'horror-investigativo',
    formato: 'campanha-curta',
    nivelInicial: 1,
    dtPadrao: 7,
    rodadas: true,
    dadosFisicos: true,
    fichasVisiveis: false,
    membros: [
      { id: 'usr_9', nome: 'Helena Duarte', papel: 'mestre' },
      { id: 'usr_1', nome: 'Marta', papel: 'jogador' },
    ],
    meuPersonagem: null,
    ...campos,
  };
}

/** Um personagem na lista de Personagens: o Davi, em uso no Sinal de Santa Ermida. */
export function personagem(
  campos: Partial<PersonagemNaLista> = {},
  ficha: Partial<FichaOp2> = {},
): PersonagemNaLista {
  return {
    id: 'chr_davi',
    donoId: MARTA.id,
    campanhaId: 'cmp_1',
    sistemaId: 'sys_op2',
    ficha: { ...fichaDoDavi(), ...ficha },
    foto: null,
    tokenImg: null,
    criadoEm: '2026-11-20T12:00:00.000Z',
    atualizadoEm: '2026-11-22T12:00:00.000Z',
    sistema: { id: 'sys_op2', nome: 'Ordem Paranormal II', tipo: 'op2' },
    campanha: { id: 'cmp_1', nome: 'O Sinal de Santa Ermida', encerrado: false },
    emUso: true,
    ...campos,
  };
}
