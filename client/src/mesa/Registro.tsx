// Aba Registro / Acontecimentos da mesa (#72, RF-45, RF-46, RF-74): mostra os marcos da sessão —
// testes e rolagens, pistas apresentadas ao grupo, mudanças de cena/rodada e de trilha — sem
// repetir conversa ou narração do chat, e com filtro por tipo.
import { useState } from 'react';
import {
  nomeDaPericia,
  type EventoDaMesa,
  type Membro,
  type Papel,
  type PersonagemNaMesa,
} from '@membrana/shared';
import {
  cx,
  EmptyState,
  Icon,
  Input,
  Note,
  textoDoVeredito,
  type NomeDoIcone,
} from '../ui/index.ts';
import { ImagemDaPista } from './ImagemDaPista.tsx';

/** Quantos acontecimentos são exibidos inicialmente no registro; o restante carrega sob demanda. */
export const LOTE_DO_REGISTRO = 40;

export type FiltroDoRegistro = 'todos' | 'testes' | 'pistas' | 'cenas' | 'trilha';

const FILTROS: { id: FiltroDoRegistro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'testes', rotulo: 'Testes' },
  { id: 'pistas', rotulo: 'Pistas' },
  { id: 'cenas', rotulo: 'Cenas' },
  { id: 'trilha', rotulo: 'Trilha' },
];

export type ItemDeAcontecimento = Extract<
  EventoDaMesa,
  {
    type:
      | 'test.resolved'
      | 'dice.rolled'
      | 'poi.infoRevealed'
      | 'clue.presented'
      | 'map.activated'
      | 'round.started'
      | 'audio.changed';
  }
>;

export function ehAcontecimento(evento: EventoDaMesa): evento is ItemDeAcontecimento {
  return (
    evento.type === 'test.resolved' ||
    evento.type === 'dice.rolled' ||
    evento.type === 'poi.infoRevealed' ||
    evento.type === 'clue.presented' ||
    evento.type === 'map.activated' ||
    evento.type === 'round.started' ||
    evento.type === 'audio.changed'
  );
}

/** Filtra os acontecimentos da sessão (sem conversa/narração) e sem repetir `seq`. */
export function filtrarAcontecimentos(
  eventos: readonly EventoDaMesa[],
  filtro: FiltroDoRegistro = 'todos',
): ItemDeAcontecimento[] {
  const vistos = new Set<number>();
  const unicos: ItemDeAcontecimento[] = [];
  for (const evento of eventos) {
    if (!ehAcontecimento(evento) || vistos.has(evento.seq)) continue;
    vistos.add(evento.seq);
    unicos.push(evento);
  }
  if (filtro === 'todos') return unicos;
  return unicos.filter((e) => {
    switch (filtro) {
      case 'testes':
        return e.type === 'test.resolved' || e.type === 'dice.rolled';
      case 'pistas':
        return e.type === 'clue.presented' || e.type === 'poi.infoRevealed';
      case 'cenas':
        return e.type === 'map.activated' || e.type === 'round.started';
      case 'trilha':
        return e.type === 'audio.changed';
    }
  });
}

