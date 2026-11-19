// Entrar: artboards "01 · Entrar" e "Celular · 01 · Entrar".
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { tituloDaPagina } from '@limiar/shared';
import { pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import { Banner, Button, Checkbox, Field, Icon, Input, Marca, Note } from '../ui/index.ts';
import {
  BotaoDiscord,
  CampoSenha,
  caminhoSeguro,
  interpretarFalha,
  linkDoDiscord,
  Ou,
  TelaDeAcesso,
  useDiscordLigado,
  type Falha,
} from './acesso/comum.tsx';

/** Erros que o login pelo Discord manda de volta em ?erro=. */
const ERROS_DO_DISCORD: Record<string, string> = {
  'estado-invalido': 'O login expirou ou veio de outra aba. Tente de novo.',
  'discord-cancelado': 'Você cancelou no Discord. Tudo bem, é só tentar de novo.',
  'discord-falhou': 'O Discord não respondeu como esperado. Tente de novo em instantes.',
  'discord-indisponivel': 'O login com Discord não está configurado neste servidor.',
};

export function Entrar() {
  const { sessao, recarregar } = useMe();
  const [params] = useSearchParams();
  const voltar = caminhoSeguro(params.get('voltar'));
  const erroDoDiscord = params.get('erro');
  const discord = useDiscordLigado();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [manter, setManter] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [esqueci, setEsqueci] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = tituloDaPagina('Entrar');
    primeiroCampo.current?.focus();
  }, []);

  if (sessao.estado === 'logado') return <Navigate to={voltar} replace />;

  async function enviar(evento?: SyntheticEvent) {
    evento?.preventDefault();
    setEnviando(true);
    setFalha(null);
    try {
      await pedir('/api/auth/entrar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, senha, manter }),
      });
      await recarregar(); // a sessão vira "logado" e o <Navigate> acima leva à página pedida
    } catch (erro) {
      setFalha(interpretarFalha(erro));
      setEnviando(false);
    }
  }

  const camposComErro = falha?.tipo === 'campos' ? falha.campos : {};

  return (
    <TelaDeAcesso
      ambiente={
        <>
          <span className="eyebrow">Mesa online para investigação paranormal</span>
          <p className="h1">A porta do Estúdio B continua trancada.</p>
          <p className="type">
            Entre para voltar aos seus casos, como jogador ou como mestre. Uma conta só serve para
            os dois.
          </p>
        </>
      }
    >
      <div className="so-cel">
        <Marca />
      </div>
      <div className="col acesso-titulo" style={{ gap: 6 }}>
        <h1 className="h1">Entrar</h1>
        <p className="muted so-pc">Bem-vindo de volta à LIMIAR.</p>
        <p className="small muted so-cel">Uma conta serve para jogar e para mestrar.</p>
      </div>

      {erroDoDiscord && (
        <Banner tone="err">
          {ERROS_DO_DISCORD[erroDoDiscord] ?? 'Não deu para entrar. Tente de novo.'}
        </Banner>
      )}

      {discord !== false && (
        <>
          <BotaoDiscord href={linkDoDiscord(manter, voltar)}>Entrar com Discord</BotaoDiscord>
          <Ou />
        </>
      )}

      <form noValidate onSubmit={(e) => void enviar(e)}>
        <Field label="E-mail" error={camposComErro['email']}>
          <Input
            ref={primeiroCampo}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </Field>
        <div className="col" style={{ gap: 10 }}>
          <Field
            label="Senha"
            error={camposComErro['senha']}
            labelExtra={
              <button
                type="button"
                className="acesso-link"
                aria-expanded={esqueci}
                onClick={() => {
                  setEsqueci(!esqueci);
                }}
              >
                <span className="so-pc">Esqueci a senha</span>
                <span className="so-cel">Esqueci</span>
              </button>
            }
          >
            <CampoSenha
              autoComplete="current-password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
              }}
            />
          </Field>
          {esqueci && (
            <Note>
              Peça ao mestre do seu grupo para redefinir sua senha. Ele recebe uma senha provisória
              para mandar a você.
            </Note>
          )}
        </div>
        <div className="so-pc">
          <Checkbox
            label="Manter conectado neste aparelho"
            checked={manter}
            onChange={(e) => {
              setManter(e.target.checked);
            }}
          />
        </div>
        <Button type="submit" variant="primary" wide loading={enviando} className="grande">
          Entrar
        </Button>
      </form>

      {falha?.tipo === 'recusa' && (
        <Banner tone="err" icon={<Icon name="alert" size="sm" />}>
          <span className="small">
            {falha.mensagem}
            {falha.mensagem.includes('não conferem') && ' Depois de 5 tentativas, espere 1 minuto.'}
          </span>
        </Banner>
      )}
      {falha?.tipo === 'rede' && (
        <Banner
          tone="err"
          icon={<Icon name="wifioff" size="sm" />}
          action={
            <Button size="sm" onClick={() => void enviar()}>
              Tentar de novo
            </Button>
          }
        >
          <span className="small">Sem conexão com o servidor. Confira a internet.</span>
        </Banner>
      )}

      <hr className="hr so-pc" />
      <div className="rodape">
        <p>
          <span className="so-pc">Ainda não tem conta? </span>
          <span className="so-cel">Não tem conta? </span>
          <Link to={`/criar-conta${voltar === '/' ? '' : `?voltar=${encodeURIComponent(voltar)}`}`}>
            Criar conta
          </Link>
        </p>
        <p className="small muted">
          <span className="so-pc">Recebeu um convite? Abra o link do convite ou </span>
          <span className="so-cel">Tem convite? </span>
          <Link to="/convite">
            <span className="so-pc">digite o código</span>
            <span className="so-cel">Digite o código</span>
          </Link>
          <span className="so-pc">.</span>
        </p>
      </div>
    </TelaDeAcesso>
  );
}
