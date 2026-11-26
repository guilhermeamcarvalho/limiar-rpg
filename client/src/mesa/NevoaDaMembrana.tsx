// A névoa da Membrana sobre o palco: o mestre diz o quanto ela está densa e todos veem igual.
// É só visual. Não esconde token nem prop e não barra movimento (isso é o breu), e não pega clique.
import type { CSSProperties } from 'react';
import { NIVEL_MAXIMO_DA_NEVOA } from '@membrana/shared';

/** Como o nível soa em palavras: vai no painel do mestre e para quem usa leitor de tela. */
export function descreverNevoa(nivel: number): string {
  if (nivel <= 0) return 'Sem névoa';
  if (nivel <= 33) return 'Névoa fina';
  if (nivel <= 66) return 'Névoa densa';
  return 'Névoa espessa: a Membrana está por um fio';
}

export function NevoaDaMembrana({ nivel }: { nivel: number }) {
  // Estado de uma versão antiga do servidor (sem o campo) também cai aqui.
  if (!(nivel > 0)) return null;
  const estilo = { '--nevoa': Math.min(nivel, NIVEL_MAXIMO_DA_NEVOA) / NIVEL_MAXIMO_DA_NEVOA };
  return (
    <div
      className="mesa-nevoa"
      role="img"
      aria-label={descreverNevoa(nivel)}
      data-testid="nevoa"
      style={estilo as CSSProperties}
    >
      <div className="mesa-nevoa-camada" />
      <div className="mesa-nevoa-camada funda" />
    </div>
  );
}
