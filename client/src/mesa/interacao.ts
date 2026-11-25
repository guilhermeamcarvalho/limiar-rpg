// Regras das interações com o palco (arrastar, setas, girar, redimensionar, desenhar o breu), sem
// Konva: o palco só chama estas funções.
import type {
  FormaDoBreu,
  MapaNaMesa,
  PropNaMesa,
  SalaNaMesa,
  TokenNaMesa,
} from '@membrana/shared';
import type { Ponto } from './camera.ts';

/** O arrasto manda a posição no máximo 20 vezes por segundo (a final vai sempre, no soltar). */
export const INTERVALO_DO_ARRASTO_MS = 50;

/** Diz se já pode mandar de novo: no máximo uma vez a cada `intervaloMs`. */
export function criarLimitador(intervaloMs = INTERVALO_DO_ARRASTO_MS) {
  let ultimo = -Infinity;
  return (agora: number) => {
    if (agora - ultimo < intervaloMs) return false;
    ultimo = agora;
    return true;
  };
}

/** O ponto, sem sair do mapa. */
export function dentroDoMapa({ x, y }: Ponto, mapa: Pick<MapaNaMesa, 'largura' | 'altura'>): Ponto {
  return {
    x: Math.min(mapa.largura, Math.max(0, x)),
    y: Math.min(mapa.altura, Math.max(0, y)),
  };
}

const SETAS: Record<string, Ponto> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Para onde a seta leva o token: uma célula naquela direção (RF-18). Outra tecla: nulo. */
export function destinoDaSeta(tecla: string, token: Ponto, celula: number): Ponto | null {
  const passo = SETAS[tecla];
  if (!passo) return null;
  return { x: token.x + passo.x * celula, y: token.y + passo.y * celula };
}

/** Graus entre 0 e 359,9, com uma casa decimal (o que o servidor aceita). */
export function rotacaoNormal(graus: number): number {
  const r = Math.round((((graus % 360) + 360) % 360) * 10) / 10;
  return r >= 360 ? 0 : r;
}

/** O botão "Girar": mais 45 graus (RF-21). */
export const girar = (rotacao: number) => rotacaoNormal(rotacao + 45);

/** O tamanho do prop depois de redimensionar na mão: entre 0,1 e 20 células. */
export function tamanhoDoProp(atual: number, escala: number): number {
  return Math.min(20, Math.max(0.1, Math.round(atual * Math.abs(escala) * 100) / 100));
}

/** "Trazer à frente": uma camada acima de todos. */
export function proximaOrdem(props: readonly PropNaMesa[]): number {
  return Math.min(10_000, Math.max(-1, ...props.map((p) => p.ordem)) + 1);
}

/**
 * O que aparece ao passar sobre um token: o nome e de quem é (RF-16: o de outro jogador mostra o
 * dono). Para o mestre, o NPC aparece como NPC.
 */
export function rotuloDoToken(
  token: TokenNaMesa,
  nomes: Readonly<Record<string, string>>,
  meuId: string,
): string {
  if (token.donoId === null) return token.nome;
  if (token.donoId === meuId) return `${token.nome} · seu`;
  const dono = nomes[token.donoId];
  return dono ? `${token.nome} · de ${dono}` : token.nome;
}

/** Quem pode arrastar: o mestre, qualquer um; o jogador, só o próprio. */
export const podeArrastar = (token: TokenNaMesa, meuId: string, mestre: boolean) =>
  mestre || (token.donoId !== null && token.donoId === meuId);

/**
 * Onde pôr um item novo: o ponto pedido, se estiver livre; senão, a casa livre mais próxima, de
 * dentro para fora, uma célula de cada vez. Assim três NPCs seguidos não nascem um sobre o outro.
 */
