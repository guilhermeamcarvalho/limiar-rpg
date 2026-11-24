// Dicas (tooltips) no estilo do site. Qualquer elemento com `title` ganha a dica desenhada aqui em
// vez da caixinha do navegador: ao passar o mouse (com uma pequena espera) ou ao chegar pelo
// teclado. O `title` sai do elemento na primeira vez (senão o navegador mostraria as duas) e o
// texto fica em `data-dica`; se o elemento não tinha outro nome, o texto vira o `aria-label`
// dele, para o leitor de tela continuar dizendo o que é.
// Montado uma vez, no topo do app. No celular (toque), não aparece: lá não existe "passar por cima".
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/** Quanto o mouse precisa ficar parado sobre o elemento para a dica aparecer. */
export const ESPERA_DA_DICA_MS = 400;
const ID = 'dica-do-site';
/** Distância entre a dica e o elemento, e da dica até a borda da tela. */
const FOLGA = 8;

interface Dica {
  alvo: Element;
  texto: string;
}

/** O elemento com dica mais próximo; o `title` dele (se houver) passa para `data-dica`. */
function alvoDaDica(origem: EventTarget | null): Dica | null {
  if (!(origem instanceof Element)) return null;
  const alvo = origem.closest('[title], [data-dica]');
  if (!alvo) return null;
  const titulo = alvo.getAttribute('title');
  if (titulo !== null) {
    alvo.removeAttribute('title');
    if (titulo.trim()) {
      alvo.setAttribute('data-dica', titulo);
      nomearSeFaltar(alvo, titulo);
    } else {
      alvo.removeAttribute('data-dica');
    }
  }
  const texto = alvo.getAttribute('data-dica')?.trim();
  return texto ? { alvo, texto } : null;
}

/** Sem `title`, um botão só de ícone ficaria sem nome: o texto da dica vira o nome. */
function nomearSeFaltar(alvo: Element, texto: string) {
  const nosso = alvo.hasAttribute('data-dica-nomeou');
  if (alvo.hasAttribute('aria-label') && !nosso) return;
  if (alvo.hasAttribute('aria-labelledby')) return;
  if (!nosso && alvo.textContent.trim()) return;
  alvo.setAttribute('aria-label', texto);
  alvo.setAttribute('data-dica-nomeou', '');
}

export function Dicas() {
  const [dica, setDica] = useState<Dica | null>(null);
  const [posicao, setPosicao] = useState<{
    x: number;
    y: number;
    embaixo: boolean;
    seta: number;
  } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let atual: Element | null = null;

    const esconder = () => {
      clearTimeout(espera);
      atual?.removeAttribute('aria-describedby');
      atual = null;
      setDica(null);
    };
    const mostrar = (nova: Dica) => {
      atual = nova.alvo;
      // Quando a dica diz algo além do nome, o leitor de tela também lê.
      if (nova.alvo.getAttribute('aria-label') !== nova.texto) {
        nova.alvo.setAttribute('aria-describedby', ID);
      }
      setDica(nova);
    };

    const aoPassar = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const nova = alvoDaDica(e.target);
      if (nova?.alvo === atual) return;
      esconder();
      if (!nova) return;
      atual = nova.alvo;
      espera = setTimeout(() => {
        mostrar(nova);
      }, ESPERA_DA_DICA_MS);
    };
    const aoSair = (e: PointerEvent) => {
      if (!atual) return;
      const para = e.relatedTarget;
      if (para instanceof Node && atual.contains(para)) return;
      esconder();
    };
    const aoFocar = (e: FocusEvent) => {
      const nova = alvoDaDica(e.target);
      // Só o foco do teclado: o clique já mostrou (ou não) pelo mouse.
      if (!nova || !(e.target instanceof Element) || !e.target.matches(':focus-visible')) return;
      esconder();
      mostrar(nova);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') esconder();
    };

    document.addEventListener('pointerover', aoPassar);
    document.addEventListener('pointerout', aoSair);
    document.addEventListener('pointerdown', esconder);
    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', esconder);
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', esconder, true);
    window.addEventListener('blur', esconder);
    return () => {
      esconder();
      document.removeEventListener('pointerover', aoPassar);
      document.removeEventListener('pointerout', aoSair);
      document.removeEventListener('pointerdown', esconder);
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('focusout', esconder);
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', esconder, true);
      window.removeEventListener('blur', esconder);
    };
  }, []);

  // Acima do elemento, centrada; sem espaço em cima, embaixo. Nunca sai da tela.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!dica || !el) {
      setPosicao(null);
      return;
    }
    const alvo = dica.alvo.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    const embaixo = alvo.top - height - FOLGA < FOLGA;
    const x = Math.min(
      Math.max(FOLGA, alvo.left + alvo.width / 2 - width / 2),
      window.innerWidth - width - FOLGA,
    );
    const y = embaixo ? alvo.bottom + FOLGA : alvo.top - height - FOLGA;
    // A setinha aponta para o meio do elemento, mesmo com a dica empurrada pela borda da tela.
    const seta = Math.min(Math.max(10, alvo.left + alvo.width / 2 - x), width - 10);
    setPosicao({ x, y, embaixo, seta });
  }, [dica]);

  if (!dica) return null;
  return createPortal(
    <div
      ref={caixa}
      id={ID}
      role="tooltip"
      className="dica"
      data-lado={posicao?.embaixo ? 'baixo' : 'cima'}
      style={
        posicao
          ? ({
              left: posicao.x,
              top: posicao.y,
              '--seta': `${String(posicao.seta)}px`,
            } as CSSProperties)
          : { visibility: 'hidden' }
      }
    >
      {dica.texto}
    </div>,
    document.body,
  );
}
