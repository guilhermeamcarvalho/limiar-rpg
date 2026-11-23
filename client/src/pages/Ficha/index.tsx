// Páginas da ficha que já existem: a ficha em branco (RF-08, #44) e a edição de uma ficha salva.
// As duas usam a mesma `EdicaoDaFicha`. A tela Ficha completa (artboard 08) chega com a #45.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ID_OP2,
  fichaNova,
  tituloDaPagina,
  type CampanhaDetalhe,
  type FichaOp2,
  type Personagem,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { primeiroNome } from '../../personagens/formatos.ts';
import { Async, Banner, Card, Skeleton, Tag, useCarga, useToast } from '../../ui/index.ts';
import { EdicaoDaFicha } from './Edicao.tsx';

/**
 * 422 do servidor: "ficha.pv" → "pv", o campo como a edição o conhece. O que não é de um campo
 * (como "ficha" inteira) fica de fora: vira a falha geral.
 */
function camposDaFicha(e: unknown): Record<string, string> {
  if (!(e instanceof ErroDaApi) || !e.campos) return {};
  return Object.fromEntries(
    Object.entries(e.campos)
      .map(([c, m]) => [c.replace(/^ficha\.?/, ''), m] as const)
      .filter(([c]) => c !== '' && c !== '_'),
  );
}

const mensagemDe = (e: unknown) =>
  e instanceof ErroDaApi
    ? e.message
    : 'Não conseguimos falar com o servidor. Suas mudanças continuam aqui; tente de novo.';

function Esqueleto() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }} aria-busy="true">
      <Card pad className="col">
        <Skeleton variant="h" width="40%" />
        <Skeleton />
        <Skeleton width="70%" />
      </Card>
    </div>
  );
}

/** Salvar: envia, guarda os erros por campo e a falha geral. */
function useSalvar(enviar: (ficha: FichaOp2) => Promise<void>) {
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  async function salvar(ficha: FichaOp2) {
    setSalvando(true);
    setFalha(null);
    try {
      await enviar(ficha);
    } catch (e) {
      const campos = camposDaFicha(e);
      setErros(campos);
      if (Object.keys(campos).length === 0) setFalha(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }
  return { salvando, erros, falha, salvar };
}

/** /personagens/novo/ficha?caso=: para quem já sabe as regras. */
export function FichaEmBranco() {
  const [params] = useSearchParams();
  const casoId = params.get('caso');
  const navegar = useNavigate();
  const avisos = useToast();
  const uso = useCarga(casoId ? `/api/campanhas/${casoId}` : 'sem-caso', (signal) =>
    casoId
      ? pedir<{ campanha: CampanhaDetalhe }>(`/api/campanhas/${encodeURIComponent(casoId)}`, {
          signal,
        }).then((r) => r.campanha)
      : Promise.resolve(null),
  );
  const envio = useSalvar(async (ficha) => {
    const caso = uso.carga.estado === 'pronto' ? uso.carga.dados : null;
    const { personagem } = await pedir<{ personagem: Personagem }>('/api/personagens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        caso ? { campanhaId: caso.id, usarNoCaso: true, ficha } : { sistemaId: ID_OP2, ficha },
      ),
    });
    avisos.show({
      type: 'ok',
      title: 'Personagem criado',
      text: caso ? `${personagem.ficha.nome}, em uso em ${caso.nome}.` : personagem.ficha.nome,
    });
    void navegar('/personagens', { replace: true });
  });

  useEffect(() => {
    document.title = tituloDaPagina('Ficha em branco');
  }, []);

  return (
    <Async uso={uso} falha="O caso não carregou." esqueleto={<Esqueleto />}>
      {(caso) =>
        caso && caso.sistema.tipo !== 'op2' ? (
          <div className="wrap" style={{ paddingTop: 40 }}>
            <Banner tone="warn">
              {caso.nome} usa {caso.sistema.nome}. A ficha em branco, por enquanto, é de Ordem
              Paranormal II.
            </Banner>
          </div>
        ) : (
          <EdicaoDaFicha
            inicial={fichaNova({ nivel: caso?.nivelInicial ?? 1 })}
            titulo="Ficha em branco"
            contexto={
              <div className="row wrapx" style={{ gap: 6 }}>
                <Tag>{caso ? caso.nome : 'Sem caso'}</Tag>
                <Tag>Ordem Paranormal II</Tag>
              </div>
            }
            rotuloDeSalvar="Criar personagem"
            salvando={envio.salvando}
            errosDoServidor={envio.erros}
            falha={envio.falha}
            aoCancelar={() => {
              void navegar('/personagens');
            }}
            aoSalvar={(ficha) => void envio.salvar(ficha)}
          />
        )
      }
    </Async>
  );
}

/** /personagens/:id/ficha: edita uma ficha salva (o dono ou o mestre do caso). */
export function FichaDoPersonagem() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const avisos = useToast();
  const url = `/api/personagens/${encodeURIComponent(id)}`;
  const uso = useCarga(url, (signal) =>
    pedir<{ personagem: Personagem }>(url, { signal }).then((r) => r.personagem),
  );
  const envio = useSalvar(async (ficha) => {
    const { personagem } = await pedir<{ personagem: Personagem }>(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ficha }),
    });
    uso.mudar(() => personagem);
    avisos.show({ type: 'ok', title: 'Ficha salva', text: personagem.ficha.nome });
  });
  const nome = uso.carga.estado === 'pronto' ? uso.carga.dados.ficha.nome : 'Ficha';

  useEffect(() => {
    document.title = tituloDaPagina(nome);
  }, [nome]);

  return (
    <Async uso={uso} falha="A ficha não carregou." esqueleto={<Esqueleto />}>
      {(p) => (
        <EdicaoDaFicha
          // Salvou: o estado salvo passa a ser o novo, e a contagem de mudanças volta a zero.
          key={p.atualizadoEm}
          inicial={p.ficha}
          titulo={`Editando a ficha de ${primeiroNome(p.ficha.nome) || p.ficha.nome}`}
          rotuloDeSalvar="Salvar ficha"
          salvando={envio.salvando}
          errosDoServidor={envio.erros}
          falha={envio.falha}
          aoCancelar={() => {
            void navegar('/personagens');
          }}
          aoSalvar={(ficha) => void envio.salvar(ficha)}
        />
      )}
    </Async>
  );
}
