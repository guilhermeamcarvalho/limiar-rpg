// Salvar a mesa sem escrever no banco a cada movimento. A primeira mudança marca a mesa; um
// segundo depois, o estado daquele momento é salvo de uma vez, junto com tudo o que mudou nesse
// meio-tempo. Assim no máximo o último segundo se perde, e 100 mudanças nesse segundo viram uma
// escrita só. Um adiamento a cada mudança não serviria: numa mesa que não para de mexer, nunca
// salvaria. Ao fechar o servidor, `descarregar` salva o que estiver pendente.

export const ATRASO_DO_SALVAMENTO_MS = 1000;

export interface Agendador {
  /** A mesa mudou: salva em até `atrasoMs`. */
  agendar(chave: string): void;
  /** Salva agora tudo o que está pendente (ao fechar o servidor). */
  descarregar(): void;
  /** Quantas mesas esperam para ser salvas. */
  readonly pendentes: number;
}

export function criarAgendador(
  salvar: (chave: string) => void,
  {
    atrasoMs = ATRASO_DO_SALVAMENTO_MS,
    aoFalhar,
  }: { atrasoMs?: number; aoFalhar?: (erro: unknown, chave: string) => void } = {},
): Agendador {
  const timers = new Map<string, NodeJS.Timeout>();

  // Erro num timer derrubaria o processo: avisa e segue; a próxima mudança tenta de novo.
  function salvarSemDerrubar(chave: string) {
    try {
      salvar(chave);
    } catch (erro) {
      if (!aoFalhar) throw erro;
      aoFalhar(erro, chave);
    }
  }

  return {
    agendar(chave) {
      if (timers.has(chave)) return;
      const timer = setTimeout(() => {
        timers.delete(chave);
        salvarSemDerrubar(chave);
      }, atrasoMs);
      // Não segura o processo vivo: ao fechar, `descarregar` salva o que faltar.
      timer.unref();
      timers.set(chave, timer);
    },
    descarregar() {
      for (const [chave, timer] of [...timers]) {
        clearTimeout(timer);
        timers.delete(chave);
        salvarSemDerrubar(chave);
      }
    },
    get pendentes() {
      return timers.size;
    },
  };
}
