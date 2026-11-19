// Peças comuns às telas Entrar e Criar conta.
import { useEffect, useState, type ReactNode } from 'react';
import { forcaDaSenha, MIN_SENHA } from '@limiar/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { Button, cx, Icon, Input, Marca } from '../../ui/index.ts';
import './acesso.css';

/** Só caminhos deste site, como no servidor: nada de mandar para outro endereço. */
export function caminhoSeguro(voltar: string | null): string {
  return voltar && /^\/(?![/\\])/.test(voltar) ? voltar : '/';
}

/** Se o servidor tem o Discord configurado. `null` enquanto pergunta. */
export function useDiscordLigado(): boolean | null {
  const [ligado, setLigado] = useState<boolean | null>(null);
  useEffect(() => {
    pedir<{ discord: boolean }>('/api/auth/opcoes')
      .then((r) => {
        setLigado(r.discord);
      })
      .catch(() => {
        setLigado(false);
      });
  }, []);
  return ligado;
}

/** Endereço que começa o login pelo Discord, levando "manter" e a página de volta. */
export function linkDoDiscord(manter: boolean, voltar: string): string {
  const params = new URLSearchParams({ ...(manter && { manter: '1' }), voltar });
  return `/api/auth/discord?${params.toString()}`;
}

/** Falha ao enviar o formulário, já traduzida para o que a tela mostra. */
export type Falha =
  | { tipo: 'campos'; campos: Record<string, string>; mensagem: string }
  | { tipo: 'recusa'; mensagem: string }
  | { tipo: 'rede' };

export function interpretarFalha(erro: unknown): Falha {
  if (erro instanceof ErroDaApi && erro.status < 500) {
    if (erro.campos) return { tipo: 'campos', campos: erro.campos, mensagem: erro.message };
    return { tipo: 'recusa', mensagem: erro.message };
  }
  // fetch rejeitado (sem rede) ou erro 5xx: vale tentar de novo.
  return { tipo: 'rede' };
}

export function TelaDeAcesso({
  ambiente,
  topoCelular,
  children,
}: {
  ambiente: ReactNode;
  topoCelular?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="acesso">
      <section className="acesso-ambiente">
        <Marca />
        <div className="acesso-chamada">{ambiente}</div>
        <p className="small muted">
          Feito para um grupo de amigos. Seus dados ficam só neste servidor.
        </p>
      </section>
      <main className={cx('acesso-form', topoCelular !== undefined && 'com-topo')}>
        {topoCelular}
        <div className="acesso-coluna">{children}</div>
      </main>
    </div>
  );
}

export function BotaoDiscord({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="btn discord wide grande" href={href}>
      <Icon name="chat" />
      {children}
    </a>
  );
}

/** Divisor "ou com e-mail" (no celular, só "ou"). */
export function Ou() {
  return (
    <div className="divisor">
      <span className="lab">
        ou<span className="so-pc"> com e-mail</span>
      </span>
    </div>
  );
}

/** Campo de senha com o botão de mostrar e esconder. Use dentro de um <Field>. */
export function CampoSenha(props: Omit<Parameters<typeof Input>[0], 'type'>) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="fld-com-botao">
      <Input {...props} type={visivel ? 'text' : 'password'} />
      <Button
        variant="ghost"
        size="sm"
        icon={<Icon name={visivel ? 'eyeoff' : 'eye'} size="sm" />}
        aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        onClick={() => {
          setVisivel(!visivel);
        }}
      />
    </div>
  );
}

/** Barra de quatro partes e o recado embaixo do campo de senha. */
export function ForcaDaSenha({ senha }: { senha: string }) {
  const forca = forcaDaSenha(senha);
  if (!senha) return null;
  const curta = senha.length < MIN_SENHA;
  const boa = !curta && forca >= 3;
  return (
    <>
      <div className={cx('forca', boa ? 'boa' : 'fraca')} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} className={cx(n <= forca && 'on')} />
        ))}
      </div>
      {curta ? (
        <span className="fwarn">
          <Icon name="alert" size="sm" />
          Senha fraca: use pelo menos {MIN_SENHA} caracteres.
        </span>
      ) : (
        <span className={cx('small', boa ? 'green' : 'gold')} style={{ fontWeight: 700 }}>
          {boa ? 'Senha boa' : 'Senha aceitável: misture letras, números e símbolos.'}
        </span>
      )}
    </>
  );
}
