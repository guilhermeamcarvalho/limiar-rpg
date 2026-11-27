// Aba de itens na mesa: mostra os itens do personagem vinculado e os espaços ocupados,
// espelhando a regra da ficha (`espacosDeItens`).
import { espacosDeItens, type Personagem } from '@membrana/shared';
import { pedir } from '../auth/api.ts';
import { Async, EmptyState, Icon, Meter, Skeleton, useCarga } from '../ui/index.ts';

export function AbaItens({
  personagemId,
  versao,
}: {
  personagemId: string | null;
  versao: number;
}) {
  const url = personagemId
    ? `/api/personagens/${encodeURIComponent(personagemId)}#${String(versao)}`
    : null;
  const uso = useCarga(url, (signal) =>
    pedir<{ personagem: Personagem }>(
      `/api/personagens/${encodeURIComponent(personagemId ?? '')}`,
      {
        signal,
      },
    ).then((r) => r.personagem),
  );

  if (!personagemId) {
    return (
      <div className="registro-vazio">
        <EmptyState icon={<Icon name="key" size="xl" />} title="Sem personagem em uso">
          Escolha um personagem neste caso para ver os itens dele aqui.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mesa-aba-lista">
      <Async
        uso={uso}
        falha="Os itens não carregaram."
        esqueleto={
          <div className="col">
            <Skeleton />
            <Skeleton width="70%" />
          </div>
        }
      >
        {(p) => {
          const espacos = espacosDeItens(p.ficha.atributos);
          const ocupados = p.ficha.itens.length;

          return (
            <div className="col" style={{ gap: 'var(--s3)' }}>
              <div className="col" style={{ gap: 'var(--s2)' }}>
                <div className="row between">
                  <span className="lab">Espaços ocupados</span>
                  <span className="small muted">
                    {ocupados} / {espacos} espaços
                  </span>
                </div>
                <Meter value={ocupados} max={espacos} label="Espaços de itens ocupados" />
                {ocupados > espacos && (
                  <p className="small muted" role="status">
                    Inventário acima do limite ({ocupados} de {espacos} espaços).
                  </p>
                )}
              </div>

              {p.ficha.itens.length === 0 ? (
                <EmptyState icon={<Icon name="key" size="xl" />} title="Nenhum item ainda">
                  Os itens adicionados na ficha aparecem aqui.
                </EmptyState>
              ) : (
                <ul className="list">
                  {p.ficha.itens.map((item) => (
                    <li key={item.id} className="li">
                      <div className="col" style={{ gap: 2 }}>
                        <b className="small">{item.nome}</b>
                        {item.descricao && <span className="small muted">{item.descricao}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
