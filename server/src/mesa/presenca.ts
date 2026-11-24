// Quem está em cada mesa agora, por conexão. A mesma pessoa em duas abas conta uma vez.
// A Central usa `mesaAbertaDesde`: a mesa está aberta enquanto o mestre estiver conectado.
import type { PresencaNaMesa } from '@membrana/shared';

export class Presenca {
  /** campanha → id da conexão → pessoa. */
  readonly #salas = new Map<string, Map<string, PresencaNaMesa>>();
  /** Desde quando há um mestre conectado em cada campanha. */
  readonly #mestreDesde = new Map<string, Date>();

  entrar(campanhaId: string, conexaoId: string, pessoa: PresencaNaMesa, agora = new Date()) {
    let sala = this.#salas.get(campanhaId);
    if (!sala) {
      sala = new Map();
      this.#salas.set(campanhaId, sala);
    }
    sala.set(conexaoId, pessoa);
    if (pessoa.papel === 'mestre' && !this.#mestreDesde.has(campanhaId)) {
      this.#mestreDesde.set(campanhaId, agora);
    }
  }

  sair(campanhaId: string, conexaoId: string) {
    const sala = this.#salas.get(campanhaId);
    if (!sala) return;
    sala.delete(conexaoId);
    if (![...sala.values()].some((p) => p.papel === 'mestre')) this.#mestreDesde.delete(campanhaId);
    if (sala.size === 0) this.#salas.delete(campanhaId);
  }

  /** Quem está online: o mestre primeiro, depois os jogadores por nome. */
  online(campanhaId: string): PresencaNaMesa[] {
    const unicos = new Map<string, PresencaNaMesa>();
    for (const pessoa of this.#salas.get(campanhaId)?.values() ?? []) unicos.set(pessoa.id, pessoa);
    return [...unicos.values()].sort(
      (a, b) =>
        Number(a.papel === 'jogador') - Number(b.papel === 'jogador') ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }

  mesaAbertaDesde(campanhaId: string): Date | null {
    return this.#mestreDesde.get(campanhaId) ?? null;
  }
}
