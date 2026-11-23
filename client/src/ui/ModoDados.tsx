// O seletor "Dados virtuais / Dados físicos" (RF-83). É o mesmo rótulo em todas as telas: na
// criação, na ficha, na edição e, depois, na mesa e no celular. Quem decide o que vale é o
// `modoDados` gravado na ficha; este componente só mostra e troca.
import { Segmented } from './Choice.tsx';
import { Icon } from './Icon.tsx';

export type ModoDeDados = 'virtual' | 'fisico';

export interface ModoDadosProps {
  value: ModoDeDados;
  onChange: (modo: ModoDeDados) => void;
  /**
   * A regra do caso. Num caso só com dados virtuais, o seletor some, a menos que a ficha já esteja
   * no modo físico (aí aparece, para a pessoa poder voltar ao virtual).
   */
  permitirFisico?: boolean;
}

export const ROTULO_DO_MODO: Record<ModoDeDados, string> = {
  virtual: 'Dados virtuais',
  fisico: 'Dados físicos',
};

export function ModoDados({ value, onChange, permitirFisico = true }: ModoDadosProps) {
  if (!permitirFisico && value === 'virtual') return null;
  return (
    <Segmented
      label="Como rolar os dados"
      value={value}
      onChange={onChange}
      options={[
        { value: 'virtual', label: ROTULO_DO_MODO.virtual, icon: <Icon name="dice" size="sm" /> },
        { value: 'fisico', label: ROTULO_DO_MODO.fisico },
      ]}
    />
  );
}
