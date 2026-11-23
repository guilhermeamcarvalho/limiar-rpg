// A tela Ficha (artboard 08): topo, atributos, PV/PD, Ímpeto e habilidades à esquerda (#45), as
// 20 perícias clicáveis no meio (#46), o último resultado e as abas à direita (#54). "Editar
// ficha" troca a tela pelo modo de edição (#47), com os testes pausados.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  DT_PADRAO,
  gastarImpetoNoAtributo,
  ErroDeRegra,
  nomeDaPericia,
  nomeDoAtributo,
  tituloDaPagina,
  type AtributoOp2,
  type CampanhaDetalhe,
  type PericiaOp2,
  type Personagem,
  type RegistroDeTeste,
} from '@membrana/shared';
import { useMe } from '../../auth/sessao.tsx';
import { linkDoDossie } from '../../casos/formatos.ts';
import { primeiroNome } from '../../personagens/formatos.ts';
import {
  Banner,
  Button,
  Icon,
  Modal,
  ResultadoTeste,
  Tag,
  useToast,
  type DadoDoResultado,
} from '../../ui/index.ts';
import { AbasDaFicha } from './Abas.tsx';
import { useSalvar } from './comum.tsx';
import { EdicaoDaFicha } from './Edicao.tsx';
import { depoisDoTeste, NADA_ARMADO, previaDoTeste, type Armados } from './extras.ts';
import { useFichaAoVivo } from './gravacao.ts';
import { Pericias } from './Pericias.tsx';
import { Atributos, CartaoDoImpeto, CartoesDeHabilidade, VidaESanidade } from './Recursos.tsx';
import { Topo } from './Topo.tsx';
import './ficha.css';

const NOME_DO_OP2 = 'Ordem Paranormal II';

/** O cartão de resultado a partir do registro que o servidor devolveu. */
export function ResultadoDoRegistro({
  registro,
  quando,
  apagado,
}: {
  registro: RegistroDeTeste;
  quando: string;
  apagado?: boolean;
}) {
  const dados: DadoDoResultado[] = registro.resultado.dados.map((d) => ({
    tipo: d.tipo,
    valor: d.valor,
    papel: d.papel,
    descartado: d.descartado,
    rotulo:
      d.papel === 'atributo'
        ? nomeDoAtributo(registro.atributo)
        : d.papel === 'pericia'
          ? nomeDaPericia(registro.periciaId)
          : (d.origem ?? 'Bônus'),
  }));
  return (
    <ResultadoTeste
      titulo={`${nomeDaPericia(registro.periciaId)} · ${nomeDoAtributo(registro.atributo)} · ${quando}`}
      origem={registro.origem}
      dados={dados}
      total={registro.resultado.total}
      dt={registro.resultado.dt}
      veredito={registro.resultado.veredito}
      nota={registro.efeitos.length > 0 ? registro.efeitos.join(' ') : undefined}
      apagado={apagado ?? false}
    />
  );
}

export interface FichaCompletaProps {
  inicial: Personagem;
  /** O caso do personagem, se houver e se carregou. */
  caso: CampanhaDetalhe | null;
}

