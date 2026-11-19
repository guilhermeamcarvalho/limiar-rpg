// Um formato só para todo erro da API: { erro: { codigo, mensagem } }, com mensagem em português.
import type { FastifyError, FastifyInstance } from 'fastify';

export interface RespostaDeErro {
  erro: { codigo: string; mensagem: string };
}

/** Erro esperado, que a rota lança de propósito: vira resposta com este status e esta mensagem. */
export class ErroDaApi extends Error {
  override name = 'ErroDaApi';
  readonly status: number;
  readonly codigo: string;

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
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

function resposta(codigo: string, mensagem: string): RespostaDeErro {
  return { erro: { codigo, mensagem } };
}

export function registrarTratadorDeErros(app: FastifyInstance) {
  app.setErrorHandler((erro: FastifyError | ErroDaApi, request, reply) => {
    if (erro instanceof ErroDaApi) {
      return reply.status(erro.status).send(resposta(erro.codigo, erro.message));
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
