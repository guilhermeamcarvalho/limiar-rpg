// O pop-up que aparece logo depois de a pessoa rolar: os números giram por um instante, param no
// total e, num teste, o veredito aparece grande ("Sucesso", "Falha"…) com a DT. Some sozinho em
// alguns segundos, com um clique em qualquer lugar ou com Esc. Quem pede menos movimento vê o
// resultado direto, sem o giro.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  lerExpressaoDeDados,
  nomeDaPericia,
  nomeDoAtributo,
  type RegistroDeTeste,
  type Veredito,
} from '@membrana/shared';
import { cx } from './cx.ts';
import { Die, type TipoDeDado } from './Display.tsx';
import { textoDoVeredito } from './ResultadoTeste.tsx';

export interface DadoRevelado {
  /** Sem tipo conhecido (um d3, um d100), o dado aparece só como número. */
  tipo: TipoDeDado | null;
  valor: number;
  papel: 'atributo' | 'pericia' | 'bonus';
  rotulo?: string;
  descartado?: boolean;
}

export interface Revelacao {
  /** Muda a cada rolagem: reinicia o giro e o tempo para sumir. */
  chave: string | number;
  /** "Luta · Físico", "2d6+1". */
  titulo: string;
  dados: DadoRevelado[];
  total: number;
  /** Só nos testes: rolagem livre não tem DT nem veredito. */
  veredito?: Veredito;
  dt?: number;
  /** Dados físicos já foram rolados na mão: aparece direto, sem giro. */
  girar: boolean;
}

const TIPOS: readonly TipoDeDado[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const ehTipo = (t: string): t is TipoDeDado => (TIPOS as readonly string[]).includes(t);

/** De um teste resolvido (na Mesa ou na Ficha). */
export function revelacaoDoTeste(registro: RegistroDeTeste): Revelacao {
  return {
    chave: registro.id,
    titulo: `${nomeDaPericia(registro.periciaId)} · ${nomeDoAtributo(registro.atributo)}`,
    dados: registro.resultado.dados.map((d) => ({
      tipo: d.tipo,
      valor: d.valor,
      papel: d.papel,
      rotulo:
        d.papel === 'atributo'
          ? nomeDoAtributo(registro.atributo)
          : d.papel === 'pericia'
            ? nomeDaPericia(registro.periciaId)
            : (d.origem ?? 'Bônus'),
      descartado: d.descartado,
    })),
    total: registro.resultado.total,
    veredito: registro.resultado.veredito,
    dt: registro.resultado.dt,
    girar: registro.origem === 'virtual',
  };
}

/** De uma rolagem livre ("2d6+1"), como a do painel de dados ou do /r no chat. */
export function revelacaoDaRolagem(rolagem: {
  chave: string | number;
  expressao: string;
  dados: number[];
  total: number;
}): Revelacao {
  let tipo: TipoDeDado | null = null;
  try {
    const faces = `d${String(lerExpressaoDeDados(rolagem.expressao).faces)}`;
    if (ehTipo(faces)) tipo = faces;
  } catch {
    // Expressão que o servidor aceitou mas este cliente não reconhece: mostra só os números.
  }
  return {
    chave: rolagem.chave,
    titulo: rolagem.expressao,
    dados: rolagem.dados.map((valor) => ({ tipo, valor, papel: 'atributo' })),
    total: rolagem.total,
    girar: true,
  };
}

const COR_DO_VEREDITO = {
  sucesso: 'green',
  critico: 'gold',
  falha: 'red',
  falhaCritica: 'red',
} as const satisfies Record<Veredito, string>;

const GIRO_MS = 650;
const VISIVEL_MS = 4500;

function querMenosMovimento() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function RevelacaoDoDado({
  revelacao,
  aoFechar,
}: {
  revelacao: Revelacao;
  aoFechar: () => void;
}) {
  const girar = revelacao.girar && !querMenosMovimento();
  const [girando, setGirando] = useState(girar);
  const [sorteado, setSorteado] = useState(revelacao.total);
  const [parado, setParado] = useState(false);
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  }, [aoFechar]);

  // O giro: números ao acaso até parar no total.
  useEffect(() => {
    if (!girar) return;
    const teto = Math.max(revelacao.total, 6);
    const troca = window.setInterval(() => {
      setSorteado(1 + Math.floor(Math.random() * teto));
    }, 55);
    const fim = window.setTimeout(() => {
      window.clearInterval(troca);
      setSorteado(revelacao.total);
      setGirando(false);
    }, GIRO_MS);
    return () => {
      window.clearInterval(troca);
      window.clearTimeout(fim);
    };
  }, [girar, revelacao.total]);

  // Some sozinho depois de um tempo; com o mouse em cima, espera.
  useEffect(() => {
    if (girando || parado) return;
    const t = window.setTimeout(() => {
      fechar.current();
    }, VISIVEL_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [girando, parado]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar.current();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const { veredito, dt } = revelacao;
  const cor = veredito ? COR_DO_VEREDITO[veredito] : null;
  const anuncio = veredito
    ? `${revelacao.titulo}: ${String(revelacao.total)}, ${textoDoVeredito(veredito)} contra DT ${String(dt)}`
    : `${revelacao.titulo}: ${String(revelacao.total)}`;

  return createPortal(
    <div
      className="revelacao-veu"
      onClick={() => {
        fechar.current();
      }}
    >
      <section
        className={cx('revelacao', !girando && cor, !girando && 'pronta')}
        aria-label="Resultado da rolagem"
        onMouseEnter={() => {
          setParado(true);
        }}
        onMouseLeave={() => {
          setParado(false);
        }}
      >
        <span className="sr-only" role="status">
          {girando ? '' : anuncio}
        </span>
        <span className="revelacao-titulo" aria-hidden="true">
          {revelacao.titulo}
        </span>
        <span className={cx('revelacao-total', !girando && cor)} aria-hidden="true">
          {sorteado}
        </span>
        {veredito && (
          <span className={cx('revelacao-veredito', cor)} aria-hidden="true">
            {girando ? ' ' : textoDoVeredito(veredito)}
          </span>
        )}
        {dt !== undefined && (
          <span className="revelacao-dt" aria-hidden="true">
            DT {dt}
          </span>
        )}
        <span className={cx('revelacao-dados', girando && 'girando')} aria-hidden="true">
          {revelacao.dados.map((d, i) => (
            <span key={i} className="die">
              {d.tipo ? (
                <Die
                  type={d.tipo}
                  value={d.valor}
                  role={d.papel}
                  discarded={Boolean(d.descartado)}
                />
              ) : (
                <b className="revelacao-numero">{girando ? '?' : d.valor}</b>
              )}
              {d.rotulo}
            </span>
          ))}
        </span>
        <span className="revelacao-dica" aria-hidden="true">
          Clique ou Esc para fechar
        </span>
      </section>
    </div>,
    document.body,
  );
}