function horarioCurto(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function iconeDo(tipo: ItemDeAcontecimento['type']): NomeDoIcone {
  switch (tipo) {
    case 'test.resolved':
    case 'dice.rolled':
      return 'dice';
    case 'clue.presented':
    case 'poi.infoRevealed':
      return 'clue';
    case 'map.activated':
      return 'map';
    case 'round.started':
      return 'flag';
    case 'audio.changed':
      return 'music';
  }
}

export interface RegistroProps {
  eventos: readonly EventoDaMesa[];
  papel: Papel;
  membros: readonly Membro[];
  personagens: readonly PersonagemNaMesa[];
}

export function Registro({ eventos, papel, membros, personagens }: RegistroProps) {
  const [filtro, setFiltro] = useState<FiltroDoRegistro>('todos');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(LOTE_DO_REGISTRO);

  const todos = filtrarAcontecimentos(eventos, 'todos');
  const porTipo = filtrarAcontecimentos(eventos, filtro);

  const nomesDeUsuarios = Object.fromEntries(membros.map((m) => [m.id, m.nome]));
  const nomesDePersonagens = Object.fromEntries(personagens.map((p) => [p.id, p.nome]));

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? porTipo.filter((item) => {
        switch (item.type) {
          case 'test.resolved': {
            const quem =
              item.registro.personagemNome ??
              nomesDePersonagens[item.registro.personagemId] ??
              item.registro.autor?.nome ??
              '';
            return (
              quem.toLowerCase().includes(termo) ||
              nomeDaPericia(item.registro.periciaId).toLowerCase().includes(termo) ||
              item.registro.efeitos.join(' ').toLowerCase().includes(termo)
            );
          }
          case 'dice.rolled':
            return (
              (nomesDeUsuarios[item.autorId] ?? '').toLowerCase().includes(termo) ||
              item.expressao.toLowerCase().includes(termo) ||
              String(item.total).includes(termo)
            );
          case 'poi.infoRevealed':
            return item.texto.toLowerCase().includes(termo);
          case 'clue.presented':
            return (
              item.item.titulo.toLowerCase().includes(termo) ||
              item.item.texto.toLowerCase().includes(termo) ||
              (nomesDePersonagens[item.item.personagemId] ?? '').toLowerCase().includes(termo)
            );
          case 'map.activated':
            return (item.mapa?.nome ?? 'mapa recolhido').toLowerCase().includes(termo);
          case 'round.started':
            return `rodada ${String(item.numero)}`.includes(termo);
          case 'audio.changed':
            return (item.trilha?.faixaId ?? 'trilha parada').toLowerCase().includes(termo);
        }
      })
    : porTipo;

  const ordenados = [...filtrados].reverse();
  const visiveis = termo ? ordenados : ordenados.slice(0, limite);
  const ocultos = termo ? 0 : ordenados.length - visiveis.length;

  return (
    <div className="registro-coluna">
      <div className="col registro-topo">
        {(todos.length > 0 || termo !== '') && (
          <Input
            type="search"
            aria-label="Buscar no registro"
            placeholder="Buscar no registro…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
            }}
          />
        )}
        <div
          className="prontos-categorias registro-filtros"
          role="group"
          aria-label="Filtrar registro"
        >
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cx('chip', filtro === f.id && 'on')}
              aria-pressed={filtro === f.id}
              onClick={() => {
                setFiltro(f.id);
              }}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="registro-vazio">
          <EmptyState
            icon={<Icon name="log" size="xl" />}
            title={todos.length === 0 ? 'Nada registrado ainda' : 'Nada encontrado'}
          >
            {todos.length === 0
              ? 'Testes, pistas apresentadas, cenas, rodadas e trilhas aparecem aqui.'
              : 'Nenhum acontecimento combina com o filtro atual.'}
          </EmptyState>
        </div>
      ) : (
        <ol className="registro-lista" aria-label="Acontecimentos da sessão">
          {visiveis.map((item) => (
            <li key={item.seq} className="registro-item">
              <span className="registro-icone" aria-hidden="true">
                <Icon name={iconeDo(item.type)} size="sm" />
              </span>
              <div className="registro-corpo">
                {item.type === 'test.resolved' && (
                  <>
                    <div className="row between">
                      <span className="small">
                        <b>
                          {item.registro.personagemNome ??
                            nomesDePersonagens[item.registro.personagemId] ??
                            item.registro.autor?.nome ??
                            'Personagem'}
                        </b>{' '}
                        · {nomeDaPericia(item.registro.periciaId)}
                      </span>
                      <span className="small muted">{horarioCurto(item.registro.em)}</span>
                    </div>
                    <span className="small muted">
                      {item.registro.resultado.total} contra DT {item.registro.resultado.dt} ·{' '}
                      {textoDoVeredito(item.registro.resultado.veredito)}
                      {(papel === 'mestre' || item.registro.origem === 'fisico') &&
                        (item.registro.origem === 'fisico'
                          ? ' · dados físicos'
                          : ' · dados virtuais')}
                    </span>
                    {item.registro.efeitos.length > 0 && (
                      <span className="small">{item.registro.efeitos.join(' ')}</span>
                    )}
                  </>
                )}

                {item.type === 'dice.rolled' && (
                  <>
                    <span className="small">
                      <b>{nomesDeUsuarios[item.autorId] ?? 'Alguém'}</b> rolou{' '}
                      <b>{item.expressao}</b>: {item.dados.join(', ')} = <b>{item.total}</b>
                    </span>
                    {item.secreta && <span className="small gold">Rolagem secreta</span>}
                  </>
                )}

                {item.type === 'poi.infoRevealed' && (
                  <Note className="registro-pista">
                    <b>Informação descoberta</b>
                    <br />
                    {item.texto}
                  </Note>
                )}

                {item.type === 'clue.presented' && (
                  <>
                    <div className="row between">
                      <span className="small">
                        <b>{nomesDePersonagens[item.item.personagemId] ?? 'Alguém'}</b> compartilhou
                        uma pista
                      </span>
                      <span className="small muted">{horarioCurto(item.item.em)}</span>
                    </div>
                    <div className="note registro-pista col" style={{ gap: 6 }}>
                      <b>{item.item.titulo}</b>
                      {item.item.imagem && (
                        <ImagemDaPista
                          imagem={item.item.imagem}
                          titulo={item.item.titulo}
                          compacta
                        />
                      )}
                      {item.item.texto && <span>{item.item.texto}</span>}
                    </div>
                  </>
                )}

                {item.type === 'map.activated' && (
                  <span className="small">
                    {item.mapa ? (
                      <>
                        Cena aberta: <b>{item.mapa.nome}</b>
                      </>
                    ) : (
                      'Mapa recolhido da mesa'
                    )}
                  </span>
                )}

                {item.type === 'round.started' && (
                  <span className="small">
                    <b>Rodada {item.numero}</b> iniciada
                  </span>
                )}

                {item.type === 'audio.changed' && (
                  <span className="small">
                    {item.trilha ? (
                      <>
                        Trilha tocando: <b>{item.trilha.faixaId}</b>
                      </>
                    ) : (
                      'Trilha sonora parada'
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
          {ocultos > 0 && (
            <li className="registro-mais">
              <button
                type="button"
                className="registro-carregar-mais small"
                onClick={() => {
                  setLimite((n) => n + LOTE_DO_REGISTRO);
                }}
              >
                Mostrar mais antigos ({ocultos})
              </button>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
