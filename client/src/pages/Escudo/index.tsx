// /campanhas/:id/escudo (artboard "13 · Sala do mestre", #82, #83): só o mestre vê.
// Lê e edita a mesma tabela de salas e pontos de interesse da mesa ao vivo.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  tituloDaPagina,
  type ComandoDaMesa,
  type MapaNaMesa,
  type PoiNaMesa,
  type RespostaDoComando,
  type SalaNaMesa,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';
import { linkDaCampanha } from '../../casos/formatos.ts';
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

interface DadosDoEscudo {
  campanha: { id: string; nome: string };
  mapa: MapaNaMesa | null;
  salas: SalaNaMesa[];
  pois: PoiNaMesa[];
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
    <div className="paper col" style={{ padding: 14, gap: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        <Input
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
      <Field label={`Notas · ${sala.nome}`}>
        <Textarea
          placeholder="Notas exclusivas do mestre…"
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
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <Async uso={uso} falha="O escudo não abriu." esqueleto={<Skeleton />}>
        {(carregado) => {
          const escudo = atual ?? carregado;
          return (
            <div className="col" style={{ gap: 20 }}>
              <div className="row between wrapx" style={{ alignItems: 'flex-end', gap: 12 }}>
                <div className="col" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Tag tone="gold">Só você vê esta página</Tag>
                    <span className="small muted">{escudo.campanha.nome}</span>
                  </div>
                  <h1 className="h1">Escudo do mestre</h1>
                  <p className="muted">
                    Salas e pontos de interesse ligados à mesa ao vivo. Editar aqui atualiza a mesa
                    na hora; notas e contexto nunca vão para os jogadores.
                  </p>
                </div>
                <div className="row">
                  <Link className="btn" to={linkDaCampanha(id, 'mesa')}>
                    <Icon name="map" size="sm" />
                    Abrir mesa
                  </Link>
                </div>
              </div>

              <div className="g2" style={{ gap: 20, alignItems: 'start' }}>
                <section className="card col" style={{ padding: 18, gap: 12 }}>
                  <div className="row between">
                    <h2 className="h3">Salas · iguais às da mesa</h2>
                    <span className="small muted">{escudo.salas.length}</span>
                  </div>
                  {escudo.salas.length === 0 ? (
                    <EmptyState icon={<Icon name="door" size="xl" />} title="Nenhuma sala ainda">
                      Abra a ferramenta Salas (S) na mesa para demarcar áreas no mapa.
                    </EmptyState>
                  ) : (
                    <div className="col" style={{ gap: 10 }}>
                      {escudo.salas.map((sala) => (
                        <SalaNoEscudo key={sala.id} sala={sala} aoExecutar={executar} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="card col" style={{ padding: 18, gap: 12 }}>
                  <div className="row between">
                    <h2 className="h3">Pontos de interesse</h2>
                    <span className="small muted">{escudo.pois.length}</span>
                  </div>
                  <EditorPoi
                    salas={escudo.salas}
                    pois={escudo.pois}
                    temMapa={Boolean(escudo.mapa)}
                    aoExecutar={executar}
                    centroPadrao={
                      escudo.mapa
                        ? { x: escudo.mapa.largura / 2, y: escudo.mapa.altura / 2 }
                        : { x: 200, y: 200 }
                    }
                  />
                </section>
              </div>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
