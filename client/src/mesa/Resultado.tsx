// Cartão de resultado de um teste na mesa (artboard 10, #70): aparece sempre no canto inferior
// esquerdo do mapa, nunca no centro, para não cobrir a cena. Todos veem o resultado; o mestre (e
// todo teste físico) vê também a origem dos dados. Some sozinho após alguns segundos (pausando ao
// passar o mouse).
import { useEffect, useRef, useState } from 'react';
import {
  nomeDaPericia,
  nomeDoAtributo,
  type Papel,
  type RegistroDeTeste,
  type Veredito,
} from '@membrana/shared';
import { Button, cx, Die, Icon, Note, textoDoVeredito } from '../ui/index.ts';

const TEMPO_LIMITE_MS = 8000;

const ESTILO_DO_VEREDITO = {
  sucesso: { tom: 'ok', cor: 'green' },
  critico: { tom: 'crit', cor: 'gold' },
  falha: { tom: 'ko', cor: 'red' },
  falhaCritica: { tom: 'ko', cor: 'red' },
} as const satisfies Record<Veredito, { tom: string; cor: string }>;

export interface ResultadoNaMesaProps {
  registro: RegistroDeTeste;
  papel: Papel;
  nomesDePersonagens: Readonly<Record<string, string>>;
  aoFechar: () => void;
  tempoLimiteMs?: number;
}

export function Resultado({
  registro,
  papel,
  nomesDePersonagens,
  aoFechar,
  tempoLimiteMs = TEMPO_LIMITE_MS,
}: ResultadoNaMesaProps) {
  const [pausado, setPausado] = useState(false);
  const fecharRef = useRef(aoFechar);
  useEffect(() => {
    fecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (pausado || tempoLimiteMs <= 0) return;
    const t = window.setTimeout(() => {
      fecharRef.current();
    }, tempoLimiteMs);
    return () => {
      window.clearTimeout(t);
    };
  }, [pausado, tempoLimiteMs, registro]);

  const mestre = papel === 'mestre';
  const estilo = ESTILO_DO_VEREDITO[registro.resultado.veredito];
  const quem =
    registro.personagemNome ??
    nomesDePersonagens[registro.personagemId] ??
    registro.autor?.nome ??
    'Personagem';
  const mostrarOrigem = mestre || registro.origem === 'fisico';
  const textoOrigem = registro.origem === 'fisico' ? 'Dados físicos' : 'Dados virtuais';

  return (
    <section
      className={cx('result mesa-resultado', mestre && estilo.tom)}
      aria-label="Resultado do teste na mesa"
      onMouseEnter={() => {
        setPausado(true);
      }}
      onMouseLeave={() => {
        setPausado(false);
      }}
    >
      <div className="result-h">
        <span>
          {nomeDaPericia(registro.periciaId)} · {nomeDoAtributo(registro.atributo)}
        </span>
        <span className="mesa-resultado-quem">
          <span>{mostrarOrigem ? `${quem} · ${textoOrigem}` : quem}</span>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="close" size="sm" />}
            aria-label="Fechar resultado"
            onClick={aoFechar}
          />
        </span>
      </div>
      <div className="result-b">
        <div className="row wrapx result-dados">
          {registro.resultado.dados.map((d, i) => {
            const rotulo =
              d.papel === 'atributo'
                ? nomeDoAtributo(registro.atributo)
                : d.papel === 'pericia'
                  ? nomeDaPericia(registro.periciaId)
                  : (d.origem ?? 'Bônus');
            return (
              <span key={i} className="die">
                <Die type={d.tipo} value={d.valor} role={d.papel} discarded={d.descartado} />
                {rotulo}
              </span>
            );
          })}
        </div>
        <div className="result-total">
          <span className={cx('num', mestre && estilo.cor)}>{registro.resultado.total}</span>
          {mestre && (
            <span className={cx('verdict', estilo.cor)}>
              {textoDoVeredito(registro.resultado.veredito)} · DT {registro.resultado.dt}
            </span>
          )}
        </div>
      </div>
      {registro.efeitos.length > 0 && (
        <Note className="result-nota">{registro.efeitos.join(' ')}</Note>
      )}
    </section>
  );
}
