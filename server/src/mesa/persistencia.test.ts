import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { criarApp } from '../app.ts';
import { carregarConfig } from '../config.ts';
import { campaigns, tableStates } from '../db/schema.ts';
import { bancoDeTeste, casoDeTeste, ENV_DE_TESTE } from '../teste/apoio.ts';
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
    const mesas = new Mesas(banco.db);
    const mesa = mesas.obter(pessoas.caso);
    mesa.aplicar(pessoas.ana, { type: 'token.create', nome: 'Vulto', x: 120, y: 80 });
    mesa.aplicar(pessoas.ana, {
      type: 'fog.add',
      forma: { tipo: 'retangulo', x: 0, y: 0, largura: 50, altura: 50 },
    });
    mesa.aplicar(pessoas.ana, { type: 'round.end' });
    return { ...banco, ...pessoas, mesas, mesa };
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
