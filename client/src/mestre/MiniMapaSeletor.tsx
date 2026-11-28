// Mini-mapa clicável para escolher a posição (x, y) de uma pista ou ponto de interesse direto no
// modal do Escudo do mestre, sem precisar ir até a Mesa para arrastar depois.
import type { MapaNaMesa, SalaNaMesa } from '@membrana/shared';
import type { Ponto } from '../mesa/camera.ts';
import { urlDaImagem } from '../mesa/prontos.ts';
import { Icon } from '../ui/index.ts';

export function MiniMapaSeletor({
  mapa,
  ponto,
  aoMudar,
  rotulo = 'Posição no mapa',
  salas = [],
}: {
  mapa: MapaNaMesa;
  ponto: Ponto;
  aoMudar: (novo: Ponto) => void;
  rotulo?: string;
  salas?: readonly SalaNaMesa[];
}) {
  const esquerda = Math.min(100, Math.max(0, (ponto.x / Math.max(1, mapa.largura)) * 100));
  const topo = Math.min(100, Math.max(0, (ponto.y / Math.max(1, mapa.altura)) * 100));

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row between">
        <span className="lab">{rotulo}</span>
        <span className="small muted">Clique no mapa para posicionar</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${rotulo}: clique para escolher a posição em ${mapa.nome}`}
        className="escudo-minimapa"
        style={{ aspectRatio: `${String(mapa.largura)} / ${String(mapa.altura)}` }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const rx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          const ry = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
          aoMudar({
            x: Math.round(rx * mapa.largura),
            y: Math.round(ry * mapa.altura),
          });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            aoMudar({ x: Math.round(mapa.largura / 2), y: Math.round(mapa.altura / 2) });
          }
        }}
      >
        <img src={urlDaImagem(mapa.imagem)} alt={mapa.nome} />
        {salas.length > 0 && (
          <svg
            className="escudo-minimapa-salas"
            viewBox={`0 0 ${String(mapa.largura)} ${String(mapa.altura)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {salas.map(
              (s) =>
                s.area.length >= 3 && (
                  <polygon
                    key={s.id}
                    points={s.area.map((pt) => `${String(pt.x)},${String(pt.y)}`).join(' ')}
                    className="escudo-minimapa-sala-existente"
                  />
                ),
            )}
          </svg>
        )}
        <span
          className="escudo-minimapa-pino"
          style={{ left: `${String(esquerda)}%`, top: `${String(topo)}%` }}
          aria-hidden="true"
        >
          <Icon name="pin" size="sm" />
        </span>
      </div>
    </div>
  );
}
