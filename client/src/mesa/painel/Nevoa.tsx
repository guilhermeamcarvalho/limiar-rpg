// Ferramenta "Névoa" do mestre (RF-22, RF-23). Com ela aberta, o mapa vira prancheta: cobrir ou
// revelar, com retângulo (arrastar) ou polígono (clicar os cantos). Mais "Cobrir tudo", "Limpar",
// "Desfazer a última" e, por sala, revelar ou cobrir a área inteira da sala de uma vez.
// O mestre vê a névoa hachurada e translúcida; os jogadores veem preto, e o servidor nem manda
// para eles os tokens e props que estão embaixo.
import {
  sobNevoa,
  type ComandoDaMesa,
  type MapaNaMesa,
  type RespostaDoComando,
  type SalaNaMesa,
  type VisaoDaMesa,
} from '@membrana/shared';
import { Button, Icon, Segmented, useToast } from '../../ui/index.ts';
import { formaDaSala, mapaInteiro, meioDaSala } from '../interacao.ts';
import type { ModoDaNevoa, PincelDaNevoa, TracoDaNevoa } from '../Nevoa.tsx';

interface Props {
  visao: VisaoDaMesa & { mapa: MapaNaMesa };
  pincel: PincelDaNevoa;
  aoMudarPincel: (pincel: PincelDaNevoa) => void;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

const DICAS: Record<TracoDaNevoa, string> = {
  retangulo: 'Arraste no mapa para desenhar.',
  poligono:
    'Clique para marcar os cantos; feche no primeiro ponto, com dois cliques ou Enter. Backspace desfaz o último canto, Esc cancela.',
};

function SalaNaLista({
  sala,
  sob,
  enviar,
}: {
  sala: SalaNaMesa;
  sob: boolean;
  enviar: (modo: ModoDaNevoa, sala: SalaNaMesa) => void;
}) {
  return (
    <li className="mapa-na-lista">
      <span className="mapa-info small">
        <b>{sala.nome}</b>
        <span className={sob ? 'nevoa-sob' : 'muted'}>{sob ? 'sob a névoa' : 'à vista'}</span>
      </span>
      <Button
        size="sm"
        variant={sob ? 'primary' : 'secondary'}
        aria-label={`${sob ? 'Revelar' : 'Cobrir'} ${sala.nome}`}
        onClick={() => {
          enviar(sob ? 'revelar' : 'cobrir', sala);
        }}
      >
        {sob ? 'Revelar' : 'Cobrir'}
      </Button>
    </li>
  );
}

export function FerramentaDaNevoa({ visao, pincel, aoMudarPincel, enviar }: Props) {
  const avisos = useToast();
  const { nevoa, mapa } = visao;
  const salas = (visao.salas ?? []).filter((s) => formaDaSala(s) !== null);
  const ultima = nevoa.at(-1);

  async function mandar(comando: ComandoDaMesa) {
    const r = await enviar(comando);
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para mexer na névoa', text: r.motivo });
  }

  function porSala(modo: ModoDaNevoa, sala: SalaNaMesa) {
    const forma = formaDaSala(sala);
    if (forma) void mandar({ type: modo === 'cobrir' ? 'fog.add' : 'fog.reveal', forma });
  }

  return (
    <>
      <div className="col" style={{ gap: 8 }}>
        <Segmented<ModoDaNevoa>
          label="Cobrir ou revelar"
          value={pincel.modo}
          onChange={(modo) => {
            aoMudarPincel({ ...pincel, modo });
          }}
          options={[
            { value: 'cobrir', label: 'Cobrir', icon: <Icon name="fog" size="sm" /> },
            { value: 'revelar', label: 'Revelar', icon: <Icon name="eye" size="sm" /> },
          ]}
        />
        <Segmented<TracoDaNevoa>
          label="Forma"
          value={pincel.forma}
          onChange={(forma) => {
            aoMudarPincel({ ...pincel, forma });
          }}
          options={[
            { value: 'retangulo', label: 'Retângulo' },
            { value: 'poligono', label: 'Polígono' },
          ]}
        />
        <p className="small muted" role="status">
          {DICAS[pincel.forma]} Para mover o mapa, use espaço + arrasto ou o botão do meio.
        </p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button
          size="sm"
          onClick={() => {
            void mandar({ type: 'fog.add', forma: mapaInteiro(mapa) });
          }}
        >
          Cobrir tudo
        </Button>
        <Button
          size="sm"
          disabled={nevoa.length === 0}
          onClick={() => {
            void mandar({ type: 'fog.remove', tudo: true });
          }}
        >
          Limpar névoa
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="back" size="sm" />}
          disabled={!ultima}
          onClick={() => {
            if (ultima) void mandar({ type: 'fog.remove', formaId: ultima.id });
          }}
        >
          Desfazer a última
        </Button>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <span className="lab">Por sala</span>
        {salas.length === 0 ? (
          <p className="small muted">
            Nenhuma sala marcada neste mapa. Com as salas, dá para revelar uma inteira de uma vez.
          </p>
        ) : (
          <ul className="mesa-mapas">
            {salas.map((sala) => {
              const meio = meioDaSala(sala);
              return (
                <SalaNaLista
                  key={sala.id}
                  sala={sala}
                  sob={meio !== null && sobNevoa(nevoa, meio)}
                  enviar={porSala}
                />
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
