// Coluna esquerda da ficha (artboard Ficha): atributos com o dado grande, PV e PD em caixas
// clicáveis, o Ímpeto do Executor e as habilidades da ocupação (Gambiarra). Cada mudança vai
// direto para o servidor pela fila de gravação da página.
import { useState } from 'react';
import {
  ATRIBUTOS_OP2,
  IMPETO_MAXIMO,
  dadoEfetivo,
  faces,
  habilidadesDaFicha,
  nomeDaPericia,
  nomeDoAtributo,
  temImpeto,
  type AtributoOp2,
  type FichaOp2,
  type Habilidade,
} from '@membrana/shared';
import { Button, Card, Chip, cx, Icon, MAX_CAIXAS, Meter, Modal } from '../../ui/index.ts';
import { habilidadeDisponivel, type Armados } from './extras.ts';

export function Atributos({ ficha }: { ficha: FichaOp2 }) {
  return (
    <Card pad className="col" style={{ gap: 14 }}>
      <span className="lab">Atributos</span>
      <div className="g3 ficha-atributos">
        {ATRIBUTOS_OP2.map((a) => {
          const base = ficha.atributos[a.id];
          const efetivo = dadoEfetivo(ficha, a.id);
          return (
            <div key={a.id} className="col ficha-atributo">
              <span className={cx('dz xl', efetivo)} aria-hidden="true">
                {faces(efetivo)}
              </span>
              <b className="disp">
                {a.nome}
                <span className="sr-only"> {efetivo}</span>
              </b>
              {efetivo !== base && (
                <span className="small gold">
                  {base} → {efetivo} na cena
                </span>
              )}
            </div>
          );
        })}
      </div>
      {ficha.modificadores.length > 0 && (
        <ul className="small muted ficha-modificadores">
          {ficha.modificadores.map((m, i) => (
            <li key={i}>
              {m.origem}: {nomeDoAlvo(m.alvo)} {m.passos > 0 ? '+' : '−'}
              {Math.abs(m.passos)} passo até o fim da cena.
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function nomeDoAlvo(alvo: FichaOp2['modificadores'][number]['alvo']): string {
  return ATRIBUTOS_OP2.some((a) => a.id === alvo)
    ? nomeDoAtributo(alvo as AtributoOp2)
    : nomeDaPericia(alvo as Exclude<typeof alvo, AtributoOp2>);
}

const RECURSO = {
  pv: { nome: 'PV', rotulo: 'lab red', caixas: 'boxes', perder: 'Perder', ganhar: 'Recuperar' },
  pd: { nome: 'PD', rotulo: 'lab pd', caixas: 'boxes pd', perder: 'Perder', ganhar: 'Recuperar' },
} as const;

/**
 * Uma linha de PV ou PD: clicar numa caixa marca até ela; clicar na última marcada desmarca só
 * ela. Cada caixa diz ao leitor de tela qual é e se está marcada.
 */
function LinhaDeRecurso({
  tipo,
  valor,
  max,
  podeMudar,
  aoMudar,
}: {
  tipo: keyof typeof RECURSO;
  valor: number;
  max: number;
  podeMudar: boolean;
  aoMudar: (novo: number) => void;
}) {
  const r = RECURSO[tipo];
  const atual = Math.min(Math.max(valor, 0), max);
  return (
    <div className="res-row">
      <span className={r.rotulo}>{r.nome}</span>
      {max <= MAX_CAIXAS ? (
        <div
          className={cx(r.caixas, 'ficha-caixas')}
          role="group"
          aria-label={`${r.nome}: ${String(atual)} de ${String(max)}`}
        >
          {Array.from({ length: max }, (_, i) => {
            const alvo = i + 1 === atual ? i : i + 1;
            return (
              <button
                key={i}
                type="button"
                className={cx(i >= atual && 'o')}
                aria-label={`${r.nome}, caixa ${String(i + 1)}`}
                aria-pressed={i < atual}
                disabled={!podeMudar}
                onClick={() => {
                  aoMudar(alvo);
                }}
              />
            );
          })}
        </div>
      ) : (
        <Meter value={atual} max={max} label={r.nome} kind={tipo} />
      )}
      <b aria-hidden="true">
        {atual}/{max}
      </b>
    </div>
  );
}

export function VidaESanidade({
  ficha,
  podeMudar,
  mudar,
}: {
  ficha: FichaOp2;
  podeMudar: boolean;
  mudar: (m: Partial<Pick<FichaOp2, 'pv' | 'pd'>>) => void;
}) {
  const botao = (tipo: 'pv' | 'pd', passo: 1 | -1) => {
    const r = RECURSO[tipo];
    const valor = ficha[tipo];
    const max = tipo === 'pv' ? ficha.pvMax : ficha.pdMax;
    const novo = valor + passo;
    return (
      <Button
        size="sm"
        className="grow"
        aria-label={`${passo < 0 ? r.perder : r.ganhar} 1 ${r.nome}`}
        disabled={!podeMudar || novo < 0 || novo > max}
        onClick={() => {
          mudar({ [tipo]: novo });
        }}
      >
        {passo < 0 ? '−1' : '+1'} {r.nome}
      </Button>
    );
  };
  return (
    <Card pad className="col" style={{ gap: 12 }}>
      <div className="row between">
        <span className="lab">Vida e sanidade</span>
        {podeMudar && (
          <span className="small muted ficha-dica-caixas">Clique numa caixa para marcar</span>
        )}
      </div>
      <LinhaDeRecurso
        tipo="pv"
        valor={ficha.pv}
        max={ficha.pvMax}
        podeMudar={podeMudar}
        aoMudar={(pv) => {
          mudar({ pv });
        }}
      />
      <LinhaDeRecurso
        tipo="pd"
        valor={ficha.pd}
        max={ficha.pdMax}
        podeMudar={podeMudar}
        aoMudar={(pd) => {
          mudar({ pd });
        }}
      />
      {podeMudar && (
        <div className="row wrapx" style={{ gap: 6 }}>
          {botao('pv', -1)}
          {botao('pv', 1)}
          {botao('pd', -1)}
          {botao('pd', 1)}
        </div>
      )}
    </Card>
  );
}

export function CartaoDoImpeto({
  ficha,
  armado,
  podeMudar,
  aoArmar,
  aoSubirAtributo,
}: {
  ficha: FichaOp2;
  armado: boolean;
  podeMudar: boolean;
  aoArmar: (armado: boolean) => void;
  aoSubirAtributo: (atributo: AtributoOp2) => void;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  if (!temImpeto(ficha)) return null;
  const subiu = ficha.impetoAtributo;
  return (
    <Card pad className="col ficha-impeto" style={{ gap: 12 }}>
      <div className="row between">
        <span className="lab gold">Ímpeto · Executor</span>
        <div
          className="boxes imp ficha-impeto-barra"
          role="meter"
          aria-label="Ímpeto"
          aria-valuemin={0}
          aria-valuemax={IMPETO_MAXIMO}
          aria-valuenow={ficha.impeto}
        >
          {Array.from({ length: IMPETO_MAXIMO }, (_, i) => (
            <i key={i} className={cx(i >= ficha.impeto && 'o')} />
          ))}
        </div>
      </div>
      <p className="small muted">
        Cada falha enche um espaço. Gaste 1 para somar d4 num teste, ou 3 para subir um atributo um
        passo até o fim da cena.
      </p>
      {subiu && (
        <p className="small gold">{nomeDoAtributo(subiu)} subiu um passo até o fim da cena.</p>
      )}
      {podeMudar && (
        <div className="row wrapx">
          <Button
            size="sm"
            className="grow"
            aria-pressed={armado}
            disabled={!armado && ficha.impeto < 1}
            icon={<Icon name={armado ? 'check' : 'plus'} size="sm" />}
            onClick={() => {
              aoArmar(!armado);
            }}
          >
            {armado ? 'No próximo teste · +d4' : 'Gastar 1 · +d4'}
          </Button>
          <Button
            size="sm"
            className="grow"
            disabled={ficha.impeto < IMPETO_MAXIMO || subiu !== null}
            onClick={() => {
              setEscolhendo(true);
            }}
          >
            Gastar 3 · +1 passo
          </Button>
        </div>
      )}
      <Modal
        open={escolhendo}
        onClose={() => {
          setEscolhendo(false);
        }}
        title="Subir um atributo"
      >
        <p className="small muted">
          Gasta os 3 espaços de Ímpeto. O atributo sobe um passo até o fim da cena.
        </p>
        <div className="g3">
          {ATRIBUTOS_OP2.map((a) => (
            <Button
              key={a.id}
              onClick={() => {
                setEscolhendo(false);
                aoSubirAtributo(a.id);
              }}
            >
              {a.nome}
            </Button>
          ))}
        </div>
      </Modal>
    </Card>
  );
}

/** "+d4 em Máquinas ou Crime. Custa 2 PV." */
export function textoDaHabilidade(hab: Habilidade): string {
  const nomes = hab.pericias.map(nomeDaPericia);
  const onde =
    nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} ou ${String(nomes.at(-1))}` : nomes[0];
  const custo = [
    hab.custo.pv ? `${String(hab.custo.pv)} PV` : '',
    hab.custo.pd ? `${String(hab.custo.pd)} PD` : '',
  ]
    .filter(Boolean)
    .join(' e ');
  return `+${hab.dado} em ${String(onde)}.${custo ? ` Custa ${custo}.` : ''}`;
}

export function CartoesDeHabilidade({
  ficha,
  armados,
  podeMudar,
  aoArmar,
}: {
  ficha: FichaOp2;
  armados: Armados;
  podeMudar: boolean;
  aoArmar: (habilidade: string, armada: boolean) => void;
}) {
  return habilidadesDaFicha(ficha).map((hab) => {
    const usada = hab.limite === 'cena' && ficha.usadasNaCena.includes(hab.id);
    const disponivel = habilidadeDisponivel(ficha, hab);
    const armada = disponivel && armados.habilidades.includes(hab.id);
    const situacao = usada ? 'usada' : disponivel ? 'disponível' : 'sem PV ou PD';
    return (
      <Card key={hab.id} pad className="col" style={{ gap: 10 }}>
        <div className="row between">
          <span className="lab">{hab.nome}</span>
          <Chip>{hab.limite === 'cena' ? `1 por cena · ${situacao}` : situacao}</Chip>
        </div>
        <p className="small muted">{textoDaHabilidade(hab)}</p>
        {podeMudar && (
          <Button
            size="sm"
            aria-pressed={armada}
            disabled={!disponivel}
            icon={<Icon name={armada ? 'check' : 'plus'} size="sm" />}
            onClick={() => {
              aoArmar(hab.id, !armada);
            }}
          >
            {armada ? `${hab.nome} no próximo teste` : 'Usar no próximo teste'}
          </Button>
        )}
      </Card>
    );
  });
}
