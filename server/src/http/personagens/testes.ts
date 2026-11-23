// Testes de perícia pela ficha. Registradas dentro das rotas de personagens (prefixo /api, login
// exigido).
//   POST /api/personagens/:id/testes   o servidor rola (crypto), aplica as consequências na ficha e
//                                      grava no histórico; o resultado que vale é este
//   GET  /api/personagens/:id/testes   o histórico, do mais novo para o mais antigo
// O histórico fica em `test_log` até a Fase 2, quando os testes passam a ir para `session_log`.
import { desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  atributoDaPericia,
  DT_PADRAO,
  ErroDeRegra,
  esquemaPedidoDeTeste,
  migrarFicha,
  testarPericia,
  type RegistroDeTeste,
  type TesteDaFicha,
} from '@membrana/shared';
import { campaigns, characters, testLog, users } from '../../db/schema.ts';
import { usuarioLogado } from '../auth/sessao.ts';
import { ErroDaApi, validar } from '../erros.ts';
import {
  acessoAo,
  avisarMesa,
  campanhasDo,
  carregar,
  paraApi,
  PERSONAGEM_NAO_ENCONTRADO,
  validarFicha,
  type LinhaDePersonagem,
} from './dados.ts';

/** Quantos testes o histórico devolve. */
export const LIMITE_DO_HISTORICO = 50;

/** O que fica na coluna `registro`: o RegistroDeTeste sem os ids, o autor e a data. */
type Registro = Pick<
  RegistroDeTeste,
  'periciaId' | 'atributo' | 'resultado' | 'falhaCritica' | 'efeitos'
>;

/** A DT padrão do caso do personagem; sem caso, a do sistema. */
function dtPadraoDo(app: FastifyInstance, { personagem }: LinhaDePersonagem): number {
  if (!personagem.campaignId) return DT_PADRAO;
  const caso = app.db
    .select({ dtPadrao: campaigns.dtPadrao })
    .from(campaigns)
    .where(eq(campaigns.id, personagem.campaignId))
    .get();
  return caso?.dtPadrao ?? DT_PADRAO;
}

export function rotasDeTestes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/personagens/:id/testes', (request, reply) => {
    const usuario = usuarioLogado(request);
    const linha = carregar(app.db, request.params.id);
    const acesso = acessoAo(app.db, usuario, linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.podeEditar) {
      throw new ErroDaApi(
        403,
        'SO_O_DONO_OU_MESTRE',
        'Só quem joga com este personagem ou o mestre do caso pode testar por ele.',
      );
    }
    const pedido = validar(esquemaPedidoDeTeste, request.body);
    if (linha.tipo !== 'op2') {
      throw new ErroDaApi(
        422,
        'SISTEMA_SEM_FICHA',
        'Este sistema ainda não tem testes pela ficha.',
      );
    }
    const ficha = migrarFicha(linha.personagem.ficha);
    if (ficha.modoDados === 'fisico') {
      throw new ErroDaApi(
        409,
        'MODO_FISICO',
        'Esta ficha está no modo de dados físicos: role na mão e informe o resultado.',
      );
    }

    let teste: TesteDaFicha;
    try {
      teste = testarPericia(
        ficha,
        { ...pedido, dt: pedido.dt ?? dtPadraoDo(app, linha) },
        app.sorteio,
      );
    } catch (e) {
      if (e instanceof ErroDeRegra) {
        throw new ErroDaApi(422, 'TESTE_RECUSADO', e.message, { [e.campo]: e.message });
      }
      throw e;
    }
    // A ficha nova passa pelo schema antes de ir para o banco, como numa edição.
    const fichaNova = validarFicha(linha.tipo, teste.ficha);

    const registro: Registro = {
      periciaId: pedido.periciaId,
      atributo: atributoDaPericia(pedido.periciaId),
      resultado: teste.resultado,
      falhaCritica: teste.falhaCritica,
      efeitos: teste.efeitos,
    };
    // A ficha e o histórico mudam juntos: não fica teste gravado sem o Ímpeto que ele gastou.
    const gravado = app.db.transaction((tx) => {
      tx.update(characters)
        .set({ ficha: fichaNova, atualizadoEm: new Date() })
        .where(eq(characters.id, linha.personagem.id))
        .run();
      return tx
        .insert(testLog)
        .values({
          characterId: linha.personagem.id,
          campaignId: linha.personagem.campaignId,
          userId: usuario.id,
          origem: 'virtual',
          registro,
        })
        .returning({ id: testLog.id, criadoEm: testLog.criadoEm })
        .get();
    });
    avisarMesa(app, campanhasDo(app.db, linha.personagem), linha.personagem.id);

    const resposta: RegistroDeTeste = {
      id: gravado.id,
      personagemId: linha.personagem.id,
      campanhaId: linha.personagem.campaignId,
      autor: { id: usuario.id, nome: usuario.nome },
      origem: 'virtual',
      ...registro,
      em: gravado.criadoEm.toISOString(),
    };
    return reply
      .status(201)
      .send({ teste: resposta, personagem: paraApi(carregar(app.db, linha.personagem.id)) });
  });

  app.get<{ Params: { id: string } }>('/personagens/:id/testes', (request) => {
    const linha = carregar(app.db, request.params.id);
    const acesso = acessoAo(app.db, usuarioLogado(request), linha);
    if (!acesso.conhece) throw PERSONAGEM_NAO_ENCONTRADO;
    if (!acesso.podeVer) {
      throw new ErroDaApi(
        403,
        'FICHA_OCULTA',
        'Neste caso, o mestre não deixou os jogadores verem as fichas uns dos outros.',
      );
    }
    const testes: RegistroDeTeste[] = app.db
      .select({
        id: testLog.id,
        campanhaId: testLog.campaignId,
        origem: testLog.origem,
        registro: testLog.registro,
        criadoEm: testLog.criadoEm,
        autorId: users.id,
        autorNome: users.nome,
      })
      .from(testLog)
      .leftJoin(users, eq(users.id, testLog.userId))
      .where(eq(testLog.characterId, linha.personagem.id))
      // Dois testes no mesmo milissegundo: vale a ordem de gravação.
      .orderBy(desc(testLog.criadoEm), sql`${testLog}.rowid desc`)
      .limit(LIMITE_DO_HISTORICO)
      .all()
      .map((t) => ({
        id: t.id,
        personagemId: linha.personagem.id,
        campanhaId: t.campanhaId,
        autor: t.autorId && t.autorNome !== null ? { id: t.autorId, nome: t.autorNome } : null,
        origem: t.origem,
        ...(t.registro as Registro),
        em: t.criadoEm.toISOString(),
      }));
    return { testes };
  });
}
