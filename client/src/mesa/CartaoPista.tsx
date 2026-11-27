// Cartão flutuante da pista clicada no mapa (#87, #88) e lista da aba Pistas da mesa (#89).
import { useState } from 'react';
import {
  pertoDaPista,
  type ComandoDaMesa,
  type ItemDoInventario,
  type Papel,
  type PersonagemNaMesa,
  type PistaNaMesa,
  type PistaParaJogador,
  type RespostaDoComando,
  type TokenNaMesa,
} from '@membrana/shared';
import {
  Button,
  Checkbox,
  cx,
  EmptyState,
  Field,
  Icon,
  Input,
  Tag,
  useToast,
} from '../ui/index.ts';
import { ImagemDaPista } from './ImagemDaPista.tsx';

export function CartaoPista({
  pista,
  papel,
  meuToken,
  celula,
  inventario,
  personagens,
  enviar,
  aoFechar,
}: {
  pista: PistaNaMesa | PistaParaJogador;
  papel: Papel;
  meuToken: TokenNaMesa | undefined;
  celula: number;
  inventario: readonly ItemDoInventario[];
  personagens: readonly PersonagemNaMesa[];
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoFechar: () => void;
}) {
  const avisos = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mestre = papel === 'mestre' && 'notaMestre' in pista;
  const tituloVisivel = 'titulo' in pista ? pista.titulo : null;
  const perto = meuToken ? pertoDaPista(meuToken, pista, celula) : false;
  const possesDesta = inventario.filter((i) => i.pistaId === pista.id);

  async function guardarNoInventario() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviar({ type: 'clue.take', pistaId: pista.id });
      if (!r.ok) {
        setErro(r.motivo);
        avisos.show({ type: 'warn', title: 'Não deu para guardar a pista', text: r.motivo });
        return;
      }
      avisos.show({ type: 'ok', title: 'Pista guardada no inventário' });
      aoFechar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="card cartao-poi cartao-pista"
      role="dialog"
      aria-label={tituloVisivel ? `Pista: ${tituloVisivel}` : 'Pista no mapa'}
    >
      <div className="cartao-poi-topo">
        <Tag tone="gold">Pista</Tag>
        <div className="grow col" style={{ gap: 2 }}>
          <b className="cartao-poi-titulo">{tituloVisivel ?? 'Pista no mapa'}</b>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="close" size="sm" />}
          aria-label="Fechar pista"
          onClick={aoFechar}
        />
      </div>

      <div className="col cartao-poi-corpo">
        {'imagem' in pista && pista.imagem && (
          <ImagemDaPista imagem={pista.imagem} titulo={tituloVisivel ?? 'Pista'} />
        )}
        {'texto' in pista && pista.texto ? (
          <p className="doc small">{pista.texto}</p>
        ) : !('imagem' in pista && pista.imagem) ? (
          <p className="small muted">
            Guarde esta pista no seu inventário para examinar o conteúdo completo.
          </p>
        ) : null}

        {mestre && (
          <>
            {pista.notaMestre && (
              <div className="poi-info">
                <span className="lab">Nota do mestre (secreta)</span>
                <p className="small" style={{ marginTop: 4 }}>
                  {pista.notaMestre}
                </p>
              </div>
            )}
            <Checkbox
              label="Visível no mapa para os jogadores"
              checked={pista.visivel}
              onChange={() => {
                void enviar({
                  type: 'clue.update',
                  pistaId: pista.id,
                  visivel: !pista.visivel,
                });
              }}
            />
            <Field label="Tamanho no mapa">
              <Input
                type="number"
                min={0.25}
                max={20}
                step={0.1}
                value={String(pista.tamanho ?? 1)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0.25 && v <= 20) {
                    void enviar({
                      type: 'clue.update',
                      pistaId: pista.id,
                      tamanho: v,
                    });
                  }
                }}
              />
            </Field>
            {personagens.length > 0 && (
              <div className="col" style={{ gap: 4 }}>
                <span className="lab">Enviar ou recolher</span>
                <div className="prontos-categorias">
                  {personagens.map((p) => {
                    const tem = possesDesta.some((i) => i.personagemId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cx('chip', tem && 'on')}
                        aria-pressed={tem}
                        onClick={() => {
                          void enviar({
                            type: tem ? 'clue.revoke' : 'clue.send',
                            pistaId: pista.id,
                            personagemId: p.id,
                          });
                        }}
                      >
                        {p.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {papel === 'jogador' && (
          <div className="col" style={{ gap: 8 }}>
            <span className="small muted">
              {!meuToken
                ? 'Coloque seu token no mapa para pegar pistas.'
                : perto
                  ? 'Seu token está ao alcance (até 1 célula).'
                  : 'Aproxime seu token (até 1 célula) para guardar esta pista.'}
            </span>
            {erro && (
              <span className="small red" role="alert">
                {erro}
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="clue" size="sm" />}
              loading={enviando}
              onClick={() => void guardarNoInventario()}
            >
              Guardar pista
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type FiltroDePistaNaMesa = 'todas' | 'minhas' | 'apresentadas';

export function AbaPistasNaMesa({
  inventario,
  papel,
  meuPersonagemId,
  nomesDePersonagens,
  enviar,
}: {
  inventario: readonly ItemDoInventario[];
  papel: Papel;
  meuPersonagemId: string | null;
  nomesDePersonagens: Readonly<Record<string, string>>;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [apresentandoId, setApresentandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDePistaNaMesa>('todas');

  async function apresentar(pistaId: string) {
    if (apresentandoId) return;
    setApresentandoId(pistaId);
    try {
      const r = await enviar({ type: 'clue.present', pistaId });
      if (!r.ok) {
        avisos.show({ type: 'err', title: 'Não deu para apresentar', text: r.motivo });
      }
    } finally {
      setApresentandoId(null);
    }
  }

  if (inventario.length === 0) {
    return (
      <div className="mesa-aba-lista">
        <div className="registro-vazio">
          <EmptyState icon={<Icon name="clue" size="xl" />} title="Nenhuma pista ainda">
            Pistas recebidas ou apresentadas aparecem aqui.
          </EmptyState>
        </div>
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = inventario.filter((item) => {
    if (filtro === 'apresentadas' && !item.apresentada) return false;
    if (filtro === 'minhas' && item.personagemId !== meuPersonagemId) {
      return false;
    }
    if (!termo) return true;
    return item.titulo.toLowerCase().includes(termo) || item.texto.toLowerCase().includes(termo);
  });

  return (
    <div className="mesa-aba-lista">
      <div className="col" style={{ gap: 10 }}>
        {inventario.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            {inventario.length > 2 && (
              <Input
                aria-label="Buscar pista no inventário"
                placeholder="Buscar pista…"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                }}
              />
            )}
            <div className="prontos-categorias" role="group" aria-label="Filtrar pistas">
              {(
                [
                  { id: 'todas', rotulo: 'Todas' },
                  { id: 'minhas', rotulo: 'Minhas' },
                  { id: 'apresentadas', rotulo: 'Do grupo' },
                ] as const
              ).map((f) => (
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
        )}

        {visiveis.length === 0 ? (
          <p className="small muted">Nenhuma pista encontrada com esse filtro.</p>
        ) : (
          visiveis.map((item) => {
            const ehMinha = meuPersonagemId !== null && item.personagemId === meuPersonagemId;
            const dono = nomesDePersonagens[item.personagemId];
            return (
              <div key={`${item.pistaId}-${item.personagemId}`} className="note col">
                <div className="row between wrapx" style={{ gap: 6 }}>
                  <b>{item.titulo}</b>
                  <span className="small muted">
                    {item.apresentada
                      ? dono
                        ? `apresentada por ${dono}`
                        : 'apresentada'
                      : ehMinha
                        ? 'só com você'
                        : dono
                          ? `com ${dono}`
                          : 'guardada'}
                  </span>
                </div>
                {item.imagem && <ImagemDaPista imagem={item.imagem} titulo={item.titulo} />}
                {item.texto && <p style={{ marginTop: 4 }}>{item.texto}</p>}
                {!item.apresentada && ehMinha && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button
                      size="sm"
                      loading={apresentandoId === item.pistaId}
                      onClick={() => void apresentar(item.pistaId)}
                    >
                      Apresentar ao grupo
                    </Button>
                  </div>
                )}
                {!item.apresentada && papel === 'mestre' && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void enviar({
                          type: 'clue.revoke',
                          pistaId: item.pistaId,
                          personagemId: item.personagemId,
                        });
                      }}
                    >
                      Recolher de {dono ?? 'jogador'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
