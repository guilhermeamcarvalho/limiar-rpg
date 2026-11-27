// /campanhas/:id/mesa: a mesa ao vivo (artboards "10 · Mesa" e "11 · Mesa-Mestre"). Tela cheia,
// sem o cabeçalho comum: cabeçalho compacto, painel esquerdo (Você / Ordem da rodada), palco com o
// mapa, cartão de resultado no canto, barra de ferramentas em grupos, e painel direito recolhível
// com Chat, Registro, Pistas e Itens. O estado recolhido dos painéis fica salvo no navegador.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  tituloDaPagina,
  type CampanhaDetalhe,
  type FormaDoBreu,
  type MapaNaMesa,
  type PoiNaMesa,
  type RespostaDoRegistro,
  type VisaoDaMesa,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import { linkDaCampanha } from '../../casos/formatos.ts';
import type { Ponto } from '../../mesa/camera.ts';
import { Chat, filtrarEventosDoChat } from '../../mesa/Chat.tsx';
import { mesclarEventosRegistrados } from '../../mesa/estado.ts';
import { enviarImagemDaMesa, nomeDoArquivoSemExtensao } from '../../mesa/imagens.ts';
import { dentroDoMapa } from '../../mesa/interacao.ts';
import { AbaPistasNaMesa, CartaoPista } from '../../mesa/CartaoPista.tsx';
import { CartaoPoi } from '../../mesa/CartaoPoi.tsx';
import { AbaItens } from '../../mesa/Inventario.tsx';
import { MapaUpload } from '../../mesa/MapaUpload.tsx';
import type { ModoDoPalco } from '../../mesa/medicao.ts';
import { descreverNevoa, NevoaDaMembrana } from '../../mesa/NevoaDaMembrana.tsx';
import type { PincelDoBreu } from '../../mesa/Breu.tsx';
import { FerramentaDoBreu } from '../../mesa/painel/Breu.tsx';
import { DadosETestes } from '../../mesa/painel/DadosETestes.tsx';
import { Jogador } from '../../mesa/painel/Jogador.tsx';
import { FerramentaDaNevoa } from '../../mesa/painel/Nevoa.tsx';
import { NovoProp } from '../../mesa/painel/NovoProp.tsx';
import { Npcs } from '../../mesa/painel/Npcs.tsx';
import { FerramentaDePistas } from '../../mesa/painel/Pistas.tsx';
import { Palco } from '../../mesa/Palco.tsx';
import { filtrarAcontecimentos, Registro } from '../../mesa/Registro.tsx';
import { Resultado } from '../../mesa/Resultado.tsx';
import { FerramentaDeSalas, type TracoDaSala } from '../../mesa/Salas.tsx';
import { CartaoReconectando, FaixaSemConexao } from '../../mesa/SemConexao.tsx';
import { useMesaAoVivo, type SituacaoDaConexao } from '../../mesa/useMesaAoVivo.ts';
import { EditorPoi } from '../../mestre/EditorPoi.tsx';
import { linkDaFicha, primeiroNome } from '../../personagens/formatos.ts';
import {
  Button,
  Chip,
  cx,
  EmptyState,
  Icon,
  TabPanel,
  Tabs,
  RevelacaoDoDado,
  revelacaoDaRolagem,
  revelacaoDoTeste,
  useCarga,
  useToast,
  type NomeDoIcone,
} from '../../ui/index.ts';
import './mesa.css';

type Ferramenta =
  'dados' | 'tokens' | 'props' | 'breu' | 'salas' | 'guia' | 'pistas' | 'nevoa' | 'mapa';
type AbaLateral = 'chat' | 'registro' | 'pistas' | 'itens';

interface PaineisSalvos {
  esquerdo: boolean;
  direito: boolean;
}

const CHAVE_PAINEIS = 'membrana:mesa-paineis';

