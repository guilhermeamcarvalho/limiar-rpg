// O cartão de resultado de um teste (artboards Componentes e Ficha): os dados com o papel de cada
// um, o total, a DT, o veredito e a nota do que mudou. Mostra sempre o que o servidor devolveu.
import type { ReactNode } from 'react';
import type { Veredito } from '@membrana/shared';
import { cx } from './cx.ts';
import { Die, Note, type TipoDeDado } from './Display.tsx';

export interface DadoDoResultado {
  tipo: TipoDeDado;
  valor: number;
  papel: 'atributo' | 'pericia' | 'bonus';
  /** Embaixo do dado: "Mente", "Máquinas", "Gambiarra". */
  rotulo: string;
  /** Não entrou na soma (o menor, com 4 dados). */
  descartado: boolean;
}

export interface ResultadoTesteProps {
  /** "Máquinas · Mente · agora". */
  titulo: ReactNode;
  origem: 'virtual' | 'fisico';
  dados: DadoDoResultado[];
  total: number;
  dt: number;
  veredito: Veredito;
  /** Quando verdadeiro (jogador), mostra só o total sem revelar DT nem sucesso/falha. */
  ocultarVeredito?: boolean;
  /** O que mudou na ficha: "Gambiarra usada: −2 PV." */
  nota?: ReactNode;
  /** Apagado: um resultado antigo, como "antes da edição". */
  apagado?: boolean;
}

const VEREDITOS = {
  sucesso: { texto: 'Sucesso', tom: 'ok', cor: 'green' },
  critico: { texto: 'Sucesso crítico', tom: 'crit', cor: 'gold' },
  falha: { texto: 'Falha', tom: 'ko', cor: 'red' },
  falhaCritica: { texto: 'Falha crítica', tom: 'ko', cor: 'red' },
} as const satisfies Record<Veredito, { texto: string; tom: string; cor: string }>;

export const textoDoVeredito = (veredito: Veredito) => VEREDITOS[veredito].texto;

export function ResultadoTeste({
  titulo,
  origem,
  dados,
  total,
  dt,
  veredito,
  ocultarVeredito = false,
  nota,
  apagado,
}: ResultadoTesteProps) {
  const v = VEREDITOS[veredito];
  return (
    <section
      className={cx('result', !ocultarVeredito && v.tom, apagado && 'apagado')}
      aria-label="Resultado do teste"
    >
      <div className="result-h">
        <span>{titulo}</span>
        <span>{origem === 'virtual' ? 'Dados virtuais' : 'Dados físicos'}</span>
      </div>
      <div className="result-b">
        <div className="row wrapx result-dados">
          {dados.map((d, i) => (
            <span key={i} className="die">
              <Die
                type={d.tipo}
                value={d.valor}
                role={d.papel}
                discarded={d.descartado}
                size="lg"
              />
              {d.rotulo}
            </span>
          ))}
        </div>
        <div className="result-total">
          <span className={cx('num', !ocultarVeredito && v.cor)}>{total}</span>
          {!ocultarVeredito && (
            <span className={cx('verdict', v.cor)}>
              {v.texto} · DT {dt}
            </span>
          )}
        </div>
      </div>
      {nota && <Note className="result-nota">{nota}</Note>}
    </section>
  );
}
