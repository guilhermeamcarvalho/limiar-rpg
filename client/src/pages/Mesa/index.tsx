// /campanhas/:id/mesa: a mesa ao vivo (artboards "10 · Mesa" e "11 · Mesa-Mestre"). Tela cheia,
// sem o cabeçalho comum. O palco com o mapa e, para o mestre, as ferramentas "Tokens e NPCs" (T),
// "Props" (O) e "Mapa e grade" (G). Os painéis laterais, o chat e a barra completa chegam com o
// layout da mesa (#74).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  tituloDaPagina,
  type CampanhaDetalhe,
  type MapaNaMesa,
  type VisaoDaMesa,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import type { Ponto } from '../../mesa/camera.ts';
import { enviarImagemDaMesa, nomeDoArquivoSemExtensao } from '../../mesa/imagens.ts';
import { dentroDoMapa } from '../../mesa/interacao.ts';
import { MapaUpload } from '../../mesa/MapaUpload.tsx';
import { NovoProp } from '../../mesa/painel/NovoProp.tsx';
import { Npcs } from '../../mesa/painel/Npcs.tsx';
import { Palco } from '../../mesa/Palco.tsx';
import { useMesaAoVivo, type SituacaoDaConexao } from '../../mesa/useMesaAoVivo.ts';
import {
  Banner,
  Button,
  Chip,
  cx,
  EmptyState,
  Icon,
  useCarga,
  useToast,
  type NomeDoIcone,
} from '../../ui/index.ts';
import './mesa.css';

type Ferramenta = 'tokens' | 'props' | 'mapa';

const FERRAMENTAS: {
  id: Ferramenta;
  titulo: string;
  tecla: string;
  icone: NomeDoIcone;
  rotulo: string;
  /** Precisa de um mapa na mesa. */
  comMapa: boolean;
}[] = [
  {
    id: 'tokens',
    titulo: 'Tokens e NPCs',
    tecla: 't',
    icone: 'token',
    rotulo: 'Tokens e NPCs, ferramenta do mestre',
    comMapa: true,
  },
  {
    id: 'props',
    titulo: 'Props',
    tecla: 'o',
    icone: 'image',
    rotulo: 'Props, ferramenta do mestre',
    comMapa: true,
  },
  {
    id: 'mapa',
    titulo: 'Mapa e grade',
    tecla: 'g',
    icone: 'grid',
    rotulo: 'Mapa e grade, ferramenta do mestre',
    comMapa: false,
  },
];

function TextoDaSituacao({ situacao }: { situacao: SituacaoDaConexao }) {
  if (situacao.estado === 'conectada') return <Chip status="online">Ao vivo</Chip>;
  if (situacao.estado === 'conectando') return <Chip status="away">Conectando…</Chip>;
  return <Chip status="off">Sem conexão</Chip>;
}

function TelaFechada({
  icone,
  titulo,
  children,
}: {
  icone: NomeDoIcone;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="mesa">
      <div className="mesa-vazia">
        <EmptyState
          icon={<Icon name={icone} size="xl" />}
          title={titulo}
          action={
            <Link className="btn" to="/">
              Voltar para a Central
            </Link>
          }
        >
          {children}
        </EmptyState>
      </div>
    </div>
  );
}

export function Mesa() {
  const { id = '' } = useParams();
  // Outro caso, outra mesa: tudo recomeça do zero (conexão, estado, câmera).
  return <MesaDoCaso key={id} campanhaId={id} />;
}

