// As mesas em memória, uma por campanha, ligadas ao banco: carregam o último estado salvo,
// agendam o salvamento a cada mudança e gravam os eventos importantes no registro da sessão.
import type { Banco } from '../db/index.ts';
import { membrosDe } from '../http/campanhas/dados.ts';
import {
  donoDoPersonagemNoCaso,
  gravarEstado,
  lerEstadoSalvo,
  lerEstadosSalvos,
  registrarEventos,
  ultimoSeqRegistrado,
  type EstadoSalvo,
} from './dados.ts';
import { Mesa } from './Mesa.ts';
import { criarAgendador, type Agendador } from './persistencia.ts';

export interface OpcoesDasMesas {
  /** Atraso do salvamento (os testes encurtam). */
  atrasoMs?: number;
  /** Um salvamento falhou: vai para o log e para o Sentry. */
  aoFalhar?: (erro: unknown, campanhaId: string) => void;
}

export class Mesas {
  readonly #db: Banco;
  readonly #mesas = new Map<string, Mesa>();
  readonly #agendador: Agendador;

  constructor(db: Banco, opcoes: OpcoesDasMesas = {}) {
    this.#db = db;
    this.#agendador = criarAgendador((campanhaId) => {
      this.#salvar(campanhaId);
    }, opcoes);
  }

  /** Ao subir: carrega o último estado de cada caso em curso. Devolve quantas mesas carregou. */
  carregarSalvas(): number {
    const salvas = lerEstadosSalvos(this.#db);
    for (const salva of salvas) {
      this.#mesas.set(salva.campanhaId, this.#criar(salva.campanhaId, salva));
    }
    return salvas.length;
  }

  /** A mesa da campanha, carregada do banco (ou vazia) na primeira vez. */
  obter(campanhaId: string): Mesa {
    let mesa = this.#mesas.get(campanhaId);
    if (!mesa) {
      mesa = this.#criar(campanhaId, lerEstadoSalvo(this.#db, campanhaId));
      this.#mesas.set(campanhaId, mesa);
    }
    return mesa;
  }

  /** A mesa, só se já estiver em memória. */
  existente(campanhaId: string): Mesa | undefined {
    return this.#mesas.get(campanhaId);
  }

  /** Salva agora o que estiver pendente. Chame ao fechar o servidor. */
  salvarTudo() {
    this.#agendador.descarregar();
  }

  get pendentes(): number {
    return this.#agendador.pendentes;
  }

  #criar(campanhaId: string, salvo: EstadoSalvo | null): Mesa {
    const db = this.#db;
    // O registro é gravado na hora; o estado, até 1 s depois. Depois de uma queda, a sequência
    // continua do maior dos dois.
    const seq = Math.max(salvo?.seq ?? 0, ultimoSeqRegistrado(db, campanhaId));
    return new Mesa(
      campanhaId,
      {
        membros: () => membrosDe(db, campanhaId),
        personagem: (personagemId) => donoDoPersonagemNoCaso(db, campanhaId, personagemId),
        aoMudar: () => {
          this.#agendador.agendar(campanhaId);
        },
        registrar: (eventos) => {
          registrarEventos(db, campanhaId, eventos);
        },
      },
      salvo ? { estado: salvo.estado, seq } : { seq },
    );
  }

  #salvar(campanhaId: string) {
    const mesa = this.#mesas.get(campanhaId);
    if (mesa) gravarEstado(this.#db, campanhaId, mesa.estado, mesa.seq);
  }
}
