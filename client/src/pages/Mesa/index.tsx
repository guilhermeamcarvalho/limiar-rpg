// /campanhas/:id/mesa: a mesa ao vivo (artboards "10 · Mesa" e "11 · Mesa-Mestre"). Tela cheia,
// sem o cabeçalho comum. O palco com o mapa, o cartão de resultado no canto, as ferramentas e o
// painel lateral com Chat e Registro (Acontecimentos). Por cima do palco, a névoa da Membrana no
// nível escolhido pelo mestre. Os painéis recolhíveis e o painel esquerdo do jogador chegam no #74/#75.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  tituloDaPagina,
  type CampanhaDetalhe,
  type FormaDoBreu,
  type MapaNaMesa,
  type RespostaDoRegistro,
  type VisaoDaMesa,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import type { Ponto } from '../../mesa/camera.ts';
import { Chat, filtrarEventosDoChat } from '../../mesa/Chat.tsx';
import { mesclarEventosRegistrados } from '../../mesa/estado.ts';
import { enviarImagemDaMesa, nomeDoArquivoSemExtensao } from '../../mesa/imagens.ts';
import { dentroDoMapa } from '../../mesa/interacao.ts';
import { MapaUpload } from '../../mesa/MapaUpload.tsx';
import { descreverNevoa, NevoaDaMembrana } from '../../mesa/NevoaDaMembrana.tsx';
import type { PincelDoBreu } from '../../mesa/Breu.tsx';
import { FerramentaDoBreu } from '../../mesa/painel/Breu.tsx';
import { DadosETestes } from '../../mesa/painel/DadosETestes.tsx';
import { FerramentaDaNevoa } from '../../mesa/painel/Nevoa.tsx';
import { NovoProp } from '../../mesa/painel/NovoProp.tsx';
import { Npcs } from '../../mesa/painel/Npcs.tsx';
import { Palco } from '../../mesa/Palco.tsx';
import { filtrarAcontecimentos, Registro } from '../../mesa/Registro.tsx';
import { Resultado } from '../../mesa/Resultado.tsx';
import { useMesaAoVivo, type SituacaoDaConexao } from '../../mesa/useMesaAoVivo.ts';
import {
  Banner,
  Button,
  Chip,
  cx,
  EmptyState,
  Icon,
  TabPanel,
  Tabs,
  useCarga,
  useToast,
  type NomeDoIcone,
} from '../../ui/index.ts';
import './mesa.css';

type Ferramenta = 'dados' | 'tokens' | 'props' | 'breu' | 'nevoa' | 'mapa';
type AbaLateral = 'chat' | 'registro';

interface DefinicaoDeFerramenta {
  id: Ferramenta;
  titulo: string;
  tecla: string;
  icone: NomeDoIcone;
  rotulo: string;
  soMestre: boolean;
  /** Precisa de um mapa na mesa. */
  comMapa: boolean;
}

const FERRAMENTAS: DefinicaoDeFerramenta[] = [
  {
    id: 'dados',
    titulo: 'Dados e testes',
    tecla: 'd',
    icone: 'dice',
    rotulo: 'Rolar dados',
    soMestre: false,
    comMapa: false,
  },
  {
    id: 'tokens',
    titulo: 'Tokens e NPCs',
    tecla: 't',
    icone: 'token',
    rotulo: 'Tokens e NPCs, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'props',
    titulo: 'Props',
    tecla: 'o',
    icone: 'image',
    rotulo: 'Props, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'breu',
    titulo: 'Breu',
    tecla: 'b',
    icone: 'darkness',
    rotulo: 'Breu, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'nevoa',
    titulo: 'Névoa',
    tecla: 'n',
    icone: 'mist',
    rotulo: 'Névoa, ferramenta do mestre',
    soMestre: true,
    // É clima da cena: vale antes mesmo de haver mapa.
    comMapa: false,
  },
  {
    id: 'mapa',
    titulo: 'Mapa e grade',
    tecla: 'g',
    icone: 'grid',
    rotulo: 'Mapa e grade, ferramenta do mestre',
    soMestre: true,
    comMapa: false,
  },
];

