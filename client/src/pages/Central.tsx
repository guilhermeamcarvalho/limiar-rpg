// Central. PROVISÓRIA até a #21: mostra quem entrou e os casos, com atalhos para testar o
// fluxo de convite (criar caso e gerar convite) antes de existirem as telas Casos e Novo caso.
import { useCallback, useEffect, useState } from 'react';
import { tituloDaPagina, type CampanhaNaLista, type ConviteDoMestre } from '@limiar/shared';
import { pedir } from '../auth/api.ts';
import { useMe } from '../auth/sessao.tsx';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  Skeleton,
  Tag,
  useToast,
} from '../ui/index.ts';

function CartaoDoCaso({ caso }: { caso: CampanhaNaLista }) {
  const avisos = useToast();
  const [gerando, setGerando] = useState(false);
  const [convite, setConvite] = useState<{ codigo: string; link: string } | null>(null);

  async function gerarConvite() {
    setGerando(true);
    try {
      const r = await pedir<{ convite: ConviteDoMestre; link: string }>(
        `/api/campanhas/${caso.id}/convites`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      );
      setConvite({ codigo: r.convite.codigo, link: r.link });
    } catch {
      avisos.show({ type: 'err', title: 'Não deu para gerar o convite' });
    } finally {
      setGerando(false);
    }
  }

  return (
    <Card pad className="col" style={{ gap: 10 }}>
      <div className="row between">
        <span className="lab">Caso nº {String(caso.numero ?? 0).padStart(3, '0')}</span>
        <Tag tone={caso.papel === 'mestre' ? 'gold' : 'blue'}>
          {caso.papel === 'mestre' ? 'Mestre' : 'Jogador'}
        </Tag>
      </div>
      <h2 className="h3">{caso.nome}</h2>
      <p className="small muted">
        {caso.sistema.nome} · {caso.contagens.jogadores}{' '}
        {caso.contagens.jogadores === 1 ? 'jogador' : 'jogadores'}
      </p>
      {caso.papel === 'mestre' && (
        <div className="col" style={{ gap: 8 }}>
          <div>
            <Button size="sm" loading={gerando} onClick={() => void gerarConvite()}>
              Gerar convite
            </Button>
          </div>
          {convite && (
            <p className="small">
              Código <b className="type">{convite.codigo}</b> ·{' '}
              <a href={convite.link}>{convite.link}</a>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function Central() {
  const { sessao, sair } = useMe();
  const avisos = useToast();
  const [casos, setCasos] = useState<CampanhaNaLista[] | null>(null);
  const [erro, setErro] = useState(false);
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const carregar = useCallback(() => {
    pedir<{ campanhas: CampanhaNaLista[] }>('/api/campanhas')
      .then((r) => {
        setCasos(r.campanhas);
        setErro(false);
      })
      .catch(() => {
        setErro(true);
      });
  }, []);

  useEffect(() => {
    document.title = tituloDaPagina('Central');
    carregar();
  }, [carregar]);

  if (sessao.estado !== 'logado') return null;

  async function criarCaso() {
    setCriando(true);
    try {
      await pedir('/api/campanhas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      setNome('');
      carregar();
    } catch {
      avisos.show({ type: 'err', title: 'Não deu para criar o caso' });
    } finally {
      setCriando(false);
    }
  }

  return (
    <main className="wrap col" style={{ paddingTop: 48, paddingBottom: 64, gap: 24 }}>
      <div className="row between wrapx">
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Central</span>
          <h1 className="h2">Olá, {sessao.usuario.nome}</h1>
        </div>
        <Button
          variant="ghost"
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

      <Banner>
        Tela provisória. A Central de verdade chega na #21, e a criação de casos na #23.
      </Banner>

      <section className="col">
        <h2 className="h3">Seus casos</h2>
        {erro && (
          <Banner
            tone="err"
            action={
              <Button size="sm" onClick={carregar}>
                Tentar de novo
              </Button>
            }
          >
            Não deu para carregar os casos.
          </Banner>
        )}
        {!casos && !erro && (
          <Card pad className="col" aria-busy="true">
            <Skeleton variant="h" width="50%" />
            <Skeleton />
          </Card>
        )}
        {casos?.length === 0 && (
          <EmptyState icon={<Icon name="folder" size="xl" />} title="Nenhum caso ainda">
            Crie um caso abaixo ou entre num pelo convite do mestre.
          </EmptyState>
        )}
        {casos && casos.length > 0 && (
          <div className="g3">
            {casos.map((caso) => (
              <CartaoDoCaso key={caso.id} caso={caso} />
            ))}
          </div>
        )}
      </section>

      <Card pad style={{ maxWidth: 560 }}>
        <form
          className="col"
          onSubmit={(e) => {
            e.preventDefault();
            void criarCaso();
          }}
        >
          <Field label="Novo caso (Ordem Paranormal II)">
            <Input
              value={nome}
              placeholder="O Sinal de Santa Ermida"
              onChange={(e) => {
                setNome(e.target.value);
              }}
            />
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={!nome.trim()} loading={criando}>
              Criar caso
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
