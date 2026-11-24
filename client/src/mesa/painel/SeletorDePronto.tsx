// Escolher um item da arte pronta (props ou modelos de NPC): busca pelo nome (sem ligar para
// acento) e filtro por categoria, com a miniatura de cada um.
import { useId, useState } from 'react';
import { paraBusca } from '../../casos/formatos.ts';
import { cx, Input } from '../../ui/index.ts';
import { urlDaImagem } from '../prontos.ts';

export interface ItemPronto {
  readonly id: string;
  readonly nome: string;
  readonly categoria: string;
}

/** Os itens que batem com a busca e a categoria. */
export function filtrarProntos<T extends ItemPronto>(
  itens: readonly T[],
  busca: string,
  categoria: string | null,
): T[] {
  const termo = paraBusca(busca);
  return itens.filter(
    (i) =>
      (!categoria || i.categoria === categoria) && (!termo || paraBusca(i.nome).includes(termo)),
  );
}

export function SeletorDePronto({
  itens,
  categorias,
  rotulo,
  escolhido = null,
  aoEscolher,
  verbo = 'Escolher',
  redondo = false,
}: {
  itens: readonly ItemPronto[];
  categorias: readonly string[];
  /** O nome do grupo, para o leitor de tela ("Props prontos"). */
  rotulo: string;
  escolhido?: string | null;
  aoEscolher: (id: string) => void;
  /** O verbo do botão de cada item: "Pôr Caixote no mapa", "Escolher Cultista". */
  verbo?: string;
  /** Miniatura redonda, como o token. */
  redondo?: boolean;
}) {
  const id = useId();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const visiveis = filtrarProntos(itens, busca, categoria);

  return (
    <div className="col" style={{ gap: 8 }} role="group" aria-label={rotulo}>
      <label className="sr-only" htmlFor={`${id}-busca`}>
        Buscar em {rotulo.toLowerCase()}
      </label>
      <Input
        id={`${id}-busca`}
        type="search"
        placeholder="Buscar pelo nome"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
        }}
        // Dentro de um formulário (o do NPC), Enter na busca não envia o formulário.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
      />
      <div className="prontos-categorias" role="group" aria-label="Categorias">
        {[null, ...categorias].map((c) => (
          <button
            key={c ?? 'todas'}
            type="button"
            className={cx('chip', categoria === c && 'on')}
            aria-pressed={categoria === c}
            onClick={() => {
              setCategoria(c);
            }}
          >
            {c ?? 'Todas'}
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <p className="small muted">Nada com esse nome.</p>
      ) : (
        <div className="prontos-grade">
          {visiveis.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('prop-pronto', escolhido === item.id && 'on')}
              aria-label={`${verbo} ${item.nome}${verbo.startsWith('Pôr') ? ' no mapa' : ''}`}
              aria-pressed={escolhido === null ? undefined : escolhido === item.id}
              onClick={() => {
                aoEscolher(item.id);
              }}
            >
              <img
                src={urlDaImagem(item.id)}
                alt=""
                loading="lazy"
                className={cx(redondo && 'redondo')}
              />
              <span className="small">{item.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
