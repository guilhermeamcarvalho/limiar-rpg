// Coluna direita da ficha (artboard Ficha): abas Itens, Pistas, Anotações e Histórico.
// Itens ocupam espaços limitados pelo Físico (RF-13); as pistas do inventário da mesa aparecem em
// papel (RF-47; "Apresentar ao grupo" liga na Fase 3); as anotações salvam ao sair do campo; o
// histórico mostra os testes que o servidor registrou.
import { useId, useState, type SyntheticEvent } from 'react';
import {
  espacosDeItens,
  nomeDaPericia,
  type FichaOp2,
  type ItemDaFicha,
  type RegistroDeTeste,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { quandoCurto } from '../../casos/formatos.ts';
import {
  Async,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  Icon,
  Input,
  Meter,
  Skeleton,
  TabPanel,
  Tabs,
  Textarea,
  textoDoVeredito,
  useCarga,
} from '../../ui/index.ts';

/** Uma pista no inventário do personagem. Chega da mesa (clue_holders) na Fase 2. */
export interface PistaDaFicha {
  id: string;
  titulo: string;
  texto: string;
  /** Recebida e ainda não vista. */
  nova: boolean;
  /** Já mostrada ao grupo. */
  apresentada: boolean;
}

type Aba = 'itens' | 'pistas' | 'anotacoes' | 'historico';

type Mudar = (mudanca: (ficha: FichaOp2) => FichaOp2) => void;

/** Um id que ainda não existe na ficha. */
export function novoIdDeItem(existentes: readonly ItemDaFicha[], semente: number): string {
  let n = semente;
  let id = `item-${n.toString(36)}`;
  while (existentes.some((i) => i.id === id)) {
    n += 1;
    id = `item-${n.toString(36)}`;
  }
  return id;
}

/** O máximo de itens que a ficha guarda (o schema recusa mais). */
const MAX_ITENS = 100;

function Itens({
  ficha,
  podeEditar,
  mudar,
}: {
  ficha: FichaOp2;
  podeEditar: boolean;
  mudar: Mudar;
}) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const espacos = espacosDeItens(ficha.atributos);
  const ocupados = ficha.itens.length;

  function adicionar(e: SyntheticEvent) {
    e.preventDefault();
    const limpo = nome.trim();
    if (!limpo) {
      setErro('Dê um nome ao item.');
      return;
    }
    mudar((f) => ({
      ...f,
      itens: [...f.itens, { id: novoIdDeItem(f.itens, Date.now()), nome: limpo, descricao: '' }],
    }));
    setNome('');
    setErro(null);
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <span className="lab">Espaços</span>
        <span className="small">
          {ocupados} de {espacos} ocupados
        </span>
      </div>
      <Meter value={ocupados} max={espacos} label="Espaços de itens ocupados" />
      {ocupados > espacos && (
        <span className="ficha-aviso">
          <Icon name="alert" size="sm" />
          Passa do limite do Físico ({espacos} espaços). Dá para carregar assim; o mestre decide.
        </span>
      )}
      {ocupados === 0 ? (
        <p className="small muted">Nenhum item.</p>
      ) : (
        <ul className="ficha-itens">
          {ficha.itens.map((item) => (
            <li key={item.id} className="kv">
              <span>
                {item.nome}
                {item.descricao && <span className="small muted"> · {item.descricao}</span>}
              </span>
              {podeEditar && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Icon name="trash" size="sm" />}
                  aria-label={`Tirar ${item.nome}`}
                  onClick={() => {
                    mudar((f) => ({ ...f, itens: f.itens.filter((i) => i.id !== item.id) }));
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && ocupados < MAX_ITENS && (
        <form className="row ficha-novo-item" onSubmit={adicionar} noValidate>
          <Field label="Novo item" error={erro ?? undefined} className="grow">
            <Input
              value={nome}
              maxLength={80}
              onChange={(e) => {
                setNome(e.target.value);
                setErro(null);
              }}
            />
          </Field>
          <Button type="submit" icon={<Icon name="plus" size="sm" />}>
            Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

export function ListaDePistas({ pistas }: { pistas: readonly PistaDaFicha[] }) {
  if (pistas.length === 0) {
    return (
      <EmptyState icon={<Icon name="clue" size="xl" />} title="Nenhuma pista ainda">
        As pistas que você receber ou guardar na mesa aparecem aqui, em papel.
      </EmptyState>
    );
  }
  return (
    <ul className="col ficha-pistas">
      {pistas.map((p) => (
        <li key={p.id} className={cx('note ficha-pista', p.apresentada && 'apresentada')}>
          <span className="lab">
            {p.titulo}
            {p.nova && ' · nova'}
            {p.apresentada && ' · apresentada'}
          </span>
          <p>{p.texto}</p>
          {!p.apresentada && (
            <Button
              size="sm"
              className="ficha-apresentar"
              disabled
              title="Apresentar ao grupo liga junto com a mesa"
            >
              Apresentar ao grupo
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Anotacoes({
  ficha,
  podeEditar,
  mudar,
}: {
  ficha: FichaOp2;
  podeEditar: boolean;
  mudar: Mudar;
}) {
  const [texto, setTexto] = useState(ficha.anotacoes);
  return (
    <Field
      label="Anotações"
      help={
        podeEditar ? 'Salvam quando você sai do campo.' : 'Só quem joga com o personagem edita.'
      }
    >
      <Textarea
        value={texto}
        rows={8}
        maxLength={20000}
        readOnly={!podeEditar}
        onChange={(e) => {
          setTexto(e.target.value);
        }}
        onBlur={() => {
          if (podeEditar && texto !== ficha.anotacoes) {
            mudar((f) => ({ ...f, anotacoes: texto }));
          }
        }}
      />
    </Field>
  );
}

const COR_DO_VEREDITO = {
  sucesso: 'green',
  critico: 'gold',
  falha: 'red',
  falhaCritica: 'red',
} as const;

function Historico({ personagemId, versao }: { personagemId: string; versao: number }) {
  const url = `/api/personagens/${encodeURIComponent(personagemId)}/testes`;
  const uso = useCarga(`${url}#${String(versao)}`, (signal) =>
    pedir<{ testes: RegistroDeTeste[] }>(url, { signal }).then((r) => r.testes),
  );
  return (
    <Async
      uso={uso}
      falha="O histórico não carregou."
      esqueleto={
        <div className="col">
          <Skeleton />
          <Skeleton width="70%" />
        </div>
      }
      vazio={{
        se: (testes) => testes.length === 0,
        mostrar: (
          <p className="small muted">Nenhum teste ainda. Clique numa perícia para testar.</p>
        ),
      }}
    >
      {(testes) => (
        <ol className="col ficha-historico">
          {testes.map((t) => (
            <li key={t.id} className="ficha-teste">
              <div className="row between">
                <b>{nomeDaPericia(t.periciaId)}</b>
                <b className={COR_DO_VEREDITO[t.resultado.veredito]}>
                  {t.resultado.total} · {textoDoVeredito(t.resultado.veredito)}
                </b>
              </div>
              <span className="small muted">
                {t.resultado.dados
                  .map((d) => `${d.tipo}: ${String(d.valor)}${d.descartado ? ' (fora)' : ''}`)
                  .join(', ')}{' '}
                · DT {t.resultado.dt} · {quandoCurto(t.em)}
                {t.autor && ` · ${t.autor.nome}`}
                {t.origem === 'fisico' && ' · dados físicos'}
              </span>
              {t.efeitos.length > 0 && <span className="small">{t.efeitos.join(' ')}</span>}
            </li>
          ))}
        </ol>
      )}
    </Async>
  );
}

export interface AbasProps {
  personagemId: string;
  ficha: FichaOp2;
  podeEditar: boolean;
  mudar: Mudar;
  /** O inventário de pistas da mesa. Vazio até a Fase 2. */
  pistas?: readonly PistaDaFicha[];
  /** Muda a cada teste feito na tela, para o histórico buscar de novo. */
  versaoDoHistorico: number;
}

const SEM_PISTAS: readonly PistaDaFicha[] = [];

export function AbasDaFicha({
  personagemId,
  ficha,
  podeEditar,
  mudar,
  pistas = SEM_PISTAS,
  versaoDoHistorico,
}: AbasProps) {
  const idBase = useId();
  const [aba, setAba] = useState<Aba>('itens');
  return (
    <Card className="ficha-abas">
      <Tabs
        idBase={idBase}
        label="Partes da ficha"
        dense
        value={aba}
        onChange={setAba}
        items={[
          { id: 'itens', label: 'Itens', count: ficha.itens.length },
          {
            id: 'pistas',
            label: 'Pistas',
            count: pistas.length,
            isNew: pistas.some((p) => p.nova),
          },
          { id: 'anotacoes', label: 'Anotações' },
          { id: 'historico', label: 'Histórico' },
        ]}
      />
      <TabPanel idBase={idBase} id={aba} className="card-b col ficha-aba">
        {aba === 'itens' && <Itens ficha={ficha} podeEditar={podeEditar} mudar={mudar} />}
        {aba === 'pistas' && <ListaDePistas pistas={pistas} />}
        {aba === 'anotacoes' && <Anotacoes ficha={ficha} podeEditar={podeEditar} mudar={mudar} />}
        {aba === 'historico' && (
          <Historico personagemId={personagemId} versao={versaoDoHistorico} />
        )}
      </TabPanel>
    </Card>
  );
}
