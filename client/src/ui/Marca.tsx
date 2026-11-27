import { Link } from 'react-router';

/**
 * O selo da MEMBRANA: um hexágono (d20) partido pela fenda vermelha, a travessia da Membrana.
 * Leva para a Central. `compacta`: só o selo, para o cabeçalho do celular.
 * O mesmo desenho, com as cores fixas, está em client/public/favicon.svg.
 */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="MEMBRANA, ir para a Central">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        {/* Hexágono externo: o d20 e o selo */}
        <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" strokeWidth="1.75" className="brand-aro" />
        {/* Facetas internas */}
        <polyline points="4,9 14,15 14,29" strokeWidth="1.25" className="brand-faceta" />
        <polyline points="28,9 18,15 18,29" strokeWidth="1.25" className="brand-faceta" />
        {/* A fenda da Membrana */}
        <path d="M16 1V31" strokeWidth="2.25" className="brand-fenda" />
        <polygon points="16,7 19.5,16 16,25 12.5,16" strokeWidth="1.75" className="brand-limiar" />
        <circle cx="16" cy="16" r="1.75" className="brand-nucleo" />
      </svg>
      {!compacta && (
        <span>
          <b>MEMBRANA</b>
          <small>Mesa virtual de RPG</small>
        </span>
      )}
    </Link>
  );
}
