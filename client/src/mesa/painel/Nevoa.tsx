// Ferramenta "Névoa" do mestre: uma régua de 0 a 100 diz o quanto a névoa da Membrana está densa
// na cena, mais atalhos para os níveis comuns. É só visual: todos veem a mesma névoa, e nada fica
// escondido nem barrado por ela. Enquanto o mestre arrasta, a régua segue a mão e o nível vai
// para a mesa um instante depois de parar (não um comando por pixel).
import { useEffect, useId, useRef, useState } from 'react';
import {
  NIVEL_MAXIMO_DA_NEVOA,
  type ComandoDaMesa,
  type RespostaDoComando,
} from '@membrana/shared';
import { Button, useToast } from '../../ui/index.ts';
import { descreverNevoa } from '../NevoaDaMembrana.tsx';

/** Quanto esperar a régua parar antes de mandar o nível. */
export const ESPERA_DA_REGUA_MS = 150;

const ATALHOS = [
  { nivel: 0, rotulo: 'Sem névoa' },
  { nivel: 30, rotulo: 'Fina' },
  { nivel: 60, rotulo: 'Densa' },
  { nivel: NIVEL_MAXIMO_DA_NEVOA, rotulo: 'Espessa' },
] as const;

interface Props {
  nivel: number;
  enviar: (comando: ComandoDaMesa) => Promise<RespostaDoComando>;
}

export function FerramentaDaNevoa({ nivel, enviar }: Props) {
  const avisos = useToast();
  const id = useId();
  const [local, setLocal] = useState(nivel);
  const pendente = useRef<{ timer: number; nivel: number } | null>(null);

  // O nível muda por outro caminho (outra aba do mestre, a volta de uma queda): a régua acompanha,
  // a não ser que o mestre esteja no meio de um ajuste.
  useEffect(() => {
    if (!pendente.current) setLocal(nivel);
  }, [nivel]);

  async function mandar(novo: number) {
    const r = await enviar({ type: 'mist.set', nivel: novo });
    if (!r.ok) avisos.show({ type: 'err', title: 'Não deu para mexer na névoa', text: r.motivo });
  }

  function cancelarPendente() {
    if (!pendente.current) return null;
    window.clearTimeout(pendente.current.timer);
    const { nivel: guardado } = pendente.current;
    pendente.current = null;
    return guardado;
  }

  // Fechou o painel no meio do ajuste: o último nível ainda vai.
  useEffect(
    () => () => {
      const guardado = cancelarPendente();
      if (guardado !== null) void mandar(guardado);
    },
    // Só na saída do painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function aoArrastar(novo: number) {
    setLocal(novo);
    cancelarPendente();
    const timer = window.setTimeout(() => {
      pendente.current = null;
      void mandar(novo);
    }, ESPERA_DA_REGUA_MS);
    pendente.current = { timer, nivel: novo };
  }

  function irPara(novo: number) {
    cancelarPendente();
    setLocal(novo);
    void mandar(novo);
  }

  return (
    <>
      <p className="small muted">
        A névoa da Membrana: quanto mais densa, mais perto o Outro Lado está. É só visual; todos
        veem igual, e ela não esconde nada nem impede ninguém de andar. Para tapar uma área, use o
        breu.
      </p>

      <div className="col" style={{ gap: 6 }}>
        <div className="row between">
          <label className="lab" htmlFor={id}>
            Nível da névoa
          </label>
          <span className="small" aria-hidden="true">
            {local}%
          </span>
        </div>
        <input
          id={id}
          className="mesa-nevoa-regua"
          type="range"
          min={0}
          max={NIVEL_MAXIMO_DA_NEVOA}
          step={1}
          value={local}
          aria-valuetext={`${String(local)}%: ${descreverNevoa(local)}`}
          onChange={(e) => {
            aoArrastar(Number(e.target.value));
          }}
        />
        <p className="small muted" role="status">
          {descreverNevoa(local)}
        </p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {ATALHOS.map((a) => (
          <Button
            key={a.nivel}
            size="sm"
            variant={local === a.nivel ? 'primary' : 'secondary'}
            aria-pressed={local === a.nivel}
            onClick={() => {
              irPara(a.nivel);
            }}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>
    </>
  );
}