const REGISTRO_VAZIO: RespostaDoRegistro = { eventos: [], personagens: [] };

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
  const idAbas = useId();
  const { sessao } = useMe();
  const avisos = useToast();
  const { mesa, situacao, enviar } = useMesaAoVivo(campanhaId);
  const [painel, setPainel] = useState<Ferramenta | null>(null);
  const [aba, setAba] = useState<AbaLateral>('chat');
  const [conversaMovel, setConversaMovel] = useState(false);
  const [seqVistoChat, setSeqVistoChat] = useState<number | null>(null);
  const [seqVistoRegistro, setSeqVistoRegistro] = useState<number | null>(null);
  const [seqResultadoFechado, setSeqResultadoFechado] = useState(0);
  const [escolhendoGrupo, setEscolhendoGrupo] = useState(false);
  const [pincel, setPincel] = useState<PincelDoBreu>({ modo: 'cobrir', forma: 'retangulo' });
  const centroRef = useRef<Ponto | null>(null);

  const caso = useCarga(`/api/campanhas/${campanhaId}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(campanhaId)}`, {
      signal,
    }).then((r) => r.campanha),
  );
  const registroInicial = useCarga(`/api/campanhas/${campanhaId}/registro`, (signal) =>
    pedir<RespostaDoRegistro>(`/api/campanhas/${encodeURIComponent(campanhaId)}/registro`, {
      signal,
    }).catch(() => REGISTRO_VAZIO),
  );

  const detalhe = caso.carga.estado === 'pronto' ? caso.carga.dados : null;
  const historico =
    registroInicial.carga.estado === 'pronto' ? registroInicial.carga.dados : REGISTRO_VAZIO;
  const nomeDoCaso = detalhe?.nome ?? null;
  const nomes = useMemo(
    () => Object.fromEntries((detalhe?.membros ?? []).map((m) => [m.id, m.nome])),
    [detalhe],
  );
  const personagens = useMemo(() => {
    const porId = new Map(historico.personagens.map((p) => [p.id, p]));
    if (detalhe?.meuPersonagem && !porId.has(detalhe.meuPersonagem.id)) {
      const eu = sessao.estado === 'logado' ? sessao.usuario.id : '';
      porId.set(detalhe.meuPersonagem.id, {
        id: detalhe.meuPersonagem.id,
        donoId: eu,
        nome: detalhe.meuPersonagem.nome,
        perfil: null,
      });
    }
    return [...porId.values()];
  }, [historico.personagens, detalhe, sessao]);
  const nomesDePersonagens = useMemo(
    () => Object.fromEntries(personagens.map((p) => [p.id, p.nome])),
    [personagens],
  );
  const eventosRegistrados = useMemo(
    () => mesclarEventosRegistrados(historico.eventos, mesa.eventos),
    [historico.eventos, mesa.eventos],
  );

  const { visao } = mesa;
  const mestre = visao?.papel === 'mestre';
  const temMapa = Boolean(visao?.mapa);
  const meuId = sessao.estado === 'logado' ? sessao.usuario.id : '';

  const maxSeqInicial = historico.eventos.at(-1)?.seq ?? 0;
  const baseChat = seqVistoChat ?? maxSeqInicial;
  const baseRegistro = seqVistoRegistro ?? maxSeqInicial;
  const novosNoChat =
    aba === 'chat'
      ? 0
      : filtrarEventosDoChat(eventosRegistrados).filter((e) => e.seq > baseChat).length;
  const novosNoRegistro =
    aba === 'registro'
      ? 0
      : filtrarAcontecimentos(eventosRegistrados).filter((e) => e.seq > baseRegistro).length;

  function trocarAba(nova: AbaLateral) {
    const topoSeq = eventosRegistrados.at(-1)?.seq ?? 0;
    setSeqVistoChat(topoSeq);
    setSeqVistoRegistro(topoSeq);
    setAba(nova);
  }

  useEffect(() => {
    document.title = tituloDaPagina(nomeDoCaso ? `Mesa · ${nomeDoCaso}` : 'Mesa');
  }, [nomeDoCaso]);

  // D abre Dados e testes para qualquer pessoa; T, O, B, N e G abrem as ferramentas do mestre.
  useEffect(() => {
    if (!visao) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.key === 'Escape') {
        setEscolhendoGrupo(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ferramenta = FERRAMENTAS.find((f) => f.tecla === e.key.toLowerCase());
      if (!ferramenta) return;
      if (ferramenta.soMestre && !mestre) return;
      if (ferramenta.comMapa && !temMapa) return;
      setPainel((aberto) => (aberto === ferramenta.id ? null : ferramenta.id));
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [visao, mestre, temMapa]);

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

  /** A forma desenhada no mapa cobre ou revela, conforme o pincel. */
  async function desenharBreu(forma: FormaDoBreu) {
    const r = await enviar({
      type: pincel.modo === 'cobrir' ? 'darkness.add' : 'darkness.reveal',
      forma,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para mexer no breu', text: r.motivo });
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
  const aberta = FERRAMENTAS.find(
    (f) => f.id === painel && (!f.soMestre || mestre) && (!f.comMapa || comMapa),
  );
  const ferramentasVisiveis = FERRAMENTAS.filter((f) => !f.soMestre || mestre);
  const mostrarBarra = Boolean(visao && (mestre || comMapa));
  const resultadoVisivel =
    mesa.ultimoTeste && mesa.ultimoTeste.seq > seqResultadoFechado
      ? mesa.ultimoTeste.registro
      : null;

  return (
    <div className="mesa">
      <header className="mesa-topo">
        <Link className="btn ghost sm" to="/" aria-label="Voltar para a Central">
          <Icon name="back" size="sm" />
        </Link>
        <h1 className="mesa-titulo">{nomeDoCaso ?? 'Mesa'}</h1>
        {visao && <span className="small muted">Rodada {visao.rodada.numero}</span>}
        <span className="grow" />
        {visao && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="dice" size="sm" />}
            aria-pressed={painel === 'dados'}
            onClick={() => {
              setPainel((agora) => (agora === 'dados' ? null : 'dados'));
            }}
          >
            Dados
          </Button>
        )}
        {visao && (
          <Button
            variant="ghost"
            size="sm"
            className="mesa-botao-chat"
            icon={<Icon name="chat" size="sm" />}
            aria-pressed={conversaMovel}
            onClick={() => {
              setConversaMovel((abertaAgora) => !abertaAgora);
            }}
          >
            Chat
          </Button>
        )}
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

      <div className="mesa-corpo">
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
              pincelDoBreu={mestre && aberta?.id === 'breu' ? pincel : null}
              aoDesenharBreu={(forma) => void desenharBreu(forma)}
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

          {visao && <NevoaDaMembrana nivel={visao.nevoa} />}

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

          {visao && resultadoVisivel && (
            <Resultado
              registro={resultadoVisivel}
              papel={visao.papel}
              nomesDePersonagens={nomesDePersonagens}
              aoFechar={() => {
                setSeqResultadoFechado(mesa.ultimoTeste?.seq ?? 0);
              }}
            />
          )}

          {/* Legenda do artboard 11: o mestre vê através, mas o jogador não. */}
          {mestre && ((comMapa && comMapa.breu.length > 0) || visao.nevoa > 0) && (
            <div className="mesa-legenda">
              {comMapa && comMapa.breu.length > 0 && (
                <Chip status="alert">Breu: jogadores veem preto</Chip>
              )}
              {visao.nevoa > 0 && (
                <Chip>{`${descreverNevoa(visao.nevoa)} (${String(visao.nevoa)}%)`}</Chip>
              )}
            </div>
          )}

          {mostrarBarra && (
            <div
              className="tool"
              role="toolbar"
              aria-label={mestre ? 'Ferramentas' : 'Ferramentas do jogador'}
            >
              {ferramentasVisiveis.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={cx('tbtn', f.soMestre && 'gm', painel === f.id && 'on')}
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

          {visao && aberta && (
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
              {aberta.id === 'dados' && (
                <DadosETestes
                  papel={visao.papel}
                  meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                  personagens={personagens}
                  versaoPersonagens={mesa.versaoPersonagens}
                  dtPadrao={detalhe?.dtPadrao}
                  permitirFisico={detalhe?.dadosFisicos !== false}
                  enviar={enviar}
                />
              )}
              {mestre && aberta.id === 'mapa' && (
                <MapaUpload campanhaId={campanhaId} mapaNaMesa={visao.mapa} enviar={enviar} />
              )}
              {mestre && aberta.id === 'tokens' && (
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
              {mestre && aberta.id === 'breu' && comMapa && (
                <FerramentaDoBreu
                  visao={comMapa}
                  pincel={pincel}
                  aoMudarPincel={setPincel}
                  enviar={enviar}
                />
              )}
              {mestre && aberta.id === 'nevoa' && (
                <FerramentaDaNevoa nivel={visao.nevoa} enviar={enviar} />
              )}
              {mestre && aberta.id === 'props' && (
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

        {visao && (
          <aside
            className={cx('mesa-lateral', conversaMovel && 'aberta')}
            aria-label="Chat e registros"
          >
            <Tabs
              idBase={idAbas}
              label="Conversa e registro da sessão"
              dense
              value={aba}
              onChange={trocarAba}
              items={[
                {
                  id: 'chat',
                  label: 'Chat',
                  ...(novosNoChat > 0 && { count: novosNoChat, isNew: true }),
                },
                {
                  id: 'registro',
                  label: 'Registro',
                  ...(novosNoRegistro > 0 && { count: novosNoRegistro, isNew: true }),
                },
              ]}
            />
            <TabPanel idBase={idAbas} id={aba} className="mesa-aba-corpo">
              {aba === 'chat' ? (
                <Chat
                  eventos={eventosRegistrados}
                  meuId={meuId}
                  papel={visao.papel}
                  membros={detalhe?.membros ?? []}
                  personagens={personagens}
                  meuPersonagemNome={detalhe?.meuPersonagem?.nome ?? null}
                  enviar={enviar}
                />
              ) : (
                <Registro
                  eventos={eventosRegistrados}
                  papel={visao.papel}
                  membros={detalhe?.membros ?? []}
                  personagens={personagens}
                />
              )}
            </TabPanel>
          </aside>
        )}
      </div>
    </div>
  );
}
