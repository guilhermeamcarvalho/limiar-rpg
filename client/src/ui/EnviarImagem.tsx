// Foto e token do personagem (RF-10, artboard Ficha). A foto sobe como veio; o servidor tira os
// metadados e converte. O token é um quadrado recortado aqui, da foto do personagem ("Usar a foto")
// ou de outra imagem, e o servidor recorta igual a partir das frações do quadrado.
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import {
  LIMITE_DA_IMAGEM,
  urlDoArquivo,
  type Personagem,
  type Recorte,
  type TipoDeImagem,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import { Button } from './Button.tsx';
import { Avatar, Banner } from './Display.tsx';
import { Icon } from './Icon.tsx';
import { Modal } from './Overlay.tsx';

/** Os formatos que o servidor aceita. GIF animado ele recusa (o navegador não sabe dizer). */
export const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const MB = Math.round(LIMITE_DA_IMAGEM / (1024 * 1024));

/** Confere antes de enviar o que dá para conferir no navegador: tamanho e tipo. */
export function problemaDoArquivo(arquivo: File): string | null {
  if (!TIPOS_ACEITOS.split(',').includes(arquivo.type)) {
    return 'Este arquivo não é uma imagem que dê para usar. Envie um JPG, PNG ou WebP.';
  }
  if (arquivo.size > LIMITE_DA_IMAGEM) {
    return `A imagem passa de ${String(MB)} MB. Diminua o tamanho e tente de novo.`;
  }
  return null;
}

const mensagemDe = (e: unknown) =>
  e instanceof ErroDaApi
    ? e.message
    : 'Não conseguimos falar com o servidor. Confira a conexão e tente de novo.';

/* ---------- Recorte do token ---------- */

/** Lado do quadro de recorte na tela. */
const QUADRO = 240;
const ZOOM_MAXIMO = 4;

export interface Enquadramento {
  /** 1 = o quadrado do tamanho do menor lado; 4 = um quarto dele. */
  zoom: number;
  /** Posição do quadrado, de 0 (esquerda, topo) a 1 (direita, fundo). */
  px: number;
  py: number;
}

const CENTRO: Enquadramento = { zoom: 1, px: 0.5, py: 0.5 };

interface Tamanho {
  w: number;
  h: number;
}

/** O recorte em frações da imagem, como o servidor espera. */
export function recorteDe({ w, h }: Tamanho, e: Enquadramento): Recorte {
  const lado = Math.min(w, h) / e.zoom;
  return { x: (e.px * (w - lado)) / w, y: (e.py * (h - lado)) / h, lado: 1 / e.zoom };
}

const limitar = (n: number) => Math.min(1, Math.max(0, n));

function Recortador({
  src,
  tamanho,
  aoCarregar,
  enquadramento,
  aoMudar,
}: {
  src: string;
  /** O tamanho natural da imagem, quando ela carregar. */
  tamanho: Tamanho | null;
  aoCarregar: (tamanho: Tamanho) => void;
  enquadramento: Enquadramento;
  aoMudar: (e: Enquadramento) => void;
}) {
  const arrasto = useRef<{ x: number; y: number; inicio: Enquadramento } | null>(null);
  const id = useId();

  const lado = tamanho ? Math.min(tamanho.w, tamanho.h) / enquadramento.zoom : 1;
  const escala = QUADRO / lado;
  const folgaX = tamanho ? (tamanho.w - lado) * escala : 0;
  const folgaY = tamanho ? (tamanho.h - lado) * escala : 0;

  function aoApertar(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, inicio: enquadramento };
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a) return;
    // Arrastar a imagem para a direita mostra mais da esquerda: o quadrado anda ao contrário.
    aoMudar({
      ...a.inicio,
      px: folgaX > 0 ? limitar(a.inicio.px - (e.clientX - a.x) / folgaX) : a.inicio.px,
      py: folgaY > 0 ? limitar(a.inicio.py - (e.clientY - a.y) / folgaY) : a.inicio.py,
    });
  }
  const soltar = () => {
    arrasto.current = null;
  };

  const faixa = (campo: keyof Enquadramento, rotulo: string, min: number, max: number) => (
    <label className="col recorte-faixa" htmlFor={`${id}-${campo}`}>
      <span className="lab">{rotulo}</span>
      <input
        id={`${id}-${campo}`}
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={enquadramento[campo]}
        onChange={(e) => {
          aoMudar({ ...enquadramento, [campo]: Number(e.target.value) });
        }}
      />
    </label>
  );

  return (
    <div className="col recorte">
      <div
        className="recorte-quadro"
        style={{ width: QUADRO, height: QUADRO }}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <img
          src={src}
          alt="Imagem do token: arraste para enquadrar"
          draggable={false}
          onLoad={(e) => {
            aoCarregar({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
          }}
          style={
            tamanho
              ? {
                  width: tamanho.w * escala,
                  height: tamanho.h * escala,
                  left: -enquadramento.px * folgaX,
                  top: -enquadramento.py * folgaY,
                }
              : { visibility: 'hidden' }
          }
        />
        <span className="recorte-circulo" aria-hidden="true" />
      </div>
      {faixa('zoom', 'Aproximar', 1, ZOOM_MAXIMO)}
      <div className="g2">
        {faixa('px', 'Esquerda e direita', 0, 1)}
        {faixa('py', 'Cima e baixo', 0, 1)}
      </div>
    </div>
  );
}

/* ---------- O modal ---------- */

type Fonte = { tipo: 'foto' } | { tipo: 'arquivo'; arquivo: File; url: string };

export interface EnviarImagemProps {
  open: boolean;
  personagem: Pick<Personagem, 'id' | 'foto' | 'tokenImg'> & { nome: string };
  /** Anel do avatar, pelo perfil. */
  tone?: 'red' | 'blue' | 'green';
  iniciais: string;
  aoTrocar: (personagem: Personagem) => void;
  aoFechar: () => void;
}

export function EnviarImagem({
  open,
  personagem,
  tone = 'red',
  iniciais,
  aoTrocar,
  aoFechar,
}: EnviarImagemProps) {
  const url = `/api/personagens/${encodeURIComponent(personagem.id)}/imagem`;
  const entradaDaFoto = useRef<HTMLInputElement>(null);
  const entradaDoToken = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<TipoDeImagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [enquadramento, setEnquadramento] = useState<Enquadramento>(CENTRO);
  const [tamanho, setTamanho] = useState<Tamanho | null>(null);

  // A prévia de um arquivo local é um endereço blob: solta quando não precisa mais.
  useEffect(() => {
    if (fonte?.tipo !== 'arquivo') return;
    return () => {
      URL.revokeObjectURL(fonte.url);
    };
  }, [fonte]);

  /** Envia (com corpo) ou tira (sem corpo) a foto ou o token. `true` se deu certo. */
  async function enviar(tipo: TipoDeImagem, corpo: FormData | null) {
    setErro(null);
    setEnviando(tipo);
    try {
      const r = await pedir<{ personagem: Personagem }>(
        corpo ? url : `${url}/${tipo}`,
        corpo ? { method: 'POST', body: corpo } : { method: 'DELETE' },
      );
      aoTrocar(r.personagem);
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
    } finally {
      setEnviando(null);
    }
  }

  function abrirRecorte(nova: Fonte) {
    setErro(null);
    setEnquadramento(CENTRO);
    setTamanho(null);
    setFonte(nova);
  }

  function escolher(tipo: TipoDeImagem, arquivo: File | undefined) {
    if (!arquivo) return;
    const problema = problemaDoArquivo(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }
    if (tipo === 'token') {
      abrirRecorte({ tipo: 'arquivo', arquivo, url: URL.createObjectURL(arquivo) });
      return;
    }
    const corpo = new FormData();
    corpo.append('tipo', 'foto');
    corpo.append('arquivo', arquivo);
    void enviar('foto', corpo);
  }

  async function salvarToken() {
    if (!fonte) return;
    const corpo = new FormData();
    corpo.append('tipo', 'token');
    // Sem o tamanho (a prévia não carregou), o servidor recorta do centro.
    if (tamanho) corpo.append('recorte', JSON.stringify(recorteDe(tamanho, enquadramento)));
    if (fonte.tipo === 'foto') corpo.append('usarFoto', 'sim');
    else corpo.append('arquivo', fonte.arquivo);
    if (await enviar('token', corpo)) setFonte(null);
  }

  const fechar = () => {
    if (enviando) return;
    setFonte(null);
    setErro(null);
    aoFechar();
  };

  const avatar = (arquivo: string | null, rotulo: string) => (
    <Avatar
      initials={iniciais}
      name={rotulo}
      tone={tone}
      size="xl"
      src={arquivo ? urlDoArquivo(arquivo) : undefined}
    />
  );

  const entrada = (tipo: TipoDeImagem, ref: typeof entradaDaFoto) => (
    <input
      ref={ref}
      type="file"
      accept={TIPOS_ACEITOS}
      hidden
      aria-label={tipo === 'foto' ? 'Arquivo da foto' : 'Arquivo do token'}
      onChange={(e) => {
        escolher(tipo, e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return (
    <Modal open={open} onClose={fechar} title="Foto e token">
      {entrada('foto', entradaDaFoto)}
      {entrada('token', entradaDoToken)}

      {fonte ? (
        <>
          <p className="muted envio-texto">
            Enquadre o rosto no círculo: é assim que o token aparece na mesa.
          </p>
          <Recortador
            src={fonte.tipo === 'arquivo' ? fonte.url : urlDoArquivo(personagem.foto ?? '')}
            tamanho={tamanho}
            aoCarregar={setTamanho}
            enquadramento={enquadramento}
            aoMudar={setEnquadramento}
          />
          {erro && <Banner tone="err">{erro}</Banner>}
          <div className="row envio-acoes">
            <Button
              variant="ghost"
              disabled={enviando !== null}
              onClick={() => {
                setFonte(null);
              }}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              loading={enviando === 'token'}
              onClick={() => void salvarToken()}
            >
              Salvar token
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small envio-texto">
            JPG, PNG ou WebP de até {MB} MB. A localização e outros dados escondidos na imagem são
            apagados no envio.
          </p>
          <div className="envio-imagem">
            <section className="col envio-lado" aria-label="Foto da ficha">
              <span className="lab">Foto da ficha</span>
              {avatar(personagem.foto, `Foto de ${personagem.nome}`)}
              <Button
                icon={<Icon name="upload" size="sm" />}
                loading={enviando === 'foto'}
                disabled={enviando !== null}
                onClick={() => entradaDaFoto.current?.click()}
              >
                {personagem.foto ? 'Trocar foto' : 'Escolher foto'}
              </Button>
              {personagem.foto && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="trash" size="sm" />}
                  disabled={enviando !== null}
                  onClick={() => void enviar('foto', null)}
                >
                  Tirar foto
                </Button>
              )}
            </section>
            <section className="col envio-lado" aria-label="Token da mesa">
              <span className="lab">Token da mesa</span>
              {avatar(personagem.tokenImg, `Token de ${personagem.nome}`)}
              <Button
                icon={<Icon name="image" size="sm" />}
                disabled={enviando !== null || !personagem.foto}
                title={personagem.foto ? undefined : 'Envie uma foto primeiro'}
                onClick={() => {
                  abrirRecorte({ tipo: 'foto' });
                }}
              >
                Usar a foto
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="upload" size="sm" />}
                disabled={enviando !== null}
                onClick={() => entradaDoToken.current?.click()}
              >
                Outra imagem
              </Button>
              {personagem.tokenImg && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="trash" size="sm" />}
                  disabled={enviando !== null}
                  onClick={() => void enviar('token', null)}
                >
                  Tirar token
                </Button>
              )}
            </section>
          </div>
          {erro && <Banner tone="err">{erro}</Banner>}
        </>
      )}
    </Modal>
  );
}
