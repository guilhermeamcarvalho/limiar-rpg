// Estado de erro / conexão perdida na mesa (artboards 18 e Celular · 18, #77):
// - Faixa vermelha no topo com tentativa, tempo até a próxima e "Tentar agora"
// - Cartão "Reconectando" sobre o mapa com a fila de ações offline, aviso de rolagens pausadas
//   e botões "Tentar agora" / "Sair da mesa"
import { Link } from 'react-router';
import { Button, Icon } from '../ui/index.ts';
import type { AcaoNaFila } from './conexao.ts';

export interface SemConexaoProps {
  tentativa: number;
  emSegundos: number;
  fila: readonly AcaoNaFila[];
  aoTentarAgora: () => void;
}

export function FaixaSemConexao({
  tentativa,
  emSegundos,
  aoTentarAgora,
}: Omit<SemConexaoProps, 'fila'>) {
  return (
    <div className="banner err mesa-faixa-erro" role="alert">
      <Icon name="wifioff" />
      <span>
        <b>Conexão com a mesa perdida.</b> Tentando de novo em {emSegundos} s (tentativa {tentativa}
        ). Movimentos e mensagens ficam esperando e são enviados quando voltar.
      </span>
      <Button size="sm" onClick={aoTentarAgora}>
        Tentar agora
      </Button>
    </div>
  );
}

export function CartaoReconectando({
  tentativa,
  emSegundos,
  fila,
  aoTentarAgora,
}: SemConexaoProps) {
  return (
    <div className="card mesa-reconectando" role="status" aria-label="Reconectando à mesa">
      <span className="red">
        <Icon name="wifioff" size="xl" />
      </span>
      <h2 className="h2">Reconectando</h2>
      <p className="muted small">
        Tentativa {tentativa} · de novo em {emSegundos} s. Quando voltar, a mesa recebe o estado
        completo e mostra o que mudou enquanto você esteve fora.
      </p>

      {fila.length > 0 && (
        <div className="list card mesa-fila" aria-label="Ações na fila">
          {fila.map((item) => (
            <div key={item.id} className="li mesa-fila-item">
              <Icon name="clock" size="sm" />
              <span className="grow small">{item.descricao}</span>
              <span className="small muted">na fila</span>
            </div>
          ))}
        </div>
      )}

      <div className="banner warn mesa-aviso-rolagens">
        <Icon name="alert" size="sm" />
        <span className="small">
          <b>Ações pausadas:</b> rolagens só voltam com a conexão, para o servidor dar o resultado
          oficial.
        </span>
      </div>

      <div className="row mesa-reconectando-acoes">
        <Button variant="primary" onClick={aoTentarAgora}>
          Tentar agora
        </Button>
        <Link className="btn ghost" to="/">
          Sair da mesa
        </Link>
      </div>
    </div>
  );
}
