// Tela de entrar. PROVISÓRIA: só o Discord. O e-mail entra na #12 e o visual final na #16.
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { tituloDaPagina } from '@limiar/shared';
import { pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import { Banner, Card, Checkbox, Icon } from '../ui/index.ts';

const ERROS: Record<string, string> = {
  'estado-invalido': 'O login expirou ou veio de outra aba. Tente de novo.',
  'discord-cancelado': 'Você cancelou no Discord. Tudo bem, é só tentar de novo.',
  'discord-falhou': 'O Discord não respondeu como esperado. Tente de novo em instantes.',
  'discord-indisponivel': 'O login com Discord não está configurado neste servidor.',
};

/** Só caminhos deste site, como no servidor: nada de mandar para outro endereço. */
function caminhoSeguro(voltar: string | null): string {
  return voltar && /^\/(?![/\\])/.test(voltar) ? voltar : '/';
}

export function Entrar() {
  const { sessao } = useMe();
  const [params] = useSearchParams();
  const [manter, setManter] = useState(true);
  const [discordLigado, setDiscordLigado] = useState<boolean | null>(null);
  const voltar = caminhoSeguro(params.get('voltar'));
  const erro = params.get('erro');

  useEffect(() => {
    document.title = tituloDaPagina('Entrar');
    pedir<{ discord: boolean }>('/api/auth/opcoes')
      .then((opcoes) => {
        setDiscordLigado(opcoes.discord);
      })
      .catch(() => {
        setDiscordLigado(false);
      });
  }, []);

  if (sessao.estado === 'logado') return <Navigate to={voltar} replace />;

  const href = `/api/auth/discord?${new URLSearchParams({
    ...(manter && { manter: '1' }),
    voltar,
  }).toString()}`;

  return (
    <main className="wrap" style={{ paddingTop: 64, maxWidth: 480 }}>
      <Card pad className="col" style={{ gap: 20 }}>
        <span className="eyebrow">LIMIAR</span>
        <h1 className="h2">Entrar</h1>
        {erro && <Banner tone="err">{ERROS[erro] ?? 'Não deu para entrar. Tente de novo.'}</Banner>}
        {discordLigado === false && !erro && (
          <Banner tone="warn">O login com Discord não está configurado neste servidor.</Banner>
        )}
        <a
          className="btn red wide"
          href={href}
          aria-disabled={discordLigado === false || undefined}
          onClick={(e) => {
            if (discordLigado === false) e.preventDefault();
          }}
        >
          <Icon name="chat" size="sm" />
          Entrar com Discord
        </a>
        <Checkbox
          label="Manter conectado por 30 dias"
          checked={manter}
          onChange={(e) => {
            setManter(e.target.checked);
          }}
        />
        <p className="small muted">Entrar com e-mail e senha chega em breve.</p>
      </Card>
    </main>
  );
}
