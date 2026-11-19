// Criar conta: artboards "01c · Criar conta" e "Celular · 01c".
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { senhaValida, tituloDaPagina } from '@limiar/shared';
import { pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import { Banner, Button, Checkbox, Field, Icon, Input } from '../ui/index.ts';
import {
  BotaoDiscord,
  CampoSenha,
  caminhoSeguro,
  ForcaDaSenha,
  interpretarFalha,
  linkDoDiscord,
  Ou,
  TelaDeAcesso,
  useDiscordLigado,
  type Falha,
} from './acesso/comum.tsx';

export function CriarConta() {
  const { sessao, recarregar } = useMe();
  const [params] = useSearchParams();
  const voltar = caminhoSeguro(params.get('voltar'));
  const discord = useDiscordLigado();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<Falha | null>(null);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = tituloDaPagina('Criar conta');
    primeiroCampo.current?.focus();
  }, []);

  if (sessao.estado === 'logado') return <Navigate to={voltar} replace />;

  const pronto = nome.trim() !== '' && email.includes('@') && senhaValida(senha) && aceite;

  async function enviar(evento?: SyntheticEvent) {
    evento?.preventDefault();
    if (!pronto) return;
    setEnviando(true);
    setFalha(null);
    try {
      await pedir('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, aceite, manter: true }),
      });
      await recarregar();
    } catch (erro) {
      setFalha(interpretarFalha(erro));
      setEnviando(false);
    }
  }

  const campos = falha?.tipo === 'campos' ? falha.campos : {};

  return (
    <TelaDeAcesso
      ambiente={
        <>
          <span className="eyebrow">Uma conta, os dois lados da mesa</span>
          <p className="h1" style={{ fontSize: 72 }}>
            Jogue num caso. Mestre outro.
          </p>
          <div className="col acesso-papeis" style={{ gap: 12 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Icon name="user" />
              <p className="muted">
                <b>Jogador</b> nos casos em que você entra por convite.
              </p>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="gold">
                <Icon name="shield" />
              </span>
              <p className="muted">
                <b>Mestre</b> nos casos que você abre. O papel é de cada caso, não da conta.
              </p>
            </div>
          </div>
        </>
      }
      topoCelular={
        <header className="acesso-topo so-cel">
          <Link
            className="btn icon ghost"
            to={`/entrar${voltar === '/' ? '' : `?voltar=${encodeURIComponent(voltar)}`}`}
            aria-label="Voltar para entrar"
          >
            <Icon name="back" />
          </Link>
          <b>Criar conta</b>
        </header>
      }
    >
      <div className="col acesso-titulo so-pc" style={{ gap: 6 }}>
        <h1 className="h1">Criar conta</h1>
        <p className="muted">Leva menos de um minuto.</p>
      </div>
      <p className="small muted so-cel">
        Você será jogador nos casos em que entrar por convite e mestre nos casos que abrir.
      </p>

      {discord !== false && (
        <>
          <BotaoDiscord href={linkDoDiscord(true, voltar)}>Continuar com Discord</BotaoDiscord>
          <Ou />
        </>
      )}

      <form noValidate onSubmit={(e) => void enviar(e)} style={{ gap: 14 }}>
        <Field label="Nome que aparece na mesa" error={campos['nome']}>
          <Input
            ref={primeiroCampo}
            autoComplete="nickname"
            maxLength={60}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
            }}
          />
        </Field>
        <Field label="E-mail" error={campos['email']}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </Field>
        <Field label="Senha" error={campos['senha']}>
          <CampoSenha
            autoComplete="new-password"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
            }}
          />
          <ForcaDaSenha senha={senha} />
        </Field>
        <Checkbox
          checked={aceite}
          onChange={(e) => {
            setAceite(e.target.checked);
          }}
          className="check-topo"
          label={
            <span className="small">
              <span className="so-pc">
                Li e aceito como a LIMIAR guarda meus dados: só neste servidor, sem venda a
                terceiros.
              </span>
              <span className="so-cel">Aceito como a LIMIAR guarda meus dados.</span>
            </span>
          }
        />
        {campos['aceite'] && <span className="ferr">{campos['aceite']}</span>}
        <Button
          type="submit"
          variant="primary"
          wide
          className="grande"
          disabled={!pronto}
          loading={enviando}
        >
          Criar conta
        </Button>
        {!pronto && (
          <span className="small muted" style={{ textAlign: 'center' }}>
            O botão libera quando a senha e o aceite estiverem certos.
          </span>
        )}
      </form>

      {falha?.tipo === 'recusa' && <Banner tone="err">{falha.mensagem}</Banner>}
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
          Já tem conta?{' '}
          <Link to={`/entrar${voltar === '/' ? '' : `?voltar=${encodeURIComponent(voltar)}`}`}>
            Entrar
          </Link>
        </p>
      </div>
    </TelaDeAcesso>
  );
}
