// O que cada pessoa recebe da mesa (aba Arquitetura técnica, "O que cada um recebe"). Segredo só
// escondido na tela não é segredo: o jogador nunca recebe o que não pode ver (nem token nem prop
// sob o breu), nem no estado inicial, nem na reconexão, nem em evento nenhum. O mestre recebe tudo.
// Campo secreto novo? Trate aqui e acrescente o segredo em projecao.test.ts.
import {
  sobBreu,
  type EstadoDaMesa,
  type EstadoDoCombate,
  type EventoDaMesa,
  type ItemDoInventario,
  type Papel,
  type PistaNaMesa,
  type PistaParaJogador,
  type PoiNaMesa,
  type PoiParaJogador,
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

/** Pista no mapa para o jogador: oculta ou sob o breu some; não descoberta, só a tarja; nunca a nota do mestre. */
export function pistaParaJogador(
  pista: PistaNaMesa,
  estado?: Pick<EstadoDaMesa, 'breu'>,
): PistaParaJogador | null {
  if (!pista.visivel) return null;
  if (estado && sobBreu(estado.breu, pista)) return null;
  const { id, x, y } = pista;
  const tamanho = pista.tamanho;
  if (!pista.descoberta) {
    return { id, x, y, ...(tamanho !== undefined && { tamanho }), descoberta: false };
  }
  return {
    id,
    x,
    y,
    ...(tamanho !== undefined && { tamanho }),
    descoberta: true,
    titulo: pista.titulo,
    texto: pista.texto,
    imagem: pista.imagem ?? null,
  };
}

/** Ponto de interesse para o jogador: sem contextoMestre e com informações ocultas como tarjas. */
export function poiParaJogador(poi: PoiNaMesa): PoiParaJogador {
  return {
    id: poi.id,
    numero: poi.numero,
    nome: poi.nome,
    descricao: poi.descricao,
    x: poi.x,
    y: poi.y,
    pericias: poi.pericias,
    informacoes: poi.informacoes.map((info) =>
      info.descoberta
        ? { id: info.id, nivel: info.nivel, descoberta: true, texto: info.texto }
        : { id: info.id, nivel: info.nivel, descoberta: false },
    ),
    desafio: poi.desafio
      ? {
          tipo: poi.desafio.tipo,
          ...(poi.desafio.dt !== undefined && { dt: poi.desafio.dt }),
        }
      : null,
    ...(poi.estadoDesafio !== undefined && { estadoDesafio: poi.estadoDesafio }),
    tudoDescoberto:
      poi.informacoes.length > 0 && poi.informacoes.every((info) => info.descoberta === true),
  };
}

function inventario(estado: EstadoDaMesa): ItemDoInventario[] {
  const itens: ItemDoInventario[] = [];
  for (const posse of estado.comAlguem) {
    const pista = estado.pistas.find((p) => p.id === posse.pistaId);
    const titulo = pista?.titulo ?? posse.titulo;
    const texto = pista?.texto ?? posse.texto;
    const imagem = pista !== undefined ? (pista.imagem ?? null) : (posse.imagem ?? null);
    if (titulo !== undefined && texto !== undefined) {
      itens.push({
        pistaId: posse.pistaId,
        personagemId: posse.personagemId,
        apresentada: posse.apresentada,
        em: posse.em,
        titulo,
        texto,
        imagem,
      });
    }
  }
  return itens;
}

/** O jogador vê as pistas do próprio personagem e as que já foram apresentadas ao grupo. */
const itemVisivel = (
  quem: Espectador,
  item: Pick<ItemDoInventario, 'personagemId' | 'apresentada'>,
) => item.apresentada || (quem.personagemId !== null && item.personagemId === quem.personagemId);

function combatParaJogador(
  quem: Espectador,
  combate: EstadoDoCombate | null | undefined,
  estado: EstadoDaMesa,
): EstadoDoCombate | null {
  if (!combate) return null;
  const visiveis = combate.participantes.filter((p) => {
    if (p.oculto) return false;
    if (p.tokenId) {
      const tok = estado.tokens.find((t) => t.id === p.tokenId);
      if (tok && !tokenVisivel(quem, tok, estado)) return false;
    }
    return true;
  });
  const atualId = combate.participantes[combate.turnoIndex]?.id;
  const turnoIndex = atualId ? visiveis.findIndex((p) => p.id === atualId) : -1;
  return { ...combate, participantes: visiveis, turnoIndex };
}

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
      combate: estado.combate ?? null,
      tokens: estado.tokens,
      props: estado.props,
      pois: estado.pois,
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
    combate: combatParaJogador(quem, estado.combate, estado),
    tokens: estado.tokens.filter((t) => tokenVisivel(quem, t, estado)),
    props: estado.props.filter((p) => propVisivel(quem, p, estado)),
    pois: estado.pois.map(poiParaJogador),
    pistas: estado.pistas.map((p) => pistaParaJogador(p, estado)).filter((p) => p !== null),
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
    case 'round.acted':
    case 'combat.started':
    case 'combat.roundChanged':
    case 'combat.ended':
    case 'mist.changed':
    case 'board.pinged':
      return [evento];

    case 'combat.updated':
      return [{ ...evento, combate: combatParaJogador(quem, evento.combate, depois) }];

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
      const pistas = quemMudouDeVista(
        antes.pistas,
        depois.pistas,
        (p) => pistaParaJogador(p, antes) !== null,
        (p) => pistaParaJogador(p, depois) !== null,
      ).map(({ id, item }) => ({
        type: 'clue.changed' as const,
        pistaId: id,
        pista: item ? pistaParaJogador(item, depois) : null,
        seq: evento.seq,
      }));
      return [evento, ...tokens, ...props, ...pistas];
    }

    case 'room.updated':
      return [];

    case 'poi.changed': {
      const agora = depois.pois.find((p) => p.id === evento.poiId);
      return [{ ...evento, poi: agora ? poiParaJogador(agora) : null }];
    }

    case 'clue.changed': {
      const agora = depois.pistas.find((p) => p.id === evento.pistaId);
      const visivel = agora ? pistaParaJogador(agora, depois) : null;
      if (visivel) return [{ ...evento, pista: visivel }];
      const via = antes.pistas.find((p) => p.id === evento.pistaId);
      if (via && pistaParaJogador(via, antes)) return [{ ...evento, pista: null }];
      return [];
    }

    case 'clue.received':
    case 'clue.presented':
      return itemVisivel(quem, evento.item) ? [evento] : [];

    case 'clue.revoked': {
      const eraApresentada = antes.comAlguem.some(
        (c) =>
          c.pistaId === evento.pistaId && c.personagemId === evento.personagemId && c.apresentada,
      );
      return eraApresentada ||
        (quem.personagemId !== null && evento.personagemId === quem.personagemId)
        ? [evento]
        : [];
    }

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

/**
 * Filtra o histórico de `session_log` pelo que `quem` pode ver (#72). O mestre recebe tudo; o
 * jogador não recebe rolagens secretas alheias nem sussurros para outras pessoas.
 */
export function projetarRegistro(
  quem: Espectador,
  eventos: readonly EventoDaMesa[],
): EventoDaMesa[] {
  if (quem.papel === 'mestre') return [...eventos];
  return eventos.filter((evento) => {
    switch (evento.type) {
      case 'chat.message':
        return evento.para === null || evento.para === quem.id || evento.autorId === quem.id;
      case 'dice.rolled':
        return !evento.secreta || evento.autorId === quem.id;
      case 'clue.presented':
        return itemVisivel(quem, evento.item);
      case 'poi.infoRevealed':
        return quem.personagemId !== null && evento.personagemIds.includes(quem.personagemId);
      case 'test.resolved':
      case 'map.activated':
      case 'audio.changed':
      case 'round.started':
        return true;
      default:
        return false;
    }
  });
}
