// Ação no detalhe de um item do Arquivo (#91): envia o item para a ficha de um
// personagem, respeitando o limite de espaços e oferecendo "Desfazer" no aviso.
import { useId, useState } from 'react';
import {
  espacosDeItens,
  espacosOcupados,
  type FichaOp2,
  type ItemDaFicha,
  type Personagem,
  type PersonagemNaLista,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import type { Entrada } from '../../conteudo/index.ts';
import { primeiroNome } from '../../personagens/formatos.ts';
import { Async, Button, Icon, Select, Skeleton, useCarga, useToast } from '../../ui/index.ts';
import { MAX_ITENS, novoIdDeItem } from '../Ficha/Abas.tsx';

const URL = '/api/me/personagens';

function ordenarPersonagens(lista: readonly PersonagemNaLista[]): PersonagemNaLista[] {
  return [...lista].sort((a, b) => Number(b.emUso) - Number(a.emUso));
}

function PainelLevar({
  entrada,
  personagens,
}: {
  entrada: Entrada;
  personagens: PersonagemNaLista[];
}) {
  const id = useId();
  const toast = useToast();
  const ordenados = ordenarPersonagens(personagens);
  const [personagemId, setPersonagemId] = useState(ordenados[0]?.id ?? '');
  const [salvando, setSalvando] = useState(false);
  const [fichasLocais, setFichasLocais] = useState<Record<string, FichaOp2>>({});

  const alvoBase = ordenados.find((p) => p.id === personagemId) ?? ordenados[0];
  if (!alvoBase) {
    return (
      <p className="small muted">
        Crie um personagem para levar este item para o inventário da ficha.
      </p>
    );
  }

  const ficha = fichasLocais[alvoBase.id] ?? alvoBase.ficha;
  const espacos = espacosDeItens(ficha.atributos);
  const ocupados = espacosOcupados(ficha.itens);
  const semEspaco = ocupados >= espacos || ficha.itens.length >= MAX_ITENS;
  const motivoBloqueio =
    ficha.itens.length >= MAX_ITENS
      ? `O inventário atingiu o máximo de ${String(MAX_ITENS)} itens.`
      : ocupados >= espacos
        ? `Sem espaço livre no inventário de ${primeiroNome(ficha.nome)} (${String(ocupados)}/${String(espacos)} espaços ocupados).`
        : null;

  async function desfazer(idAlvo: string, fichaBase: FichaOp2, itensAntes: ItemDaFicha[]) {
    try {
      const res = await pedir<{ personagem: Personagem }>(
        `/api/personagens/${encodeURIComponent(idAlvo)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ficha: { ...fichaBase, itens: itensAntes } }),
        },
      );
      setFichasLocais((prev) => ({ ...prev, [idAlvo]: res.personagem.ficha }));
      toast.show({
        type: 'info',
        title: `${entrada.titulo} removido do inventário`,
      });
    } catch {
      toast.show({
        type: 'err',
        title: 'Não foi possível desfazer',
        text: 'Tente remover o item diretamente na ficha.',
      });
    }
  }

  async function levar() {
    const alvo = alvoBase;
    if (!alvo || semEspaco || salvando) return;
    const itensAntes = ficha.itens;
    const novoItem: ItemDaFicha = {
      id: novoIdDeItem(itensAntes, Date.now()),
      nome: entrada.titulo.slice(0, 80),
      descricao: entrada.resumo.slice(0, 200),
    };
    const fichaNova: FichaOp2 = { ...ficha, itens: [...itensAntes, novoItem] };
    setSalvando(true);
    try {
      const res = await pedir<{ personagem: Personagem }>(
        `/api/personagens/${encodeURIComponent(alvo.id)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ficha: fichaNova }),
        },
      );
      const fichaSalva = res.personagem.ficha;
      setFichasLocais((prev) => ({ ...prev, [alvo.id]: fichaSalva }));
      toast.show({
        type: 'ok',
        title: `${entrada.titulo} adicionado ao inventário`,
        text: `${primeiroNome(fichaSalva.nome)} (${String(fichaSalva.itens.length)}/${String(espacos)} espaços).`,
        action: {
          label: 'Desfazer',
          onClick: () => {
            void desfazer(alvo.id, fichaSalva, itensAntes);
          },
        },
      });
    } catch (erro) {
      toast.show({
        type: 'err',
        title: 'Não foi possível levar o item',
        text: erro instanceof Error ? erro.message : 'Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="col arq-levar">
      <div className="row between wrapx" style={{ gap: 'var(--s2)' }}>
        <span className="lab">Inventário da ficha</span>
        <span className="small muted">
          {ocupados} / {espacos} espaços
        </span>
      </div>

      <div className="row wrapx" style={{ gap: 'var(--s2)' }}>
        {ordenados.length > 1 && (
          <Select
            id={`${id}-destino`}
            aria-label="Personagem de destino"
            className="grow"
            value={alvoBase.id}
            onChange={(e) => {
              setPersonagemId(e.target.value);
            }}
          >
            {ordenados.map((p) => {
              const f = fichasLocais[p.id] ?? p.ficha;
              return (
                <option key={p.id} value={p.id}>
                  {f.nome}
                  {p.emUso ? ' (em uso)' : ''} · {f.itens.length}/{espacosDeItens(f.atributos)}
                </option>
              );
            })}
          </Select>
        )}
        <Button
          variant="primary"
          icon={<Icon name="key" size="sm" />}
          disabled={semEspaco || salvando}
          onClick={() => {
            void levar();
          }}
        >
          {salvando ? 'Levando…' : 'Levar para o inventário'}
        </Button>
      </div>

      {motivoBloqueio && (
        <p className="small muted" role="status">
          {motivoBloqueio}
        </p>
      )}
    </div>
  );
}

export function LevarItem({ entrada }: { entrada: Entrada }) {
  const uso = useCarga(URL, (signal) =>
    pedir<{ personagens: PersonagemNaLista[] }>(URL, { signal }).then((r) => r.personagens),
  );

  return (
    <div className="arq-levar-bloco">
      <Async
        uso={uso}
        falha="Não foi possível carregar seus personagens."
        esqueleto={<Skeleton width="60%" />}
      >
        {(personagens) => <PainelLevar entrada={entrada} personagens={personagens} />}
      </Async>
    </div>
  );
}
