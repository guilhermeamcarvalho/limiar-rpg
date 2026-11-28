// As 20 perícias da ficha, clicáveis (artboard Ficha, coluna do meio). Cada linha mostra o
// atributo de origem, o dado do atributo, o da perícia e os bônus; clicar testa. Em dados
// virtuais a página pede o resultado oficial ao servidor; em físicos, abre o modal.
import { useId } from 'react';
import {
  ATRIBUTOS_OP2,
  PERICIAS_OP2,
  faces,
  type AtributoOp2,
  type Dado,
  type FichaOp2,
  type PericiaOp2,
} from '@membrana/shared';
import { Card, Checkbox, cx, Icon } from '../../ui/index.ts';
import { previaDoTeste, type Armados } from './extras.ts';

const SIGLA = Object.fromEntries(ATRIBUTOS_OP2.map((a) => [a.id, a.sigla])) as Record<
  AtributoOp2,
  string
>;

/** Em ordem alfabética, como no artboard: Acrobacia, Aptidão, Atletismo... */
export const PERICIAS_EM_ORDEM = [...PERICIAS_OP2].sort((a, b) =>
  a.nome.localeCompare(b.nome, 'pt-BR'),
);

/** DTs do seletor: as comuns e a padrão do caso. */
export function opcoesDeDt(padrao: number): number[] {
  return [...new Set([5, 7, 10, 12, 15, 20, padrao])].sort((a, b) => a - b);
}

/** O dado desenhado com o número de faces dentro (não é um valor rolado). */
function Forma({ dado, papel }: { dado: Dado; papel: 'atributo' | 'pericia' | 'bonus' }) {
  return (
    <span
      className={cx('dz', dado, papel === 'pericia' && 'w', papel === 'bonus' && 'y')}
      aria-hidden="true"
    >
      {faces(dado)}
    </span>
  );
}

export interface PericiasProps {
  ficha: FichaOp2;
  dt: number;
  dtPadrao: number;
  ocultarDt?: boolean;
  aoMudarDt: (dt: number) => void;
  ajuda: boolean;
  aoMudarAjuda: (ajuda: boolean) => void;
  armados: Armados;
  /** Desligado para quem só vê a ficha e enquanto um teste espera o servidor. */
  podeTestar: boolean;
  aoTestar: (periciaId: PericiaOp2) => void;
}

export function Pericias({
  ficha,
  dt,
  dtPadrao,
  ocultarDt = false,
  aoMudarDt,
  ajuda,
  aoMudarAjuda,
  armados,
  podeTestar,
  aoTestar,
}: PericiasProps) {
  const idDt = useId();
  return (
    <Card className="ficha-pericias-card">
      <div className="card-h wrapx">
        <span className="lab">Perícias · {podeTestar ? 'clique para testar' : 'prévia'}</span>
        <div className="row wrapx" style={{ gap: 12 }}>
          <Checkbox
            label="Ajuda"
            checked={ajuda}
            onChange={(e) => {
              aoMudarAjuda(e.target.checked);
            }}
          />
          {!ocultarDt && (
            <span className="row" style={{ gap: 6 }}>
              <label htmlFor={idDt} className="lab">
                DT
              </label>
              <select
                id={idDt}
                className="fld ficha-dt"
                value={dt}
                onChange={(e) => {
                  aoMudarDt(Number(e.target.value));
                }}
              >
                {opcoesDeDt(dtPadrao).map((n) => (
                  <option key={n} value={n}>
                    {n === dtPadrao ? `${String(n)} · padrão` : n}
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>
      </div>

      <div className="ficha-lista-pericias">
        {PERICIAS_EM_ORDEM.map((p) => {
          const previa = previaDoTeste(ficha, p.id, { dt, ajuda, armados });
          return (
            <button
              key={p.id}
              type="button"
              className="sk"
              aria-label={previa.descricao}
              disabled={!podeTestar}
              onClick={() => {
                aoTestar(p.id);
              }}
            >
              <span>
                {p.nome} <span className="src">{SIGLA[p.atributo]}</span>
              </span>
              <span className="row" style={{ gap: 6 }}>
                <Forma dado={previa.teste.atributo} papel="atributo" />
                <Forma dado={previa.teste.pericia} papel="pericia" />
                {previa.bonus.map((b) =>
                  b.armado ? (
                    <Forma key={b.origem} dado={b.tipo} papel="bonus" />
                  ) : (
                    <span
                      key={b.origem}
                      className={cx('dz y', b.tipo)}
                      title={`${b.origem} disponível`}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  ),
                )}
              </span>
              <Icon name="dice" size="sm" className="muted" />
            </button>
          );
        })}
      </div>

      <div className="row wrapx ficha-legenda" aria-hidden="true">
        <span className="small muted">Atributo</span>
        <span className="dz">8</span>
        <span className="small muted">Perícia</span>
        <span className="dz w">6</span>
        <span className="small muted">Bônus disponível</span>
        <span className="dz y d4">+</span>
      </div>
    </Card>
  );
}
