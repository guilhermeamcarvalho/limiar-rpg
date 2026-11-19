// Redefine a senha de alguém à mão, enquanto não existe "esqueci a senha" por e-mail (#13).
//
//   pnpm --filter @limiar/server reset-senha marta@exemplo.com
//
// Gera uma senha provisória, mostra na tela e encerra todas as sessões da pessoa.
// Mande a senha por um canal privado; ela pode trocá-la depois, no Perfil.
// Funciona também para quem só entrava pelo Discord: passa a ter e-mail e senha.
import { randomInt } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { caminhoDoBanco } from '../config.ts';
import { abrirBanco, type Banco } from '../db/index.ts';
import { identities, sessions, users } from '../db/schema.ts';
import { gerarHash } from '../http/auth/senha.ts';

// Sem letras que se confundem (l, 1, I, O, 0): a pessoa vai digitar isso.
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function senhaProvisoria(tamanho = 14): string {
  return Array.from({ length: tamanho }, () => LETRAS[randomInt(LETRAS.length)]).join('');
}

/** Troca a senha e derruba as sessões. Devolve o nome da pessoa, ou null se o e-mail não existe. */
export async function redefinirSenha(db: Banco, emailBruto: string, senha: string) {
  const email = emailBruto.trim().toLowerCase();
  const pelaIdentidade = db
    .select({ id: identities.userId })
    .from(identities)
    .where(and(eq(identities.provedor, 'email'), eq(identities.idExterno, email)))
    .get();
  const pelaConta = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  const userId = pelaIdentidade?.id ?? pelaConta?.id;
  if (!userId) return null;

  const senhaHash = await gerarHash(senha);
  db.transaction((tx) => {
    tx.insert(identities)
      .values({ userId, provedor: 'email', idExterno: email, senhaHash })
      .onConflictDoUpdate({
        target: [identities.provedor, identities.idExterno],
        set: { senhaHash },
      })
      .run();
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();
  });
  return db.select({ nome: users.nome }).from(users).where(eq(users.id, userId)).get()?.nome ?? '';
}

// Só roda como script, não quando importado pelos testes.
if (import.meta.main) {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: pnpm --filter @limiar/server reset-senha <e-mail>');
    process.exit(1);
  }
  const { db, sqlite } = abrirBanco(caminhoDoBanco());
  try {
    const senha = senhaProvisoria();
    const nome = await redefinirSenha(db, email, senha);
    if (nome === null) {
      console.error(`Nenhuma conta com o e-mail ${email}.`);
      process.exitCode = 1;
    } else {
      console.log(`Senha de ${nome} (${email}) redefinida. Sessões abertas foram encerradas.`);
      console.log(`Senha provisória: ${senha}`);
    }
  } finally {
    sqlite.close();
  }
}