export function pontoLivre(
  desejado: Ponto,
  ocupados: readonly Ponto[],
  mapa: Pick<MapaNaMesa, 'largura' | 'altura' | 'grade'>,
): Ponto {
  const passo = mapa.grade.celula;
  const livre = (p: Ponto) => ocupados.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= passo / 2);
  for (let anel = 0; anel <= 6; anel++) {
    for (let dy = -anel; dy <= anel; dy++) {
      for (let dx = -anel; dx <= anel; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== anel) continue;
        const p = dentroDoMapa({ x: desejado.x + dx * passo, y: desejado.y + dy * passo }, mapa);
        if (livre(p)) return p;
      }
    }
  }
  return dentroDoMapa(desejado, mapa);
}

/* ---------- Breu (RF-22, RF-23) ---------- */

/** Menor lado (em pixels do mapa) de um retângulo de breu: menos que isso é um clique, não um desenho. */
export const MENOR_LADO_DO_BREU = 4;

/** O retângulo entre dois cantos quaisquer, sem sair do mapa; pequeno demais, nulo. */
export function retanguloEntre(
  a: Ponto,
  b: Ponto,
  mapa: Pick<MapaNaMesa, 'largura' | 'altura'>,
): Extract<FormaDoBreu, { tipo: 'retangulo' }> | null {
  const p = dentroDoMapa(a, mapa);
  const q = dentroDoMapa(b, mapa);
  const largura = Math.abs(p.x - q.x);
  const altura = Math.abs(p.y - q.y);
  if (largura < MENOR_LADO_DO_BREU || altura < MENOR_LADO_DO_BREU) return null;
  return { tipo: 'retangulo', x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), largura, altura };
}

/** O mapa inteiro: "cobrir tudo". */
export const mapaInteiro = (mapa: Pick<MapaNaMesa, 'largura' | 'altura'>): FormaDoBreu => ({
  tipo: 'retangulo',
  x: 0,
  y: 0,
  largura: mapa.largura,
  altura: mapa.altura,
});

/** Até 200 pontos por polígono (o que o servidor aceita). */
export const MAIS_PONTOS_NO_POLIGONO = 200;

/**
 * Um clique no desenho do polígono: fecha (perto do primeiro ponto, com três ou mais), ignora
 * (em cima do último: o segundo clique de um duplo) ou acrescenta. `raio` já em pixels do mapa.
 */
export function cliqueNoPoligono(
  pontos: readonly Ponto[],
  clique: Ponto,
  raio: number,
): 'fechar' | 'ignorar' | 'acrescentar' {
  const perto = (p: Ponto | undefined) =>
    p !== undefined && Math.hypot(p.x - clique.x, p.y - clique.y) <= raio;
  if (pontos.length >= 3 && perto(pontos[0])) return 'fechar';
  if (perto(pontos.at(-1))) return 'ignorar';
  if (pontos.length >= MAIS_PONTOS_NO_POLIGONO) return 'ignorar';
  return 'acrescentar';
}

/** O polígono desenhado, pronto para mandar; com menos de três pontos, nulo. */
export function poligonoDe(pontos: readonly Ponto[]): FormaDoBreu | null {
  if (pontos.length < 3) return null;
  return { tipo: 'poligono', pontos: pontos.slice(0, MAIS_PONTOS_NO_POLIGONO) };
}

/** A área de uma sala como forma do breu ("revelar por sala"); sala sem área, nulo. */
export function formaDaSala(sala: Pick<SalaNaMesa, 'area'>): FormaDoBreu | null {
  return poligonoDe(sala.area);
}

/** O meio da sala (média dos cantos): é por ele que o painel diz se a sala está sob o breu. */
export function meioDaSala(sala: Pick<SalaNaMesa, 'area'>): Ponto | null {
  if (sala.area.length === 0) return null;
  const soma = sala.area.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  return { x: soma.x / sala.area.length, y: soma.y / sala.area.length };
}

/** Tecla digitada num campo de texto não conta como atalho do mapa. */
export const digitando = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement &&
  (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName));
