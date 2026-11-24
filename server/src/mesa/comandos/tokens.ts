// Tokens: mover e arrastar (dono ou mestre), criar, mudar e remover (mestre; o jogador só troca
// imagem e tamanho do próprio). O jogador não entra na névoa; o mestre põe o token onde quiser.
import {
  ehMestre,
  podeAlterarToken,
  podeConduzirMesa,
  podeMoverToken,
  sobNevoa,
  NOME_DE_ARQUIVO,
  type EventoDaMesaSemSeq,
  type Ponto,
  type TokenNaMesa,
} from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { exigirMapa, Recusa, type Contexto, type Tratadores } from './contexto.ts';

function acharToken(ctx: Contexto, tokenId: string): TokenNaMesa {
  const token = ctx.estado.tokens.find((t) => t.id === tokenId);
  if (!token) throw new Recusa('Esse token não está mais no mapa.');
  return token;
}

function conferirDestino(ctx: Contexto, x: number, y: number) {
  const { mapa, nevoa } = ctx.estado;
  if (mapa && (x > mapa.largura || y > mapa.altura)) throw new Recusa('Fora do mapa.');
  if (!ehMestre(ctx.quem, ctx.campanha) && sobNevoa(nevoa, { x, y })) {
    throw new Recusa('Não dá para entrar na névoa.');
  }
}

function conferirMovimento(ctx: Contexto, token: TokenNaMesa, x: number, y: number) {
  if (!podeMoverToken(ctx.quem, token, ctx.campanha)) {
    throw new Recusa('Só o dono do token ou o mestre pode movê-lo.');
  }
  conferirDestino(ctx, x, y);
}

function exigirMestre(ctx: Contexto, mensagem: string) {
  if (!podeConduzirMesa(ctx.quem, ctx.campanha)) throw new Recusa(mensagem);
}

/**
 * As casas em volta de um ponto, de dentro para fora: o centro, o anel de 8 em volta, o de 16...
 * Cada uma a `passo` pixels da vizinha, sem sair do mapa.
 */
export function casasEmVolta(
  centro: Ponto,
  quantas: number,
  passo: number,
  limite: { largura: number; altura: number },
): Ponto[] {
  const casas: Ponto[] = [];
  for (let anel = 0; casas.length < quantas; anel++) {
    for (let dy = -anel; dy <= anel && casas.length < quantas; dy++) {
      for (let dx = -anel; dx <= anel && casas.length < quantas; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== anel) continue;
        casas.push({
          x: Math.min(limite.largura, Math.max(0, centro.x + dx * passo)),
          y: Math.min(limite.altura, Math.max(0, centro.y + dy * passo)),
        });
      }
    }
  }
  return casas;
}

export const tratadoresDeTokens: Tratadores = {
  'token.move'(ctx, { tokenId, x, y }) {
    const token = acharToken(ctx, tokenId);
    conferirMovimento(ctx, token, x, y);
    token.x = x;
    token.y = y;
    return [{ type: 'token.moved', tokenId, x, y }];
  },

  // A posição no meio do arrasto: confere igual, mas não grava.
  'token.drag'(ctx, { tokenId, x, y }) {
    conferirMovimento(ctx, acharToken(ctx, tokenId), x, y);
    return [{ type: 'token.dragging', tokenId, x, y }];
  },

  'token.create'(ctx, comando) {
    exigirMestre(ctx, 'Só o mestre cria tokens.');
    exigirMapa(ctx);
    conferirDestino(ctx, comando.x, comando.y);
    const personagemId = comando.personagemId ?? null;
    let donoId: string | null = null;
    if (personagemId !== null) {
      const personagem = ctx.personagem(personagemId);
      if (!personagem) throw new Recusa('Esse personagem não está neste caso.');
      if (ctx.estado.tokens.some((t) => t.personagemId === personagemId)) {
        throw new Recusa('Esse personagem já tem um token no mapa.');
      }
      donoId = personagem.donoId;
    }
    const token: TokenNaMesa = {
      id: novoId('tok'),
      nome: comando.nome,
      imagem: comando.imagem ?? null,
      x: comando.x,
      y: comando.y,
      tamanho: comando.tamanho ?? 1,
      oculto: comando.oculto ?? false,
      personagemId,
      donoId,
    };
    ctx.estado.tokens.push(token);
    return [{ type: 'token.changed', tokenId: token.id, token }];
  },

  'token.update'(ctx, { tokenId, nome, imagem, tamanho, oculto }) {
    const token = acharToken(ctx, tokenId);
    const campos = Object.entries({ nome, imagem, tamanho, oculto })
      .filter(([, valor]) => valor !== undefined)
      .map(([campo]) => campo);
    if (!podeAlterarToken(ctx.quem, token, campos, ctx.campanha)) {
      throw new Recusa(
        podeMoverToken(ctx.quem, token, ctx.campanha)
          ? 'No seu token, você troca só a imagem e o tamanho.'
          : 'Só o mestre pode mudar este token.',
      );
    }
    if (nome !== undefined) token.nome = nome;
    if (imagem !== undefined) token.imagem = imagem;
    if (tamanho !== undefined) token.tamanho = tamanho;
    if (oculto !== undefined) token.oculto = oculto;
    return [{ type: 'token.changed', tokenId, token }];
  },

  // "Trazer o grupo" (RF-19): cada personagem do grupo vai para uma casa em volta do ponto. Quem
  // ainda não tem token neste mapa (como num mapa novo) ganha um, com o token da ficha.
  'token.gather'(ctx, { x, y }) {
    exigirMestre(ctx, 'Só o mestre traz o grupo.');
    const mapa = exigirMapa(ctx);
    const grupo = ctx.grupo();
    if (grupo.length === 0) throw new Recusa('Ninguém do grupo escolheu um personagem ainda.');
    const casas = casasEmVolta({ x, y }, grupo.length, mapa.grade.celula, mapa);
    const eventos: EventoDaMesaSemSeq[] = [];
    grupo.forEach((personagem, i) => {
      const casa = casas[i] ?? { x, y };
      const token = ctx.estado.tokens.find((t) => t.personagemId === personagem.personagemId);
      if (token) {
        token.x = casa.x;
        token.y = casa.y;
        eventos.push({ type: 'token.moved', tokenId: token.id, x: casa.x, y: casa.y });
        return;
      }
      const novo: TokenNaMesa = {
        id: novoId('tok'),
        nome: personagem.nome.slice(0, 60) || 'Sem nome',
        imagem:
          personagem.imagem && NOME_DE_ARQUIVO.test(personagem.imagem) ? personagem.imagem : null,
        x: casa.x,
        y: casa.y,
        tamanho: 1,
        oculto: false,
        personagemId: personagem.personagemId,
        donoId: personagem.donoId,
      };
      ctx.estado.tokens.push(novo);
      eventos.push({ type: 'token.changed', tokenId: novo.id, token: novo });
    });
    return eventos;
  },

  'token.delete'(ctx, { tokenId }) {
    exigirMestre(ctx, 'Só o mestre remove tokens.');
    acharToken(ctx, tokenId);
    ctx.estado.tokens = ctx.estado.tokens.filter((t) => t.id !== tokenId);
    return [{ type: 'token.changed', tokenId, token: null }];
  },
};
