// Fila de ações offline e regras de reconexão da mesa (#76):
// - Movimentos (`token.move`) e mensagens (`chat.send`) ficam na fila enquanto a conexão caiu e
//   são reenviados na ordem assim que o Socket.IO reconecta.
// - Rolagens (`dice.roll`, `test.resolve`, `test.report`) são bloqueadas offline, pois o resultado
//   oficial vem sempre do servidor.
import type { ComandoDaMesa, TokenNaMesa } from '@membrana/shared';

export interface AcaoNaFila {
  id: string;
  comando: ComandoDaMesa;
  descricao: string;
}

const ENFILEIRAVEIS: ReadonlySet<ComandoDaMesa['type']> = new Set(['token.move', 'chat.send']);
const ROLAGENS: ReadonlySet<ComandoDaMesa['type']> = new Set([
  'dice.roll',
  'test.resolve',
  'test.report',
]);

export const AVISO_ROLAGEM_OFFLINE =
  'Rolagens só voltam com a conexão, para o servidor dar o resultado oficial.';

export function podeEnfileirarOffline(comando: ComandoDaMesa): boolean {
  return ENFILEIRAVEIS.has(comando.type);
}

export function ehRolagemBloqueadaOffline(comando: ComandoDaMesa): boolean {
  return ROLAGENS.has(comando.type);
}

export function descreverAcaoNaFila(
  comando: ComandoDaMesa,
  tokens: readonly Pick<TokenNaMesa, 'id' | 'nome'>[] = [],
): string {
  if (comando.type === 'token.move') {
    const token = tokens.find((t) => t.id === comando.tokenId);
    return token ? `Mover ${token.nome}` : 'Mover token';
  }
  if (comando.type === 'chat.send') {
    const trecho = comando.texto.length > 42 ? `${comando.texto.slice(0, 42)}…` : comando.texto;
    return `“${trecho}”`;
  }
  return 'Ação na mesa';
}

/** Atraso padrão entre tentativas de reconexão (em segundos). */
export function segundosParaTentativa(tentativa: number): number {
  return Math.min(30, Math.max(2, tentativa * 2));
}
