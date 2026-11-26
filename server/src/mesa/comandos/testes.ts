// Testes da ficha pela mesa (`test.resolve` e `test.report` → `test.resolved` + `character.changed`,
// #70). Usa exatamente as mesmas funções de regra e gravação da rota HTTP da ficha: o mesmo teste
// com o mesmo sorteio produz o mesmo resultado, gasta Ímpeto/habilidades, aplica falha crítica e
// avisa toda a sala que a ficha mudou.
import {
  ErroDeRegra,
  migrarFicha,
  podeEditarFicha,
  podeInformarTeste,
  registrarTesteInformado,
  testarPericia,
  type TesteDaFicha,
} from '@membrana/shared';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';

function carregarAlvo(ctx: Contexto, personagemId: string) {
  const alvo = ctx.fichaNoCaso(personagemId);
  if (!alvo) throw new Recusa('Esse personagem não está neste caso.');
  if (alvo.tipo !== 'op2') {
    throw new Recusa('Este sistema ainda não tem testes pela ficha.');
  }
  return {
    ...alvo,
    ficha: migrarFicha(alvo.ficha),
    minimo: { donoId: alvo.donoId, campanhaId: ctx.campanha.id },
  };
}

function rodarRegra(regra: () => TesteDaFicha): TesteDaFicha {
  try {
    return regra();
  } catch (erro) {
    if (erro instanceof ErroDeRegra) throw new Recusa(erro.message);
    throw erro;
  }
}

export const tratadoresDeTestes: Tratadores = {
  'test.resolve'(ctx, comando) {
    const { personagemId, periciaId, dt: dtPedida, ajuda, impeto, habilidades } = comando;
    const pedido = {
      periciaId,
      ...(dtPedida !== undefined && { dt: dtPedida }),
      ...(ajuda !== undefined && { ajuda }),
      ...(impeto !== undefined && { impeto }),
      ...(habilidades !== undefined && { habilidades }),
    };
    const alvo = carregarAlvo(ctx, personagemId);
    if (!podeEditarFicha(ctx.quem, alvo.minimo, ctx.campanha)) {
      throw new Recusa('Só quem joga com este personagem ou o mestre do caso pode testar por ele.');
    }
    if (alvo.ficha.modoDados === 'fisico') {
      throw new Recusa(
        'Esta ficha está no modo de dados físicos: role na mão e informe o resultado.',
      );
    }
    const dt = pedido.dt ?? alvo.dtPadrao;
    const teste = rodarRegra(() => testarPericia(alvo.ficha, { ...pedido, dt }, ctx.sorteio));
    const registro = ctx.gravarTeste({
      personagemId,
      autorId: ctx.quem.id,
      origem: 'virtual',
      periciaId: pedido.periciaId,
      teste,
    });
    return [
      { type: 'test.resolved', registro },
      { type: 'character.changed', campanhaId: ctx.campanha.id, personagemId, removido: false },
    ];
  },

  'test.report'(ctx, comando) {
    const {
      personagemId,
      periciaId,
      dt: dtPedida,
      ajuda,
      impeto,
      habilidades,
      resultado,
      falhaCritica,
    } = comando;
    const pedido = {
      periciaId,
      ...(dtPedida !== undefined && { dt: dtPedida }),
      ...(ajuda !== undefined && { ajuda }),
      ...(impeto !== undefined && { impeto }),
      ...(habilidades !== undefined && { habilidades }),
    };
    const alvo = carregarAlvo(ctx, personagemId);
    if (!podeInformarTeste(ctx.quem, alvo.minimo, ctx.campanha)) {
      throw new Recusa('Só quem joga com este personagem pode informar dados físicos.');
    }
    if (alvo.ficha.modoDados !== 'fisico') {
      throw new Recusa('Esta ficha está no modo de dados virtuais: quem rola é o app.');
    }
    if (!alvo.dadosFisicos) {
      throw new Recusa(
        'O mestre deste caso não permite dados físicos. Troque a ficha para dados virtuais.',
      );
    }
    const dt = pedido.dt ?? alvo.dtPadrao;
    const teste = rodarRegra(() =>
      registrarTesteInformado(
        alvo.ficha,
        { ...pedido, dt },
        { resultado, ...(falhaCritica && { falhaCritica }) },
      ),
    );
    const registro = ctx.gravarTeste({
      personagemId,
      autorId: ctx.quem.id,
      origem: 'fisico',
      periciaId: pedido.periciaId,
      teste,
    });
    return [
      { type: 'test.resolved', registro },
      { type: 'character.changed', campanhaId: ctx.campanha.id, personagemId, removido: false },
    ];
  },
};
