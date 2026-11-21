// Perfil. Por enquanto só quem entrou e o "Sair"; as preferências chegam na Fase 4.
import { useEffect } from 'react';
import { tituloDaPagina } from '@membrana/shared';
import { useMe } from '../auth/sessao.tsx';
import { iniciais } from '../casos/formatos.ts';
import { Avatar, Button, Card, Icon, useEnvio, useToast } from '../ui/index.ts';

export function Perfil() {
  const { sessao, sair } = useMe();
  const avisos = useToast();
  const saida = useEnvio(async () => {
    try {
      // A sessão vira anônima e o ExigirLogin leva para /entrar, sem ?voltar.
      await sair();
    } catch {
      avisos.show({ type: 'err', title: 'Não deu para sair', text: 'Tente de novo.' });
    }
  });

  useEffect(() => {
    document.title = tituloDaPagina('Perfil');
  }, []);

  if (sessao.estado !== 'logado') return null;
  const { usuario } = sessao;

  return (
    <div className="wrap col" style={{ paddingTop: 40, paddingBottom: 64, gap: 24 }}>
      <h1 className="h1">Perfil</h1>
      <Card pad className="row wrapx" style={{ maxWidth: 560 }}>
        <Avatar initials={iniciais(usuario.nome)} name={usuario.nome} size="lg" />
        <div className="grow col" style={{ gap: 2 }}>
          <b className="h3">{usuario.nome}</b>
          {usuario.email && <span className="small muted">{usuario.email}</span>}
        </div>
        <Button
          icon={<Icon name="logout" size="sm" />}
          loading={saida.enviando}
          onClick={() => void saida.enviar()}
        >
          Sair
        </Button>
      </Card>
    </div>
  );
}
