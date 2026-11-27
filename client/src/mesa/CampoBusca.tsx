// Campo de busca compacto (~34px) com lupa à esquerda e botão limpar (×) para abas da mesa.
import { Icon } from '../ui/index.ts';

export function CampoBusca({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="mesa-busca">
      <Icon name="search" size="sm" className="mesa-busca-lupa" />
      <input
        type="search"
        className="fld mesa-busca-campo"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="mesa-busca-limpar"
          aria-label="Limpar busca"
          title="Limpar busca"
          onClick={() => {
            onChange('');
          }}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
