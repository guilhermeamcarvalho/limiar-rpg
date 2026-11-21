// Páginas que o menu já aponta, mas que chegam em fases seguintes. Mostram onde a pessoa está
// e como voltar, em vez de uma página não encontrada.
import { useEffect, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { tituloDaPagina, type CampanhaDetalhe } from '@membrana/shared';
import { pedir } from '../auth/api.ts';
import { linkDaCampanha, linkDoDossie, type PaginaDaCampanha } from '../casos/formatos.ts';
import {
  Async,
  Card,
  EmptyState,
  Icon,
  Skeleton,
  useCarga,
  type NomeDoIcone,
} from '../ui/index.ts';

function EmBreve({
  titulo,
  icone,
  children,
  acao,
}: {
  titulo: string;
  icone: NomeDoIcone;
  children: string;
  acao?: ReactNode;
}) {
  useEffect(() => {
    document.title = tituloDaPagina(titulo);
  }, [titulo]);
  return (
    <div className="wrap col" style={{ paddingTop: 40, paddingBottom: 64, gap: 24 }}>
      <h1 className="h1">{titulo}</h1>
      <Card pad>
        <EmptyState icon={<Icon name={icone} size="xl" />} title="Em breve" action={acao}>
          {children}
        </EmptyState>
      </Card>
    </div>
  );
}

const VOLTAR = (
  <Link className="btn" to="/">
    Voltar para a Central
  </Link>
);

export function Personagens() {
  return (
    <EmBreve titulo="Personagens" icone="users" acao={VOLTAR}>
      Seus sobreviventes ficam aqui assim que a criação de personagem chegar.
    </EmBreve>
  );
}

export function Arquivo() {
  return (
    <EmBreve titulo="Arquivo" icone="book" acao={VOLTAR}>
      As regras de consulta rápida e os itens chegam junto com a ficha.
    </EmBreve>
  );
}

const DA_CAMPANHA = {
  mesa: { titulo: 'Mesa', icone: 'map', texto: 'A mesa ao vivo, com mapa, tokens e dados.' },
  escudo: { titulo: 'Escudo', icone: 'shield', texto: 'O escudo do mestre, com salas e pistas.' },
  ficha: { titulo: 'Ficha', icone: 'user', texto: 'A ficha do personagem neste caso.' },
} as const satisfies Record<
  PaginaDaCampanha,
  { titulo: string; icone: NomeDoIcone; texto: string }
>;

/** /campanhas/:id/mesa, /escudo e /ficha: o caso vem da URL, e o personagem de ?personagem=. */
export function PaginaDaCampanhaEmBreve({ pagina }: { pagina: PaginaDaCampanha }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const personagem = params.get('personagem');
  const info = DA_CAMPANHA[pagina];
  const uso = useCarga(`/api/campanhas/${id}`, (signal) =>
    pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(id)}`, {
      signal,
    }).then((r) => r.campanha),
  );

  useEffect(() => {
    document.title = tituloDaPagina(info.titulo);
  }, [info.titulo]);

  return (
    <div className="wrap col" style={{ paddingTop: 40, paddingBottom: 64, gap: 24 }}>
      <Async
        uso={uso}
        falha="O caso não carregou."
        esqueleto={
          <Card pad className="col">
            <Skeleton variant="h" width="50%" />
            <Skeleton width="70%" />
          </Card>
        }
      >
        {(caso) => (
          <>
            <div className="col" style={{ gap: 6 }}>
              <span className="lab">{info.titulo}</span>
              <h1 className="h1">{caso.nome}</h1>
            </div>
            <Card pad>
              <EmptyState
                icon={<Icon name={info.icone} size="xl" />}
                title="Em breve"
                action={
                  <div className="row wrapx" style={{ justifyContent: 'center' }}>
                    <Link className="btn" to={linkDoDossie(caso.id)}>
                      <Icon name="folder" size="sm" />
                      Dossiê do caso
                    </Link>
                    {pagina !== 'mesa' && (
                      <Link className="btn ghost" to={linkDaCampanha(caso.id, 'mesa', personagem)}>
                        Mesa
                      </Link>
                    )}
                  </div>
                }
              >
                {info.texto}
              </EmptyState>
            </Card>
          </>
        )}
      </Async>
    </div>
  );
}