function lerPaineisSalvos(): PaineisSalvos {
  try {
    const bruto = localStorage.getItem(CHAVE_PAINEIS);
    if (!bruto) return { esquerdo: true, direito: true };
    const lido = JSON.parse(bruto) as Partial<PaineisSalvos>;
    return {
      esquerdo: typeof lido.esquerdo === 'boolean' ? lido.esquerdo : true,
      direito: typeof lido.direito === 'boolean' ? lido.direito : true,
    };
  } catch {
    return { esquerdo: true, direito: true };
  }
}

function salvarPaineis(paineis: PaineisSalvos) {
  try {
    localStorage.setItem(CHAVE_PAINEIS, JSON.stringify(paineis));
  } catch {
    // Armazenamento indisponível não impede de usar a mesa.
  }
}

interface DefinicaoDeFerramenta {
  id: Ferramenta;
  titulo: string;
  tecla: string;
  icone: NomeDoIcone;
  /** Nome curto, escrito embaixo do ícone na barra: ninguém precisa adivinhar o desenho. */
  curto: string;
  rotulo: string;
  soMestre: boolean;
  /** Precisa de um mapa na mesa. */
  comMapa: boolean;
}

// Na barra, as do mestre seguem a ordem de preparar uma sessão: mapa, breu, salas, peças,
// pontos de interesse e, por fim, o clima (névoa).
const FERRAMENTAS: DefinicaoDeFerramenta[] = [
  {
    id: 'dados',
    curto: 'Dados',
    titulo: 'Dados e testes',
    tecla: 'd',
    icone: 'dice',
    rotulo: 'Rolar dados',
    soMestre: false,
    comMapa: false,
  },
  {
    id: 'mapa',
    curto: 'Mapa',
    titulo: 'Mapa e grade',
    tecla: 'g',
    icone: 'grid',
    rotulo: 'Mapa e grade, ferramenta do mestre',
    soMestre: true,
    comMapa: false,
  },
  {
    id: 'breu',
    curto: 'Breu',
    titulo: 'Breu',
    tecla: 'b',
    icone: 'darkness',
    rotulo: 'Breu, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'salas',
    curto: 'Salas',
    titulo: 'Salas',
    tecla: 's',
    icone: 'door',
    rotulo: 'Salas, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'tokens',
    curto: 'Tokens',
    titulo: 'Tokens e NPCs',
    tecla: 't',
    icone: 'token',
    rotulo: 'Tokens e NPCs, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'props',
    curto: 'Props',
    titulo: 'Props',
    tecla: 'o',
    icone: 'image',
    rotulo: 'Props, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'guia',
    curto: 'Pontos',
    titulo: 'Pontos de interesse',
    tecla: 'i',
    icone: 'pin',
    rotulo: 'Pontos de interesse, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'pistas',
    curto: 'Pistas',
    titulo: 'Pistas',
    tecla: 'c',
    icone: 'clue',
    rotulo: 'Pistas, ferramenta do mestre',
    soMestre: true,
    comMapa: true,
  },
  {
    id: 'nevoa',
    curto: 'Névoa',
    titulo: 'Névoa',
    tecla: 'n',
    icone: 'mist',
    rotulo: 'Névoa, ferramenta do mestre',
    soMestre: true,
    // É clima da cena: vale antes mesmo de haver mapa.
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
  const { mesa, situacao, fila, enviar, tentarAgora } = useMesaAoVivo(campanhaId);
  const [painel, setPainel] = useState<Ferramenta | null>(null);
  const [aba, setAba] = useState<AbaLateral>('chat');
  const [paineis, setPaineis] = useState<PaineisSalvos>(lerPaineisSalvos);
  const [esquerdaMovel, setEsquerdaMovel] = useState(false);
  const [conversaMovel, setConversaMovel] = useState(false);
  const [seqVistoChat, setSeqVistoChat] = useState<number | null>(null);
  const [seqVistoRegistro, setSeqVistoRegistro] = useState<number | null>(null);
  const [seqResultadoFechado, setSeqResultadoFechado] = useState(0);
  // O pop-up do resultado: só para quem rolou, e some depois de visto.
  const [seqRevelacaoFechada, setSeqRevelacaoFechada] = useState(0);
  const [escolhendoGrupo, setEscolhendoGrupo] = useState(false);
  const [prepararAberto, setPrepararAberto] = useState(true);
  const [escolhendoPoi, setEscolhendoPoi] = useState<((ponto: Ponto) => void) | null>(null);
  const [escolhendoPista, setEscolhendoPista] = useState<((ponto: Ponto) => void) | null>(null);
  const [poiAbertoId, setPoiAbertoId] = useState<string | null>(null);
  const [pistaAbertaId, setPistaAbertaId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoDoPalco>('mover');
  const [pincel, setPincel] = useState<PincelDoBreu>({ modo: 'cobrir', forma: 'retangulo' });
  const [tracoSala, setTracoSala] = useState<TracoDaSala>('retangulo');
  const [nomeNovaSala, setNomeNovaSala] = useState('');
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
  const rodadasAtivo = detalhe?.rodadas !== false;
  const jaAgiuNaRodada = Boolean(visao?.rodada.agiram.includes(meuId));

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

  function alternarPainel(lado: keyof PaineisSalvos) {
    setPaineis((atual) => {
      const proximo = { ...atual, [lado]: !atual[lado] };
      salvarPaineis(proximo);
      return proximo;
    });
  }

  function trocarAba(nova: AbaLateral) {
    const topoSeq = eventosRegistrados.at(-1)?.seq ?? 0;
    setSeqVistoChat(topoSeq);
    setSeqVistoRegistro(topoSeq);
    setAba(nova);
  }

  useEffect(() => {
    document.title = tituloDaPagina(nomeDoCaso ? `Mesa · ${nomeDoCaso}` : 'Mesa');
  }, [nomeDoCaso]);

  // D abre Dados e testes para qualquer pessoa; T, O, B, N e G abrem as ferramentas do mestre;
  // V, M e P alternam entre Mover, Medir e Marcar ponto quando há mapa.
  useEffect(() => {
    if (!visao) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.key === 'Escape') {
        if (escolhendoGrupo || escolhendoPoi || escolhendoPista || poiAbertoId || pistaAbertaId) {
          setEscolhendoGrupo(false);
          setEscolhendoPoi(null);
          setEscolhendoPista(null);
          setPoiAbertoId(null);
          setPistaAbertaId(null);
        } else if (modo !== 'mover') {
          setModo('mover');
        } else {
          setPainel(null);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (temMapa && (tecla === 'v' || tecla === 'm' || tecla === 'p')) {
        setPainel((aberto) => (aberto === 'breu' || aberto === 'salas' ? null : aberto));
        setModo((agora) => {
          if (tecla === 'v') return 'mover';
          const proximo: ModoDoPalco = tecla === 'm' ? 'medir' : 'marcar';
          return agora === proximo ? 'mover' : proximo;
        });
        return;
      }
      const ferramenta = FERRAMENTAS.find((f) => f.tecla === tecla);
      if (!ferramenta) return;
      if (ferramenta.soMestre && !mestre) return;
      if (ferramenta.comMapa && !temMapa) return;
      setPainel((aberto) => (aberto === ferramenta.id ? null : ferramenta.id));
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [
    visao,
    mestre,
    temMapa,
    escolhendoGrupo,
    escolhendoPoi,
    escolhendoPista,
    poiAbertoId,
    pistaAbertaId,
    modo,
  ]);

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

  /** A forma desenhada no mapa cria uma sala exclusiva do mestre (#82). */
  async function criarSala(area: Ponto[]) {
    const quantidade = visao?.salas?.length ?? 0;
    const nome = nomeNovaSala.trim() || `Sala ${String(quantidade + 1)}`;
    const r = await enviar({ type: 'room.create', nome, area });
    if (r.ok) setNomeNovaSala('');
    else avisos.show({ type: 'err', title: 'Não deu para criar a sala', text: r.motivo });
  }

  async function trazerGrupo(ponto: Ponto) {
    setEscolhendoGrupo(false);
    const r = await enviar({ type: 'token.gather', ...ponto });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para trazer o grupo', text: r.motivo });
  }

  async function marcarPonto(ponto: Ponto) {
    const r = await enviar({ type: 'board.ping', ...ponto });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para marcar o ponto', text: r.motivo });
  }

  async function encerrarRodada() {
    const r = await enviar({ type: 'round.end' });
    if (!r.ok)
      avisos.show({ type: 'err', title: 'Não deu para encerrar a rodada', text: r.motivo });
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
  const modoEfetivo: ModoDoPalco | null =
    !comMapa ||
    escolhendoGrupo ||
    escolhendoPoi !== null ||
    escolhendoPista !== null ||
    aberta?.id === 'breu' ||
    aberta?.id === 'salas'
      ? null
      : modo;
  const ferramentasComuns = FERRAMENTAS.filter((f) => !f.soMestre);
  const ferramentasDoMestre = mestre ? FERRAMENTAS.filter((f) => f.soMestre) : [];
  const mostrarBarra = Boolean(visao && (mestre || comMapa));
  const minhaRevelacao = (() => {
    const teste = mesa.ultimoTeste?.registro.autor?.id === meuId ? mesa.ultimoTeste : null;
    const rolagem = mesa.ultimaRolagem?.autorId === meuId ? mesa.ultimaRolagem : null;
    const ultima =
      teste && (!rolagem || teste.seq > rolagem.seq)
        ? { seq: teste.seq, revelacao: revelacaoDoTeste(teste.registro) }
        : rolagem
          ? { seq: rolagem.seq, revelacao: revelacaoDaRolagem({ chave: rolagem.seq, ...rolagem }) }
          : null;
    return ultima && ultima.seq > seqRevelacaoFechada ? ultima : null;
  })();
  const resultadoVisivel =
    mesa.ultimoTeste && mesa.ultimoTeste.seq > seqResultadoFechado
      ? mesa.ultimoTeste.registro
      : null;

  return (
    <div className="mesa">
      <header className="mesa-topo">
        <Link
          className="btn ghost sm"
          to="/"
          aria-label="Voltar para a Central"
          title="Voltar para a Central"
        >
          <Icon name="back" size="sm" />
        </Link>
        <div className="row mesa-titulo-linha">
          <h1 className="mesa-titulo">{nomeDoCaso ?? 'Mesa'}</h1>
          {mestre && <span className="mesa-selo-mestre">Mestre</span>}
          {!mestre && visao && rodadasAtivo && (
            <span className="small muted">· {jaAgiuNaRodada ? 'ação usada' : 'sua vez'}</span>
          )}
        </div>

        {visao && (
          <div className="row mesa-rodada-pilula">
            <span className="small muted">Rodada {visao.rodada.numero}</span>
            {mestre && (
              <>
                <span className="mesa-rodada-divisor" aria-hidden="true" />
                <button
                  type="button"
                  className="mesa-rodada-btn"
                  onClick={() => void encerrarRodada()}
                >
                  <Icon name="flag" size="sm" />
                  Encerrar rodada
                </button>
              </>
            )}
          </div>
        )}

        <span className="grow" />

        {visao && (
          <Button
            variant="ghost"
            size="sm"
            className="mesa-botao-esquerda"
            icon={<Icon name="user" size="sm" />}
            aria-pressed={esquerdaMovel}
            onClick={() => {
              setEsquerdaMovel((abertaAgora) => !abertaAgora);
              setConversaMovel(false);
            }}
          >
            {mestre ? 'Grupo' : 'Você'}
          </Button>
        )}
        {visao && (
          <Button
            variant="ghost"
            size="sm"
            className="mesa-botao-dados"
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
              setEsquerdaMovel(false);
            }}
          >
            Chat
          </Button>
        )}
        {mestre && (
          <Link className="btn sm mesa-link-topo" to={linkDaCampanha(campanhaId, 'escudo')}>
            <Icon name="shield" size="sm" />
            Escudo
          </Link>
        )}
        {!mestre && detalhe?.meuPersonagem && (
          <Link className="btn sm mesa-link-topo" to={linkDaFicha(detalhe.meuPersonagem.id)}>
            <Icon name="user" size="sm" />
            Ficha de {primeiroNome(detalhe.meuPersonagem.nome) || detalhe.meuPersonagem.nome}
          </Link>
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
        <FaixaSemConexao
          tentativa={situacao.tentativa}
          emSegundos={situacao.emSegundos}
          aoTentarAgora={tentarAgora}
        />
      )}

      <div className="mesa-corpo">
        {visao &&
          (paineis.esquerdo ? (
            <aside
              className={cx('pnl mesa-esquerda', esquerdaMovel && 'aberta')}
              aria-label={mestre ? 'Grupo e ordem' : 'Você e o grupo'}
            >
              <div className="pnl-h">
                <span className="lab">{mestre ? 'Grupo' : 'Você'}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="back" size="sm" />}
                  aria-label="Recolher painel esquerdo"
                  onClick={() => {
                    alternarPainel('esquerdo');
                    setEsquerdaMovel(false);
                  }}
                />
              </div>
              <div className="pnl-b">
                <Jogador
                  campanhaId={campanhaId}
                  papel={visao.papel}
                  meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                  versaoPersonagens={mesa.versaoPersonagens}
                  dtPadrao={detalhe?.dtPadrao}
                  rodadas={rodadasAtivo}
                  rodada={visao.rodada}
                  membros={detalhe?.membros ?? []}
                  personagens={personagens}
                  online={mesa.online}
                  enviar={enviar}
                  aoAbrirDadosAvulsos={() => {
                    setPainel('dados');
                    setEsquerdaMovel(false);
                  }}
                />
              </div>
            </aside>
          ) : (
            <>
              <div className="pnl-tg">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="next" size="sm" />}
                  aria-label="Expandir painel esquerdo"
                  title="Expandir painel esquerdo"
                  onClick={() => {
                    alternarPainel('esquerdo');
                  }}
                />
              </div>
              {esquerdaMovel && (
                <aside
                  className="pnl mesa-esquerda aberta"
                  aria-label={mestre ? 'Grupo e ordem' : 'Você e o grupo'}
                >
                  <div className="pnl-h">
                    <span className="lab">{mestre ? 'Grupo' : 'Você'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="close" size="sm" />}
                      aria-label="Fechar painel esquerdo"
                      onClick={() => {
                        setEsquerdaMovel(false);
                      }}
                    />
                  </div>
                  <div className="pnl-b">
                    <Jogador
                      campanhaId={campanhaId}
                      papel={visao.papel}
                      meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                      versaoPersonagens={mesa.versaoPersonagens}
                      dtPadrao={detalhe?.dtPadrao}
                      rodadas={rodadasAtivo}
                      rodada={visao.rodada}
                      membros={detalhe?.membros ?? []}
                      personagens={personagens}
                      online={mesa.online}
                      enviar={enviar}
                      aoAbrirDadosAvulsos={() => {
                        setPainel('dados');
                        setEsquerdaMovel(false);
                      }}
                    />
                  </div>
                </aside>
              )}
            </>
          ))}

        <section
          className={cx('mesa-palco', situacao.estado === 'caiu' && visao && 'offline')}
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
              aoEscolherPonto={
                escolhendoGrupo
                  ? (ponto) => void trazerGrupo(ponto)
                  : escolhendoPoi
                    ? (ponto) => {
                        const aoClicar = escolhendoPoi;
                        setEscolhendoPoi(null);
                        aoClicar(ponto);
                      }
                    : escolhendoPista
                      ? (ponto) => {
                          const aoClicar = escolhendoPista;
                          setEscolhendoPista(null);
                          aoClicar(ponto);
                        }
                      : null
              }
              aoSoltarImagem={(arquivo, ponto) => void aoSoltarImagem(arquivo, ponto, comMapa)}
              pincelDoBreu={mestre && aberta?.id === 'breu' ? pincel : null}
              aoDesenharBreu={(forma) => void desenharBreu(forma)}
              tracoDaSala={mestre && aberta?.id === 'salas' ? tracoSala : null}
              aoDesenharSala={(area) => void criarSala(area)}
              modo={modoEfetivo ?? 'mover'}
              ultimoPulso={mesa.ultimoPulso}
              aoMarcarPonto={(ponto) => void marcarPonto(ponto)}
              aoAbrirPoi={(id) => {
                setPistaAbertaId(null);
                setPoiAbertoId(id);
              }}
              aoAbrirPista={(id) => {
                setPoiAbertoId(null);
                setPistaAbertaId(id);
              }}
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

          {situacao.estado === 'caiu' && visao && (
            <CartaoReconectando
              tentativa={situacao.tentativa}
              emSegundos={situacao.emSegundos}
              fila={fila}
              aoTentarAgora={tentarAgora}
            />
          )}

          {/* Flutua sobre o mapa: uma faixa no fluxo empurraria o mapa bem na hora do clique. */}
          {(escolhendoGrupo || escolhendoPoi || escolhendoPista) && (
            <div className="mesa-dica" role="status">
              <span className="small">
                {escolhendoGrupo
                  ? 'Clique no mapa onde o grupo deve ficar.'
                  : escolhendoPoi
                    ? 'Clique no mapa onde o ponto de interesse deve ficar.'
                    : 'Clique no mapa onde a pista deve ficar.'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEscolhendoGrupo(false);
                  setEscolhendoPoi(null);
                  setEscolhendoPista(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          )}

          {visao &&
            poiAbertoId &&
            (() => {
              const poiAberto = visao.pois.find((p) => p.id === poiAbertoId);
              if (!poiAberto) return null;
              const novas =
                mesa.ultimasDescobertas?.poiId === poiAberto.id
                  ? mesa.ultimasDescobertas.infoIds
                  : [];
              return (
                <CartaoPoi
                  poi={poiAberto}
                  papel={visao.papel}
                  meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                  novasInfoIds={novas}
                  enviar={enviar}
                  aoFechar={() => {
                    setPoiAbertoId(null);
                  }}
                />
              );
            })()}

          {visao &&
            comMapa &&
            pistaAbertaId &&
            (() => {
              const pistaAberta = visao.pistas.find((p) => p.id === pistaAbertaId);
              if (!pistaAberta) return null;
              const meuToken = visao.tokens.find((t) => t.donoId === meuId);
              return (
                <CartaoPista
                  pista={pistaAberta}
                  papel={visao.papel}
                  meuToken={meuToken}
                  celula={comMapa.mapa.grade.celula}
                  inventario={visao.inventario}
                  personagens={personagens}
                  enviar={enviar}
                  aoFechar={() => {
                    setPistaAbertaId(null);
                  }}
                />
              );
            })()}

          {minhaRevelacao && (
            <RevelacaoDoDado
              key={minhaRevelacao.seq}
              revelacao={minhaRevelacao.revelacao}
              aoFechar={() => {
                setSeqRevelacaoFechada(minhaRevelacao.seq);
              }}
            />
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
              aria-orientation="vertical"
            >
              <span className="tool-grupo" aria-hidden="true">
                Jogar
              </span>
              <button
                type="button"
                className={cx('tbtn', modoEfetivo === 'mover' && 'on')}
                aria-pressed={modoEfetivo === 'mover'}
                aria-label={mestre ? 'Mover' : 'Mover meu token'}
                title="Mover peças e o mapa (tecla V)"
                disabled={!comMapa}
                onClick={() => {
                  setPainel((agora) => (agora === 'breu' ? null : agora));
                  setModo('mover');
                }}
              >
                <Icon name="hand" />
              </button>
              <button
                type="button"
                className={cx('tbtn', modoEfetivo === 'medir' && 'on')}
                aria-pressed={modoEfetivo === 'medir'}
                aria-label="Medir distância"
                title="Medir distância: 1 quadrado = 1,5 m (tecla M)"
                disabled={!comMapa}
                onClick={() => {
                  setPainel((agora) => (agora === 'breu' ? null : agora));
                  setModo((agora) => (agora === 'medir' ? 'mover' : 'medir'));
                }}
              >
                <Icon name="ruler" />
              </button>
              <button
                type="button"
                className={cx('tbtn', modoEfetivo === 'marcar' && 'on')}
                aria-pressed={modoEfetivo === 'marcar'}
                aria-label="Marcar um ponto para todos"
                title="Marcar um ponto: todos veem um pulso (tecla P)"
                disabled={!comMapa}
                onClick={() => {
                  setPainel((agora) => (agora === 'breu' ? null : agora));
                  setModo((agora) => (agora === 'marcar' ? 'mover' : 'marcar'));
                }}
              >
                <Icon name="target" />
              </button>
              {ferramentasComuns.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={cx('tbtn', painel === f.id && 'on')}
                  aria-pressed={painel === f.id}
                  aria-label={f.rotulo}
                  title={`${f.titulo} (tecla ${f.tecla.toUpperCase()})`}
                  disabled={f.comMapa && !comMapa}
                  onClick={() => {
                    setPainel((agora) => (agora === f.id ? null : f.id));
                  }}
                >
                  <Icon name={f.icone} />
                </button>
              ))}
              {ferramentasDoMestre.length > 0 && (
                <button
                  type="button"
                  className="tool-grupo tool-grupo-btn"
                  aria-expanded={prepararAberto}
                  title={
                    prepararAberto
                      ? 'Recolher ferramentas de preparação'
                      : 'Mostrar ferramentas de preparação'
                  }
                  onClick={() => {
                    setPrepararAberto((v) => !v);
                  }}
                >
                  <span>Preparar</span>
                  <Icon name={prepararAberto ? 'down' : 'next'} size="sm" />
                </button>
              )}
              {prepararAberto &&
                ferramentasDoMestre.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cx('tbtn gm', painel === f.id && 'on')}
                    aria-pressed={painel === f.id}
                    aria-label={f.rotulo}
                    title={
                      f.comMapa && !comMapa
                        ? `${f.titulo}: ponha um mapa na mesa primeiro`
                        : `${f.titulo} (tecla ${f.tecla.toUpperCase()})`
                    }
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
              {mestre && aberta.id === 'salas' && comMapa && (
                <FerramentaDeSalas
                  salas={visao.salas ?? []}
                  traco={tracoSala}
                  nomeNovaSala={nomeNovaSala}
                  aoMudarTraco={setTracoSala}
                  aoMudarNomeNovaSala={setNomeNovaSala}
                  enviar={enviar}
                />
              )}
              {mestre && aberta.id === 'guia' && (
                <EditorPoi
                  salas={visao.salas ?? []}
                  pois={visao.pois.filter((p): p is PoiNaMesa => 'contextoMestre' in p)}
                  temMapa={Boolean(comMapa)}
                  aoExecutar={enviar}
                  aoEscolherNoMapa={(aoClicar) => {
                    setEscolhendoPoi(() => aoClicar);
                  }}
                />
              )}
              {mestre && aberta.id === 'pistas' && (
                <FerramentaDePistas
                  campanhaId={campanhaId}
                  pistas={visao.pistas.filter((p) => 'notaMestre' in p)}
                  inventario={visao.inventario}
                  personagens={personagens}
                  temMapa={Boolean(comMapa)}
                  enviar={enviar}
                  centroRef={centroRef}
                  aoEscolherNoMapa={(aoClicar) => {
                    setEscolhendoPista(() => aoClicar);
                  }}
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

        {visao &&
          (paineis.direito ? (
            <aside
              className={cx('pnl r mesa-lateral', conversaMovel && 'aberta')}
              aria-label="Chat e registros"
            >
              <div className="mesa-lateral-topo">
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
                    {
                      id: 'pistas',
                      label: 'Pistas',
                      ...(visao.inventario.length > 0 && { count: visao.inventario.length }),
                    },
                    { id: 'itens', label: 'Itens' },
                  ]}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="next" size="sm" />}
                  aria-label="Recolher painel direito"
                  title="Recolher painel"
                  onClick={() => {
                    alternarPainel('direito');
                    setConversaMovel(false);
                  }}
                />
              </div>
              <TabPanel idBase={idAbas} id={aba} className="mesa-aba-corpo">
                {aba === 'chat' && (
                  <Chat
                    eventos={eventosRegistrados}
                    meuId={meuId}
                    papel={visao.papel}
                    membros={detalhe?.membros ?? []}
                    personagens={personagens}
                    meuPersonagemNome={detalhe?.meuPersonagem?.nome ?? null}
                    enviar={enviar}
                  />
                )}
                {aba === 'registro' && (
                  <Registro
                    eventos={eventosRegistrados}
                    papel={visao.papel}
                    membros={detalhe?.membros ?? []}
                    personagens={personagens}
                  />
                )}
                {aba === 'pistas' && (
                  <AbaPistasNaMesa
                    inventario={visao.inventario}
                    papel={visao.papel}
                    meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                    nomesDePersonagens={nomesDePersonagens}
                    enviar={enviar}
                  />
                )}
                {aba === 'itens' && (
                  <AbaItens
                    personagemId={detalhe?.meuPersonagem?.id ?? null}
                    versao={
                      detalhe?.meuPersonagem
                        ? (mesa.versaoPersonagens[detalhe.meuPersonagem.id] ?? 0)
                        : 0
                    }
                  />
                )}
              </TabPanel>
            </aside>
          ) : (
            <>
              <div className="pnl-tg r">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="back" size="sm" />}
                  aria-label="Expandir painel direito"
                  title="Expandir painel direito"
                  onClick={() => {
                    alternarPainel('direito');
                  }}
                />
              </div>
              {conversaMovel && (
                <aside className="pnl r mesa-lateral aberta" aria-label="Chat e registros">
                  <div className="mesa-lateral-topo">
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
                        {
                          id: 'pistas',
                          label: 'Pistas',
                          ...(visao.inventario.length > 0 && { count: visao.inventario.length }),
                        },
                        { id: 'itens', label: 'Itens' },
                      ]}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="close" size="sm" />}
                      aria-label="Fechar painel direito"
                      onClick={() => {
                        setConversaMovel(false);
                      }}
                    />
                  </div>
                  <TabPanel idBase={idAbas} id={aba} className="mesa-aba-corpo">
                    {aba === 'chat' && (
                      <Chat
                        eventos={eventosRegistrados}
                        meuId={meuId}
                        papel={visao.papel}
                        membros={detalhe?.membros ?? []}
                        personagens={personagens}
                        meuPersonagemNome={detalhe?.meuPersonagem?.nome ?? null}
                        enviar={enviar}
                      />
                    )}
                    {aba === 'registro' && (
                      <Registro
                        eventos={eventosRegistrados}
                        papel={visao.papel}
                        membros={detalhe?.membros ?? []}
                        personagens={personagens}
                      />
                    )}
                    {aba === 'pistas' && (
                      <AbaPistasNaMesa
                        inventario={visao.inventario}
                        papel={visao.papel}
                        meuPersonagemId={detalhe?.meuPersonagem?.id ?? null}
                        nomesDePersonagens={nomesDePersonagens}
                        enviar={enviar}
                      />
                    )}
                    {aba === 'itens' && (
                      <AbaItens
                        personagemId={detalhe?.meuPersonagem?.id ?? null}
                        versao={
                          detalhe?.meuPersonagem
                            ? (mesa.versaoPersonagens[detalhe.meuPersonagem.id] ?? 0)
                            : 0
                        }
                      />
                    )}
                  </TabPanel>
                </aside>
              )}
            </>
          ))}
      </div>
    </div>
  );
}
