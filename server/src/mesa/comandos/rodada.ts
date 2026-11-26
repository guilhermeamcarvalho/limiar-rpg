// Rodadas (#73): o mestre encerra a rodada (`round.end`) para todos voltarem a poder agir.
// Com `campaigns.rodadas` ligado, cada jogador tem uma ação importante (ex.: Investigar) por
// rodada; a segunda é recusada com explicação. Com a opção desligada, não há limite.
import { podeConduzirMesa, type EventoDaMesaSemSeq } from '@membrana/shared';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';

/**
 * Confere e consome a ação da rodada do jogador quando `campaigns.rodadas` está ativo.
 * O mestre nunca é bloqueado. Devolve o evento `round.acted` se a ação foi marcada.
 */
export function consumirAcaoDaRodada(ctx: Contexto): EventoDaMesaSemSeq[] {
  if (podeConduzirMesa(ctx.quem, ctx.campanha)) return [];
  if (ctx.campanha.rodadas === false) return [];
  if (ctx.estado.rodada.agiram.includes(ctx.quem.id)) {
    throw new Recusa('Você já usou sua ação nesta rodada. Aguarde o mestre encerrar a rodada.');
  }
  ctx.estado.rodada.agiram.push(ctx.quem.id);
  return [{ type: 'round.acted', userId: ctx.quem.id }];
}

export const tratadoresDaRodada: Tratadores = {
  'round.end'(ctx) {
    if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa('Só o mestre passa a rodada.');
    ctx.estado.rodada.numero += 1;
    ctx.estado.rodada.agiram = [];
    return [{ type: 'round.started', numero: ctx.estado.rodada.numero }];
  },

  // Investigar ponto de interesse (o detalhe dos POIs chega na Fase 3; já aplica a regra da rodada).
  'poi.investigate'(ctx) {
    return consumirAcaoDaRodada(ctx);
  },
};
