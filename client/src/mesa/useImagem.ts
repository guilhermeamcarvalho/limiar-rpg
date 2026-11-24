// Carrega uma imagem (mapa, token, prop enviado ou pronto) para o canvas. O nome é o hash do conteúdo: a
// mesma imagem nunca muda, então fica guardada enquanto a página estiver aberta.
import { useEffect, useState } from 'react';
import { urlDaImagem } from './props-prontos/index.ts';

const carregadas = new Map<string, HTMLImageElement>();

export function useImagem(nome: string | null): HTMLImageElement | undefined {
  const [, setVersao] = useState(0);
  const pronta = nome ? carregadas.get(nome) : undefined;

  useEffect(() => {
    if (!nome || carregadas.has(nome)) return;
    let vivo = true;
    const imagem = new window.Image();
    imagem.decoding = 'async';
    imagem.onload = () => {
      carregadas.set(nome, imagem);
      if (vivo) setVersao((v) => v + 1);
    };
    imagem.src = urlDaImagem(nome);
    return () => {
      vivo = false;
    };
  }, [nome]);

  return pronta;
}
