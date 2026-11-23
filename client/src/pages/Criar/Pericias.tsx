// Passo 4 da criação: perícias. Todas começam em d4, e as da ocupação em d6 (bônus já aplicado);
// 8 passos para distribuir ("seis d6 e um d8"). Fora da regra é permitido, com aviso.
import {
  ATRIBUTOS_OP2,
  PASSOS_DE_PERICIA,
  PERICIAS_OP2,
  avisosDaCriacao,
  basesDasPericias,
  passosEmPericias,
  type FichaOp2,
  type PericiaOp2,
} from '@membrana/shared';
import { Banner, Button, Die, Tag } from '../../ui/index.ts';
import { AvisosDaRegra } from './Atributos.tsx';

const faces = (dado: string) => Number(dado.slice(1));

export function Pericias({
  ficha,
  passos,
  mudar,
}: {
  ficha: FichaOp2;
  passos: Partial<Record<PericiaOp2, number>>;
  mudar: (passos: Partial<Record<PericiaOp2, number>>) => void;
}) {
  const bases = basesDasPericias(ficha.ocupacao);
  const usados = passosEmPericias(ficha.pericias, ficha.ocupacao);
  const restantes = PASSOS_DE_PERICIA - usados;
  const avisos = avisosDaCriacao(ficha).filter((a) => a.campo.startsWith('pericias'));

  return (
    <>
      <p className="small" role="status">
        <b>
          {usados} de {PASSOS_DE_PERICIA} passos usados.
        </b>{' '}
        {Object.values(bases).some((b) => b !== 'd4')
          ? 'As perícias da ocupação já começam em d6.'
          : 'Sem ocupação conhecida, todas começam em d4.'}
      </p>

      <div className="g3 criar-pericias">
        {ATRIBUTOS_OP2.map((a) => (
          <section key={a.id} className="col" aria-labelledby={`grupo-${a.id}`}>
            <span className="lab" id={`grupo-${a.id}`}>
              {a.nome}
            </span>
            <ul className="col criar-lista">
              {PERICIAS_OP2.filter((p) => p.atributo === a.id).map((p) => {
                const dado = ficha.pericias[p.id];
                const n = passos[p.id] ?? 0;
                const daOcupacao = bases[p.id] !== 'd4';
                return (
                  <li key={p.id} className="criar-pericia">
                    <span className="grow">
                      <b>{p.nome}</b>
                      {daOcupacao && (
                        <>
                          {' '}
                          <Tag tone="gold">ocupação</Tag>
                        </>
                      )}
                    </span>
                    <Button
                      size="sm"
                      icon={<span aria-hidden="true">−</span>}
                      aria-label={`Baixar ${p.nome}`}
                      disabled={n === 0}
                      onClick={() => {
                        mudar({ ...passos, [p.id]: n - 1 });
                      }}
                    />
                    <Die type={dado} value={faces(dado)} role="pericia" />
                    <Button
                      size="sm"
                      icon={<span aria-hidden="true">+</span>}
                      aria-label={`Subir ${p.nome}`}
                      disabled={dado === 'd12'}
                      onClick={() => {
                        mudar({ ...passos, [p.id]: n + 1 });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {restantes === 0 && avisos.length === 0 && (
        <Banner tone="ok">Todos os passos foram usados.</Banner>
      )}
      {restantes > 0 && (
        <Banner>
          {restantes === 1 ? 'Falta usar 1 passo.' : `Faltam usar ${String(restantes)} passos.`}
        </Banner>
      )}
      <AvisosDaRegra mensagens={avisos.map((a) => a.mensagem)} />
    </>
  );
}
