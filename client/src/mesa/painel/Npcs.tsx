// Ferramenta "Tokens e NPCs" do mestre (RF-18, RF-19): traz o grupo para um ponto do mapa, cria
// NPCs (com nome, tamanho e a arte de um modelo pronto ou uma imagem enviada; ocultos ou não) e
// lista o que está no mapa, com ocultar,
// revelar e remover. Tamanho e imagem de um token também mudam pela barra dele, no mapa.
import { useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import {
  CATEGORIAS_DE_NPCS,
  NPCS_PRONTOS,
  type ComandoDaMesa,
  type PersonagemNaLista,
  type RespostaDoComando,
  type TokenNaMesa,
  type VisaoDaMesa,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { iniciais } from '../../casos/formatos.ts';
import { linkDaFicha } from '../../personagens/formatos.ts';
import {
  Async,
  Button,
  Checkbox,
  Field,
  Icon,
  Input,
  Select,
  Skeleton,
  useCarga,
  useEnvio,
  useToast,
} from '../../ui/index.ts';
import type { Ponto } from '../camera.ts';
import { enviarImagemDaMesa } from '../imagens.ts';
import { pontoLivre } from '../interacao.ts';
import { urlDaImagem } from '../prontos.ts';
import { SeletorDePronto } from './SeletorDePronto.tsx';

const nomeDoModelo = (id: string | null) => NPCS_PRONTOS.find((n) => n.id === id)?.nome ?? '';

interface Props {
  campanhaId: string;
  visao: VisaoDaMesa;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
  /** O meio da tela, em pixels do mapa: onde o NPC novo aparece. */
  centroRef: RefObject<Ponto | null>;
  nomes: Readonly<Record<string, string>>;
  /** "Trazer o grupo": a página pede um ponto no mapa e manda o comando. */
  aoTrazerGrupo: () => void;
}

function NovoNpc({
  campanhaId,
  enviar,
  centroRef,
  visao,
}: Pick<Props, 'campanhaId' | 'enviar' | 'centroRef' | 'visao'>) {
  const avisos = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [tamanho, setTamanho] = useState('1');
  const [oculto, setOculto] = useState(false);
  const [imagem, setImagem] = useState<File | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [escolhendoModelo, setEscolhendoModelo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** O modelo dá a arte e, se o nome estiver vazio (ou ainda for o do modelo anterior), o nome. */
  function escolherModelo(id: string) {
    const anterior = nomeDoModelo(modelo);
    setModelo(id);
    setImagem(null);
    setEscolhendoModelo(false);
    if (!nome.trim() || nome === anterior) setNome(nomeDoModelo(id));
    setErro(null);
  }

  const criar = useEnvio(async () => {
    if (!nome.trim()) {
      setErro('Dê um nome.');
      return;
    }
    let nomeDaImagem: string | undefined = modelo ?? undefined;
    if (imagem) {
      const envio = await enviarImagemDaMesa(campanhaId, imagem, 'token');
      if (!envio.ok) {
        avisos.show({ type: 'err', title: envio.titulo, text: envio.texto });
        return;
      }
      nomeDaImagem = envio.nome;
    }
    const centro = centroRef.current ?? { x: 0, y: 0 };
    const ponto = visao.mapa ? pontoLivre(centro, visao.tokens, visao.mapa) : centro;
    const r = await enviar({
      type: 'token.create',
      nome: nome.trim(),
      ...ponto,
      tamanho: Number(tamanho),
      oculto,
      ...(nomeDaImagem && { imagem: nomeDaImagem }),
    });
    if (!r.ok) {
      setErro(r.motivo);
      return;
    }
    avisos.show({ type: 'ok', title: 'NPC no mapa', text: nome.trim() });
    // O modelo continua escolhido: dá para pôr vários (três cultistas) em seguida.
    setNome(nomeDoModelo(modelo));
    setImagem(null);
    setErro(null);
  });

  return (
    <form
      className="col"
      style={{ gap: 10 }}
      aria-label="Novo NPC"
      onSubmit={(e) => {
        e.preventDefault();
        void criar.enviar();
      }}
    >
      <span className="lab">Novo NPC</span>
      <Field label="Nome" error={erro}>
        <Input
          value={nome}
          maxLength={60}
          placeholder="Segurança Brito"
          onChange={(e) => {
            setNome(e.target.value);
            setErro(null);
          }}
        />
      </Field>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label="Tamanho">
          <Select
            value={tamanho}
            onChange={(e) => {
              setTamanho(e.target.value);
            }}
          >
            <option value="1">1×1</option>
            <option value="2">2×2</option>
            <option value="3">3×3</option>
          </Select>
        </Field>
        <Checkbox
          label="Começa oculto"
          checked={oculto}
          onChange={(e) => {
            setOculto(e.target.checked);
          }}
        />
      </div>
      <input
        ref={arquivo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        aria-label="Imagem do NPC"
        onChange={(e) => {
          const escolhido = e.target.files?.[0] ?? null;
          e.target.value = '';
          setImagem(escolhido);
          if (escolhido) {
            if (nome === nomeDoModelo(modelo)) setNome('');
            setModelo(null);
          }
        }}
      />
      <div className="row" style={{ gap: 8 }}>
        {modelo && <img className="modelo-escolhido" src={urlDaImagem(modelo)} alt="" />}
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="users" size="sm" />}
          aria-expanded={escolhendoModelo}
          onClick={() => {
            setEscolhendoModelo((aberto) => !aberto);
          }}
        >
          {modelo ? `Modelo: ${nomeDoModelo(modelo)}` : 'Escolher modelo'}
        </Button>
      </div>
      {escolhendoModelo && (
        <SeletorDePronto
          itens={NPCS_PRONTOS}
          categorias={CATEGORIAS_DE_NPCS}
          rotulo="Modelos de NPC"
          escolhido={modelo}
          aoEscolher={escolherModelo}
          redondo
        />
      )}
      <div className="row" style={{ gap: 8 }}>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="image" size="sm" />}
          onClick={() => arquivo.current?.click()}
        >
          {imagem ? 'Trocar imagem' : 'Enviar imagem'}
        </Button>
        {imagem && <span className="small muted mesa-arquivo">{imagem.name}</span>}
      </div>
      <Button type="submit" size="sm" variant="primary" loading={criar.enviando}>
        Pôr no mapa
      </Button>
    </form>
  );
}

function TokenNaLista({
  token,
  nomes,
  enviar,
}: {
  token: TokenNaMesa;
  nomes: Props['nomes'];
  enviar: Props['enviar'];
}) {
  const avisos = useToast();
  const responder = (r: RespostaDoComando) => {
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu', text: r.motivo });
  };
  const dono = token.donoId === null ? 'NPC' : `de ${nomes[token.donoId] ?? 'um jogador'}`;
  return (
    <li className="mapa-na-lista">
      <span className="mesa-avatar" aria-hidden="true">
        {iniciais(token.nome)}
      </span>
      <div className="mapa-info">
        <b title={token.nome}>{token.nome}</b>
        <div className="small muted">
          {dono}
          {token.oculto && ' · oculto'}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<Icon name={token.oculto ? 'eyeoff' : 'eye'} size="sm" />}
        aria-label={token.oculto ? `Revelar ${token.nome}` : `Ocultar ${token.nome}`}
        title={token.oculto ? 'Revelar no mapa' : 'Ocultar dos jogadores'}
        aria-pressed={token.oculto}
        onClick={() =>
          void enviar({ type: 'token.update', tokenId: token.id, oculto: !token.oculto }).then(
            responder,
          )
        }
      />
      <Button
        size="sm"
        variant="ghost"
        className="btn-excluir"
        icon={<Icon name="trash" size="sm" />}
        aria-label={`Remover ${token.nome}`}
        title="Remover da cena"
        onClick={() => void enviar({ type: 'token.delete', tokenId: token.id }).then(responder)}
      />
    </li>
  );
}

function PersonagensDoMestre({
  campanhaId,
  visao,
  enviar,
  centroRef,
}: Pick<Props, 'campanhaId' | 'visao' | 'enviar' | 'centroRef'>) {
  const avisos = useToast();
  const uso = useCarga('/api/me/personagens', (signal) =>
    pedir<{ personagens: PersonagemNaLista[] }>('/api/me/personagens', { signal }).then(
      (r) => r.personagens,
    ),
  );

  async function colocarNaCena(p: PersonagemNaLista) {
    const centro = centroRef.current ?? { x: 0, y: 0 };
    const ponto = visao.mapa ? pontoLivre(centro, visao.tokens, visao.mapa) : centro;
    const r = await enviar({
      type: 'token.create',
      nome: p.ficha.nome,
      personagemId: p.id,
      ...(p.foto && { imagem: p.foto }),
      ...ponto,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para pôr na cena', text: r.motivo });
  }

  return (
    <section aria-label="Personagens do mestre" className="col" style={{ gap: 8 }}>
      <div className="row between">
        <span className="lab">Personagens do mestre</span>
        <Link
          className="btn ghost sm"
          to={`/personagens/novo/ficha?caso=${encodeURIComponent(campanhaId)}`}
          title="Montar nova ficha completa"
        >
          <Icon name="plus" size="sm" />
          Nova ficha
        </Link>
      </div>
      <Async uso={uso} falha="Não deu para carregar suas fichas." esqueleto={<Skeleton />}>
        {(lista) => {
          const doCaso = lista.filter((p) => p.campanhaId === campanhaId);
          if (doCaso.length === 0) {
            return (
              <p className="small muted">
                Crie uma ficha completa para o mestre neste caso para colocá-la na cena e no
                combate.
              </p>
            );
          }
          return (
            <ul className="mesa-mapas">
              {doCaso.map((p) => {
                const naCena = visao.tokens.some((t) => t.personagemId === p.id);
                return (
                  <li key={p.id} className="mapa-na-lista">
                    <span className="mesa-avatar" aria-hidden="true">
                      {iniciais(p.ficha.nome)}
                    </span>
                    <div className="mapa-info">
                      <b title={p.ficha.nome}>{p.ficha.nome}</b>
                      <div className="small muted">
                        PV {p.ficha.pv}/{p.ficha.pvMax} · PD {p.ficha.pd}/{p.ficha.pdMax}
                      </div>
                    </div>
                    <Link
                      className="btn ghost sm"
                      to={linkDaFicha(p.id)}
                      title="Abrir ficha completa"
                    >
                      Ficha
                    </Link>
                    <Button
                      size="sm"
                      variant={naCena ? 'ghost' : 'secondary'}
                      disabled={naCena || !visao.mapa}
                      onClick={() => void colocarNaCena(p)}
                    >
                      {naCena ? 'Na cena' : 'Pôr na cena'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Async>
    </section>
  );
}

export function Npcs({ campanhaId, visao, enviar, centroRef, nomes, aoTrazerGrupo }: Props) {
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="col" style={{ gap: 6 }}>
        <Button icon={<Icon name="users" size="sm" />} onClick={aoTrazerGrupo}>
          Trazer o grupo
        </Button>
        <p className="small muted">
          Escolha um ponto no mapa: os personagens do grupo vão para lá. Quem ainda não está neste
          mapa entra.
        </p>
      </div>

      <PersonagensDoMestre
        campanhaId={campanhaId}
        visao={visao}
        enviar={enviar}
        centroRef={centroRef}
      />

      <NovoNpc campanhaId={campanhaId} enviar={enviar} centroRef={centroRef} visao={visao} />

      <section aria-label="Tokens no mapa" className="col" style={{ gap: 8 }}>
        <span className="lab">No mapa</span>
        {visao.tokens.length === 0 ? (
          <p className="small muted">Nenhum token ainda.</p>
        ) : (
          <ul className="mesa-mapas">
            {visao.tokens.map((token) => (
              <TokenNaLista key={token.id} token={token} nomes={nomes} enviar={enviar} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
