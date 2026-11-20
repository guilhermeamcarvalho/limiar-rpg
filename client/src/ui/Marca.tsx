import { Link } from 'react-router';

/**
 * O olho da LIMIAR, com o nome e o "horror investigativo". Leva para a Central.
 * `compacta`: só o olho, para o cabeçalho do celular.
 */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="LIMIAR, ir para a Central">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" strokeWidth="1.6" className="brand-aro" />
        <path
          d="M20 5C27 13 27 27 20 35 13 27 13 13 20 5Z"
          fill="none"
          strokeWidth="1.4"
          className="brand-olho"
        />
        <circle cx="20" cy="20" r="3.2" className="brand-pupila" />
      </svg>
      {!compacta && (
        <span>
          <b>LIMIAR</b>
          <small>HORROR INVESTIGATIVO</small>
        </span>
      )}
    </Link>
  );
}
