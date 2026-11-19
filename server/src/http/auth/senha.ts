// Hash de senha com Argon2id, usando o argon2 que o Node 26 já traz (sem dependência nativa).
// Parâmetros iguais aos padrões da lib `argon2`: 64 MiB, 3 passadas, paralelismo 4.
// Guardado no formato PHC, o mesmo das outras libs: $argon2id$v=19$m=65536,t=3,p=4$sal$hash
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

const PADRAO = { memoria: 65536, passadas: 3, paralelismo: 4, tamanho: 32 } as const;

async function derivar(
  senha: string,
  sal: Buffer,
  m: number,
  t: number,
  p: number,
  tamanho: number,
) {
  return argon2Async('argon2id', {
    message: senha,
    nonce: sal,
    memory: m,
    passes: t,
    parallelism: p,
    tagLength: tamanho,
  });
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const { memoria: m, passadas: t, paralelismo: p, tamanho } = PADRAO;
  const hash = await derivar(senha, sal, m, t, p, tamanho);
  const b64 = (b: Buffer) => b.toString('base64').replace(/=+$/, '');
  return `$argon2id$v=19$m=${String(m)},t=${String(t)},p=${String(p)}$${b64(sal)}$${b64(hash)}`;
}

const FORMATO = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** Confere a senha com o hash guardado. Hash em formato estranho conta como "não confere". */
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = FORMATO.exec(guardado);
  if (!partes) return false;
  const [, m, t, p, sal, hash] = partes;
  const esperado = Buffer.from(hash ?? '', 'base64');
  const obtido = await derivar(
    senha,
    Buffer.from(sal ?? '', 'base64'),
    Number(m),
    Number(t),
    Number(p),
    esperado.length,
  );
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

/**
 * Hash de uma senha qualquer, calculado uma vez. Quando o e-mail não existe, conferimos contra ele
 * mesmo assim: a resposta demora o mesmo tanto e não entrega quais e-mails têm conta.
 */
let hashFalso: Promise<string> | undefined;
export function hashParaComparar(): Promise<string> {
  hashFalso ??= gerarHash(randomBytes(16).toString('hex'));
  return hashFalso;
}
