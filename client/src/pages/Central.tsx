// Central. PROVISÓRIA: só confirma quem entrou. A tela de verdade é a #21.
import { useEffect, useState } from 'react';
import { tituloDaPagina } from '@limiar/shared';
import { useMe } from '../auth/sessao.tsx';
import { Button, Card } from '../ui/index.ts';

export function Central() {
  const { sessao, sair } = useMe();
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    document.title = tituloDaPagina('Central');
  }, []);

  if (sessao.estado !== 'logado') return null;

  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <Card pad className="col" style={{ gap: 16, maxWidth: 560 }}>
        <span className="eyebrow">Central</span>
        <h1 className="h2">Olá, {sessao.usuario.nome}</h1>
        <p className="muted">Você entrou. A Central de verdade chega na #21.</p>
        <div>
          <Button
            loading={saindo}
            onClick={() => {
              setSaindo(true);
              void sair().finally(() => {
                setSaindo(false);
              });
            }}
          >
            Sair
          </Button>
        </div>
      </Card>
    </main>
  );
}
