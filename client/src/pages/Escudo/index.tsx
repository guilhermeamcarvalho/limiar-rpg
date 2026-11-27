// /campanhas/:id/escudo (artboard "13 · Sala do mestre", #82, #83): só o mestre vê.
// Lê e edita a mesma tabela de salas e pontos de interesse da mesa ao vivo.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  tituloDaPagina,
  type ComandoDaMesa,
  type ItemDoInventario,
  type MapaNaMesa,
  type PersonagemNaMesa,
  type PistaNaMesa,
  type PoiNaMesa,
  type RespostaDoComando,
  type SalaNaMesa,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { linkDaCampanha } from '../../casos/formatos.ts';
import { FerramentaDePistas } from '../../mesa/painel/Pistas.tsx';
import { EditorPoi } from '../../mestre/EditorPoi.tsx';
import {
  Async,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Skeleton,
  Tag,
  Textarea,
  useCarga,
  useToast,
} from '../../ui/index.ts';
import './escudo.css';

interface DadosDoEscudo {
  campanha: { id: string; nome: string };
  mapa: MapaNaMesa | null;
  salas: SalaNaMesa[];
  pois: PoiNaMesa[];
  pistas?: PistaNaMesa[];
  inventario?: ItemDoInventario[];
  personagens?: PersonagemNaMesa[];
}

function SalaNoEscudo({
  sala,
  aoExecutar,
}: {
  sala: SalaNaMesa;
  aoExecutar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}) {
  const avisos = useToast();
  const [nome, setNome] = useState(sala.nome);
  const [notas, setNotas] = useState(sala.notasMestre);

  const [anterior, setAnterior] = useState(sala);
  if (anterior !== sala) {
    setAnterior(sala);
    setNome(sala.nome);
    setNotas(sala.notasMestre);
  }

  async function salvar() {
    const limpo = nome.trim();
    if (!limpo) return;
    if (limpo === sala.nome && notas === sala.notasMestre) return;
    const r = await aoExecutar({
      type: 'room.update',
      salaId: sala.id,
      nome: limpo,
      notasMestre: notas,
    });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para salvar a sala', text: r.motivo });
  }

  return (
    <div className="paper col escudo-sala">
      <div className="row" style={{ gap: 6 }}>
        <Input
          paper
          aria-label={`Nome da sala ${sala.nome}`}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
          }}
          onBlur={() => {
            void salvar();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="trash" size="sm" />}
          aria-label={`Remover sala ${sala.nome}`}
          onClick={() => {
            void aoExecutar({ type: 'room.delete', salaId: sala.id });
          }}
        />
      </div>
      <Field label={`Notas secretas · ${sala.nome}`}>
        <Textarea
          className="paper"
          placeholder="O que só você precisa lembrar sobre esta área…"
          rows={2}
          value={notas}
          onChange={(e) => {
            setNotas(e.target.value);
          }}
          onBlur={() => {
            void salvar();
          }}
        />
      </Field>
    </div>
  );
}