export function FichaCompleta({ inicial, caso }: FichaCompletaProps) {
  const avisos = useToast();
  const { sessao } = useMe();
  const eu = sessao.estado === 'logado' ? sessao.usuario.id : null;
  // O dono ou o mestre do caso; o servidor confere de novo em cada gravação.
  const podeEditar = inicial.donoId === eu || caso?.papel === 'mestre';

  const falhar = (texto: string) => {
    avisos.show({ type: 'err', title: 'Não deu certo', text: texto });
  };
  const vivo = useFichaAoVivo(inicial, falhar);
  const { personagem } = vivo;
  const { ficha } = personagem;

  const dtPadrao = caso?.dtPadrao ?? DT_PADRAO;
  const [dt, setDt] = useState(dtPadrao);
  const [ajuda, setAjuda] = useState(false);
  const [armados, setArmados] = useState<Armados>(NADA_ARMADO);
  const [ultimo, setUltimo] = useState<RegistroDeTeste | null>(null);
  const [versaoDoHistorico, setVersaoDoHistorico] = useState(0);
  const [editando, setEditando] = useState(false);
  const [fisico, setFisico] = useState<PericiaOp2 | null>(null);

  const envio = useSalvar(async (nova) => {
    const salvo = await vivo.salvarFicha(nova);
    setEditando(false);
    avisos.show({ type: 'ok', title: 'Ficha salva', text: salvo.ficha.nome });
  });

  useEffect(() => {
    document.title = tituloDaPagina(ficha.nome);
  }, [ficha.nome]);

  // Enquanto um teste espera o servidor, nada mais muda a ficha: a resposta dele é a nova ficha.
  const podeMudar = podeEditar && !vivo.testando;

  async function testar(periciaId: PericiaOp2) {
    if (ficha.modoDados === 'fisico') {
      setFisico(periciaId);
      return;
    }
    const { pedido } = previaDoTeste(ficha, periciaId, { dt, ajuda, armados });
    const registro = await vivo.testar(pedido);
    if (!registro) return;
    setUltimo(registro);
    setArmados((a) => depoisDoTeste(a, pedido));
    setVersaoDoHistorico((v) => v + 1);
  }

  function subirAtributo(atributo: AtributoOp2) {
    try {
      gastarImpetoNoAtributo(ficha, atributo);
    } catch (e) {
      if (e instanceof ErroDeRegra) {
        falhar(e.message);
        return;
      }
      throw e;
    }
    vivo.mudar((f) => gastarImpetoNoAtributo(f, atributo));
  }

  const etiquetas = (
    <div className="row wrapx" style={{ gap: 6 }}>
      {caso && <Tag>{caso.nome}</Tag>}
      <Tag>{caso?.sistema.nome ?? NOME_DO_OP2}</Tag>
    </div>
  );

  if (editando) {
    return (
      <EdicaoDaFicha
        inicial={ficha}
        titulo={`Editando a ficha de ${primeiroNome(ficha.nome) || ficha.nome}`}
        contexto={etiquetas}
        rotuloDeSalvar="Salvar ficha"
        salvando={envio.salvando}
        errosDoServidor={envio.erros}
        falha={envio.falha}
        aoCancelar={() => {
          envio.limpar();
          setEditando(false);
        }}
        aoSalvar={(nova) => void envio.salvar(nova)}
        lateral={
          <>
            <Banner>
              Os testes ficam pausados enquanto a ficha está em edição. Salve para testar com os
              valores novos.
            </Banner>
            {ultimo && <ResultadoDoRegistro registro={ultimo} quando="antes da edição" apagado />}
          </>
        }
      />
    );
  }

  const previaFisica =
    fisico === null ? null : previaDoTeste(ficha, fisico, { dt, ajuda, armados });

  return (
    <div className="wrap col ficha-pagina">
      <nav className="crumb" aria-label="Caminho">
        <Link to="/personagens">Personagens</Link>
        <Icon name="next" size="sm" />
        {caso && (
          <>
            <Link to={linkDoDossie(caso.id)}>{caso.nome}</Link>
            <Icon name="next" size="sm" />
          </>
        )}
        <b aria-current="page">{ficha.nome}</b>
      </nav>

      <Topo
        ficha={ficha}
        caso={caso}
        sistema={caso?.sistema.nome ?? NOME_DO_OP2}
        salvando={vivo.salvando}
        salvaEm={vivo.salvaEm}
        podeEditar={podeEditar}
        editarDesligado={vivo.testando}
        aoEditar={() => {
          setEditando(true);
        }}
        aoMudarModo={(modoDados) => {
          vivo.mudar((f) => ({ ...f, modoDados }));
        }}
      />

      <div className="ficha-tres">
        <div className="col ficha-coluna">
          <Atributos ficha={ficha} />
          <VidaESanidade
            ficha={ficha}
            podeMudar={podeMudar}
            mudar={(m) => {
              vivo.mudar((f) => ({ ...f, ...m }));
            }}
          />
          <CartaoDoImpeto
            ficha={ficha}
            armado={armados.impeto}
            podeMudar={podeMudar}
            aoArmar={(impeto) => {
              setArmados((a) => ({ ...a, impeto }));
            }}
            aoSubirAtributo={subirAtributo}
          />
          <CartoesDeHabilidade
            ficha={ficha}
            armados={armados}
            podeMudar={podeMudar}
            aoArmar={(id, armada) => {
              setArmados((a) => ({
                ...a,
                habilidades: armada
                  ? [...a.habilidades.filter((h) => h !== id), id]
                  : a.habilidades.filter((h) => h !== id),
              }));
            }}
          />
        </div>

        <Pericias
          ficha={ficha}
          dt={dt}
          dtPadrao={dtPadrao}
          aoMudarDt={setDt}
          ajuda={ajuda}
          aoMudarAjuda={setAjuda}
          armados={armados}
          podeTestar={podeMudar}
          aoTestar={(id) => void testar(id)}
        />

        <div className="col ficha-coluna ficha-direita">
          {vivo.testando && (
            <p className="small muted" role="status">
              Rolando no servidor…
            </p>
          )}
          {ultimo && <ResultadoDoRegistro registro={ultimo} quando="agora" />}
          <AbasDaFicha
            personagemId={personagem.id}
            ficha={ficha}
            podeEditar={podeMudar}
            mudar={vivo.mudar}
            versaoDoHistorico={versaoDoHistorico}
          />
        </div>
      </div>

      <Modal
        open={previaFisica !== null}
        onClose={() => {
          setFisico(null);
        }}
        title={fisico ? `Testar ${nomeDaPericia(fisico)} · dados físicos` : ''}
        footer={
          <Button
            onClick={() => {
              setFisico(null);
            }}
          >
            Fechar
          </Button>
        }
      >
        {previaFisica && (
          <>
            <p>Role estes dados e some os três maiores. A DT é {dt}.</p>
            <ul className="row wrapx ficha-dados-fisicos">
              {[
                { tipo: previaFisica.teste.atributo, rotulo: 'atributo' },
                { tipo: previaFisica.teste.pericia, rotulo: 'perícia' },
                ...previaFisica.armados.map((b) => ({ tipo: b.tipo, rotulo: b.origem })),
              ].map((d, i) => (
                <li key={i} className="tag">
                  {d.tipo} de {d.rotulo}
                </li>
              ))}
            </ul>
            <Banner>
              Informar o resultado pelo app chega em breve. Por enquanto, conte o resultado ao
              mestre: nada foi registrado na ficha.
            </Banner>
          </>
        )}
      </Modal>
    </div>
  );
}
