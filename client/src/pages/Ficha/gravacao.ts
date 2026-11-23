// A ficha aberta e o que a grava no servidor. Toda gravação passa por uma fila só: um clique em
// "+1 PV", um teste e o salvar da edição nunca correm ao mesmo tempo, então a resposta de um não
// apaga a mudança do outro. A tela mostra a mudança na hora; se o servidor recusar, a ficha volta
// ao último estado salvo e a pessoa vê o motivo.
import { useRef, useState } from 'react';
import type {
  FichaOp2,
  PedidoDeTeste,
  Personagem,
  RegistroDeTeste,
  TesteInformado,
} from '@membrana/shared';
import { ErroDaApi, pedir } from '../../auth/api.ts';

export const mensagemDe = (e: unknown) =>
  e instanceof ErroDaApi
    ? e.message
    : 'Não conseguimos falar com o servidor. Confira a conexão e tente de novo.';

export interface FichaAoVivo {
  /** O personagem com as mudanças que a pessoa acabou de fazer. */
  personagem: Personagem;
  /** Há gravação na fila ou a caminho. */
  salvando: boolean;
  /** Um teste está esperando o resultado do servidor. */
  testando: boolean;
  /** Quando o servidor confirmou a última gravação (ms). */
  salvaEm: number;
  /** Muda a ficha agora e grava em seguida (PV, PD, Ímpeto, itens, anotações, modo dos dados). */
  mudar: (mudanca: (ficha: FichaOp2) => FichaOp2) => void;
  /** Salva a ficha inteira (modo de edição). Rejeita com o erro do servidor, para a tela mostrar. */
  salvarFicha: (ficha: FichaOp2) => Promise<Personagem>;
  /** Pede o teste oficial ao servidor. `null` se falhou (o motivo vai para `aoFalhar`). */
  testar: (pedido: PedidoDeTeste) => Promise<RegistroDeTeste | null>;
  /**
   * Envia o teste com dados físicos (o que o jogador rolou na mão). Rejeita com o erro do servidor,
   * para o modal continuar aberto e mostrar o motivo.
   */
  informar: (teste: TesteInformado) => Promise<RegistroDeTeste>;
  /** Mostra o personagem que o servidor devolveu depois de trocar a foto ou o token. */
  trocouImagem: (personagem: Personagem) => void;
}

export function useFichaAoVivo(
  inicial: Personagem,
  aoFalhar: (mensagem: string) => void,
): FichaAoVivo {
  const url = `/api/personagens/${encodeURIComponent(inicial.id)}`;
  const [personagem, setPersonagem] = useState(inicial);
  const [pendentes, setPendentes] = useState(0);
  const [testando, setTestando] = useState(false);
  const [salvaEm, setSalvaEm] = useState(() => Date.parse(inicial.atualizadoEm));

  /** O que a tela mostra (com as mudanças locais) e o que o servidor confirmou por último. */
  const atual = useRef(inicial);
  const confirmado = useRef(inicial);
  /** Há mudança local que ainda não foi para a fila de gravação. */
  const sujo = useRef(false);
  /** Lido numa função: depois de um await o valor pode ter mudado (outro clique). */
  const estaSujo = () => sujo.current;
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  function mostrar(p: Personagem) {
    atual.current = p;
    setPersonagem(p);
  }

  function confirmar(p: Personagem) {
    confirmado.current = p;
    setSalvaEm(Date.now());
  }

  /** Põe a operação no fim da fila; a fila segue mesmo se ela falhar. */
  function enfileirar<T>(op: () => Promise<T>): Promise<T> {
    setPendentes((n) => n + 1);
    const vez = fila.current.then(op).finally(() => {
      setPendentes((n) => n - 1);
    });
    fila.current = vez.catch(() => undefined);
    return vez;
  }

  async function gravarSeSujo() {
    if (!sujo.current) return;
    sujo.current = false;
    const ficha = atual.current.ficha;
    try {
      const { personagem: salvo } = await pedir<{ personagem: Personagem }>(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ficha }),
      });
      confirmar(salvo);
      // Mudou de novo enquanto gravava: fica a mudança nova, que já está na fila.
      if (estaSujo()) atual.current = { ...salvo, ficha: atual.current.ficha };
      else mostrar(salvo);
    } catch (e) {
      sujo.current = false;
      mostrar(confirmado.current);
      aoFalhar(`A ficha não salvou e voltou ao último estado salvo. ${mensagemDe(e)}`);
    }
  }

  /** Um teste (rolado pelo servidor ou informado) entra na fila; a resposta traz a ficha nova. */
  async function enviarTeste(caminho: string, corpo: object): Promise<RegistroDeTeste> {
    setTestando(true);
    try {
      return await enfileirar(async () => {
        const r = await pedir<{ teste: RegistroDeTeste; personagem: Personagem }>(caminho, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(corpo),
        });
        confirmar(r.personagem);
        mostrar(r.personagem);
        return r.teste;
      });
    } finally {
      setTestando(false);
    }
  }

  return {
    personagem,
    salvando: pendentes > 0,
    testando,
    salvaEm,
    mudar(mudanca) {
      mostrar({ ...atual.current, ficha: mudanca(atual.current.ficha) });
      sujo.current = true;
      void enfileirar(gravarSeSujo);
    },
    salvarFicha(ficha) {
      return enfileirar(async () => {
        const { personagem: salvo } = await pedir<{ personagem: Personagem }>(url, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ficha }),
        });
        confirmar(salvo);
        mostrar(salvo);
        return salvo;
      });
    },
    async testar(pedido) {
      try {
        return await enviarTeste(`${url}/testes`, pedido);
      } catch (e) {
        aoFalhar(mensagemDe(e));
        return null;
      }
    },
    informar(teste) {
      return enviarTeste(`${url}/testes/informado`, teste);
    },
    trocouImagem(p) {
      // Só a foto e o token mudaram: a ficha da tela (com mudanças ainda na fila) continua.
      confirmado.current = { ...p, ficha: confirmado.current.ficha };
      mostrar({ ...p, ficha: atual.current.ficha });
    },
  };
}
