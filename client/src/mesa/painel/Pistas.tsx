// Painel da ferramenta Pistas do mestre (#87; RF-40, RF-41, RF-42):
// cria pistas no mapa (com título, texto para o jogador, foto enviada ou ilustração genérica,
// tamanho no mapa, nota secreta do mestre e visibilidade), edita ou apaga, e envia ou recolhe
// do inventário de cada personagem.
import { useRef, useState, type RefObject } from 'react';
import {
  CATEGORIAS_DE_PISTAS,
  PISTAS_PRONTAS,
  type ComandoDaMesa,
  type ItemDoInventario,
  type MapaNaMesa,
  type PersonagemNaMesa,
  type PistaNaMesa,
  type RespostaDoComando,
} from '@membrana/shared';
import type { Ponto } from '../camera.ts';
import { enviarImagemDaMesa } from '../imagens.ts';
import { ImagemDaPista } from '../ImagemDaPista.tsx';
import { urlDaImagem } from '../prontos.ts';
import { MiniMapaSeletor } from '../../mestre/MiniMapaSeletor.tsx';
import {
  Button,
  Checkbox,
  cx,
  Field,
  Icon,
  Input,
  Modal,
  Select,
  Tag,
  Textarea,
  useEnvio,
  useToast,
} from '../../ui/index.ts';
import { SeletorDePronto } from './SeletorDePronto.tsx';

const TAMANHOS_DE_PISTA = [
  { valor: '0.5', rotulo: '0.5× · Pequena' },
  { valor: '1', rotulo: '1× · Padrão' },
  { valor: '1.5', rotulo: '1.5× · Média' },
  { valor: '2', rotulo: '2× · Grande' },
  { valor: '3', rotulo: '3× · Enorme' },
  { valor: '4', rotulo: '4× · Muito grande' },
] as const;

const nomeDaPistaPronta = (id: string | null | undefined) =>
  PISTAS_PRONTAS.find((p) => p.id === id)?.nome ?? '';

type FiltroDePistaNoPainel = 'todas' | 'visiveis' | 'ocultas';

function EdicaoDaPista({
  campanhaId,
  pista,
  atualizar,
}: {
  campanhaId: string;
  pista: PistaNaMesa;
  atualizar: (
    campos: Omit<Extract<ComandoDaMesa, { type: 'clue.update' }>, 'type' | 'pistaId'>,
  ) => Promise<void>;
}) {
  const avisos = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [escolhendoGenerica, setEscolhendoGenerica] = useState(false);
  const [titulo, setTitulo] = useState(pista.titulo);
  const [texto, setTexto] = useState(pista.texto);
  const [notaMestre, setNotaMestre] = useState(pista.notaMestre);

  const envioFoto = useEnvio(async (escolhido: File) => {
    const r = await enviarImagemDaMesa(campanhaId, escolhido, 'pista');
    if (!r.ok) {
      avisos.show({ type: 'err', title: r.titulo, text: r.texto });
      return;
    }
    setEscolhendoGenerica(false);
    await atualizar({ imagem: r.nome });
  });

  function salvarTexto() {
    const limpo = titulo.trim();
    if (!limpo) return;
    if (limpo === pista.titulo && texto === pista.texto && notaMestre === pista.notaMestre) return;
    void atualizar({ titulo: limpo, texto, notaMestre });
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <Field label="Título">
        <Input
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
          }}
          onBlur={salvarTexto}
        />
      </Field>
      <Field label="Texto para o jogador">
        <Textarea
          rows={2}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
          }}
          onBlur={salvarTexto}
        />
      </Field>

      <div className="col" style={{ gap: 6 }}>
        <span className="lab">Imagem da pista (opcional)</span>
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          aria-label={`Enviar foto para ${pista.titulo}`}
          onChange={(e) => {
            const escolhido = e.target.files?.[0];
            e.target.value = '';
            if (escolhido) void envioFoto.enviar(escolhido);
          }}
        />
        <div className="row wrapx" style={{ gap: 6 }}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="image" size="sm" />}
            aria-expanded={escolhendoGenerica}
            onClick={() => {
              setEscolhendoGenerica((v) => !v);
            }}
          >
            {nomeDaPistaPronta(pista.imagem)
              ? `Genérica: ${nomeDaPistaPronta(pista.imagem)}`
              : 'Escolher genérica'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="upload" size="sm" />}
            loading={envioFoto.enviando}
            onClick={() => arquivo.current?.click()}
          >
            Enviar foto
          </Button>
          {pista.imagem && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEscolhendoGenerica(false);
                void atualizar({ imagem: null });
              }}
            >
              Sem imagem
            </Button>
          )}
        </div>
        {escolhendoGenerica && (
          <SeletorDePronto
            itens={PISTAS_PRONTAS}
            categorias={CATEGORIAS_DE_PISTAS}
            rotulo="Ilustrações genéricas de pista"
            escolhido={pista.imagem ?? null}
            aoEscolher={(id) => {
              setEscolhendoGenerica(false);
              void atualizar({ imagem: id });
            }}
          />
        )}
      </div>

      <Field label="Tamanho no mapa">
        <Select
          value={String(pista.tamanho ?? 1)}
          onChange={(e) => {
            void atualizar({ tamanho: Number(e.target.value) });
          }}
        >
          {TAMANHOS_DE_PISTA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </Select>
      </Field>

      <Checkbox
        label="Manter visível no mapa após examinada"
        checked={Boolean(pista.manterVisivel)}
        onChange={() => {
          void atualizar({ manterVisivel: !pista.manterVisivel });
        }}
      />

      <Field label="Nota do mestre (secreta)">
        <Textarea
          rows={2}
          placeholder="Só você lê este campo…"
          value={notaMestre}
          onChange={(e) => {
            setNotaMestre(e.target.value);
          }}
          onBlur={salvarTexto}
        />
      </Field>
    </div>
  );
}

