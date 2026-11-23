// Topo da ficha (artboard Ficha): foto com o botão de troca, caso, sistema, "Salva há X min",
// nome, perfil, ocupação e nível; à direita, Editar ficha, Jogar na mesa e o seletor de dados.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { CampanhaDetalhe, FichaOp2 } from '@membrana/shared';
import { iniciais, linkDaCampanha } from '../../casos/formatos.ts';
import {
  linhaDaFicha,
  NOME_DO_PERFIL,
  textoDeSalva,
  TOM_DO_PERFIL,
} from '../../personagens/formatos.ts';
import { Avatar, Button, Chip, Icon, Segmented, Tag } from '../../ui/index.ts';

const ANEL = { red: 'red', blue: 'blue', green: 'green' } as const;

/** O relógio da tela, de 30 em 30 segundos: o "Salva há X min" anda sozinho. */
function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setAgora(Date.now());
    }, intervaloMs);
    return () => {
      clearInterval(id);
    };
  }, [intervaloMs]);
  return agora;
}

export interface TopoProps {
  ficha: FichaOp2;
  caso: CampanhaDetalhe | null;
  sistema: string;
  salvando: boolean;
  salvaEm: number;
  podeEditar: boolean;
  /** Enquanto um teste espera o servidor: a edição começaria de uma ficha velha. */
  editarDesligado?: boolean;
  aoEditar: () => void;
  aoMudarModo: (modo: FichaOp2['modoDados']) => void;
}

export function Topo({
  ficha,
  caso,
  sistema,
  salvando,
  salvaEm,
  podeEditar,
  editarDesligado = false,
  aoEditar,
  aoMudarModo,
}: TopoProps) {
  const agora = useAgora();
  // A gravação que acabou de voltar pode ser mais nova que o último tique do relógio.
  const status = salvando ? 'Salvando…' : textoDeSalva(salvaEm, Math.max(agora, salvaEm));
  return (
    <section className="card ficha-topo" aria-label="Personagem">
      <div className="ficha-foto">
        <Avatar
          initials={iniciais(ficha.nome) || '?'}
          name={ficha.nome}
          tone={ANEL[TOM_DO_PERFIL[ficha.perfil]]}
          size="xl"
        />
        {podeEditar && (
          <Button
            size="sm"
            className="ficha-trocar-foto"
            icon={<Icon name="image" size="sm" />}
            aria-label="Trocar foto e token (em breve)"
            title="O envio de foto e token chega em breve"
            disabled
          />
        )}
      </div>

      <div className="col grow ficha-identidade">
        <div className="row wrapx" style={{ gap: 8 }}>
          {caso && <Tag>{caso.nome}</Tag>}
          <Tag>{sistema}</Tag>
          <span role="status" aria-live="polite">
            <Chip status={salvando ? 'away' : 'online'}>{status}</Chip>
          </span>
        </div>
        <h1 className="h1 ficha-titulo">{ficha.nome}</h1>
        <div className="row wrapx" style={{ gap: 10 }}>
          <Tag tone={TOM_DO_PERFIL[ficha.perfil]}>{NOME_DO_PERFIL[ficha.perfil]}</Tag>
          <span className="lab ficha-linha">{linhaDaFicha(ficha)}</span>
        </div>
      </div>

      <div className="col ficha-acoes">
        <div className="row wrapx">
          {podeEditar && (
            <Button
              icon={<Icon name="edit" size="sm" />}
              disabled={editarDesligado}
              onClick={aoEditar}
            >
              Editar ficha
            </Button>
          )}
          {caso && (
            <Link className="btn red" to={linkDaCampanha(caso.id, 'mesa')}>
              <Icon name="map" size="sm" />
              Jogar na mesa
            </Link>
          )}
        </div>
        {/* Caso que não permite dados físicos: o seletor some (a menos que a ficha já esteja neles). */}
        {podeEditar && (caso?.dadosFisicos !== false || ficha.modoDados === 'fisico') && (
          <Segmented
            label="Como rolar os dados"
            value={ficha.modoDados}
            onChange={aoMudarModo}
            options={[
              { value: 'virtual', label: 'Dados virtuais', icon: <Icon name="dice" size="sm" /> },
              { value: 'fisico', label: 'Dados físicos' },
            ]}
          />
        )}
      </div>
    </section>
  );
}
