// Entrar por convite: artboards "01b · Entrar por convite" e "Celular · 01b".
// /c/:codigo mostra o cartão do convite; /convite só a caixa para digitar o código.
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  codigoBemFormado,
  normalizarCodigo,
  tituloDaPagina,
  type ConvitePublico,
} from '@limiar/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import { esquecerConvitePendente, guardarConvitePendente } from '../convites/pendentes.ts';
import { useMe } from '../auth/sessao.tsx';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Field,
  Icon,
  Input,
  Marca,
  Paper,
  Skeleton,
  Tag,
  useToast,
} from '../ui/index.ts';
import {
  AvisoDeFalha,
  BotaoDiscord,
  CampoSenha,
  interpretarFalha,
  linkDoDiscord,
  Ou,
  TelaDeAcesso,
  useDiscordLigado,
  useEntrarPorEmail,
  type Falha,
} from './acesso/comum.tsx';

/** "sexta, 21/11, às 21h" (ou "às 21h30"). */
export function quandoFoiMarcada(iso: string): string {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d).split('-')[0];
  const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
  const minutos = d.getMinutes();
  const hora = `${String(d.getHours())}h${minutos ? String(minutos).padStart(2, '0') : ''}`;
  return `${dia ?? ''}, ${data}, às ${hora}`;
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const MENSAGEM_DO_ESTADO = {
  expirado: 'Este convite expirou. Peça um novo ao mestre.',
  esgotado: 'As vagas deste convite acabaram. Peça um novo ao mestre.',
} as const;

function CartaoDoConvite({ convite }: { convite: ConvitePublico }) {
  const numero = convite.campanha.numero;
  const sessao = convite.proximaSessao ? quandoFoiMarcada(convite.proximaSessao) : null;
  const vagas =
    convite.estado === 'expirado'
      ? 'Expirado'
      : `${String(convite.vagasRestantes)} ${convite.vagasRestantes === 1 ? 'vaga' : 'vagas'}`;
  return (
    <Paper className="cartao-convite">
      <div className="row between">
        <span className="lab">
          Convite{numero !== null && ` · caso nº ${String(numero).padStart(3, '0')}`}
        </span>
        <span className="so-pc">
          <Tag tone="ink">{vagas}</Tag>
        </span>
      </div>
      <h2 className="h2 cartao-titulo">{convite.campanha.nome}</h2>
      <p className="doc cartao-texto">
        <span className="so-pc">
          {convite.mestre.nome} convidou você para jogar como investigador.
          {sessao && ` Próxima sessão: ${sessao}.`}
        </span>
        <span className="so-cel">
          {convite.mestre.nome} convidou você.
          {sessao && ` ${sessao[0]?.toUpperCase() ?? ''}${sessao.slice(1)}.`}
        </span>
      </p>
      <div className="row so-pc" style={{ marginTop: 14, gap: 8 }}>
        <Avatar
          initials={iniciais(convite.mestre.nome)}
          name={convite.mestre.nome}
          tone="gold"
          size="sm"
        />
        <span className="small cartao-mestre">
          Mestre: {convite.mestre.nome} · {convite.sistema.nome}
        </span>
      </div>
    </Paper>
  );
}

/** Caixa "Recebeu só um código?": confere o código enquanto a pessoa digita. */
function CaixaDoCodigo({ inicial }: { inicial: string }) {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState(inicial);
  const [conferido, setConferido] = useState<
    { codigo: string; nome: string } | { codigo: string; erro: string } | null
  >(null);
  const normalizado = normalizarCodigo(codigo);
  const pronto = codigoBemFormado(normalizado);

  useEffect(() => {
    if (!pronto) return;
    let ativo = true;
    const espera = setTimeout(() => {
      pedir<{ convite: ConvitePublico }>(`/api/convites/${normalizado}`)
        .then(({ convite }) => {
          if (ativo) setConferido({ codigo: normalizado, nome: convite.campanha.nome });
        })
        .catch((erro: unknown) => {
          if (!ativo) return;
          const mensagem =
            erro instanceof ErroDaApi
              ? (erro.campos?.['codigo'] ?? erro.message)
              : 'Sem conexão. Tente de novo.';
          setConferido({ codigo: normalizado, erro: mensagem });
        });
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [normalizado, pronto]);

  // Só vale o resultado do código que está no campo agora.
  const resultado = pronto && conferido?.codigo === normalizado ? conferido : null;
  const valido = resultado !== null && 'nome' in resultado;
  const erro =
    resultado && 'erro' in resultado
      ? resultado.erro
      : codigo.length > 0 && normalizado.length >= 9 && !pronto
        ? 'O código tem o formato PALAVRA-1234, como ERMIDA-3H33.'
        : undefined;

  return (
    <Card pad className="col caixa-codigo">
      <form
        className="col"
        style={{ gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) void navegar(`/c/${normalizado}`);
        }}
      >
        <Field
          label={
            <>
              <span className="so-pc">Recebeu só um código?</span>
              <span className="so-cel">Tem só um código?</span>
            </>
          }
          error={erro}
        >
          <div className="row">
            <Input
              className="type campo-codigo"
              value={codigo}
              placeholder="ERMIDA-3H33"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase());
              }}
            />
            <Button type="submit" disabled={!valido}>
              Validar
            </Button>
          </div>
        </Field>
        {valido && (
          <span className="green small" role="status" style={{ fontWeight: 700 }}>
            <Icon name="check" size="sm" /> Código válido para {resultado.nome}.
          </span>
        )}
      </form>
    </Card>
  );
}