function CartaoDaPistaNoPainel({
  campanhaId,
  pista,
  inventario,
  personagens,
  enviar,
}: {
  campanhaId: string;
  pista: PistaNaMesa;
  inventario: readonly ItemDoInventario[];
  personagens: readonly PersonagemNaMesa[];
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [aberto, setAberto] = useState(false);

  const possesDesta = inventario.filter((i) => i.pistaId === pista.id);

  async function atualizar(
    campos: Omit<Extract<ComandoDaMesa, { type: 'clue.update' }>, 'type' | 'pistaId'>,
  ) {
    const r = await enviar({ type: 'clue.update', pistaId: pista.id, ...campos });
    if (!r.ok)
      avisos.show({ type: 'err', title: 'Não deu para atualizar a pista', text: r.motivo });
  }

  async function alternarPosse(personagemId: string, temAgora: boolean) {
    const r = await enviar({
      type: temAgora ? 'clue.revoke' : 'clue.send',
      pistaId: pista.id,
      personagemId,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu', text: r.motivo });
  }

  return (
    <div className="mesa-bloco card col" style={{ gap: 8, padding: 10 }}>
      <div className="row between" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 6, minWidth: 0 }}>
          <Tag {...(pista.visivel && { tone: 'gold' as const })}>
            {pista.visivel ? 'Visível' : 'Oculta'}
          </Tag>
          <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pista.titulo}
          </b>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Editar pista ${pista.titulo}`}
            aria-expanded={aberto}
            onClick={() => {
              setAberto((v) => !v);
            }}
          >
            {aberto ? 'Fechar' : 'Editar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="trash" size="sm" />}
            aria-label={`Remover pista ${pista.titulo}`}
            onClick={() => {
              void enviar({ type: 'clue.delete', pistaId: pista.id }).then((r) => {
                if (!r.ok)
                  avisos.show({ type: 'err', title: 'Não deu para remover', text: r.motivo });
              });
            }}
          />
        </div>
      </div>

      {pista.imagem && <ImagemDaPista imagem={pista.imagem} titulo={pista.titulo} compacta />}

      <Checkbox
        label="Visível no mapa para os jogadores"
        checked={pista.visivel}
        onChange={() => {
          void atualizar({ visivel: !pista.visivel });
        }}
      />

      {personagens.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="lab">Com quem está (clique para enviar ou recolher)</span>
          <div className="prontos-categorias">
            {personagens.map((p) => {
              const posse = possesDesta.find((i) => i.personagemId === p.id);
              const tem = Boolean(posse);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cx('chip', tem && 'on')}
                  aria-pressed={tem}
                  aria-label={
                    tem
                      ? `Recolher pista ${pista.titulo} de ${p.nome}`
                      : `Enviar pista ${pista.titulo} para ${p.nome}`
                  }
                  onClick={() => {
                    void alternarPosse(p.id, tem);
                  }}
                >
                  {p.nome}
                  {posse?.apresentada ? ' · apresentada' : tem ? ' · guardada' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {aberto && (
        <EdicaoDaPista
          key={`${pista.id}-${pista.titulo}-${pista.texto}-${pista.notaMestre}`}
          campanhaId={campanhaId}
          pista={pista}
          atualizar={atualizar}
        />
      )}
    </div>
  );
}

export function FerramentaDePistas({
  campanhaId,
  pistas,
  inventario,
  personagens,
  temMapa,
  mapa = null,
  enviar,
  aoEscolherNoMapa,
  centroRef,
  centroPadrao,
  criarEmModal = false,
}: {
  campanhaId: string;
  pistas: readonly PistaNaMesa[];
  inventario: readonly ItemDoInventario[];
  personagens: readonly PersonagemNaMesa[];
  temMapa: boolean;
  mapa?: MapaNaMesa | null;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  aoEscolherNoMapa?: (aoClicar: (ponto: Ponto) => void) => void;
  centroRef?: RefObject<Ponto | null>;
  centroPadrao?: Ponto;
  criarEmModal?: boolean;
}) {
  const avisos = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [notaMestre, setNotaMestre] = useState('');
  const [tamanho, setTamanho] = useState('1');
  const [visivel, setVisivel] = useState(false);
  const [manterVisivel, setManterVisivel] = useState(false);
  const [modelo, setModelo] = useState<string | null>(null);
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [escolhendoModelo, setEscolhendoModelo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDePistaNoPainel>('todas');
  const [pontoModal, setPontoModal] = useState<Ponto>(
    centroPadrao ?? { x: mapa ? mapa.largura / 2 : 200, y: mapa ? mapa.altura / 2 : 200 },
  );

  function escolherModelo(id: string) {
    const anterior = nomeDaPistaPronta(modelo);
    setModelo(id);
    setArquivoFoto(null);
    setEscolhendoModelo(false);
    if (!titulo.trim() || titulo === anterior) setTitulo(nomeDaPistaPronta(id));
  }

  async function criarEm(ponto: Ponto) {
    if (criando) return;
    setCriando(true);
    try {
      let imagem: string | undefined = modelo ?? undefined;
      if (arquivoFoto) {
        const up = await enviarImagemDaMesa(campanhaId, arquivoFoto, 'pista');
        if (!up.ok) {
          avisos.show({ type: 'err', title: up.titulo, text: up.texto });
          return;
        }
        imagem = up.nome;
      }
      const limpo = titulo.trim() || `Pista ${String(pistas.length + 1)}`;
      const r = await enviar({
        type: 'clue.create',
        titulo: limpo,
        texto: texto.trim(),
        ...(imagem && { imagem }),
        ...(Number(tamanho) !== 1 && { tamanho: Number(tamanho) }),
        ...(manterVisivel && { manterVisivel: true }),
        notaMestre: notaMestre.trim(),
        x: ponto.x,
        y: ponto.y,
        visivel,
      });
      if (r.ok) {
        setTitulo('');
        setTexto('');
        setNotaMestre('');
        setTamanho('1');
        setManterVisivel(false);
        setModelo(null);
        setArquivoFoto(null);
        setEscolhendoModelo(false);
        setModalAberto(false);
      } else {
        avisos.show({ type: 'err', title: 'Não deu para criar a pista', text: r.motivo });
      }
    } finally {
      setCriando(false);
    }
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = pistas.filter((p) => {
    if (filtro === 'visiveis' && !p.visivel) return false;
    if (filtro === 'ocultas' && p.visivel) return false;
    if (!termo) return true;
    return p.titulo.toLowerCase().includes(termo) || p.texto.toLowerCase().includes(termo);
  });

  const formularioNovaPista = (
    <div className="col" style={{ gap: 8 }}>
      <Field label="Título da nova pista">
        <Input
          placeholder="Ex.: Fita 33, Chave do porão…"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
          }}
        />
      </Field>
      <Field label="Texto para o jogador">
        <Textarea
          rows={2}
          placeholder="O que o jogador lê quando guarda ou recebe a pista…"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
          }}
        />
      </Field>

      <div className="col" style={{ gap: 6 }}>
        <span className="lab">Imagem da pista (opcional)</span>
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          aria-label="Foto da nova pista"
          onChange={(e) => {
            const escolhido = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (escolhido) {
              if (titulo === nomeDaPistaPronta(modelo)) setTitulo('');
              setModelo(null);
              setEscolhendoModelo(false);
              setArquivoFoto(escolhido);
            }
          }}
        />
        <div className="row wrapx" style={{ gap: 6 }}>
          {modelo && <img className="pista-previa-mini" src={urlDaImagem(modelo)} alt="" />}
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="image" size="sm" />}
            aria-expanded={escolhendoModelo}
            onClick={() => {
              setEscolhendoModelo((v) => !v);
            }}
          >
            {modelo ? `Genérica: ${nomeDaPistaPronta(modelo)}` : 'Ilustração genérica'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="upload" size="sm" />}
            onClick={() => arquivo.current?.click()}
          >
            {arquivoFoto ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {(modelo || arquivoFoto) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (titulo === nomeDaPistaPronta(modelo)) setTitulo('');
                setModelo(null);
                setArquivoFoto(null);
              }}
            >
              Sem imagem
            </Button>
          )}
        </div>
        {arquivoFoto && <span className="small muted mesa-arquivo">{arquivoFoto.name}</span>}
        {escolhendoModelo && (
          <SeletorDePronto
            itens={PISTAS_PRONTAS}
            categorias={CATEGORIAS_DE_PISTAS}
            rotulo="Ilustrações genéricas de pista"
            escolhido={modelo}
            aoEscolher={escolherModelo}
          />
        )}
      </div>

      <Field label="Tamanho no mapa">
        <Select
          value={tamanho}
          onChange={(e) => {
            setTamanho(e.target.value);
          }}
        >
          {TAMANHOS_DE_PISTA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </Select>
      </Field>

      {criarEmModal && mapa && (
        <MiniMapaSeletor
          mapa={mapa}
          ponto={pontoModal}
          aoMudar={setPontoModal}
          rotulo="Posição da pista no mapa"
        />
      )}

      <Field label="Nota do mestre (secreta)">
        <Textarea
          rows={2}
          placeholder="Contexto só para você…"
          value={notaMestre}
          onChange={(e) => {
            setNotaMestre(e.target.value);
          }}
        />
      </Field>
      <Checkbox
        label="Já colocar visível no mapa"
        checked={visivel}
        onChange={() => {
          setVisivel((v) => !v);
        }}
      />
      <Checkbox
        label="Manter visível no mapa após examinada"
        checked={manterVisivel}
        onChange={() => {
          setManterVisivel((v) => !v);
        }}
      />
      <div className="row wrapx" style={{ gap: 6 }}>
        {aoEscolherNoMapa && (
          <Button
            size="sm"
            variant="primary"
            icon={<Icon name="clue" size="sm" />}
            loading={criando}
            onClick={() => {
              aoEscolherNoMapa((ponto) => {
                void criarEm(ponto);
              });
            }}
          >
            Marcar no mapa
          </Button>
        )}
        <Button
          size="sm"
          {...(!aoEscolherNoMapa && { variant: 'primary' as const })}
          icon={aoEscolherNoMapa ? undefined : <Icon name="clue" size="sm" />}
          loading={criando}
          onClick={() => {
            void criarEm(
              criarEmModal && mapa
                ? pontoModal
                : (centroRef?.current ?? centroPadrao ?? { x: 200, y: 200 }),
            );
          }}
        >
          {aoEscolherNoMapa ? 'Pôr no centro' : 'Adicionar pista no mapa'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="small muted">
        Coloque pistas no mapa ou envie direto ao inventário de quem as encontrou. Notas do mestre e
        pistas ocultas nunca saem para os jogadores.
      </p>

      {temMapa &&
        (criarEmModal ? (
          <>
            <div className="row">
              <Button
                size="sm"
                variant="primary"
                icon={<Icon name="plus" size="sm" />}
                onClick={() => {
                  if (mapa) setPontoModal({ x: mapa.largura / 2, y: mapa.altura / 2 });
                  setModalAberto(true);
                }}
              >
                Adicionar pista
              </Button>
            </div>
            <Modal
              open={modalAberto}
              onClose={() => {
                setModalAberto(false);
              }}
              title="Nova pista"
            >
              {formularioNovaPista}
            </Modal>
          </>
        ) : (
          formularioNovaPista
        ))}

      {!temMapa && <p className="small muted">Ative um mapa na mesa para cadastrar pistas nele.</p>}

      <div className="col" style={{ gap: 8 }}>
        <span className="lab">Pistas neste mapa ({pistas.length})</span>
        {pistas.length > 2 && (
          <div className="col" style={{ gap: 6 }}>
            <Input
              aria-label="Buscar pista neste mapa"
              placeholder="Buscar pista…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
              }}
            />
            <div className="prontos-categorias">
              {(
                [
                  { id: 'todas', rotulo: 'Todas' },
                  { id: 'visiveis', rotulo: 'Visíveis' },
                  { id: 'ocultas', rotulo: 'Ocultas' },
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
        {pistas.length === 0 ? (
          <p className="small muted">Nenhuma pista neste mapa ainda.</p>
        ) : filtradas.length === 0 ? (
          <p className="small muted">Nenhuma pista encontrada com esse filtro.</p>
        ) : (
          filtradas.map((pista) => (
            <CartaoDaPistaNoPainel
              key={pista.id}
              campanhaId={campanhaId}
              pista={pista}
              inventario={inventario}
              personagens={personagens}
              enviar={enviar}
            />
          ))
        )}
      </div>
    </div>
  );
}
