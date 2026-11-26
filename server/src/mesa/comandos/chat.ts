// Chat da mesa (`chat.send` → `chat.message`, #71): mensagem comum para o grupo, narração na
// caixa própria (só o mestre) e sussurro (só o destinatário, quem mandou e o mestre recebem).
import { podeConduzirMesa } from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { Recusa, type Tratadores } from './contexto.ts';

export const tratadoresDoChat: Tratadores = {
  'chat.send'(ctx, { texto, para, narracao }) {
    const ehNarracao = narracao === true;
    if (ehNarracao && !podeConduzirMesa(ctx.quem, ctx.campanha)) {
      throw new Recusa('Só o mestre pode narrar.');
    }
    if (ehNarracao && para !== undefined) {
      throw new Recusa('A narração é para toda a mesa, não um sussurro.');
    }
    if (para !== undefined) {
      if (para === ctx.quem.id) throw new Recusa('Escolha outra pessoa para sussurrar.');
      const participa = ctx.campanha.membros.some((m) => m.userId === para);
      if (!participa) throw new Recusa('Essa pessoa não está neste caso.');
    }
    return [
      {
        type: 'chat.message',
        id: novoId('msg'),
        autorId: ctx.quem.id,
        texto,
        para: para ?? null,
        narracao: ehNarracao,
        em: new Date().toISOString(),
      },
    ];
  },
};
