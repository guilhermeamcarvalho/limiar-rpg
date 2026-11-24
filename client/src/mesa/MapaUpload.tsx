// Ferramenta "Mapa e grade" do mestre (RF-14): envia mapas, troca o mapa da mesa (para todos ao
// mesmo tempo, pelo comando `map.activate`), apaga os que não estão na mesa e ajusta a grade.
import { useRef, useState, type ChangeEvent } from 'react';
import {
  LIMITE_DO_MAPA_ENVIADO,
  urlDoArquivo,
  type ComandoDaMesa,
  type GradeDoMapa,
  type MapaDoCaso,
  type MapaNaMesa,
  type RespostaDoComando,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../auth/api.ts';
import {
  Async,
  Button,
  Field,
  Icon,
  Input,
  Skeleton,
  useCarga,
  useEnvio,
  useToast,
} from '../ui/index.ts';

/** O mesmo aviso do servidor (artboard Componentes), dado antes de enviar 20 MB à toa. */
export const AVISO_DE_MAPA_GRANDE = 'Mapa acima de 20 MB. Reduza para 4096 px.';

interface Props {
  campanhaId: string;
  /** O mapa que está na mesa agora (vale mais que a lista, que pode estar velha). */
  mapaNaMesa: MapaNaMesa | null;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

const mensagem = (erro: unknown) =>
  erro instanceof ErroDaApi ? erro.message : 'Sem conexão. Tente de novo.';

function Grade({ mapa, enviar }: { mapa: MapaNaMesa; enviar: Props['enviar'] }) {
  const avisos = useToast();
  const [campos, setCampos] = useState(() => ({
    celula: String(mapa.grade.celula),
    deslocamentoX: String(mapa.grade.deslocamentoX),
    deslocamentoY: String(mapa.grade.deslocamentoY),
  }));
  const [erro, setErro] = useState<string | null>(null);
  const aplicar = useEnvio(async () => {
    const grade: GradeDoMapa = {
      celula: Number(campos.celula),
      deslocamentoX: Number(campos.deslocamentoX),
      deslocamentoY: Number(campos.deslocamentoY),
    };
    const r = await enviar({ type: 'map.grid', grade });
    if (r.ok) {
      setErro(null);
      avisos.show({ type: 'ok', title: 'Grade ajustada' });
    } else {
      setErro(r.motivo);
    }
  });
  const campo = (nome: keyof typeof campos) => ({
    type: 'number',
    inputMode: 'numeric' as const,
    min: 0,
    value: campos[nome],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setCampos((c) => ({ ...c, [nome]: e.target.value }));
    },
  });

  return (
    <form
      className="col"
      style={{ gap: 10 }}
      aria-label="Grade do mapa na mesa"
      onSubmit={(e) => {
        e.preventDefault();
        void aplicar.enviar();
      }}
    >
      <span className="lab">Grade de “{mapa.nome}”</span>
      <Field label="Tamanho da célula (px)" error={erro}>
        <Input {...campo('celula')} min={10} max={500} />
      </Field>
      <div className="row" style={{ gap: 10 }}>
        <Field label="Deslocamento X">
          <Input {...campo('deslocamentoX')} max={500} />
        </Field>
        <Field label="Deslocamento Y">
          <Input {...campo('deslocamentoY')} max={500} />
        </Field>
      </div>
      <Button type="submit" size="sm" loading={aplicar.enviando}>
        Aplicar grade
      </Button>
    </form>
  );
}

function MapaNaLista({
  mapa,
  naMesa,
  aoUsar,
  aoApagar,
}: {
  mapa: MapaDoCaso;
  naMesa: boolean;
  aoUsar: () => Promise<void>;
  aoApagar: () => Promise<void>;
}) {
  const usar = useEnvio(aoUsar);
  const apagar = useEnvio(aoApagar);
  return (
    <li className="mapa-na-lista">
      <img className="mapa-miniatura" src={urlDoArquivo(mapa.imagem)} alt="" loading="lazy" />
      <div className="mapa-info">
        <b title={mapa.nome}>{mapa.nome}</b>
        <div className="small muted">
          {mapa.largura} × {mapa.altura} px{naMesa && ' · na mesa'}
        </div>
      </div>
      {!naMesa && (
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" loading={usar.enviando} onClick={() => void usar.enviar()}>
            Usar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Icon name="trash" size="sm" />}
            aria-label={`Apagar ${mapa.nome}`}
            loading={apagar.enviando}
            onClick={() => void apagar.enviar()}
          />
        </div>
      )}
    </li>
  );
}

