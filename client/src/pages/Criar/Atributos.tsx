// Passo 3 da criação: atributos (artboard "07 · Criar" e "Celular · 07"), com os avisos RF-09.
// Cada atributo começa em d6; 2 passos para subir; baixar um para d4 dá mais um passo.
// Fora da regra é permitido: o aviso dourado não bloqueia.
import {
  ATRIBUTOS_OP2,
  DADOS,
  PASSOS_DE_ATRIBUTO,
  avisosDaCriacao,
  mudarPasso,
  passosEmAtributos,
  type AtributoOp2,
  type Dado,
  type FichaOp2,
} from '@membrana/shared';
import { Banner, Button, Card, Die, Icon, cx, type NomeDoIcone } from '../../ui/index.ts';

const DESCRICAO: Record<AtributoOp2, { icone: NomeDoIcone; texto: string }> = {
  fisico: { icone: 'sword', texto: 'Força, reflexo, resistência. Soma no PV.' },
  mente: { icone: 'brain', texto: 'Raciocínio, memória, percepção. Soma no PD.' },
  emocao: { icone: 'heart', texto: 'Vontade, empatia, presença. Soma no PD.' },
};

const faces = (dado: Dado) => Number(dado.slice(1));

/** "d8 · +1 passo", "d6 · sem mudança", "d4 · devolve 1 passo". */
export function textoDoPasso(dado: Dado, inicial: Dado = 'd6'): string {
  const n = DADOS.indexOf(dado) - DADOS.indexOf(inicial);
  if (n === 0) return `${dado} · sem mudança`;
  if (n < 0) return `${dado} · devolve ${String(-n)} ${-n === 1 ? 'passo' : 'passos'}`;
  return `${dado} · +${String(n)} ${n === 1 ? 'passo' : 'passos'}`;
}

/** Avisos da regra com o lembrete de que dá para salvar assim. */
export function AvisosDaRegra({ mensagens }: { mensagens: string[] }) {
  return (
    <>
      {mensagens.map((m) => (
        <Banner key={m} tone="warn">
          {m} Dá para salvar assim; o mestre verá o aviso na ficha.
        </Banner>
      ))}
    </>
  );
}

export function Atributos({
  ficha,
  mudar,
}: {
  ficha: FichaOp2;
  mudar: (atributos: FichaOp2['atributos']) => void;
}) {
  const usados = passosEmAtributos(ficha.atributos);
  const restantes = PASSOS_DE_ATRIBUTO - usados;
  const avisos = avisosDaCriacao(ficha).filter((a) => a.campo.startsWith('atributos'));

  return (
    <>
      <div className="g3 criar-atributos">
        {ATRIBUTOS_OP2.map((a) => {
          const dado = ficha.atributos[a.id];
          const mudou = dado !== 'd6';
          const trocar = (n: number) => {
            mudar({ ...ficha.atributos, [a.id]: mudarPasso(dado, n) });
          };
          return (
            <Card key={a.id} className={cx('col criar-atributo', mudou && 'hl')}>
              <Icon name={DESCRICAO[a.id].icone} size="lg" />
              <b className="h2" id={`atr-${a.id}`}>
                {a.nome}
              </b>
              <span className="small muted">{DESCRICAO[a.id].texto}</span>
              <div className="row criar-dado" role="group" aria-labelledby={`atr-${a.id}`}>
                <Button
                  icon={<span aria-hidden="true">−</span>}
                  aria-label={`Baixar ${a.nome}`}
                  disabled={dado === 'd4'}
                  onClick={() => {
                    trocar(-1);
                  }}
                />
                <Die type={dado} value={faces(dado)} size="xl" />
                <Button
                  icon={<span aria-hidden="true">+</span>}
                  aria-label={`Subir ${a.nome}`}
                  disabled={dado === 'd12'}
                  onClick={() => {
                    trocar(1);
                  }}
                />
              </div>
              <span className={cx('lab', mudou && 'red')} aria-live="polite">
                {textoDoPasso(dado)}
              </span>
            </Card>
          );
        })}
      </div>

      {restantes === 0 && avisos.length === 0 && (
        <Banner tone="ok">
          Todos os passos foram usados. PV {ficha.pvMax} e PD {ficha.pdMax} calculados.
        </Banner>
      )}
      {restantes > 0 && (
        <Banner>
          {restantes === 1 ? 'Falta usar 1 passo.' : `Faltam usar ${String(restantes)} passos.`} PV{' '}
          {ficha.pvMax} e PD {ficha.pdMax} por enquanto.
        </Banner>
      )}
      <AvisosDaRegra mensagens={avisos.map((a) => a.mensagem)} />
    </>
  );
}
