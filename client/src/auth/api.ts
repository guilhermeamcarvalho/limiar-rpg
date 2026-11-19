// Chamadas à API do próprio app. Mesmo endereço, então o cookie de sessão vai junto sozinho.

export class ErroDaApi extends Error {
  override name = 'ErroDaApi';
  readonly status: number;
  readonly codigo: string;
  /** Mensagem por campo do formulário, quando o servidor diz qual campo está errado. */
  readonly campos: Record<string, string> | undefined;

  constructor(status: number, codigo: string, mensagem: string, campos?: Record<string, string>) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

interface CorpoDeErro {
  erro?: { codigo?: string; mensagem?: string; campos?: Record<string, string> };
}

/** GET ou POST na API. Erro vira `ErroDaApi` com o código e a mensagem que o servidor mandou. */
export async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  const resposta = await fetch(caminho, { credentials: 'same-origin', ...init, headers });
  if (resposta.status === 204) return undefined as T;

  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const { erro } = (corpo ?? {}) as CorpoDeErro;
    throw new ErroDaApi(
      resposta.status,
      erro?.codigo ?? 'ERRO',
      erro?.mensagem ?? 'Não deu para falar com o servidor. Tente de novo.',
      erro?.campos,
    );
  }
  return corpo as T;
}