export function MapaUpload({ campanhaId, mapaNaMesa, enviar }: Props) {
  const avisos = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const caminho = `/api/campanhas/${encodeURIComponent(campanhaId)}/mapas`;
  const mapas = useCarga(caminho, (signal) =>
    pedir<{ mapas: MapaDoCaso[] }>(caminho, { signal }).then((r) => r.mapas),
  );

  const envio = useEnvio(async (escolhido: File) => {
    if (escolhido.size > LIMITE_DO_MAPA_ENVIADO) {
      avisos.show({ type: 'err', title: 'Mapa grande demais', text: AVISO_DE_MAPA_GRANDE });
      return;
    }
    const corpo = new FormData();
    corpo.append('arquivo', escolhido);
    try {
      const { mapa } = await pedir<{ mapa: MapaDoCaso }>(caminho, { method: 'POST', body: corpo });
      mapas.mudar((lista) => [mapa, ...lista]);
      avisos.show({ type: 'ok', title: 'Mapa enviado', text: mapa.nome });
    } catch (erro) {
      avisos.show({ type: 'err', title: 'Não deu para enviar o mapa', text: mensagem(erro) });
    }
  });

  async function usar(mapa: MapaDoCaso) {
    const r = await enviar({ type: 'map.activate', mapaId: mapa.id });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para trocar o mapa', text: r.motivo });
  }

  async function apagar(mapa: MapaDoCaso) {
    try {
      await pedir(`${caminho}/${encodeURIComponent(mapa.id)}`, { method: 'DELETE' });
      mapas.mudar((lista) => lista.filter((m) => m.id !== mapa.id));
      avisos.show({ type: 'info', title: 'Mapa apagado', text: mapa.nome });
    } catch (erro) {
      avisos.show({ type: 'err', title: 'Não deu para apagar o mapa', text: mensagem(erro) });
    }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="col" style={{ gap: 8 }}>
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          aria-label="Arquivo do mapa"
          onChange={(e) => {
            const escolhido = e.target.files?.[0];
            e.target.value = '';
            if (escolhido) void envio.enviar(escolhido);
          }}
        />
        <Button
          variant="primary"
          icon={<Icon name="upload" size="sm" />}
          loading={envio.enviando}
          onClick={() => arquivo.current?.click()}
        >
          Enviar mapa
        </Button>
        <p className="small muted">JPG, PNG ou WebP até 20 MB. Fica com até 4096 px.</p>
      </div>

      {mapaNaMesa && <Grade key={mapaNaMesa.id} mapa={mapaNaMesa} enviar={enviar} />}

      <section aria-label="Mapas do caso" className="col" style={{ gap: 8 }}>
        <span className="lab">Mapas do caso</span>
        <Async
          uso={mapas}
          falha="Os mapas não carregaram."
          esqueleto={
            <div className="col">
              <Skeleton variant="h" />
              <Skeleton variant="h" />
            </div>
          }
          vazio={{
            se: (lista) => lista.length === 0,
            mostrar: <p className="small muted">Nenhum mapa ainda. Envie o primeiro.</p>,
          }}
        >
          {(lista) => (
            <ul className="mesa-mapas">
              {lista.map((mapa) => (
                <MapaNaLista
                  key={mapa.id}
                  mapa={mapa}
                  naMesa={mapaNaMesa?.id === mapa.id}
                  aoUsar={() => usar(mapa)}
                  aoApagar={() => apagar(mapa)}
                />
              ))}
            </ul>
          )}
        </Async>
      </section>
    </div>
  );
}
