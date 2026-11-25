// O que cada pessoa recebe da mesa (aba Arquitetura técnica, "O que cada um recebe"). Segredo só
// escondido na tela não é segredo: o jogador nunca recebe o que não pode ver (nem token nem prop
// sob o breu), nem no estado inicial, nem na reconexão, nem em evento nenhum. O mestre recebe tudo.
// Campo secreto novo? Trate aqui e acrescente o segredo em projecao.test.ts.
import {
  sobBreu,
  type EstadoDaMesa,
  type EventoDaMesa,
  type ItemDoInventario,
  type Papel,
  type PistaNaMesa,
  type PistaParaJogador,
  type PropNaMesa,
  type TokenNaMesa,
  type VisaoDaMesa,
} from '@membrana/shared';

/** Quem vai receber: o papel e o personagem vêm da conexão. */
export interface Espectador {
  id: string;
  papel: Papel;
  personagemId: string | null;
}

/** O jogador vê o próprio token sempre; os outros, se não estiverem ocultos nem sob o breu. */
export function tokenVisivel(quem: Espectador, token: TokenNaMesa, estado: EstadoDaMesa): boolean {
  if (quem.papel === 'mestre') return true;
  if (token.donoId !== null && token.donoId === quem.id) return true;
  return !token.oculto && !sobBreu(estado.breu, token);
}

/** O jogador vê o prop que não está sob o breu (vale o centro dele, como no token). */
export function propVisivel(quem: Espectador, prop: PropNaMesa, estado: EstadoDaMesa): boolean {
  return quem.papel === 'mestre' || !sobBreu(estado.breu, prop);
}

/** Pista no mapa para o jogador: oculta some; não descoberta, só a tarja; nunca a nota do mestre. */
export function pistaParaJogador(pista: PistaNaMesa): PistaParaJogador | null {
  if (!pista.visivel) return null;
  const { id, x, y } = pista;
  if (!pista.descoberta) return { id, x, y, descoberta: false };
  return { id, x, y, descoberta: true, titulo: pista.titulo, texto: pista.texto };
}

function inventario(estado: EstadoDaMesa): ItemDoInventario[] {
  const itens: ItemDoInventario[] = [];
  for (const posse of estado.comAlguem) {
    const pista = estado.pistas.find((p) => p.id === posse.pistaId);
    if (pista) itens.push({ ...posse, titulo: pista.titulo, texto: pista.texto });
  }
  return itens;
}

/** O jogador vê as pistas do próprio personagem e as que já foram apresentadas ao grupo. */
const itemVisivel = (
  quem: Espectador,
  item: Pick<ItemDoInventario, 'personagemId' | 'apresentada'>,
) => item.apresentada || (quem.personagemId !== null && item.personagemId === quem.personagemId);

export function projetarEstado(quem: Espectador, estado: EstadoDaMesa): VisaoDaMesa {
  const comum = {
    mapa: estado.mapa,
    breu: estado.breu,
    nevoa: estado.nevoa,
    rodada: estado.rodada,
    trilha: estado.trilha,
  };
  if (quem.papel === 'mestre') {
    return {
      papel: 'mestre',
      ...comum,
      tokens: estado.tokens,
      props: estado.props,
      pistas: estado.pistas,
      inventario: inventario(estado),
      salas: estado.salas,
      guia: estado.guia,
      escudo: estado.escudo,
    };
  }
  return {
    papel: 'jogador',
    ...comum,
    tokens: estado.tokens.filter((t) => tokenVisivel(quem, t, estado)),
    props: estado.props.filter((p) => propVisivel(quem, p, estado)),
    pistas: estado.pistas.map(pistaParaJogador).filter((p) => p !== null),
    inventario: inventario(estado).filter((i) => itemVisivel(quem, i)),
  };
}

/** Um token mudou: o jogador recebe o token novo, ou `null` se ele acabou de sair da vista. */
function tokenParaJogador(
  quem: Espectador,
  tokenId: string,
  seq: number,
  antes: EstadoDaMesa,
  depois: EstadoDaMesa,
): EventoDaMesa[] {
  const agora = depois.tokens.find((t) => t.id === tokenId);
  if (agora && tokenVisivel(quem, agora, depois)) {
    return [{ type: 'token.changed', tokenId, token: agora, seq }];
  }
  const via = antes.tokens.find((t) => t.id === tokenId);
  if (via && tokenVisivel(quem, via, antes)) {
    return [{ type: 'token.changed', tokenId, token: null, seq }];
  }
  return [];
}

/** Um prop mudou: o jogador recebe o prop novo, ou `null` se ele acabou de sair da vista. */
function propParaJogador(
  quem: Espectador,
  propId: string,
  seq: number,
  antes: EstadoDaMesa,
  depois: EstadoDaMesa,
): EventoDaMesa[] {
  const agora = depois.props.find((p) => p.id === propId);
  if (agora && propVisivel(quem, agora, depois)) {
    return [{ type: 'prop.changed', propId, prop: agora, seq }];
  }
  const via = antes.props.find((p) => p.id === propId);
  if (via && propVisivel(quem, via, antes)) {
    return [{ type: 'prop.changed', propId, prop: null, seq }];
  }
  return [];
}

/** Os que mudaram de vista (por causa da breu novo), cada um num evento: `null` se sumiu. */
function quemMudouDeVista<T extends { id: string }>(
  antes: readonly T[],
  depois: readonly T[],
  visivelAntes: (item: T) => boolean,
  visivelDepois: (item: T) => boolean,
): { id: string; item: T | null }[] {
  return [...new Set([...antes, ...depois].map((i) => i.id))].flatMap((id) => {
    const via = antes.find((i) => i.id === id);
    const ve = depois.find((i) => i.id === id);
    const viaAntes = via !== undefined && visivelAntes(via);
    const veAgora = ve !== undefined && visivelDepois(ve);
    if (viaAntes === veAgora) return [];
    return [{ id, item: veAgora ? ve : null }];
  });
}