export function Convite() {
  const { codigo: daUrl } = useParams();
  const codigo = daUrl ? normalizarCodigo(daUrl) : undefined;
  const [params] = useSearchParams();
  const { sessao, recarregar } = useMe();
  const avisos = useToast();
  const discord = useDiscordLigado();
  const navegar = useNavigate();

  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [erroDoConvite, setErroDoConvite] = useState<string | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const [falhaAoAceitar, setFalhaAoAceitar] = useState<Falha | null>(null);
  const [aceito, setAceito] = useState(false);
  const aceiteAutomatico = useRef(false);
  const login = useEntrarPorEmail(true);

  const logado = sessao.estado === 'logado';
  const voltar = codigo ? `/c/${codigo}?aceitar=1` : '/convite';

  useEffect(() => {
    document.title = tituloDaPagina('Convite');
  }, []);

  // Carrega o cartão; de novo quando a pessoa entra (para saber se já participa).
  useEffect(() => {
    if (!codigo) return;
    let ativo = true;
    pedir<{ convite: ConvitePublico }>(`/api/convites/${codigo}`)
      .then((r) => {
        // Visto e ainda não aceito: a Central lembra dele em "Convites".
        if (r.convite.estado === 'valido' && !r.convite.jaParticipa) guardarConvitePendente(codigo);
        else esquecerConvitePendente(codigo);
        if (ativo) setConvite(r.convite);
      })
      .catch((erro: unknown) => {
        if (erro instanceof ErroDaApi && erro.status === 404) esquecerConvitePendente(codigo);
        if (ativo)
          setErroDoConvite(
            erro instanceof ErroDaApi ? erro.message : 'Sem conexão com o servidor.',
          );
      });
    return () => {
      ativo = false;
    };
  }, [codigo, logado]);

  async function aceitar() {
    if (!codigo || !convite) return;
    setAceitando(true);
    setFalhaAoAceitar(null);
    try {
      await pedir(`/api/convites/${codigo}/aceitar`, { method: 'POST' });
      esquecerConvitePendente(codigo);
      avisos.show({ type: 'ok', title: 'Você entrou no caso', text: convite.campanha.nome });
      await recarregar();
      setAceito(true);
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.codigo === 'JA_PARTICIPA') {
        esquecerConvitePendente(codigo);
        setAceito(true);
        return;
      }
      setFalhaAoAceitar(interpretarFalha(erro));
      setAceitando(false);
    }
  }

  // Voltou do login (Discord ou e-mail) com ?aceitar=1: aceita sozinho, uma vez.
  const podeAceitar = logado && convite?.estado === 'valido' && convite.jaParticipa === false;
  useEffect(() => {
    if (params.get('aceitar') !== '1' || !podeAceitar || aceiteAutomatico.current) return;
    aceiteAutomatico.current = true;
    void aceitar();
    // aceitar() muda a cada render; o ref garante uma vez só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, podeAceitar]);

  // Depois de aceitar, vai para a Central (Personagens chega na Fase 1).
  if (aceito) return <Navigate to="/" replace />;

  const indisponivel =
    convite && convite.estado !== 'valido' ? MENSAGEM_DO_ESTADO[convite.estado] : null;

  return (
    <TelaDeAcesso
      ambiente={
        <>
          <span className="eyebrow">Mesa online para investigação paranormal</span>
          <p className="h1">Alguém leu o seu nome no rádio.</p>
          <p className="type">
            Mapa, fichas, pistas e dados num lugar só, para o seu grupo jogar Ordem Paranormal ou o
            sistema que vocês inventaram.
          </p>
        </>
      }
    >
      <div className="so-cel col" style={{ gap: 18 }}>
        <Marca />
        <p className="h1 titulo-convite-cel">Alguém leu o seu nome no rádio.</p>
      </div>

      {codigo && !convite && !erroDoConvite && (
        <Paper className="cartao-convite" aria-busy="true">
          <Skeleton variant="h" width="70%" />
          <Skeleton width="90%" />
        </Paper>
      )}
      {erroDoConvite && <Banner tone="err">{erroDoConvite}</Banner>}
      {convite && <CartaoDoConvite convite={convite} />}
      {indisponivel && <Banner tone="warn">{indisponivel}</Banner>}

      {!codigo && (
        <div className="col acesso-titulo" style={{ gap: 6 }}>
          <h1 className="h1">Entrar num caso</h1>
          <p className="muted">Digite o código que o mestre mandou, como ERMIDA-3H33.</p>
        </div>
      )}

      {convite && !indisponivel && logado && (
        <div className="col" style={{ gap: 12 }}>
          <h1 className="h2">
            {convite.jaParticipa ? 'Você já está neste caso' : `Olá, ${sessao.usuario.nome}`}
          </h1>
          {convite.jaParticipa ? (
            <Link className="btn red wide grande" to="/">
              Ir para a Central
            </Link>
          ) : (
            <>
              <p className="muted">
                Ao aceitar, você entra como jogador. Depois escolhe ou cria o personagem.
              </p>
              <Button
                variant="primary"
                wide
                className="grande"
                loading={aceitando}
                onClick={() => void aceitar()}
              >
                Aceitar convite
              </Button>
            </>
          )}
          <AvisoDeFalha falha={falhaAoAceitar} tentarDeNovo={() => void aceitar()} />
        </div>
      )}

      {convite && !indisponivel && sessao.estado === 'anonimo' && (
        <>
          <div className="col so-pc" style={{ gap: 8 }}>
            <h1 className="h2">Entrar para aceitar</h1>
            <p className="muted">
              Depois de entrar, você escolhe ou cria o personagem para este caso.
            </p>
          </div>
          {discord !== false && (
            <>
              <BotaoDiscord href={linkDoDiscord(true, voltar)}>Entrar com Discord</BotaoDiscord>
              <span className="so-pc">
                <Ou />
              </span>
            </>
          )}
          <form
            className="so-pc"
            noValidate
            onSubmit={(e) => {
              // Entrou: a sessão vira "logado" e o aceite automático cuida do resto.
              void login.enviar(e).then((ok) => {
                if (ok) void navegar(voltar, { replace: true });
              });
            }}
          >
            <Field label="E-mail" error={login.camposComErro['email']}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={login.email}
                onChange={(e) => {
                  login.setEmail(e.target.value);
                }}
              />
            </Field>
            <Field
              label="Senha"
              error={login.camposComErro['senha']}
              help="Esqueceu? Peça ao mestre para redefinir sua senha."
            >
              <CampoSenha
                autoComplete="current-password"
                value={login.senha}
                onChange={(e) => {
                  login.setSenha(e.target.value);
                }}
              />
            </Field>
            <Button type="submit" wide loading={login.enviando}>
              Entrar com e-mail
            </Button>
          </form>
          <Link
            className="btn wide grande so-cel"
            to={`/entrar?voltar=${encodeURIComponent(voltar)}`}
          >
            Entrar com e-mail
          </Link>
          <AvisoDeFalha falha={login.falha} tentarDeNovo={() => void login.enviar()} />
          <p className="small muted">
            Não tem conta?{' '}
            <Link to={`/criar-conta?voltar=${encodeURIComponent(voltar)}`}>Criar conta</Link>
          </p>
        </>
      )}

      <CaixaDoCodigo inicial={codigo && erroDoConvite ? codigo : ''} />
      <p className="small muted so-cel" style={{ textAlign: 'center' }}>
        Seus dados ficam só no servidor do grupo.
      </p>
    </TelaDeAcesso>
  );
}