function SecaoEscudo({
  id,
  titulo,
  abertaPorPadrao = true,
  children,
}: {
  id: string;
  titulo: string;
  abertaPorPadrao?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(abertaPorPadrao);
  return (
    <section className="col escudo-coluna" aria-labelledby={id}>
      <button
        type="button"
        id={id}
        className="escudo-faixa escudo-toggle"
        aria-expanded={aberta}
        onClick={() => {
          setAberta((v) => !v);
        }}
      >
        <span>{titulo}</span>
        <Icon name={aberta ? 'down' : 'next'} size="sm" />
      </button>
      {aberta && children}
    </section>
  );
}

export function Escudo() {
  const { id = '' } = useParams();
  const [atual, setAtual] = useState<DadosDoEscudo | null>(null);

  const uso = useCarga(`/api/campanhas/${id}/escudo`, (signal) =>
    pedir<DadosDoEscudo>(`/api/campanhas/${encodeURIComponent(id)}/escudo`, { signal }),
  );

  const dados = atual ?? (uso.carga.estado === 'pronto' ? uso.carga.dados : null);

  useEffect(() => {
    document.title = tituloDaPagina(dados ? `Escudo · ${dados.campanha.nome}` : 'Escudo');
  }, [dados]);

  async function executar(comando: ComandoDaMesa): Promise<RespostaDoComando> {
    try {
      const resposta = await pedir<{
        mapa: MapaNaMesa | null;
        salas: SalaNaMesa[];
        pois: PoiNaMesa[];
        pistas?: PistaNaMesa[];
        inventario?: ItemDoInventario[];
      }>(`/api/campanhas/${encodeURIComponent(id)}/escudo/comandos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(comando),
      });
      setAtual((prev) => {
        const base = prev ?? (uso.carga.estado === 'pronto' ? uso.carga.dados : null);
        return base ? { ...base, ...resposta } : null;
      });
      return { ok: true };
    } catch (erro) {
      return {
        ok: false,
        motivo: erro instanceof ErroDaApi ? erro.message : 'Não deu para salvar.',
      };
    }
  }

  return (
    <div className="wrap col escudo">
      <Async uso={uso} falha="O escudo não abriu." esqueleto={<Skeleton />}>
        {(carregado) => {
          const escudo = atual ?? carregado;
          return (
            <div className="col" style={{ gap: 24 }}>
              <div className="row between wrapx" style={{ alignItems: 'flex-end', gap: 12 }}>
                <div className="col" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Tag tone="gold">Só você vê esta página</Tag>
                  </div>
                  <h1 className="h1">Escudo do mestre</h1>
                  <p className="muted">
                    Salas e pontos de interesse ligados à mesa ao vivo. Editar aqui atualiza a mesa
                    na hora; notas e contexto nunca vão para os jogadores.
                  </p>
                </div>
                <div className="row">
                  <Link className="btn red" to={linkDaCampanha(id, 'mesa')}>
                    <Icon name="map" size="sm" />
                    Abrir mesa
                  </Link>
                </div>
              </div>

              <div className="escudo-grade">
                <div className="col" style={{ gap: 24 }}>
                  <SecaoEscudo id="escudo-salas" titulo={`Salas (${String(escudo.salas.length)})`}>
                    <p className="small muted">
                      Áreas demarcadas no mapa. Só você vê os contornos e as notas de cada sala.
                    </p>
                    {escudo.salas.length === 0 ? (
                      <div className="card">
                        <EmptyState
                          icon={<Icon name="door" size="xl" />}
                          title="Nenhuma sala ainda"
                        >
                          Abra a ferramenta Salas (S) na mesa para demarcar áreas no mapa.
                        </EmptyState>
                      </div>
                    ) : (
                      <div className="col" style={{ gap: 10 }}>
                        {escudo.salas.map((sala) => (
                          <SalaNoEscudo key={sala.id} sala={sala} aoExecutar={executar} />
                        ))}
                      </div>
                    )}
                  </SecaoEscudo>

                  <SecaoEscudo
                    id="escudo-pistas"
                    titulo={`Pistas (${String((escudo.pistas ?? []).length)})`}
                  >
                    <div className="card col" style={{ padding: 16, gap: 12 }}>
                      <FerramentaDePistas
                        campanhaId={id}
                        pistas={escudo.pistas ?? []}
                        inventario={escudo.inventario ?? []}
                        personagens={escudo.personagens ?? []}
                        temMapa={Boolean(escudo.mapa)}
                        enviar={executar}
                        criarEmModal
                        centroPadrao={
                          escudo.mapa
                            ? { x: escudo.mapa.largura / 2, y: escudo.mapa.altura / 2 }
                            : { x: 200, y: 200 }
                        }
                      />
                    </div>
                  </SecaoEscudo>
                </div>

                <SecaoEscudo
                  id="escudo-pois"
                  titulo={`Pontos de interesse (${String(escudo.pois.length)})`}
                >
                  <p className="small muted">
                    Lugares clicáveis no mapa. Cada ponto pode pedir perícias e liberar informações
                    conforme a DT alcançada.
                  </p>
                  <div className="card col" style={{ padding: 16, gap: 12 }}>
                    <EditorPoi
                      salas={escudo.salas}
                      pois={escudo.pois}
                      temMapa={Boolean(escudo.mapa)}
                      aoExecutar={executar}
                      criarEmModal
                      centroPadrao={
                        escudo.mapa
                          ? { x: escudo.mapa.largura / 2, y: escudo.mapa.altura / 2 }
                          : { x: 200, y: 200 }
                      }
                    />
                  </div>
                </SecaoEscudo>

                <SecaoEscudo id="escudo-regras" titulo="Regras na mão">
                  <div className="card col escudo-bloco">
                    <span className="lab">Dificuldade (DT)</span>
                    <div className="kv">
                      <span>Fácil</span>
                      <b>5</b>
                    </div>
                    <div className="kv">
                      <span>Padrão</span>
                      <b>7</b>
                    </div>
                    <div className="kv">
                      <span>Difícil</span>
                      <b>10</b>
                    </div>
                    <div className="kv">
                      <span>Muito difícil</span>
                      <b>13</b>
                    </div>
                  </div>
                  <div className="card col escudo-bloco">
                    <span className="lab">Como funciona um ponto</span>
                    <p className="doc small">
                      <b>1.</b> Escolha as perícias e DTs que podem investigar o ponto.
                    </p>
                    <p className="doc small">
                      <b>2.</b> Cadastre as informações por DT mínima: os jogadores veem tarjas
                      pretas até passarem no teste.
                    </p>
                  </div>
                </SecaoEscudo>
              </div>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