/**
 * Os eventos de um comando, como `quem` deve recebê-los. Pode tirar eventos, trocar um por outro
 * (token que entrou no breu vira "sumiu") e acrescentar (breu que revelou um token). Os eventos
 * derivados levam o mesmo número de sequência do original.
 */
export function projetarEventos(
  quem: Espectador,
  eventos: readonly EventoDaMesa[],
  antes: EstadoDaMesa,
  depois: EstadoDaMesa,
): EventoDaMesa[] {
  return eventos.flatMap((evento) => {
    const projetados =
      quem.papel === 'mestre' ? [evento] : projetarParaJogador(quem, evento, antes, depois);
    // Troca de mapa: tudo o que está sobre ele muda de uma vez; cada um recebe o mapa novo inteiro,
    // do jeito que pode ver, com o mesmo número de sequência.
    if (evento.type !== 'map.activated') return projetados;
    return [
      ...projetados,
      { type: 'mesa.estado' as const, estado: projetarEstado(quem, depois), seq: evento.seq },
    ];
  });
}

function projetarParaJogador(
  quem: Espectador,
  evento: EventoDaMesa,
  antes: EstadoDaMesa,
  depois: EstadoDaMesa,
): EventoDaMesa[] {
  switch (evento.type) {
    // Sem nada secreto: vão para todos como estão (a névoa é só visual, todos veem o mesmo nível).
    case 'presence.changed':
    case 'character.changed':
    case 'campaign.deleted':
    case 'map.activated':
    case 'map.changed':
    case 'test.resolved':
    case 'audio.changed':
    case 'round.started':
    case 'mist.changed':
      return [evento];

    case 'mesa.estado':
      return [{ ...evento, estado: projetarEstado(quem, depois) }];

    case 'token.moved': {
      // Visto antes e depois: só a posição. Saiu do breu: o token inteiro. Entrou: some.
      const via = antes.tokens.find((t) => t.id === evento.tokenId);
      const agora = depois.tokens.find((t) => t.id === evento.tokenId);
      if (via && agora && tokenVisivel(quem, via, antes) && tokenVisivel(quem, agora, depois)) {
        return [evento];
      }
      return tokenParaJogador(quem, evento.tokenId, evento.seq, antes, depois);
    }

    case 'token.dragging': {
      // O arrasto não muda o estado: vale a posição do próprio evento.
      const token = depois.tokens.find((t) => t.id === evento.tokenId);
      const noArrasto = token && { ...token, x: evento.x, y: evento.y };
      return noArrasto && tokenVisivel(quem, noArrasto, depois) ? [evento] : [];
    }

    case 'token.changed':
      return tokenParaJogador(quem, evento.tokenId, evento.seq, antes, depois);

    case 'prop.changed':
      return propParaJogador(quem, evento.propId, evento.seq, antes, depois);

    case 'prop.dragging': {
      // Só o que o jogador já tem e continua à vista; ao soltar, o `prop.changed` acerta o resto.
      const prop = depois.props.find((p) => p.id === evento.propId);
      const noArrasto = prop && { ...prop, x: evento.x, y: evento.y };
      return prop &&
        noArrasto &&
        propVisivel(quem, prop, depois) &&
        propVisivel(quem, noArrasto, depois)
        ? [evento]
        : [];
    }

    case 'darkness.changed': {
      // O breu novo pode esconder ou revelar tokens e props: cada um que mudou de vista vira um
      // evento.
      const tokens = quemMudouDeVista(
        antes.tokens,
        depois.tokens,
        (t) => tokenVisivel(quem, t, antes),
        (t) => tokenVisivel(quem, t, depois),
      ).map(({ id, item }) => ({
        type: 'token.changed' as const,
        tokenId: id,
        token: item,
        seq: evento.seq,
      }));
      const props = quemMudouDeVista(
        antes.props,
        depois.props,
        (p) => propVisivel(quem, p, antes),
        (p) => propVisivel(quem, p, depois),
      ).map(({ id, item }) => ({
        type: 'prop.changed' as const,
        propId: id,
        prop: item,
        seq: evento.seq,
      }));
      return [evento, ...tokens, ...props];
    }

    case 'room.updated':
      return [];

    case 'clue.changed': {
      const agora = depois.pistas.find((p) => p.id === evento.pistaId);
      const visivel = agora ? pistaParaJogador(agora) : null;
      if (visivel) return [{ ...evento, pista: visivel }];
      const via = antes.pistas.find((p) => p.id === evento.pistaId);
      if (via && pistaParaJogador(via)) return [{ ...evento, pista: null }];
      return [];
    }

    case 'clue.received':
    case 'clue.presented':
      return itemVisivel(quem, evento.item) ? [evento] : [];

    case 'clue.revoked':
      return quem.personagemId !== null && evento.personagemId === quem.personagemId
        ? [evento]
        : [];

    case 'dice.rolled':
      return !evento.secreta || evento.autorId === quem.id ? [evento] : [];

    case 'chat.message':
      return evento.para === null || evento.para === quem.id || evento.autorId === quem.id
        ? [evento]
        : [];

    case 'poi.infoRevealed':
      return quem.personagemId !== null && evento.personagemIds.includes(quem.personagemId)
        ? [evento]
        : [];

    default: {
      // Evento novo sem regra de projeção não compila.
      const faltou: never = evento;
      return faltou;
    }
  }
}
