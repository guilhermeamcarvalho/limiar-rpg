// Rolagem de dados avulsos na mesa (`dice.roll` → `dice.rolled`, #69). Qualquer pessoa do caso
// pode rolar; quando `secreta` está ligada, a projeção entrega só ao mestre e a quem rolou.
import { ErroDeRegra, rolarExpressao } from '@membrana/shared';
import { Recusa, type Tratadores } from './contexto.ts';

export const tratadoresDeDados: Tratadores = {
  'dice.roll'(ctx, { expressao, secreta }) {
    let rolagem;
    try {
      rolagem = rolarExpressao(expressao, ctx.sorteio);
    } catch (erro) {
      if (erro instanceof ErroDeRegra) throw new Recusa(erro.message);
      throw erro;
    }
    return [
      {
        type: 'dice.rolled',
        autorId: ctx.quem.id,
        expressao: rolagem.expressao,
        dados: rolagem.dados,
        total: rolagem.total,
        secreta: secreta ?? false,
      },
    ];
  },
};
