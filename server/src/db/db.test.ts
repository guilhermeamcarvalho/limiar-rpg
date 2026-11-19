/// <reference types="node" />
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG_OP2, esquemaConfigOp2, ID_OP2 } from '@limiar/shared';
import { bancoDeTeste } from '../teste/apoio.ts';
import { abrirBanco, migrar, schema } from './index.ts';
import { semear } from './seed.ts';

const { users, campaigns, memberships, gameSystems } = schema;

const abertos: { close: () => void }[] = [];
const pastas: string[] = [];
afterEach(() => {
  for (const banco of abertos.splice(0)) banco.close();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function bancoEmArquivo() {
  const pasta = mkdtempSync(join(tmpdir(), 'limiar-'));
  pastas.push(pasta);
  const caminho = join(pasta, 'sub', 'limiar.db');
  const banco = abrirBanco(caminho);
  abertos.push(banco.sqlite);
  return { ...banco, caminho };
}

function emMemoria() {
  const banco = bancoDeTeste();
  abertos.push(banco.sqlite);
  return banco;
}

describe('abrirBanco', () => {
  it('cria o arquivo (e a pasta) do zero, em modo WAL', () => {
    const { db, sqlite, caminho } = bancoEmArquivo();
    migrar(db);

    expect(existsSync(caminho)).toBe(true);
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
  });

  it('migrar de novo não faz nada', () => {
    const { db } = bancoEmArquivo();
    migrar(db);

    expect(() => {
      migrar(db);
    }).not.toThrow();
  });
});

describe('memberships', () => {
  it('a mesma pessoa é mestre numa campanha e jogadora noutra', () => {
    const { db } = emMemoria();
    const [ana, bia] = db
      .insert(users)
      .values([{ nome: 'Ana' }, { nome: 'Bia' }])
      .returning()
      .all();
    if (!ana || !bia) throw new Error('usuários não criados');

    const [daAna, daBia] = db
      .insert(campaigns)
      .values([
        { nome: 'O Sinal', systemId: ID_OP2, criadoPor: ana.id },
        { nome: 'Maré de Concreto', systemId: ID_OP2, criadoPor: bia.id },
      ])
      .returning()
      .all();
    if (!daAna || !daBia) throw new Error('campanhas não criadas');

    db.insert(memberships)
      .values([
        { campaignId: daAna.id, userId: ana.id, papel: 'mestre' },
        { campaignId: daBia.id, userId: ana.id, papel: 'jogador' },
      ])
      .run();

    const papeis = db
      .select({ campanha: memberships.campaignId, papel: memberships.papel })
      .from(memberships)
      .where(eq(memberships.userId, ana.id))
      .all();
    expect(papeis).toEqual(
      expect.arrayContaining([
        { campanha: daAna.id, papel: 'mestre' },
        { campanha: daBia.id, papel: 'jogador' },
      ]),
    );
  });

  it('o banco recusa papel fora de mestre/jogador e campanha que não existe', () => {
    const { db } = emMemoria();
    const [ana] = db.insert(users).values({ nome: 'Ana' }).returning().all();
    const [caso] = db
      .insert(campaigns)
      .values({ nome: 'O Sinal', systemId: ID_OP2, criadoPor: ana?.id ?? '' })
      .returning()
      .all();

    expect(() =>
      db
        .insert(memberships)
        .values({ campaignId: caso?.id ?? '', userId: ana?.id ?? '', papel: 'dono' as 'mestre' })
        .run(),
    ).toThrow(/CHECK constraint/);
    expect(() =>
      db
        .insert(memberships)
        .values({ campaignId: 'cmp_inexistente', userId: ana?.id ?? '', papel: 'jogador' })
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('ids saem com prefixo: usr_ e cmp_', () => {
    const { db } = emMemoria();
    const [ana] = db.insert(users).values({ nome: 'Ana' }).returning().all();
    const [caso] = db
      .insert(campaigns)
      .values({ nome: 'O Sinal', systemId: ID_OP2, criadoPor: ana?.id ?? '' })
      .returning()
      .all();

    expect(ana?.id).toMatch(/^usr_[0-9a-z]{16}$/);
    expect(caso?.id).toMatch(/^cmp_[0-9a-z]{16}$/);
    expect(caso?.rodadas).toBe(true);
  });
});

describe('seed', () => {
  it('rodar duas vezes não duplica Ordem Paranormal II', () => {
    const { db } = emMemoria(); // já semeado uma vez
    semear(db);

    const linhas = db.select().from(gameSystems).all();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.id).toBe(ID_OP2);
    expect(linhas[0]?.tipo).toBe('op2');
  });

  it('o config gravado passa no schema Zod do sistema', () => {
    const { db } = emMemoria();
    const [op2] = db.select().from(gameSystems).where(eq(gameSystems.id, ID_OP2)).all();

    expect(esquemaConfigOp2.safeParse(op2?.config).success).toBe(true);
    expect(op2?.config).toEqual(CONFIG_OP2);
  });
});
