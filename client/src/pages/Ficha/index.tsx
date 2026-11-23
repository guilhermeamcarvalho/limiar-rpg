// Páginas da ficha: a ficha em branco (RF-08, #44) e a tela Ficha de um personagem salvo
// (artboard 08), que tem o modo de edição. As duas editam com a mesma `EdicaoDaFicha`.
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ID_OP2,
  fichaNova,
  tituloDaPagina,
  type CampanhaDetalhe,
  type Personagem,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { Async, Banner, Tag, useCarga, useToast } from '../../ui/index.ts';
import { Esqueleto, useSalvar } from './comum.tsx';
import { EdicaoDaFicha } from './Edicao.tsx';
import { FichaCompleta } from './Ficha.tsx';

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
            permitirFisico={caso?.dadosFisicos !== false}
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

/**
 * /personagens/:id/ficha: a ficha de um personagem salvo. O dono e o mestre do caso mexem; os
 * outros jogadores só veem, se o caso deixar. O caso (nome, DT padrão, papel) vem junto; se não
 * carregar, a ficha abre sem ele.
 */
export function FichaDoPersonagem() {
  const { id = '' } = useParams();
  const url = `/api/personagens/${encodeURIComponent(id)}`;
  const uso = useCarga(url, async (signal) => {
    const { personagem } = await pedir<{ personagem: Personagem }>(url, { signal });
    const caso = personagem.campanhaId
      ? await pedir<{ campanha: CampanhaDetalhe }>(
          `/api/campanhas/${encodeURIComponent(personagem.campanhaId)}`,
          { signal },
        ).then(
          (r) => r.campanha,
          () => null,
        )
      : null;
    return { personagem, caso };
  });

  useEffect(() => {
    if (uso.carga.estado !== 'pronto') document.title = tituloDaPagina('Ficha');
  }, [uso.carga.estado]);

  return (
    <Async uso={uso} falha="A ficha não carregou." esqueleto={<Esqueleto />}>
      {({ personagem, caso }) => (
        <FichaCompleta key={personagem.id} inicial={personagem} caso={caso} />
      )}
    </Async>
  );
}
