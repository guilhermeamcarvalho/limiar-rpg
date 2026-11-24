// /campanhas/:id/mesa: a mesa ao vivo (artboards "10 · Mesa" e "11 · Mesa-Mestre"). Tela cheia,
// sem o cabeçalho comum. Por enquanto: o palco com o mapa e, para o mestre, a ferramenta "Mapa e
// grade". Os painéis laterais, o chat e a barra completa chegam com o layout da mesa (#74).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  LIMITE_DA_IMAGEM,
  tituloDaPagina,
  type CampanhaDetalhe,
  type MapaNaMesa,
  type VisaoDaMesa,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import type { Ponto } from '../../mesa/camera.ts';
import { MapaUpload } from '../../mesa/MapaUpload.tsx';
import { Palco } from '../../mesa/Palco.tsx';
import { useMesaAoVivo, type SituacaoDaConexao } from '../../mesa/useMesaAoVivo.ts';
import { Banner, Button, Chip, EmptyState, Icon, useCarga, useToast } from '../../ui/index.ts';
import './mesa.css';

/** "retrato-do-vulto.png" → "retrato-do-vulto" (o nome do token criado pela imagem solta). */
export function nomeDoToken(arquivo: string): string {
  return (
    arquivo
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 60) || 'Token'
  );
}

const limitar = (valor: number, maximo: number) => Math.min(maximo, Math.max(0, valor));

function TextoDaSituacao({ situacao }: { situacao: SituacaoDaConexao }) {
  if (situacao.estado === 'conectada') return <Chip status="online">Ao vivo</Chip>;
  if (situacao.estado === 'conectando') return <Chip status="away">Conectando…</Chip>;
  return <Chip status="off">Sem conexão</Chip>;
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
  const [painelAberto, setPainelAberto] = useState(false);
  const caso = useCarga(`/api/campanhas/${campanhaId}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(campanhaId)}`, {
      signal,
    }).then((r) => r.campanha),
  );
  const nomeDoCaso = caso.carga.estado === 'pronto' ? caso.carga.dados.nome : null;
  const { visao } = mesa;
  const mestre = visao?.papel === 'mestre';
  const meuId = sessao.estado === 'logado' ? sessao.usuario.id : '';

  useEffect(() => {
    document.title = tituloDaPagina(nomeDoCaso ? `Mesa · ${nomeDoCaso}` : 'Mesa');
  }, [nomeDoCaso]);

  // G abre e fecha a ferramenta de mapa (só o mestre).
  useEffect(() => {
    if (!mestre) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPainelAberto((aberto) => !aberto);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [mestre]);

  /** RF-24: imagem solta sobre o mapa vira token ali (mestre) ou a imagem do próprio token. */
  async function aoSoltarImagem(
    arquivo: File,
    ponto: Ponto,
    atual: VisaoDaMesa & { mapa: MapaNaMesa },
  ) {
    if (!arquivo.type.startsWith('image/')) {
      avisos.show({
        type: 'err',
        title: 'Isso não é uma imagem',
        text: 'Solte um JPG, PNG ou WebP.',
      });
      return;
    }
    if (arquivo.size > LIMITE_DA_IMAGEM) {
      avisos.show({
        type: 'err',
        title: 'Imagem grande demais',
        text: 'A imagem passa de 5 MB. Diminua o tamanho e tente de novo.',
      });
      return;
    }
    const meuToken = atual.tokens.find((t) => t.donoId === meuId);
    if (!mestre && !meuToken) {
      avisos.show({
        type: 'info',
        title: 'Você ainda não tem um token neste mapa',
        text: 'Peça ao mestre para pôr o seu personagem na mesa.',
      });
      return;
    }

    const corpo = new FormData();
    corpo.append('uso', 'token');
    corpo.append('arquivo', arquivo);
    let imagem: string;
    try {
      ({ nome: imagem } = await pedir<{ nome: string }>(
        `/api/campanhas/${encodeURIComponent(campanhaId)}/imagens`,
        { method: 'POST', body: corpo },
      ));
    } catch (erro) {
      avisos.show({
        type: 'err',
        title: 'Não deu para enviar a imagem',
        text: erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.',
      });
      return;
    }

    const resposta =
      mestre || !meuToken
        ? await enviar({
            type: 'token.create',
            nome: nomeDoToken(arquivo.name),
            imagem,
            x: limitar(ponto.x, atual.mapa.largura),
            y: limitar(ponto.y, atual.mapa.altura),
          })
        : await enviar({ type: 'token.update', tokenId: meuToken.id, imagem });
    if (!resposta.ok) {
      avisos.show({ type: 'err', title: 'Não deu para usar a imagem', text: resposta.motivo });
    }
  }

  if (situacao.estado === 'excluido') {
    return (
      <div className="mesa">
        <div className="mesa-vazia">
          <EmptyState
            icon={<Icon name="folder" size="xl" />}
            title="Caso excluído"
            action={
              <Link className="btn" to="/">
                Voltar para a Central
              </Link>
            }
          >
            O mestre excluiu este caso. A mesa foi fechada para todos.
          </EmptyState>
        </div>
      </div>
    );
  }

  if (situacao.estado === 'recusada') {
    return (
      <div className="mesa">
        <div className="mesa-vazia">
          <EmptyState
            icon={<Icon name="lock" size="xl" />}
            title="Não deu para abrir a mesa"
            action={
              <Link className="btn" to="/">
                Voltar para a Central
              </Link>
            }
          >
            {situacao.mensagem}
          </EmptyState>
        </div>
      </div>
    );
  }

  const comMapa = visao?.mapa ? (visao as VisaoDaMesa & { mapa: MapaNaMesa }) : null;

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
                      setPainelAberto(true);
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

        {mestre && (
          <div className="tool" role="toolbar" aria-label="Ferramentas">
            <button
              type="button"
              className={`tbtn gm${painelAberto ? ' on' : ''}`}
              aria-pressed={painelAberto}
              aria-label="Mapa e grade, ferramenta do mestre"
              title="Mapa (G)"
              onClick={() => {
                setPainelAberto((aberto) => !aberto);
              }}
            >
              <Icon name="grid" />
            </button>
          </div>
        )}

        {mestre && painelAberto && (
          <aside className="mesa-painel" aria-label="Mapa e grade">
            <div className="row between">
              <h2 className="h3">Mapa e grade</h2>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="close" size="sm" />}
                aria-label="Fechar mapa e grade"
                onClick={() => {
                  setPainelAberto(false);
                }}
              />
            </div>
            <MapaUpload campanhaId={campanhaId} mapaNaMesa={visao.mapa} enviar={enviar} />
          </aside>
        )}
      </section>
    </div>
  );
}