function MesaDoCaso({ campanhaId }: { campanhaId: string }) {
  const { sessao } = useMe();
  const avisos = useToast();
  const { mesa, situacao, enviar } = useMesaAoVivo(campanhaId);
  const [painel, setPainel] = useState<Ferramenta | null>(null);
  const [escolhendoGrupo, setEscolhendoGrupo] = useState(false);
  const centroRef = useRef<Ponto | null>(null);
  const caso = useCarga(`/api/campanhas/${campanhaId}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(campanhaId)}`, {
      signal,
    }).then((r) => r.campanha),
  );
  const detalhe = caso.carga.estado === 'pronto' ? caso.carga.dados : null;
  const nomeDoCaso = detalhe?.nome ?? null;
  const nomes = useMemo(
    () => Object.fromEntries((detalhe?.membros ?? []).map((m) => [m.id, m.nome])),
    [detalhe],
  );
  const { visao } = mesa;
  const mestre = visao?.papel === 'mestre';
  const temMapa = Boolean(visao?.mapa);
  const meuId = sessao.estado === 'logado' ? sessao.usuario.id : '';

  useEffect(() => {
    document.title = tituloDaPagina(nomeDoCaso ? `Mesa · ${nomeDoCaso}` : 'Mesa');
  }, [nomeDoCaso]);

  // T, O e G abrem e fecham as ferramentas do mestre; Esc cancela a escolha do ponto.
  useEffect(() => {
    if (!mestre) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.key === 'Escape') {
        setEscolhendoGrupo(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ferramenta = FERRAMENTAS.find((f) => f.tecla === e.key.toLowerCase());
      if (!ferramenta || (ferramenta.comMapa && !temMapa)) return;
      setPainel((aberto) => (aberto === ferramenta.id ? null : ferramenta.id));
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [mestre, temMapa]);

  /** RF-24: imagem solta sobre o mapa vira token ali (mestre) ou a imagem do próprio token. */
  async function aoSoltarImagem(
    arquivo: File,
    ponto: Ponto,
    atual: VisaoDaMesa & { mapa: MapaNaMesa },
  ) {
    const meuToken = atual.tokens.find((t) => t.donoId === meuId);
    if (!mestre && !meuToken && arquivo.type.startsWith('image/')) {
      avisos.show({
        type: 'info',
        title: 'Você ainda não tem um token neste mapa',
        text: 'Peça ao mestre para pôr o seu personagem na mesa.',
      });
      return;
    }
    const envio = await enviarImagemDaMesa(campanhaId, arquivo, 'token');
    if (!envio.ok) {
      avisos.show({ type: 'err', title: envio.titulo, text: envio.texto });
      return;
    }
    const resposta =
      mestre || !meuToken
        ? await enviar({
            type: 'token.create',
            nome: nomeDoArquivoSemExtensao(arquivo.name),
            imagem: envio.nome,
            ...dentroDoMapa(ponto, atual.mapa),
          })
        : await enviar({ type: 'token.update', tokenId: meuToken.id, imagem: envio.nome });
    if (!resposta.ok) {
      avisos.show({ type: 'err', title: 'Não deu para usar a imagem', text: resposta.motivo });
    }
  }

  async function trazerGrupo(ponto: Ponto) {
    setEscolhendoGrupo(false);
    const r = await enviar({ type: 'token.gather', ...ponto });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para trazer o grupo', text: r.motivo });
  }

  if (situacao.estado === 'excluido') {
    return (
      <TelaFechada icone="folder" titulo="Caso excluído">
        O mestre excluiu este caso. A mesa foi fechada para todos.
      </TelaFechada>
    );
  }

  if (situacao.estado === 'recusada') {
    return (
      <TelaFechada icone="lock" titulo="Não deu para abrir a mesa">
        {situacao.mensagem}
      </TelaFechada>
    );
  }

  const comMapa = visao?.mapa ? (visao as VisaoDaMesa & { mapa: MapaNaMesa }) : null;
  const aberta = FERRAMENTAS.find((f) => f.id === painel && (!f.comMapa || comMapa));

  return (
    <div className="mesa">
      <header className="mesa-topo">
        <Link className="btn ghost sm" to="/" aria-label="Voltar para a Central">
          <Icon name="back" size="sm" />
        </Link>
        <h1 className="mesa-titulo">{nomeDoCaso ?? 'Mesa'}</h1>
        {visao && <span className="small muted">Rodada {visao.rodada.numero}</span>}
        <span className="grow" />
        {mesa.online.length > 0 && (
          <span
            className="small muted mesa-online"
            title={mesa.online.map((p) => p.nome).join(', ')}
          >
            {mesa.online.length} na mesa
          </span>
        )}
        <TextoDaSituacao situacao={situacao} />
      </header>

      {situacao.estado === 'caiu' && visao && (
        <Banner tone="warn">Conexão perdida. Tentando voltar…</Banner>
      )}

      <section
        className="mesa-palco"
        aria-label={mestre ? 'Mapa na visão do mestre' : 'Mapa'}
        aria-busy={!visao}
      >
        {!visao ? (
          <div className="mesa-vazia">
            <p className="muted">Conectando à mesa…</p>
          </div>
        ) : comMapa ? (
          <Palco
            visao={comMapa}
            arrastando={mesa.arrastando}
            meuId={meuId}
            nomes={nomes}
            campanhaId={campanhaId}
            enviar={enviar}
            centroRef={centroRef}
            aoEscolherPonto={escolhendoGrupo ? (ponto) => void trazerGrupo(ponto) : null}
            aoSoltarImagem={(arquivo, ponto) => void aoSoltarImagem(arquivo, ponto, comMapa)}
          />
        ) : (
          <div className="mesa-vazia">
            <EmptyState
              icon={<Icon name="map" size="xl" />}
              title="Nenhum mapa na mesa"
              {...(mestre && {
                action: (
                  <Button
                    variant="primary"
                    icon={<Icon name="upload" size="sm" />}
                    onClick={() => {
                      setPainel('mapa');
                    }}
                  >
                    Escolher mapa
                  </Button>
                ),
              })}
            >
              {mestre
                ? 'Envie um mapa e ponha na mesa: todos passam a ver na hora.'
                : 'O mestre ainda não pôs um mapa na mesa.'}
            </EmptyState>
          </div>
        )}

        {/* Flutua sobre o mapa: uma faixa no fluxo empurraria o mapa bem na hora do clique. */}
        {escolhendoGrupo && (
          <div className="mesa-dica" role="status">
            <span className="small">Clique no mapa onde o grupo deve ficar.</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEscolhendoGrupo(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}

        {mestre && (
          <div className="tool" role="toolbar" aria-label="Ferramentas">
            {FERRAMENTAS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cx('tbtn gm', painel === f.id && 'on')}
                aria-pressed={painel === f.id}
                aria-label={f.rotulo}
                title={`${f.titulo} (${f.tecla.toUpperCase()})`}
                disabled={f.comMapa && !comMapa}
                onClick={() => {
                  setPainel((agora) => (agora === f.id ? null : f.id));
                }}
              >
                <Icon name={f.icone} />
              </button>
            ))}
          </div>
        )}

        {mestre && aberta && (
          <aside className="mesa-painel" aria-label={aberta.titulo}>
            <div className="row between">
              <h2 className="h3">{aberta.titulo}</h2>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="close" size="sm" />}
                aria-label={`Fechar ${aberta.titulo.toLowerCase()}`}
                onClick={() => {
                  setPainel(null);
                }}
              />
            </div>
            {aberta.id === 'mapa' && (
              <MapaUpload campanhaId={campanhaId} mapaNaMesa={visao.mapa} enviar={enviar} />
            )}
            {aberta.id === 'tokens' && (
              <Npcs
                campanhaId={campanhaId}
                visao={visao}
                enviar={enviar}
                centroRef={centroRef}
                nomes={nomes}
                aoTrazerGrupo={() => {
                  setEscolhendoGrupo(true);
                }}
              />
            )}
            {aberta.id === 'props' && (
              <NovoProp
                campanhaId={campanhaId}
                enviar={enviar}
                centroRef={centroRef}
                visao={visao}
              />
            )}
          </aside>
        )}
      </section>
    </div>
  );
}
