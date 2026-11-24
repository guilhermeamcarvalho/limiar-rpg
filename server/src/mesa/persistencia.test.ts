import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarApp } from '../app.ts';
import { carregarConfig } from '../config.ts';
import { campaigns, characters, maps, props, tableStates, tokens } from '../db/schema.ts';
import { bancoDeTeste, casoDeTeste, ENV_DE_TESTE, mapaDeTeste } from '../teste/apoio.ts';
import { Mesas } from './mesas.ts';
import { criarAgendador } from './persistencia.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('agendador', () => {
  it('100 mudanças em 1 s geram uma escrita só', () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const agendador = criarAgendador(salvar);
    for (let i = 0; i < 100; i++) {
      agendador.agendar('cmp_1');
      vi.advanceTimersByTime(9);
    }
    expect(salvar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar).toHaveBeenCalledWith('cmp_1');
    expect(agendador.pendentes).toBe(0);
  });

  it('numa mesa que não para de mexer, salva a cada segundo (no máximo 1 s se perde)', () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const agendador = criarAgendador(salvar);
    for (let i = 0; i < 300; i++) {
      agendador.agendar('cmp_1');
      vi.advanceTimersByTime(10);
    }
    expect(salvar).toHaveBeenCalledTimes(3);
  });

  it('cada mesa tem o seu tempo', () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const agendador = criarAgendador(salvar);
    agendador.agendar('cmp_1');
    vi.advanceTimersByTime(500);
    agendador.agendar('cmp_2');
    vi.advanceTimersByTime(500);
    expect(salvar.mock.calls).toEqual([['cmp_1']]);
    vi.advanceTimersByTime(500);
    expect(salvar.mock.calls).toEqual([['cmp_1'], ['cmp_2']]);
  });

  it('descarregar salva agora o que estiver pendente, uma vez', () => {
    vi.useFakeTimers();
    const salvar = vi.fn();
    const agendador = criarAgendador(salvar);
    agendador.agendar('cmp_1');
    agendador.agendar('cmp_2');
    agendador.descarregar();
    expect(salvar.mock.calls).toEqual([['cmp_1'], ['cmp_2']]);
    vi.advanceTimersByTime(5000);
    expect(salvar).toHaveBeenCalledTimes(2);
  });

  it('falha ao salvar vai para aoFalhar sem derrubar o processo', () => {
    vi.useFakeTimers();
    const erro = new Error('disco cheio');
    const aoFalhar = vi.fn();
    const agendador = criarAgendador(
      () => {
        throw erro;
      },
      { aoFalhar },
    );
    agendador.agendar('cmp_1');
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(aoFalhar).toHaveBeenCalledWith(erro, 'cmp_1');
  });
});

describe('recuperação ao reiniciar', () => {
  function mesaMexida() {
    const banco = bancoDeTeste();
    const pessoas = casoDeTeste(banco);
    const mapa = mapaDeTeste(banco, pessoas.caso, { ativo: true });
    const mesas = new Mesas(banco.db);
    const mesa = mesas.obter(pessoas.caso);
    mesa.aplicar(pessoas.ana, { type: 'token.create', nome: 'Vulto', x: 120, y: 80 });
    mesa.aplicar(pessoas.ana, {
      type: 'fog.add',
      forma: { tipo: 'retangulo', x: 0, y: 0, largura: 50, altura: 50 },
    });
    mesa.aplicar(pessoas.ana, { type: 'round.end' });
    return { ...banco, ...pessoas, mapa, mesas, mesa };
  }

  it('o estado salvo volta igual: tokens, névoa, rodada e sequência', () => {
    const m = mesaMexida();
    expect(m.mesas.pendentes).toBe(1);
    m.mesas.salvarTudo();

    const depois = new Mesas(m.db);
    expect(depois.carregarSalvas()).toBe(1);
    const recuperada = depois.existente(m.caso);
    expect(recuperada?.estado).toEqual(m.mesa.estado);
    expect(recuperada?.estado.tokens[0]).toMatchObject({ nome: 'Vulto', x: 120, y: 80 });
    expect(recuperada?.estado.nevoa).toHaveLength(1);
    expect(recuperada?.seq).toBe(3);
    m.sqlite.close();
  });

  it('caiu antes de salvar: a sequência continua do registro, sem repetir número', () => {
    const m = mesaMexida();
    // Sem salvarTudo: o estado não chegou ao banco, mas o round.started (seq 3) já foi registrado.
    const depois = new Mesas(m.db).obter(m.caso);
    expect(depois.estado.tokens).toEqual([]);
    expect(depois.seq).toBe(3);
    const r = depois.aplicar(m.ana, { type: 'round.end' });
    expect(r.ok && r.eventos[0]?.seq).toBe(4);
    m.sqlite.close();
  });

  it('caso encerrado não é carregado ao subir', () => {
    const m = mesaMexida();
    m.mesas.salvarTudo();
    m.db.update(campaigns).set({ encerradoEm: new Date() }).where(eq(campaigns.id, m.caso)).run();
    expect(new Mesas(m.db).carregarSalvas()).toBe(0);
    m.sqlite.close();
  });

  it('fechar o app (SIGTERM) salva o pendente; o app novo sobe com a mesa', async () => {
    const { db, sqlite } = bancoDeTeste();
    const config = carregarConfig(ENV_DE_TESTE);
    const pessoas = casoDeTeste({ db });
    mapaDeTeste({ db }, pessoas.caso, { ativo: true });

    const antes = await criarApp({ config, db, logger: false, discord: null });
    antes.mesas
      .obter(pessoas.caso)
      .aplicar(pessoas.ana, { type: 'token.create', nome: 'Vulto', x: 300, y: 200 });
    expect(db.select().from(tableStates).all()).toEqual([]);
    await antes.close();
    expect(db.select().from(tableStates).all()).toHaveLength(1);

    const depois = await criarApp({ config, db, logger: false, discord: null });
    expect(depois.mesas.existente(pessoas.caso)?.estado.tokens).toMatchObject([
      { nome: 'Vulto', x: 300, y: 200 },
    ]);
    await depois.close();
    sqlite.close();
  });
});

