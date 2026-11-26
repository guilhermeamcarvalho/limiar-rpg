// Uma mesa ao vivo por campanha: o estado em memória, a sequência dos eventos e `aplicar`, por onde
// passa todo comando. A ordem é sempre: valida o contrato, confere a permissão, aplica num
// rascunho, numera os eventos e, só então, troca o estado. Recusado, nada muda.
import {
  estadoVazioDaMesa,
  podeVerCampanha,
  rngCripto,
  validarComando,
  type CampanhaComMembros,
  type EstadoDaMesa,
  type EventoDaMesa,
  type EventoDaMesaSemSeq,
  type Rng,
  type TipoDeEvento,
} from '@membrana/shared';
import { Recusa, tratar, type Contexto } from './comandos/index.ts';

/** Não mudam o estado: não pedem para salvar. */
const TRANSITORIOS: ReadonlySet<TipoDeEvento> = new Set([
  'token.dragging',
  'prop.dragging',
  'board.pinged',
]);

/** Vão para o registro da sessão (`session_log`): a aba Acontecimentos e o resumo. */
const REGISTRADOS: ReadonlySet<TipoDeEvento> = new Set([
  'chat.message',
  'dice.rolled',
  'test.resolved',
  'clue.presented',
  'map.activated',
  'audio.changed',
  'round.started',
]);

export const ehRegistrado = (tipo: TipoDeEvento) => REGISTRADOS.has(tipo);
export const ehTransitorio = (tipo: TipoDeEvento) => TRANSITORIOS.has(tipo);

export type ResultadoDoComando =
  | {
      ok: true;
      eventos: EventoDaMesa[];
      /** O estado antes e depois: a projeção usa os dois (um token que sumiu da vista, por exemplo). */
      antes: EstadoDaMesa;
      depois: EstadoDaMesa;
    }
  | { ok: false; motivo: string };

export interface DependenciasDaMesa {
  /** Os membros do caso agora, lidos a cada comando: quem saiu perde o acesso na hora. */
  membros: () => CampanhaComMembros['membros'];
  /** Se o caso limita a uma ação importante por rodada (`campaigns.rodadas`). */
  rodadas?: () => boolean;
  /** O dono do personagem, se ele for deste caso. */
  personagem: (personagemId: string) => { donoId: string } | null;
  /** Um mapa deste caso, como está salvo. */
  mapa: Contexto['mapa'];
  /** Os personagens que o grupo usa neste caso. */
  grupo: Contexto['grupo'];
  /** A ficha e as regras do caso para rodar um teste pela mesa. */
  fichaNoCaso: Contexto['fichaNoCaso'];
  /** Grava o resultado do teste oficial e atualiza a ficha no banco. */
  gravarTeste: Contexto['gravarTeste'];
  /** O sorteio dos dados; sem ele, usa o criptográfico. */
  sorteio?: Rng;
  /**
   * Grava o mapa que está saindo, antes de uma troca: o que entra é lido do banco, e o que sai
   * deixa de estar em memória. Se falhar, a troca não acontece.
   */
  guardarMapa?: (estado: EstadoDaMesa) => void;
  /** O estado mudou: hora de agendar o salvamento. */
  aoMudar?: () => void;
  /** Grava os eventos importantes. Se falhar, o comando inteiro falha e nada muda. */
  registrar?: (eventos: EventoDaMesa[]) => void;
}

export class Mesa {
  readonly campanhaId: string;
  #estado: EstadoDaMesa;
  #seq: number;
  readonly #deps: DependenciasDaMesa;
  readonly #sorteio: Rng;

  constructor(
    campanhaId: string,
    deps: DependenciasDaMesa,
    salvo?: { estado?: EstadoDaMesa; seq: number },
  ) {
    this.campanhaId = campanhaId;
    this.#deps = deps;
    this.#sorteio = deps.sorteio ?? rngCripto();
    // Campos que vieram depois do último salvamento (uma versão nova do app) nascem vazios.
    const vazio = estadoVazioDaMesa();
    this.#estado = {
      ...vazio,
      ...salvo?.estado,
      rodada: { ...vazio.rodada, ...salvo?.estado?.rodada },
    };
    this.#seq = salvo?.seq ?? 0;
  }

  /** O estado atual. Nunca é mudado no lugar: cada comando troca por um novo. */
  get estado(): EstadoDaMesa {
    return this.#estado;
  }

  /** O número do último evento. */
  get seq(): number {
    return this.#seq;
  }

  /** Valida, confere a permissão e aplica o comando de `quem`. */
  aplicar(quem: { id: string }, entrada: unknown): ResultadoDoComando {
    const validacao = validarComando(entrada);
    if (!validacao.ok) return validacao;

    const campanha: CampanhaComMembros = {
      id: this.campanhaId,
      membros: this.#deps.membros(),
      rodadas: this.#deps.rodadas?.() ?? true,
    };
    if (!podeVerCampanha(quem, campanha)) return { ok: false, motivo: 'Você não está neste caso.' };

    const rascunho = structuredClone(this.#estado);
    let saida: EventoDaMesaSemSeq[];
    try {
      saida = tratar(
        {
          quem,
          campanha,
          estado: rascunho,
          sorteio: this.#sorteio,
          personagem: this.#deps.personagem,
          grupo: this.#deps.grupo,
          mapa: this.#deps.mapa,
          fichaNoCaso: this.#deps.fichaNoCaso,
          gravarTeste: this.#deps.gravarTeste,
        },
        validacao.comando,
      );
    } catch (erro) {
      if (erro instanceof Recusa) return { ok: false, motivo: erro.message };
      throw erro;
    }

    // Nada a fazer (como ativar o mapa que já está na mesa): o estado fica como está.
    if (saida.length === 0) {
      return { ok: true, eventos: [], antes: this.#estado, depois: this.#estado };
    }

    let seq = this.#seq;
    const eventos = saida.map((evento) => ({ ...evento, seq: ++seq }));
    if (this.#estado.mapa && eventos.some((e) => e.type === 'map.activated')) {
      this.#deps.guardarMapa?.(this.#estado);
    }
    const importantes = eventos.filter((e) => REGISTRADOS.has(e.type));
    if (importantes.length > 0) this.#deps.registrar?.(importantes);

    const antes = this.#estado;
    this.#estado = rascunho;
    this.#seq = seq;
    if (eventos.some((e) => !TRANSITORIOS.has(e.type))) this.#deps.aoMudar?.();
    return { ok: true, eventos, antes, depois: rascunho };
  }

  /** Dá número a um evento que não nasceu de um comando (presença, ficha editada numa rota). */
  carimbar(evento: EventoDaMesaSemSeq): EventoDaMesa {
    this.#seq += 1;
    return { ...evento, seq: this.#seq };
  }
}
