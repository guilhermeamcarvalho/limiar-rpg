// A tela Ficha (artboard 08): topo, atributos, PV/PD, Ímpeto e habilidades à esquerda (#45), as
// 20 perícias clicáveis no meio (#46), o último resultado e as abas à direita (#54). "Editar
// ficha" troca a tela pelo modo de edição (#47), com os testes pausados. No modo de dados físicos,
// a perícia abre o modal para informar o que saiu na mão (#50, #51); a foto abre o envio (#52).
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
  type PedidoDeTeste,
  type PericiaOp2,
  type Personagem,
  type PistaDoPersonagem,
  type RegistroDeTeste,
  type RelatoDeTesteOp2,
} from '@membrana/shared';
import { pedir } from '../../auth/api.ts';
import { useMe } from '../../auth/sessao.tsx';
import { TopoDoCelular, useCelularProprio } from '../../app/celular.tsx';
import { iniciais, linkDaCampanha, linkDoDossie } from '../../casos/formatos.ts';
import { primeiroNome, TOM_DO_PERFIL } from '../../personagens/formatos.ts';
import {
  Banner,
  Button,
  cx,
  EnviarImagem,
  Icon,
  ModalDadosFisicos,
  ResultadoTeste,
  RevelacaoDoDado,
  revelacaoDoTeste,
  Tag,
  useToast,
  type DadoDoResultado,
} from '../../ui/index.ts';
import { AbasDaFicha, type Aba, type PistaDaFicha } from './Abas.tsx';
import { useSalvar } from './comum.tsx';
import { EdicaoDaFicha } from './Edicao.tsx';
import { depoisDoTeste, NADA_ARMADO, previaDoTeste, type Armados } from './extras.ts';
import { mensagemDe, useFichaAoVivo } from './gravacao.ts';
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
  const ehDono = inicial.donoId === eu;
  // O dono ou o mestre do caso; o servidor confere de novo em cada gravação.
  const podeEditar = ehDono || caso?.papel === 'mestre';

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
  /** O teste que acabou de sair, para o pop-up do resultado; some depois de visto. */
  const [revelar, setRevelar] = useState<RegistroDeTeste | null>(null);
  const [versaoDoHistorico, setVersaoDoHistorico] = useState(0);
  const [editando, setEditando] = useState(false);
  /** A perícia do modal de dados físicos aberto. */
  const [fisico, setFisico] = useState<PericiaOp2 | null>(null);
  const [informando, setInformando] = useState(false);
  const [erroFisico, setErroFisico] = useState<string | null>(null);
  const [imagens, setImagens] = useState(false);
  const [pistas, setPistas] = useState<PistaDaFicha[]>([]);
  const [apresentandoPistaId, setApresentandoPistaId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    pedir<{ pistas: PistaDoPersonagem[] }>(
      `/api/personagens/${encodeURIComponent(personagem.id)}/pistas`,
      { signal: ctrl.signal },
    )
      .then((r) => {
        setPistas(
          r.pistas.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            texto: p.texto,
            imagem: p.imagem ?? null,
            nova: false,
            apresentada: p.apresentada,
          })),
        );
      })
      .catch(() => {
        // Sem pistas ou rota indisponível nos testes sem caso: mantém lista vazia.
      });
    return () => {
      ctrl.abort();
    };
  }, [personagem.id]);

  async function apresentarPista(pistaId: string) {
    if (apresentandoPistaId) return;
    setApresentandoPistaId(pistaId);
    try {
      const { pista } = await pedir<{ pista: PistaDoPersonagem }>(
        `/api/personagens/${encodeURIComponent(personagem.id)}/pistas/${encodeURIComponent(pistaId)}/apresentar`,
        { method: 'POST' },
      );
      setPistas((atuais) =>
        atuais.map((p) => (p.id === pistaId ? { ...p, apresentada: true, nova: false } : p)),
      );
      avisos.show({ type: 'ok', title: 'Pista apresentada ao grupo', text: pista.titulo });
    } catch (e) {
      falhar(mensagemDe(e));
    } finally {
      setApresentandoPistaId(null);
    }
  }

  const envio = useSalvar(async (nova) => {
    const salvo = await vivo.salvarFicha(nova);
    setEditando(false);
    avisos.show({ type: 'ok', title: 'Ficha salva', text: salvo.ficha.nome });
  });

  useEffect(() => {
    document.title = tituloDaPagina(ficha.nome);
  }, [ficha.nome]);

  // Celular · 08: cabeçalho e barra de baixo próprios (Ficha, Itens, Pistas, Mesa). Na edição,
  // volta a valer o cabeçalho do app.
  useCelularProprio({ topo: !editando, barra: !editando });
  const [aba, setAba] = useState<Aba>('itens');
  const [parte, setParte] = useState<'ficha' | Aba>('ficha');
  function irParaAba(nova: Aba) {
    setAba(nova);
    setParte(nova);
    document.getElementById('ficha-abas')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // Enquanto um teste espera o servidor, nada mais muda a ficha: a resposta dele é a nova ficha.
  const podeMudar = podeEditar && !vivo.testando;

  async function testar(periciaId: PericiaOp2) {
    if (ficha.modoDados === 'fisico') {
      setErroFisico(null);
      setFisico(periciaId);
      return;
    }
    const { pedido } = previaDoTeste(ficha, periciaId, { dt, ajuda, armados });
    const registro = await vivo.testar(pedido);
    if (!registro) return;
    setUltimo(registro);
    setRevelar(registro);
    setArmados((a) => depoisDoTeste(a, pedido));
    setVersaoDoHistorico((v) => v + 1);
  }

  /** O resultado dos dados físicos vai ao servidor; se ele recusar, o modal fica aberto. */
  async function informar(pedido: PedidoDeTeste, relato: RelatoDeTesteOp2) {
    setErroFisico(null);
    setInformando(true);
    try {
      const registro = await vivo.informar({ ...pedido, ...relato });
      setUltimo(registro);
      setRevelar(registro);
      setArmados((a) => depoisDoTeste(a, pedido));
      setVersaoDoHistorico((v) => v + 1);
      setFisico(null);
    } catch (e) {
      setErroFisico(mensagemDe(e));
    } finally {
      setInformando(false);
    }
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
        permitirFisico={caso?.dadosFisicos !== false}
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

  const sistema = caso?.sistema.nome ?? NOME_DO_OP2;
  return (
    <>
      <TopoDoCelular
        inicio={
          <Link className="btn icon ghost" to="/personagens" aria-label="Voltar para Personagens">
            <Icon name="back" />
          </Link>
        }
        titulo={ficha.nome || 'Sem nome'}
        subtitulo={caso ? `${caso.nome} · ${sistema}` : `Sem caso · ${sistema}`}
        fim={
          podeEditar && (
            <Button
              variant="ghost"
              icon={<Icon name="edit" />}
              aria-label={`Editar a ficha de ${primeiroNome(ficha.nome) || ficha.nome}`}
              disabled={vivo.testando}
              onClick={() => {
                setEditando(true);
              }}
            />
          )
        }
      />
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
          foto={personagem.foto}
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
          aoTrocarImagem={() => {
            setImagens(true);
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
            {revelar && (
              <RevelacaoDoDado
                key={revelar.id}
                revelacao={revelacaoDoTeste(revelar)}
                aoFechar={() => {
                  setRevelar(null);
                }}
              />
            )}
            <AbasDaFicha
              personagemId={personagem.id}
              ficha={ficha}
              podeEditar={podeMudar}
              mudar={vivo.mudar}
              pistas={pistas}
              {...(ehDono && {
                aoApresentarPista: (id) => {
                  void apresentarPista(id);
                },
              })}
              apresentandoPistaId={apresentandoPistaId}
              versaoDoHistorico={versaoDoHistorico}
              aba={aba}
              aoMudarAba={setAba}
            />
          </div>
        </div>

        {previaFisica && fisico && (
          <ModalDadosFisicos
            key={fisico}
            ficha={ficha}
            pedido={{ ...previaFisica.pedido, dt }}
            enviando={informando}
            erro={erroFisico}
            aoEnviar={(relato) => void informar(previaFisica.pedido, relato)}
            aoCancelar={() => {
              setFisico(null);
            }}
          />
        )}

        {podeEditar && (
          <EnviarImagem
            open={imagens}
            personagem={{ ...personagem, nome: ficha.nome }}
            tone={TOM_DO_PERFIL[ficha.perfil]}
            iniciais={iniciais(ficha.nome) || '?'}
            aoTrocar={vivo.trocouImagem}
            aoFechar={() => {
              setImagens(false);
            }}
          />
        )}
      </div>

      <nav className="m-tabbar quatro" aria-label="Partes da ficha">
        <button
          type="button"
          className={cx(parte === 'ficha' && 'on')}
          aria-current={parte === 'ficha' ? 'true' : undefined}
          onClick={() => {
            setParte('ficha');
            document.querySelector('.ficha-pagina')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Icon name="user" />
          Ficha
        </button>
        <button
          type="button"
          className={cx(parte === 'itens' && 'on')}
          aria-current={parte === 'itens' ? 'true' : undefined}
          onClick={() => {
            irParaAba('itens');
          }}
        >
          <Icon name="key" />
          Itens
        </button>
        <button
          type="button"
          className={cx(parte === 'pistas' && 'on')}
          aria-current={parte === 'pistas' ? 'true' : undefined}
          onClick={() => {
            irParaAba('pistas');
          }}
        >
          <Icon name="clue" />
          Pistas
        </button>
        {caso ? (
          <Link to={linkDaCampanha(caso.id, 'mesa')}>
            <Icon name="map" />
            Mesa
          </Link>
        ) : (
          <button type="button" disabled title="Sem caso, sem mesa">
            <Icon name="map" />
            Mesa
          </button>
        )}
      </nav>
    </>
  );
}
