// Um formato só para todo erro da API: { erro: { codigo, mensagem, campos? } }, em português.
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';

/** Mensagem por campo do formulário, para a tela mostrar o erro no lugar certo. */
export type ErrosPorCampo = Record<string, string>;

export interface RespostaDeErro {
  erro: { codigo: string; mensagem: string; campos?: ErrosPorCampo };
}

/** Erro esperado, que a rota lança de propósito: vira resposta com este status e esta mensagem. */
export class ErroDaApi extends Error {
  override name = 'ErroDaApi';
  readonly status: number;
  readonly codigo: string;
  readonly campos: ErrosPorCampo | undefined;

  constructor(status: number, codigo: string, mensagem: string, campos?: ErrosPorCampo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

/** Valida o corpo com Zod; se falhar, 400 com a mensagem de cada campo. */
export function validar<T>(esquema: z.ZodType<T>, dados: unknown): T {
  const resultado = esquema.safeParse(dados);
  if (resultado.success) return resultado.data;
  const campos: ErrosPorCampo = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path.join('.') || '_';
    campos[campo] ??= problema.message;
  }
  throw new ErroDaApi(400, 'DADOS_INVALIDOS', 'Confira os campos destacados.', campos);
}

const PADRAO_POR_STATUS: Record<number, [string, string]> = {
  400: ['PEDIDO_INVALIDO', 'O pedido não pôde ser entendido.'],
  401: ['NAO_AUTENTICADO', 'Entre na sua conta para continuar.'],
  403: ['SEM_PERMISSAO', 'Você não tem permissão para isso.'],
  404: ['NAO_ENCONTRADO', 'Não encontramos o que você procurou.'],
  413: ['GRANDE_DEMAIS', 'O arquivo ou os dados enviados são grandes demais.'],
  415: ['TIPO_NAO_ACEITO', 'Esse tipo de conteúdo não é aceito.'],
  429: ['MUITAS_TENTATIVAS', 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
};

const ERRO_INTERNO: RespostaDeErro = {
  erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
};

function resposta(codigo: string, mensagem: string, campos?: ErrosPorCampo): RespostaDeErro {
  return { erro: { codigo, mensagem, ...(campos && { campos }) } };
}

export function registrarTratadorDeErros(app: FastifyInstance) {
  app.setErrorHandler((erro: FastifyError | ErroDaApi, request, reply) => {
    if (erro instanceof ErroDaApi) {
      return reply.status(erro.status).send(resposta(erro.codigo, erro.message, erro.campos));
    }

    if (erro.validation) {
      return reply
        .status(400)
        .send(resposta('DADOS_INVALIDOS', 'Alguns dados enviados não são válidos.'));
    }

    const status = erro.statusCode ?? 500;
    const padrao = PADRAO_POR_STATUS[status];
    if (status < 500 && padrao) return reply.status(status).send(resposta(...padrao));

    // Inesperado: o detalhe vai para o log, nunca para quem chamou.
    request.log.error({ err: erro }, 'erro inesperado');
    return reply.status(500).send(ERRO_INTERNO);
  });
}

export const NAO_ENCONTRADO = resposta('NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