describe('o mapa ativo nas tabelas dele', () => {
  function montar() {
    const banco = bancoDeTeste();
    const pessoas = casoDeTeste(banco);
    const mapa = mapaDeTeste(banco, pessoas.caso, { ativo: true });
    const mesas = new Mesas(banco.db);
    const mesa = mesas.obter(pessoas.caso);
    return { ...banco, ...pessoas, mapa, mesas, mesa };
  }

  it('tokens, props e névoa vão para as tabelas do mapa; o dono volta do personagem', () => {
    const m = montar();
    m.mesa.aplicar(m.ana, {
      type: 'token.create',
      nome: 'Davi',
      x: 10,
      y: 20,
      personagemId: m.davi,
    });
    m.mesa.aplicar(m.ana, { type: 'prop.create', imagem: `${'b'.repeat(64)}.webp`, x: 5, y: 5 });
    m.mesa.aplicar(m.ana, {
      type: 'fog.add',
      forma: { tipo: 'retangulo', x: 0, y: 0, largura: 50, altura: 50 },
    });
    m.mesas.salvarTudo();

    expect(m.db.select().from(tokens).all()).toMatchObject([
      { mapId: m.mapa.id, characterId: m.davi, nome: 'Davi', x: 10, y: 20 },
    ]);
    expect(m.db.select().from(props).all()).toMatchObject([{ mapId: m.mapa.id, ordem: 0 }]);
    expect(m.db.select().from(maps).get()?.nevoa).toHaveLength(1);
    // O resto do estado não leva o que é do mapa.
    const resto = m.db.select().from(tableStates).get()?.estado;
    expect(resto).not.toHaveProperty('tokens');
    expect(resto).not.toHaveProperty('mapa');

    const recuperada = new Mesas(m.db).obter(m.caso);
    expect(recuperada.estado.tokens).toMatchObject([{ personagemId: m.davi, donoId: m.bia.id }]);
    expect(recuperada.estado).toEqual(m.mesa.estado);
    m.sqlite.close();
  });

  it('apagar um mapa apaga os tokens e os props dele', () => {
    const m = montar();
    m.mesa.aplicar(m.ana, { type: 'token.create', nome: 'Vulto', x: 1, y: 1 });
    m.mesa.aplicar(m.ana, { type: 'prop.create', imagem: `${'b'.repeat(64)}.webp`, x: 5, y: 5 });
    m.mesas.salvarTudo();
    expect(m.db.select().from(tokens).all()).toHaveLength(1);

    m.db.delete(maps).where(eq(maps.id, m.mapa.id)).run();
    expect(m.db.select().from(tokens).all()).toEqual([]);
    expect(m.db.select().from(props).all()).toEqual([]);
    m.sqlite.close();
  });

  it('personagem apagado no meio da sessão: o token fica, como NPC', () => {
    const m = montar();
    m.mesa.aplicar(m.ana, {
      type: 'token.create',
      nome: 'Davi',
      x: 10,
      y: 20,
      personagemId: m.davi,
    });
    m.db.delete(characters).where(eq(characters.id, m.davi)).run();
    m.mesas.salvarTudo();
    expect(m.db.select().from(tokens).all()).toMatchObject([{ nome: 'Davi', characterId: null }]);
    m.sqlite.close();
  });

  it('só um mapa fica ativo, e é o da mesa', () => {
    const m = montar();
    const segundo = mapaDeTeste(m, m.caso, { nome: 'Porão' });
    m.mesa.aplicar(m.ana, { type: 'map.activate', mapaId: segundo.id });
    m.mesas.salvarTudo();
    const ativos = m.db
      .select({ id: maps.id })
      .from(maps)
      .where(eq(maps.ativo, true))
      .all()
      .map((l) => l.id);
    expect(ativos).toEqual([segundo.id]);
    expect(new Mesas(m.db).obter(m.caso).estado.mapa?.id).toBe(segundo.id);
    m.sqlite.close();
  });

  it('um salvamento antigo, com tokens soltos no estado, não traz esses tokens de volta', () => {
    const m = montar();
    m.mesas.salvarTudo();
    m.db
      .insert(tableStates)
      .values({
        campaignId: m.caso,
        estado: {
          rodada: { numero: 4 },
          tokens: [{ id: 'tok_velho' }],
        } as unknown as typeof tableStates.$inferInsert.estado,
        seq: 9,
        atualizadoEm: new Date(),
      })
      .onConflictDoUpdate({
        target: tableStates.campaignId,
        set: {
          estado: {
            rodada: { numero: 4 },
            tokens: [{ id: 'tok_velho' }],
          } as unknown as typeof tableStates.$inferInsert.estado,
        },
      })
      .run();
    const recuperada = new Mesas(m.db).obter(m.caso);
    expect(recuperada.estado.tokens).toEqual([]);
    expect(recuperada.estado.rodada).toEqual({ numero: 4 });
    expect(recuperada.estado.mapa?.id).toBe(m.mapa.id);
    m.sqlite.close();
  });
});
