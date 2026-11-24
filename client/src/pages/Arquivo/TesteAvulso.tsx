// Teste avulso no Arquivo: rola uma perícia do personagem em uso com a regra do sistema dele
// (`resolverTeste`, a mesma da ficha e do servidor). É só consulta: a ficha não muda e o teste não
// entra no histórico.
import { useId, useState } from 'react';
import { Link } from 'react-router';
import {
  DT_PADRAO,
  PERICIAS_OP2,
  nomeDaPericia,
  nomeDoAtributo,
  prepararTeste,
  resolverTeste,
  rngCripto,
  atributoDaPericia,
  type PericiaOp2,
  type PersonagemNaLista,
  type ResultadoDeTeste,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { primeiroNome } from '../../personagens/formatos.ts';
import {
  Async,
  Button,
  Card,
  Icon,
  ResultadoTeste,
  Select,
  Skeleton,
  useCarga,
  type DadoDoResultado,
} from '../../ui/index.ts';

const URL = '/api/me/personagens';

/** Os personagens de Ordem Paranormal II em uso num caso em curso. */
export function personagensEmUso(lista: readonly PersonagemNaLista[]): PersonagemNaLista[] {
  return lista.filter(
    (p) => p.sistema.tipo === 'op2' && p.emUso && p.campanha !== null && !p.campanha.encerrado,
  );
}

interface Rolagem {
  periciaId: PericiaOp2;
  resultado: ResultadoDeTeste;
}

function Rolador({ emUso }: { emUso: PersonagemNaLista[] }) {
  const id = useId();
  const [personagemId, setPersonagemId] = useState(emUso[0]?.id ?? '');
  const [periciaId, setPericiaId] = useState<PericiaOp2>('percepcao');
  const [rolagem, setRolagem] = useState<Rolagem | null>(null);
  const personagem = emUso.find((p) => p.id === personagemId) ?? emUso[0];
  if (!personagem) return null;
  const { ficha } = personagem;

  function rolar() {
    if (!personagem) return;
    const { teste } = prepararTeste(personagem.ficha, { periciaId, dt: DT_PADRAO });
    setRolagem({ periciaId, resultado: resolverTeste(teste, rngCripto()) });
  }

  const atributo = (p: PericiaOp2) => nomeDoAtributo(atributoDaPericia(p));
  const dados: DadoDoResultado[] =
    rolagem?.resultado.dados.map((d) => ({
      tipo: d.tipo,
      valor: d.valor,
      papel: d.papel,
      descartado: d.descartado,
      rotulo:
        d.papel === 'atributo'
          ? atributo(rolagem.periciaId)
          : d.papel === 'pericia'
            ? nomeDaPericia(rolagem.periciaId)
            : (d.origem ?? 'Bônus'),
    })) ?? [];

  return (
    <div className="col arq-avulso">
      {emUso.length > 1 && (
        <>
          <label className="lab" htmlFor={`${id}-pers`}>
            Personagem
          </label>
          <Select
            id={`${id}-pers`}
            value={personagem.id}
            onChange={(e) => {
              setPersonagemId(e.target.value);
              setRolagem(null);
            }}
          >
            {emUso.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ficha.nome} · {p.campanha?.nome}
              </option>
            ))}
          </Select>
        </>
      )}
      <div className="row arq-rolar">
        <Select
          aria-label="Perícia"
          className="grow"
          value={periciaId}
          onChange={(e) => {
            setPericiaId(e.target.value as PericiaOp2);
          }}
        >
          {PERICIAS_OP2.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} · {ficha.atributos[p.atributo]} + {ficha.pericias[p.id]}
            </option>
          ))}
        </Select>
        <Button icon={<Icon name="dice" size="sm" />} onClick={rolar}>
          Rolar
        </Button>
      </div>
      {rolagem && (
        <ResultadoTeste
          titulo={`${nomeDaPericia(rolagem.periciaId)} · ${atributo(rolagem.periciaId)} · avulso`}
          origem="virtual"
          dados={dados}
          total={rolagem.resultado.total}
          dt={rolagem.resultado.dt}
          veredito={rolagem.resultado.veredito}
          nota={
            rolagem.resultado.veredito === 'falhaCritica'
              ? 'Avulso: role 1d8 na tabela de falha crítica. A ficha não muda.'
              : 'Avulso: a ficha não muda e o teste não entra no histórico.'
          }
        />
      )}
    </div>
  );
}

export function TesteAvulso() {
  const uso = useCarga(URL, (signal) =>
    pedir<{ personagens: PersonagemNaLista[] }>(URL, { signal }).then((r) => r.personagens),
  );
  return (
    <Card pad className="col arq-cartao" aria-labelledby="arq-avulso-titulo">
      <span id="arq-avulso-titulo" className="lab">
        Teste avulso
      </span>
      <Async uso={uso} falha="Seus personagens não carregaram." esqueleto={<Skeleton />}>
        {(lista) => {
          const emUso = personagensEmUso(lista);
          if (emUso.length === 0) {
            return (
              <p className="small muted">
                Nenhum personagem em uso num caso. Escolha um em{' '}
                <Link to="/personagens">Personagens</Link> para rolar com a ficha dele.
              </p>
            );
          }
          const um = emUso.length === 1 ? emUso[0] : undefined;
          return (
            <>
              <p className="small muted">
                {um
                  ? `Com a ficha de ${primeiroNome(um.ficha.nome) || um.ficha.nome}, pela regra de ${um.sistema.nome}. DT ${String(DT_PADRAO)}.`
                  : `Use a regra do sistema do personagem em uso. DT ${String(DT_PADRAO)}.`}
              </p>
              <Rolador emUso={emUso} />
            </>
          );
        }}
      </Async>
    </Card>
  );
}
