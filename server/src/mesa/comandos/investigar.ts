// Investigar, Examinar, Interagir e Desafios de acesso nos pontos de interesse (#84, #85, #86).
import {
  aplicarTentativaDeDesafio,
  criarEstadoDoDesafio,
  ErroDeRegra,
  liberarDesafio,
  migrarFicha,
  PERICIAS_OP2,
  podeConduzirMesa,
  testarPericia,
  TIPOS_DE_DESAFIO,
  type EventoDaMesaSemSeq,
  type PericiaOp2,
  type PoiNaMesa,
  type TipoDeDesafio,
} from '@membrana/shared';
import { novoId } from '../../db/ids.ts';
import { Recusa, type Contexto, type Tratadores } from './contexto.ts';
import { consumirAcaoDaRodada } from './rodada.ts';

function resolverPericia(pedida: string | undefined, poi: PoiNaMesa): PericiaOp2 {
  const candidata = pedida ?? poi.pericias[0]?.periciaId ?? 'percepcao';
  const valida = PERICIAS_OP2.find((p) => p.id === candidata);
  return valida ? valida.id : 'percepcao';
}

function resolverPersonagemId(ctx: Contexto, pedido: string | undefined): string {
  if (pedido) {
    const dono = ctx.personagem(pedido);
    if (!dono) throw new Recusa('Esse personagem não está neste caso.');
    if (!podeConduzirMesa(ctx.quem, ctx.campanha) && dono.donoId !== ctx.quem.id) {
      throw new Recusa('Só quem joga com este personagem pode agir por ele.');
    }
    return pedido;
  }
  const meu = ctx.grupo().find((p) => p.donoId === ctx.quem.id);
  if (!meu) throw new Recusa('Escolha um personagem neste caso para investigar.');
  return meu.personagemId;
}

function tipoDeDesafio(bruto: string | undefined): TipoDeDesafio {
  return (TIPOS_DE_DESAFIO as readonly string[]).includes(bruto ?? '')
    ? (bruto as TipoDeDesafio)
    : 'destrancar';
}

function menorDtPendente(poi: PoiNaMesa): number {
  const pendentes = poi.informacoes.filter((i) => !i.descoberta).map((i) => i.nivel);
  if (pendentes.length > 0) return Math.min(...pendentes);
  return poi.pericias[0]?.dt ?? 7;
}

function revelarPorTotal(poi: PoiNaMesa, total: number) {
  const novas: { id: string; nivel: number; texto: string }[] = [];
  for (const info of poi.informacoes) {
    if (!info.descoberta && info.nivel <= total) {
      info.descoberta = true;
      novas.push({ id: info.id, nivel: info.nivel, texto: info.texto });
    }
  }
  return novas;
}

export const tratadoresDeInvestigacao: Tratadores = {
  'poi.investigate'(ctx, comando) {
    const { poiId, modo, personagemId: pidPedido, periciaId: periciaPedida, texto } = comando;
    const poi = ctx.estado.pois.find((p) => p.id === poiId);

    // Compatibilidade com testes antigos que enviam apenas `{ type: 'poi.investigate', poiId }` sem POIs carregados.
    if (!poi) {
      if (modo) throw new Recusa('Esse ponto de interesse não existe neste mapa.');
      return consumirAcaoDaRodada(ctx);
    }

    if (modo === 'liberar') {
      if (!podeConduzirMesa(ctx.quem, ctx.campanha)) {
        throw new Recusa('Só o mestre pode liberar um ponto travado.');
      }
      if (poi.estadoDesafio) {
        poi.estadoDesafio = liberarDesafio(poi.estadoDesafio);
      }
      return [{ type: 'poi.changed', poiId: poi.id, poi }];
    }

    if (poi.estadoDesafio?.travado) {
      throw new Recusa('Este ponto está travado. Aguarde o mestre liberar.');
    }

    const eventosRodada = consumirAcaoDaRodada(ctx);

    if (modo === 'interagir') {
      const acao = texto?.trim();
      if (!acao) throw new Recusa('Descreva o que você quer fazer neste ponto.');
      return [
        ...eventosRodada,
        {
          type: 'chat.message',
          id: novoId('msg'),
          autorId: ctx.quem.id,
          texto: `[${poi.nome}] ${acao}`,
          para: null,
          narracao: false,
          em: new Date().toISOString(),
        },
      ];
    }

    const personagemId = resolverPersonagemId(ctx, pidPedido);
    const alvo = ctx.fichaNoCaso(personagemId);
    if (!alvo || alvo.tipo !== 'op2') {
      throw new Recusa('Este sistema ainda não tem testes de investigação.');
    }
    const ficha = migrarFicha(alvo.ficha);
    const periciaId = resolverPericia(periciaPedida, poi);
    const saida: EventoDaMesaSemSeq[] = [...eventosRodada];

    if (modo === 'desafio') {
      const desafioAtual =
        poi.estadoDesafio ?? criarEstadoDoDesafio(tipoDeDesafio(poi.desafio?.tipo));
      const dt = poi.desafio?.dt ?? alvo.dtPadrao;
      const teste = testarPericia(ficha, { periciaId, dt }, ctx.sorteio);
      const registro = ctx.gravarTeste({
        personagemId,
        autorId: ctx.quem.id,
        origem: 'virtual',
        periciaId,
        teste,
      });
      saida.push({ type: 'test.resolved', registro });

      if (desafioAtual.tipo === 'arrombar') {
        ctx.ajustarRecurso?.(personagemId, 'pv', -1);
      }
      try {
        const passou =
          teste.resultado.veredito === 'sucesso' || teste.resultado.veredito === 'critico';
        poi.estadoDesafio = aplicarTentativaDeDesafio(desafioAtual, {
          sucesso: passou,
          valorObtido: teste.resultado.total,
        });
      } catch (erro) {
        if (erro instanceof ErroDeRegra) throw new Recusa(erro.message);
        throw erro;
      }
      saida.push(
        { type: 'character.changed', campanhaId: ctx.campanha.id, personagemId, removido: false },
        { type: 'poi.changed', poiId: poi.id, poi },
      );
      return saida;
    }

    // `investigar` (padrão) ou `examinar` (custa 1 PD se não achar nada novo).
    const dt = menorDtPendente(poi);
    const teste = testarPericia(ficha, { periciaId, dt }, ctx.sorteio);
    const registro = ctx.gravarTeste({
      personagemId,
      autorId: ctx.quem.id,
      origem: 'virtual',
      periciaId,
      teste,
    });
    saida.push({ type: 'test.resolved', registro });

    const novas = revelarPorTotal(poi, teste.resultado.total);
    if (novas.length > 0) {
      saida.push(
        { type: 'poi.changed', poiId: poi.id, poi },
        {
          type: 'poi.infoRevealed',
          poiId: poi.id,
          personagemIds: [personagemId],
          infoIds: novas.map((n) => n.id),
          autorId: ctx.quem.id,
          texto: `${poi.nome}: ${novas.map((n) => n.texto).join(' · ')}`,
        },
      );
    } else if (modo === 'examinar') {
      ctx.ajustarRecurso?.(personagemId, 'pd', -1);
    }

    saida.push({
      type: 'character.changed',
      campanhaId: ctx.campanha.id,
      personagemId,
      removido: false,
    });
    return saida;
  },
};
