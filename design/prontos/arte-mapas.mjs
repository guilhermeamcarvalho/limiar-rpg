// Mapas prontos do site (RF-14): plantas vistas de cima, alinhadas à grade (1 célula = 80 px).
// O construtor junta: piso por cômodo, paredes com aberturas (portas), grades, escadas, caminhos
// e a mobília, que é a mesma arte dos props prontos (arte-props.mjs).

import { CORES_DE_LUZ, FILTROS, gradientesDeLuz } from './acabamento.mjs';

export const CELULA = 80;

/* ---------- Pisos (padrões) ---------- */

const PISOS = {
  madeira: `<pattern id="madeira" width="160" height="80" patternUnits="userSpaceOnUse"><rect width="160" height="80" fill="#5e4430"/><g stroke="#43301f" stroke-width="2"><line x1="0" y1="20" x2="160" y2="20"/><line x1="0" y1="40" x2="160" y2="40"/><line x1="0" y1="60" x2="160" y2="60"/><line x1="0" y1="0" x2="160" y2="0"/><line x1="40" y1="0" x2="40" y2="20"/><line x1="120" y1="20" x2="120" y2="40"/><line x1="70" y1="40" x2="70" y2="60"/><line x1="150" y1="60" x2="150" y2="80"/></g></pattern>`,
  tacos: `<pattern id="tacos" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#6a4c32"/><g stroke="#4a3220" stroke-width="2"><rect x="0" y="0" width="40" height="40" fill="none"/><rect x="40" y="40" width="40" height="40" fill="none"/><line x1="0" y1="10" x2="40" y2="10"/><line x1="0" y1="20" x2="40" y2="20"/><line x1="0" y1="30" x2="40" y2="30"/><line x1="50" y1="0" x2="50" y2="40"/><line x1="60" y1="0" x2="60" y2="40"/><line x1="70" y1="0" x2="70" y2="40"/><line x1="40" y1="50" x2="80" y2="50"/><line x1="40" y1="60" x2="80" y2="60"/><line x1="40" y1="70" x2="80" y2="70"/><line x1="10" y1="40" x2="10" y2="80"/><line x1="20" y1="40" x2="20" y2="80"/><line x1="30" y1="40" x2="30" y2="80"/></g></pattern>`,
  ladrilho: `<pattern id="ladrilho" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#77746e"/><rect width="40" height="40" fill="#6a6762"/><rect x="40" y="40" width="40" height="40" fill="#6a6762"/><path d="M0 0 H80 M0 40 H80 M0 0 V80 M40 0 V80" stroke="#55524d" stroke-width="2"/></pattern>`,
  hospital: `<pattern id="hospital" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#b9c3c0"/><path d="M0 0 H40 M0 0 V40" stroke="#97a29f" stroke-width="2"/></pattern>`,
  xadrez: `<pattern id="xadrez" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#cfcac1"/><rect width="40" height="40" fill="#2e2c2a"/><rect x="40" y="40" width="40" height="40" fill="#2e2c2a"/></pattern>`,
  concreto: `<pattern id="concreto" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#55534f"/><g fill="#4a4844"><circle cx="20" cy="30" r="3"/><circle cx="90" cy="14" r="2"/><circle cx="130" cy="60" r="4"/><circle cx="50" cy="110" r="3"/><circle cx="110" cy="130" r="2"/><circle cx="150" cy="150" r="3"/></g><g fill="#605e5a"><circle cx="70" cy="70" r="5"/><circle cx="20" cy="140" r="4"/><circle cx="140" cy="100" r="3"/></g><path d="M0 0 H160 V160" stroke="#4a4844" stroke-width="2" fill="none"/></pattern>`,
  carpete: `<pattern id="carpete" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#4e2222"/><path d="M0 20 L20 0" stroke="#5a2a2a" stroke-width="2"/></pattern>`,
  carpeteAzul: `<pattern id="carpeteAzul" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#26303c"/><path d="M0 20 L20 0" stroke="#2e3a48" stroke-width="2"/></pattern>`,
  lajota: `<pattern id="lajota" width="160" height="160" patternUnits="userSpaceOnUse"><rect width="160" height="160" fill="#6a665e"/><g stroke="#4e4a44" stroke-width="3" fill="none"><rect x="0" y="0" width="80" height="80"/><rect x="80" y="0" width="80" height="80"/><rect x="0" y="80" width="80" height="80"/><rect x="80" y="80" width="80" height="80"/></g><g fill="#5e5a53"><rect x="6" y="6" width="68" height="68"/><rect x="86" y="86" width="68" height="68"/></g></pattern>`,
  grama: `<pattern id="grama" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#2b3a22"/><g stroke="#344a2a" stroke-width="3" stroke-linecap="round"><path d="M10 20 l3 -8 M14 20 l-2 -7 M50 14 l3 -8 M54 14 l-2 -7 M30 56 l3 -8 M34 56 l-2 -7 M66 66 l3 -8 M70 66 l-2 -7"/></g><g fill="#253320"><circle cx="64" cy="30" r="5"/><circle cx="20" cy="70" r="6"/></g></pattern>`,
  gramaEscura: `<pattern id="gramaEscura" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#1e2a19"/><g stroke="#283822" stroke-width="3" stroke-linecap="round"><path d="M10 20 l3 -8 M14 20 l-2 -7 M50 14 l3 -8 M54 14 l-2 -7 M30 56 l3 -8 M34 56 l-2 -7 M66 66 l3 -8 M70 66 l-2 -7"/></g></pattern>`,
  terra: `<pattern id="terra" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#5a4630"/><g fill="#4a3a28"><circle cx="12" cy="18" r="4"/><circle cx="52" cy="10" r="3"/><circle cx="34" cy="48" r="5"/><circle cx="70" cy="62" r="3"/><circle cx="16" cy="66" r="2"/></g><g fill="#6a5438"><circle cx="60" cy="36" r="3"/><circle cx="26" cy="30" r="2"/></g></pattern>`,
  asfalto: `<pattern id="asfalto" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#2a2a2c"/><g fill="#333336"><circle cx="10" cy="14" r="2"/><circle cx="44" cy="30" r="3"/><circle cx="70" cy="8" r="2"/><circle cx="24" cy="60" r="2"/><circle cx="60" cy="70" r="3"/></g></pattern>`,
  calcada: `<pattern id="calcada" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#6a6862"/><path d="M0 0 H80 M0 0 V80" stroke="#55534e" stroke-width="3"/></pattern>`,
  telhado: `<pattern id="telhado" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#3a2826"/><path d="M0 20 H40 M0 40 H40 M20 0 V20 M0 20 V40" stroke="#2a1c1a" stroke-width="3"/></pattern>`,
  telhadoCinza: `<pattern id="telhadoCinza" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#34363a"/><path d="M0 20 H40 M0 40 H40 M20 0 V20 M0 20 V40" stroke="#26282c" stroke-width="3"/></pattern>`,
  brita: `<pattern id="brita" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#46423c"/><g fill="#56524b"><circle cx="8" cy="8" r="4"/><circle cx="28" cy="14" r="5"/><circle cx="16" cy="30" r="4"/><circle cx="34" cy="34" r="3"/></g></pattern>`,
};

/* ---------- O construtor ---------- */

/**
 * `escuridao`: quanto o mapa escurece fora das luzes (0 a 1).
 * `luzDasSalas`: cada cômodo ganha uma luz no meio, com os cantos mais escuros (lugares fechados).
 */
export function criarMapa({
  colunas,
  linhas,
  fundo = '#0d0b0a',
  props,
  escuridao = 0.5,
  luzDasSalas = true,
}) {
  const W = colunas * CELULA;
  const H = linhas * CELULA;
  const pisosUsados = new Set();
  const pisos = [];
  const baixo = []; // caminhos, trilhos, marcas no chão
  const mobilia = [];
  const paredes = []; // {x1,y1,x2,y2} em células, alinhadas a um eixo
  const aberturas = []; // {x,y,o:'h'|'v',len,folha,abre}
  const cima = []; // grades, detalhes por cima das paredes
  const luzes = []; // {x, y, raio, cor} em células
  let contador = 0;
  const px = (c) => c * CELULA;

  const m = {
    W,
    H,
    /** Piso num retângulo (em células). */
    piso(x, y, w, h, padrao) {
      if (PISOS[padrao]) pisosUsados.add(padrao);
      const fill = PISOS[padrao] ? `url(#${padrao})` : padrao;
      pisos.push(`<rect x="${px(x)}" y="${px(y)}" width="${px(w)}" height="${px(h)}" fill="${fill}"/>`);
      return m;
    },
    /** Um cômodo: piso e as quatro paredes. */
    sala(x, y, w, h, padrao) {
      m.piso(x, y, w, h, padrao);
      if (luzDasSalas) {
        luzes.push({ x: x + w / 2, y: y + h / 2, raio: Math.max(w, h) * 0.62, cor: 'quente' });
      }
      paredes.push({ x1: x, y1: y, x2: x + w, y2: y }, { x1: x, y1: y + h, x2: x + w, y2: y + h });
      paredes.push({ x1: x, y1: y, x2: x, y2: y + h }, { x1: x + w, y1: y, x2: x + w, y2: y + h });
      return m;
    },
    parede(x1, y1, x2, y2) {
      paredes.push({ x1, y1, x2, y2 });
      return m;
    },
    /** Abertura numa parede: 'h' corta uma parede horizontal (em y), de x até x + len. */
    porta(x, y, o, len = 1, { folha = true, abre = 1 } = {}) {
      aberturas.push({ x, y, o, len, folha, abre });
      return m;
    },
    /** Passagem sem porta (arco, vão aberto). */
    vao(x, y, o, len) {
      return m.porta(x, y, o, len, { folha: false });
    },
    /** Um prop pronto, com o centro em (cx, cy) em células e `largura` em células. */
    p(id, cx, cy, largura, rot = 0) {
      const def = props.get(id);
      if (!def) throw new Error(`prop desconhecido no mapa: ${id}`);
      const n = ++contador;
      const u = (nome) => `m${n}-${nome}`;
      const s = px(largura) / def.w;
      mobilia.push(
        `<g transform="translate(${px(cx)} ${px(cy)}) rotate(${rot}) scale(${s.toFixed(4)}) translate(${-def.w / 2} ${-def.h / 2})">${def.acabar(def.corpo(u))}</g>`,
      );
      if (def.luz) luzes.push({ x: cx, y: cy, raio: def.luz.raio, cor: def.luz.cor });
      return m;
    },
    /** Uma luz no mapa (em células): um lustre, a lua por uma janela... */
    luz(x, y, raio, cor = 'quente') {
      luzes.push({ x, y, raio, cor });
      return m;
    },
    /** Desenho livre no chão (em pixels). */
    chao(svg) {
      baixo.push(svg);
      return m;
    },
    /** Desenho livre por cima das paredes (em pixels). */
    topo(svg) {
      cima.push(svg);
      return m;
    },
    /** Grade de cela, de (x1,y1) a (x2,y2), alinhada a um eixo. */
    grade(x1, y1, x2, y2) {
      const horizontal = y1 === y2;
      let barras = `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="#2a2e32" stroke-width="6"/>`;
      const total = horizontal ? (x2 - x1) * 8 : (y2 - y1) * 8;
      for (let i = 0; i <= total; i++) {
        const t = i / 8;
        const bx = horizontal ? px(x1 + t) : px(x1);
        const by = horizontal ? px(y1) : px(y1 + t);
        barras += `<circle cx="${bx}" cy="${by}" r="4" fill="#5a6066"/>`;
      }
      cima.push(barras);
      return m;
    },
    /** Escada: degraus num retângulo, subindo na direção dada. */
    escada(x, y, w, h, direcao = 'n') {
      let degraus = `<rect x="${px(x)}" y="${px(y)}" width="${px(w)}" height="${px(h)}" fill="#4a4640"/>`;
      const vertical = direcao === 'n' || direcao === 's';
      const passos = Math.round((vertical ? h : w) * 4);
      for (let i = 0; i <= passos; i++) {
        const t = i / 4;
        const cor = `rgba(0,0,0,${(0.08 + (direcao === 'n' || direcao === 'o' ? 1 - i / passos : i / passos) * 0.35).toFixed(2)})`;
        degraus += vertical
          ? `<rect x="${px(x)}" y="${px(y + t)}" width="${px(w)}" height="${CELULA / 4}" fill="${cor}"/><line x1="${px(x)}" y1="${px(y + t)}" x2="${px(x + w)}" y2="${px(y + t)}" stroke="#2a2622" stroke-width="3"/>`
          : `<rect x="${px(x + t)}" y="${px(y)}" width="${CELULA / 4}" height="${px(h)}" fill="${cor}"/><line x1="${px(x + t)}" y1="${px(y)}" x2="${px(x + t)}" y2="${px(y + h)}" stroke="#2a2622" stroke-width="3"/>`;
      }
      baixo.push(degraus);
      return m;
    },
    svg() {
      // Cada parede perde os trechos das aberturas que estão sobre ela.
      const trechos = [];
      for (const w of paredes) {
        const horizontal = w.y1 === w.y2;
        const ini = horizontal ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
        const fim = horizontal ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);
        const cortes = aberturas
          .filter((a) => (horizontal ? a.o === 'h' && a.y === w.y1 : a.o === 'v' && a.x === w.x1))
          .map((a) => (horizontal ? [a.x, a.x + a.len] : [a.y, a.y + a.len]))
          .sort((a, b) => a[0] - b[0]);
        let atual = ini;
        for (const [a, b] of cortes) {
          if (b <= atual || a >= fim) continue;
          if (a > atual) trechos.push(horizontal ? [atual, w.y1, a, w.y1] : [w.x1, atual, w.x1, a]);
          atual = Math.max(atual, b);
        }
        if (atual < fim) trechos.push(horizontal ? [atual, w.y1, fim, w.y1] : [w.x1, atual, w.x1, fim]);
      }
      const linhas = (cor, largura) =>
        trechos
          .map(([x1, y1, x2, y2]) => `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${cor}" stroke-width="${largura}" stroke-linecap="square"/>`)
          .join('');
      const portas = aberturas
        .filter((a) => a.folha)
        .map((a) => {
          const L = px(a.len);
          const s = a.abre;
          if (a.o === 'h') {
            const x = px(a.x);
            const y = px(a.y);
            return `<path d="M${x + L} ${y} A${L} ${L} 0 0 ${s > 0 ? 1 : 0} ${x} ${y + s * L}" fill="none" stroke="#8a7a62" stroke-width="2" stroke-dasharray="6 6"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + s * L}" stroke="#8a6440" stroke-width="7"/>`;
          }
          const x = px(a.x);
          const y = px(a.y);
          return `<path d="M${x} ${y + L} A${L} ${L} 0 0 ${s > 0 ? 0 : 1} ${x + s * L} ${y}" fill="none" stroke="#8a7a62" stroke-width="2" stroke-dasharray="6 6"/><line x1="${x}" y1="${y}" x2="${x + s * L}" y2="${y}" stroke="#8a6440" stroke-width="7"/>`;
        })
        .join('');
      const defs = [...pisosUsados].map((p) => PISOS[p]).join('');
      // Escuridão com furos onde há luz, e o brilho colorido de cada luz por cima.
      const furos = luzes
        .map((l) => `<circle cx="${px(l.x)}" cy="${px(l.y)}" r="${px(l.raio)}" fill="url(#g-furo)"/>`)
        .join('');
      const brilhos = luzes
        .filter((l) => l.cor !== 'quente' || !luzDasSalas || l.raio < 3)
        .map((l) => `<circle cx="${px(l.x)}" cy="${px(l.y)}" r="${px(l.raio)}" fill="url(#g-brilho-${l.cor})"/>`)
        .join('');
      const oclusao = trechos
        .map(([x1, y1, x2, y2]) => `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="#000" stroke-width="46"/>`)
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}${FILTROS}${gradientesDeLuz(CORES_DE_LUZ)}<mask id="m-escuro" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${furos}</mask></defs>` +
        `<rect width="${W}" height="${H}" fill="${fundo}"/>` +
        `<g filter="url(#f-textura)">${pisos.join('')}</g>` +
        `<rect width="${W}" height="${H}" fill="#000" filter="url(#f-sujeira)" opacity="0.38"/>` +
        `<g opacity="0.55" filter="url(#f-desfoque)">${oclusao}</g>` +
        `${baixo.join('')}${mobilia.join('')}` +
        `<g filter="url(#f-textura)">${linhas('#120e0c', 18)}${linhas('#3a322c', 6)}</g>${portas}${cima.join('')}` +
        `<rect width="${W}" height="${H}" fill="#06040a" opacity="${escuridao}" mask="url(#m-escuro)"/>${brilhos}` +
        `<rect width="${W}" height="${H}" fill="url(#g-vinheta)"/><rect width="${W}" height="${H}" fill="#fff" filter="url(#f-grao)"/></svg>`;
    },
  };
  return m;
}

/** Números pseudoaleatórios repetíveis (o mesmo mapa sai igual toda vez que gerar). */
function sementes(semente) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* ---------- Os mapas ---------- */

export const MAPAS = [
  {
    id: 'radio',
    nome: 'Rádio, 2º andar',
    descricao: 'Recepção, dois estúdios, arquivo, sala técnica e banheiro.',
    colunas: 30,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 9, 7, 'carpete').sala(10, 1, 11, 7, 'carpeteAzul').sala(21, 1, 8, 12, 'madeira');
      m.sala(1, 8, 20, 4, 'ladrilho').sala(1, 12, 10, 7, 'madeira').sala(11, 12, 10, 7, 'concreto').sala(21, 13, 8, 6, 'hospital');
      m.porta(1, 3, 'v', 2, { abre: 1 }).porta(4, 8, 'h', 2).porta(14, 8, 'h', 2, { abre: -1 }).porta(21, 9, 'v', 2);
      m.porta(4, 12, 'h', 2).porta(15, 12, 'h', 2).porta(24, 13, 'h', 2);
      m.p('sofa', 5.5, 2.1, 3).p('escrivaninha', 5.5, 6.2, 2.6, 180).p('poltrona', 2.4, 4.6, 1.2, 90).p('arbusto', 9, 2, 1);
      m.p('mesa', 15.5, 4.5, 3).p('radio', 15.5, 4.5, 1).p('cadeira', 14, 3.3, 0.8).p('cadeira', 17, 3.3, 0.8).p('cadeira', 15.5, 5.9, 0.8, 180);
      m.p('computador', 19.4, 2.2, 1.6).p('estante', 12.6, 1.6, 2.6);
      m.p('estante', 25, 1.6, 2.6).p('mesa-redonda', 25, 6.5, 2).p('cadeira', 25, 5, 0.8).p('mancha', 26.5, 9.5, 1.5).p('papel', 23.5, 10.5, 0.8, 20);
      m.p('estante', 3, 12.6, 2.6).p('estante', 7.5, 12.6, 2.6).p('caixas', 3, 17, 2).p('caixote', 8.5, 17.6, 1).p('caixote', 9.4, 16.5, 1, 20);
      m.p('gerador', 14, 17.4, 1.8).p('computador', 18.5, 13.2, 1.6).p('escrivaninha', 18.5, 14.2, 2.4, 180).p('barril', 12, 13, 1);
      m.p('vaso', 27.8, 14.2, 0.8, 90).p('pia', 23, 18.4, 1.4, 180).p('banheira', 27.5, 17, 1.4, 90);
    },
  },
  {
    id: 'hospital',
    nome: 'Ala 13 do hospital',
    descricao: 'Três enfermarias, posto de enfermagem, cirurgia e necrotério.',
    colunas: 32,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 10, 7, 'hospital').sala(11, 1, 10, 7, 'hospital').sala(21, 1, 10, 7, 'hospital');
      m.sala(1, 8, 30, 4, 'hospital').sala(1, 12, 8, 7, 'hospital').sala(9, 12, 10, 7, 'hospital').sala(19, 12, 12, 7, 'concreto');
      m.porta(1, 9, 'v', 2).porta(5, 8, 'h', 2, { abre: -1 }).porta(15, 8, 'h', 2, { abre: -1 }).porta(25, 8, 'h', 2, { abre: -1 });
      m.porta(4, 12, 'h', 2).porta(13, 12, 'h', 2).porta(24, 12, 'h', 2);
      for (const base of [1, 11, 21]) {
        for (const dx of [2, 5, 8]) m.p('maca', base + dx, 3.2, 1.2).p('soro', base + dx + 1, 2, 0.6);
      }
      m.p('mancha', 27, 5, 1.2).p('corpo-coberto', 28, 3.2, 1.2);
      m.p('escrivaninha', 4.6, 16, 2.6).p('computador', 4.6, 15.8, 1.4).p('cadeira', 4.6, 17.3, 0.8, 180).p('carrinho', 7.6, 17.6, 1.1).p('armario', 1.6, 14.8, 2.4, 90);
      m.p('maca', 14, 15.2, 1.3).p('carrinho', 16.4, 15, 1.1, 90).p('soro', 12.3, 14, 0.7).p('mancha', 14.5, 17.4, 1);
      for (const x of [21, 24, 27]) m.p('maca', x, 15.6, 1.2).p('corpo-coberto', x, 15.6, 1);
      m.p('armario', 30, 15.5, 2.4, 90);
      m.p('cadeira-de-rodas', 21, 10, 1, 90).p('cadeira', 9, 9, 0.8).p('cadeira', 10, 9, 0.8);
    },
  },
  {
    id: 'casa',
    nome: 'Casa abandonada',
    descricao: 'Sala, cozinha, dois quartos e banheiro, com o quintal em volta.',
    colunas: 28,
    linhas: 20,
    fundo: 'url(#grama)',
    desenhar: (m) => {
      m.piso(0, 0, 28, 20, 'grama');
      m.sala(2, 2, 12, 9, 'madeira').sala(14, 2, 12, 6, 'xadrez').sala(14, 8, 12, 3, 'madeira');
      m.sala(2, 11, 9, 7, 'tacos').sala(11, 11, 5, 7, 'hospital').sala(16, 11, 10, 7, 'tacos');
      m.porta(2, 5, 'v', 2).porta(14, 9, 'v', 2).porta(18, 8, 'h', 2, { abre: -1 }).porta(17, 11, 'h', 2);
      m.porta(14, 11, 'h', 1).porta(5, 11, 'h', 2).porta(26, 4, 'v', 2, { abre: -1 });
      m.p('tapete', 8, 6.5, 4).p('sofa', 8, 3, 3).p('poltrona', 11.6, 6.5, 1.2, -90).p('televisao', 8, 9.9, 1.6, 180);
      m.p('estante', 2.6, 6.5, 2.6, 90).p('mancha', 5, 8.6, 1.2).p('papel', 9.5, 7.5, 0.7, 30);
      m.p('fogao', 15.2, 2.8, 1.2, 180).p('geladeira', 16.7, 2.8, 1.1, 180).p('pia', 19, 2.6, 1.6, 180);
      m.p('mesa-redonda', 21.5, 5.2, 2).p('cadeira', 20.1, 5.2, 0.8, -90).p('cadeira', 22.9, 5.2, 0.8, 90).p('cadeira', 21.5, 6.6, 0.8, 180);
      m.p('cama', 4, 14.4, 1.6).p('armario', 8.5, 11.6, 2.4).p('caixote', 9.6, 16.8, 0.9, 15);
      m.p('banheira', 12.3, 14.6, 1.4).p('vaso', 15, 12.6, 0.8, 180).p('pia', 14.6, 17.4, 1.4, 180);
      m.p('cama-casal', 22.4, 14.4, 2.6).p('armario', 24.6, 17.4, 2.4, 180).p('lanterna', 18, 16.6, 1.6, -30).p('livro', 23.5, 12.5, 0.8);
      m.p('arvore-morta', 1, 1, 2.6).p('arvore', 27, 19, 2.6).p('arbusto', 26.6, 1, 1.4).p('arbusto', 1, 19, 1.4).p('barril', 27, 9, 1);
    },
  },
  {
    id: 'porao',
    nome: 'Porão',
    descricao: 'Pilares, caixas e um círculo ritual no meio do concreto.',
    colunas: 24,
    linhas: 18,
    desenhar: (m) => {
      m.sala(1, 1, 22, 16, 'concreto');
      m.escada(1, 1, 4, 2, 'n');
      for (const x of [7, 13, 19]) {
        for (const y of [6, 12]) m.piso(x - 0.3, y - 0.3, 0.6, 0.6, '#2a2826');
      }
      m.p('circulo-ritual', 12, 9, 3.6).p('vela', 12, 6.8, 0.6).p('vela', 14.2, 9, 0.6).p('vela', 12, 11.2, 0.6).p('vela', 9.8, 9, 0.6);
      m.p('cranio', 12, 9, 0.6).p('mancha', 14.6, 11.4, 1.2).p('simbolo', 20.5, 15, 1.4).p('livro', 10.6, 10.4, 0.7, 20);
      m.p('caixas', 3.5, 14.5, 2).p('caixote', 6, 15.6, 1).p('caixas', 20, 3.4, 2).p('caixote', 17.6, 2, 1, 10);
      m.p('barril', 21.6, 9.2, 1).p('barril', 21.6, 10.4, 1).p('gerador', 3.6, 8.5, 1.8, 90).p('estante', 10, 1.6, 2.6);
      m.p('corpo-coberto', 17, 15.2, 1.2, 90).p('lanterna', 5, 4.4, 1.6, 40);
    },
  },
  {
    id: 'igreja',
    nome: 'Igreja',
    descricao: 'Nave com bancos, presbitério com altar e sacristia.',
    colunas: 32,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 22, 18, 'lajota').sala(23, 1, 8, 12, 'carpete').sala(23, 13, 8, 6, 'madeira');
      m.piso(3, 9, 20, 2, 'carpete');
      m.porta(1, 9, 'v', 2).vao(23, 3, 'v', 8).porta(26, 13, 'h', 2).porta(23, 15, 'v', 2);
      for (let x = 5; x <= 20; x += 2) m.p('banco-igreja', x, 5.4, 3.6, -90).p('banco-igreja', x, 14.6, 3.6, -90);
      m.p('altar', 27.2, 7, 3, 90).p('vela', 27.2, 4.4, 0.6).p('vela', 27.2, 9.6, 0.6).p('cruz', 30, 7, 1, 90);
      m.p('vela', 24.5, 2.2, 0.5).p('vela', 24.5, 11.8, 0.5).p('tapete', 27, 11.5, 2.4);
      m.p('caixao', 27, 16, 1.2, 90).p('armario', 30.2, 16, 2.4, 90).p('estante', 26.6, 18.4, 2.6, 180).p('vela', 24.4, 18.2, 0.5);
      m.p('vela', 2.4, 2.4, 0.5).p('vela', 2.4, 17.6, 0.5);
    },
  },
  {
    id: 'delegacia',
    nome: 'Delegacia',
    descricao: 'Recepção, escritório, sala do delegado, interrogatório, celas e arquivo.',
    colunas: 30,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 10, 8, 'ladrilho').sala(11, 1, 12, 8, 'carpeteAzul').sala(23, 1, 6, 8, 'madeira').sala(1, 9, 28, 3, 'ladrilho');
      m.sala(1, 12, 8, 7, 'concreto').sala(21, 12, 8, 7, 'madeira');
      m.piso(9, 12, 12, 7, 'concreto').parede(9, 19, 21, 19).parede(13, 12, 13, 19).parede(17, 12, 17, 19);
      m.grade(9, 12, 21, 12);
      m.porta(1, 4, 'v', 2).porta(5, 9, 'h', 2, { abre: -1 }).porta(16, 9, 'h', 2, { abre: -1 }).porta(25, 9, 'h', 2, { abre: -1 });
      m.porta(4, 12, 'h', 2).porta(24, 12, 'h', 2);
      m.p('escrivaninha', 6, 3.5, 2.6, 180).p('cadeira', 6, 2.2, 0.8).p('cadeira', 3, 7.5, 0.8).p('cadeira', 4.2, 7.5, 0.8).p('arbusto', 10, 8, 0.9);
      for (const x of [13.5, 17, 20.5]) m.p('escrivaninha', x, 5, 2.4).p('computador', x, 4.6, 1.2).p('cadeira', x, 6.4, 0.8, 180);
      m.p('quadro-de-pistas', 17, 2.2, 2.4);
      m.p('escrivaninha', 26, 4.5, 2.4).p('cadeira', 26, 5.9, 0.8, 180).p('cofre', 28, 2, 1).p('estante', 28.4, 6, 2.2, 90);
      m.p('mesa', 5, 15.5, 1.8).p('cadeira', 5, 14.2, 0.8).p('cadeira', 5, 16.8, 0.8, 180).p('lanterna', 3, 18, 1.4, -60);
      for (const x of [9, 13, 17]) m.p('cama', x + 1, 16.6, 1, 0).p('vaso', x + 3.4, 18.4, 0.6, 180);
      m.p('estante', 23.5, 12.6, 2.6).p('estante', 23.5, 15.5, 2.6).p('estante', 23.5, 18.4, 2.6, 180).p('caixas', 27.4, 16, 1.6).p('caixote', 27.6, 13.4, 0.9);
    },
  },
  {
    id: 'biblioteca',
    nome: 'Biblioteca',
    descricao: 'Salão com estantes e mesas de leitura, arquivo restrito e sala de leitura.',
    colunas: 30,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 20, 18, 'madeira').sala(21, 1, 8, 9, 'carpete').sala(21, 10, 8, 9, 'carpeteAzul');
      m.porta(9, 19, 'h', 2, { abre: -1 }).porta(21, 5, 'v', 2).porta(21, 13, 'v', 2);
      for (const y of [3, 6, 9, 12, 15]) m.p('estante', 3.8, y, 2.6).p('estante', 7.4, y, 2.6);
      for (const y of [4, 9.5, 15]) {
        m.p('mesa', 15.5, y, 3).p('cadeira', 14.4, y - 1.3, 0.8).p('cadeira', 16.6, y - 1.3, 0.8).p('cadeira', 14.4, y + 1.3, 0.8, 180).p('cadeira', 16.6, y + 1.3, 0.8, 180);
        m.p('livro', 15, y, 0.7, 15);
      }
      m.p('escrivaninha', 11.5, 17.2, 2.4).p('cadeira', 11.5, 16, 0.8);
      m.p('cofre', 27.8, 2.2, 1).p('estante', 24, 1.6, 2.6).p('mesa', 24.5, 6, 2).p('livro', 24.5, 6, 0.8).p('vela', 23.4, 5.6, 0.5);
      m.p('simbolo', 27, 8, 1.2).p('caixote', 22, 8.6, 0.9);
      m.p('tapete', 25, 14.5, 3.4).p('poltrona', 23.4, 12.4, 1.1).p('poltrona', 26.6, 12.4, 1.1).p('mesa-redonda', 25, 14.6, 1.4).p('estante', 25, 18.4, 2.6, 180);
    },
  },
  {
    id: 'escola',
    nome: 'Escola',
    descricao: 'Duas salas de aula, corredor, banheiro, diretoria e refeitório.',
    colunas: 30,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 14, 7, 'tacos').sala(15, 1, 14, 7, 'tacos').sala(1, 8, 28, 4, 'ladrilho');
      m.sala(1, 12, 6, 7, 'hospital').sala(7, 12, 8, 7, 'carpete').sala(15, 12, 14, 7, 'xadrez');
      m.porta(5, 8, 'h', 2, { abre: -1 }).porta(19, 8, 'h', 2, { abre: -1 }).porta(29, 9, 'v', 2, { abre: -1 });
      m.porta(3, 12, 'h', 1).porta(10, 12, 'h', 2).porta(21, 12, 'h', 2);
      for (const base of [1, 15]) {
        m.piso(base + 0.2, 1.4, 0.25, 5, '#20402e');
        m.p('escrivaninha', base + 2, 2.4, 2, 90);
        for (const x of [5, 8, 11]) {
          for (const y of [2.6, 5]) m.p('mesa', base + x, y, 1.2).p('cadeira', base + x, y + 1, 0.6, 180);
        }
      }
      m.p('papel', 9, 4, 0.6, 30).p('mancha', 23, 6.5, 1);
      m.p('vaso', 2, 12.6, 0.6, 180).p('vaso', 3.4, 18.4, 0.6).p('vaso', 2, 18.4, 0.6).p('pia', 5.8, 15, 1.2, -90);
      m.p('escrivaninha', 11, 16.6, 2.4, 180).p('cadeira', 11, 17.8, 0.8, 180).p('estante', 8.6, 13, 2.4, 90).p('cofre', 14.2, 18.2, 0.8).p('poltrona', 9, 17, 1);
      for (const y of [14, 17]) m.p('mesa', 19, y, 3).p('mesa', 25, y, 3);
    },
  },
  {
    id: 'cemiterio',
    nome: 'Cemitério',
    descricao: 'Túmulos, caminhos de terra, árvores e um mausoléu.',
    colunas: 32,
    linhas: 22,
    fundo: 'url(#grama)',
    luz: { escuridao: 0.45, luzDasSalas: false },
    desenhar: (m) => {
      m.piso(0, 0, 32, 22, 'grama').piso(0, 10, 32, 2, 'terra').piso(15, 0, 2, 22, 'terra');
      for (let x = 0.5; x < 32; x += 5) {
        if (x < 14 || x > 18) m.p('cerca', x + 2.5, 0.3, 5).p('cerca', x + 2.5, 21.7, 5);
      }
      for (let y = 0.5; y < 22; y += 5) {
        if (y < 9 || y > 12) m.p('cerca', 0.3, y + 2.5, 5, 90).p('cerca', 31.7, y + 2.5, 5, 90);
      }
      const r = sementes(7);
      const tumulos = (x0, x1, y0, y1) => {
        for (let x = x0; x <= x1; x += 2) {
          for (let y = y0; y <= y1; y += 2.5) {
            const tipo = r() < 0.3 ? 'cruz' : 'lapide';
            m.p(tipo, x, y, tipo === 'cruz' ? 0.6 : 0.9, (r() - 0.5) * 12);
            if (r() < 0.15) m.piso(x - 0.4, y + 0.5, 0.8, 1.4, 'terra');
          }
        }
      };
      tumulos(2.5, 12.5, 2, 7);
      tumulos(19.5, 29.5, 2, 7);
      tumulos(2.5, 12.5, 13.5, 18.5);
      m.sala(21, 14, 7, 6, 'lajota').porta(23.5, 14, 'h', 2, { abre: -1 });
      m.p('caixao', 24.5, 17.4, 1.1, 90).p('vela', 22, 15, 0.5).p('vela', 27, 15, 0.5).p('cruz', 24.5, 19.3, 0.8, 180);
      m.p('arvore', 14, 4, 2.6).p('arvore', 18.5, 18, 2.8).p('arvore-morta', 29.5, 12.8, 2.6).p('arvore-morta', 2, 11, 2.2);
      m.p('arbusto', 13.6, 14, 1.2).p('arbusto', 19, 2, 1.2).p('mancha', 10.5, 11, 1).p('lanterna', 16, 7, 1.4, 80);
    },
  },
  {
    id: 'floresta',
    nome: 'Floresta',
    descricao: 'Trilha na mata, clareira com fogueira, riacho e uma cabana.',
    colunas: 32,
    linhas: 22,
    fundo: 'url(#gramaEscura)',
    luz: { escuridao: 0.5, luzDasSalas: false },
    desenhar: (m) => {
      m.piso(0, 0, 32, 22, 'gramaEscura');
      m.chao(`<path d="M-40 1520 C400 1500 600 1200 900 1100 C1250 980 1400 820 1600 720 C1900 560 2200 600 2600 -40" fill="none" stroke="#4a3a28" stroke-width="130" stroke-linecap="round"/><path d="M-40 1520 C400 1500 600 1200 900 1100 C1250 980 1400 820 1600 720 C1900 560 2200 600 2600 -40" fill="none" stroke="#5a4630" stroke-width="100" stroke-linecap="round"/>`);
      m.chao(`<path d="M2420 1800 C2500 1500 2380 1300 2480 1000 C2580 700 2860 520 2600 -40" fill="none" stroke="#1e3440" stroke-width="110" stroke-linecap="round"/><path d="M2420 1800 C2500 1500 2380 1300 2480 1000 C2580 700 2860 520 2600 -40" fill="none" stroke="#2a4a5a" stroke-width="70" stroke-linecap="round"/>`);
      m.chao(`<circle cx="1600" cy="720" r="300" fill="#5a4630"/>`);
      m.p('fogueira', 20, 9, 1.6).p('pedra', 18, 10.6, 0.9).p('pedra', 22.4, 8, 0.8).p('barril', 21.6, 11, 0.8).p('mala', 18.4, 7.6, 1, 30);
      m.sala(4, 14, 6, 5, 'madeira').porta(6, 14, 'h', 2, { abre: 1 });
      m.p('cama', 5.4, 16.6, 1.2).p('mesa', 8, 16.6, 1.4, 90).p('lanterna', 8, 15.4, 1.2).p('livro', 8.2, 17.4, 0.6);
      const r = sementes(42);
      const livre = (x, y) =>
        Math.hypot(x - 20, y - 9) > 5 && !(x > 3 && x < 11 && y > 13 && y < 20) && Math.abs(x - (y < 11 ? 25 : 30)) > 2;
      for (let i = 0; i < 70; i++) {
        const x = r() * 32;
        const y = r() * 22;
        if (!livre(x, y)) continue;
        const sorte = r();
        if (sorte < 0.6) m.p('arvore', x, y, 2 + r() * 1.4, r() * 360);
        else if (sorte < 0.8) m.p('arbusto', x, y, 1 + r() * 0.6, r() * 360);
        else if (sorte < 0.9) m.p('arvore-morta', x, y, 1.8 + r(), r() * 360);
        else m.p('pedra', x, y, 0.8 + r() * 0.6, r() * 360);
      }
    },
  },
  {
    id: 'rua',
    nome: 'Rua à noite',
    descricao: 'Avenida com calçadas, postes, carros, prédios e um beco.',
    colunas: 32,
    linhas: 20,
    luz: { escuridao: 0.5, luzDasSalas: false },
    desenhar: (m) => {
      m.piso(0, 7, 32, 6, 'asfalto').piso(0, 5.5, 32, 1.5, 'calcada').piso(0, 13, 32, 1.5, 'calcada');
      m.chao(Array.from({ length: 16 }, (_, i) => `<rect x="${i * 160 + 30}" y="${10 * 80 - 4}" width="90" height="8" fill="#d8c86a" opacity="0.8"/>`).join(''));
      m.chao(Array.from({ length: 7 }, (_, i) => `<rect x="${20 * 80 + 10}" y="${7 * 80 + 20 + i * 64}" width="140" height="36" fill="#d8d4cc" opacity="0.75"/>`).join(''));
      m.piso(0, 0, 13, 5.5, 'telhado').piso(17, 0, 15, 5.5, 'telhadoCinza').piso(13, 0, 4, 5.5, 'asfalto');
      m.piso(0, 14.5, 9, 5.5, 'telhadoCinza').piso(9, 14.5, 12, 5.5, 'telhado').piso(21, 14.5, 11, 5.5, 'telhadoCinza');
      m.parede(0, 5.5, 13, 5.5).parede(17, 5.5, 32, 5.5).parede(0, 14.5, 32, 14.5).parede(13, 0, 13, 5.5).parede(17, 0, 17, 5.5);
      m.parede(9, 14.5, 9, 20).parede(21, 14.5, 21, 20);
      m.porta(5, 5.5, 'h', 1, { abre: -1 }).porta(24, 5.5, 'h', 1, { abre: -1 }).porta(14, 14.5, 'h', 1).porta(26, 14.5, 'h', 1);
      m.p('lixeira', 15, 1.4, 1.8, 90).p('caixas', 14.2, 4, 1.4).p('mancha', 15.6, 3, 1).p('barril', 16.3, 4.4, 0.8).p('papel', 14.4, 2.6, 0.5, 40);
      for (const x of [3, 11, 19, 27]) m.p('poste', x, 6, 2.2).p('poste', x + 4, 14, 2.2);
      m.p('carro', 8, 8.2, 2.1, 90).p('carro', 24, 8.2, 2.1, 90).p('carro', 29, 11.8, 2.1, -90);
      m.p('lixeira', 6.5, 13.8, 1.4).p('arvore', 1, 13.8, 1.6).p('arvore', 30.5, 6.2, 1.6);
    },
  },
  {
    id: 'metro',
    nome: 'Estação de metrô',
    descricao: 'Plataforma com pilares e bancos, catracas, escada e os trilhos.',
    colunas: 32,
    linhas: 20,
    desenhar: (m) => {
      m.sala(1, 1, 30, 11, 'concreto').piso(1, 12, 30, 7, 'brita').parede(1, 19, 31, 19);
      m.piso(1, 11.55, 30, 0.45, '#c9a22e');
      m.chao(Array.from({ length: 60 }, (_, i) => `<rect x="${80 + i * 40}" y="${13 * 80}" width="16" height="${4.6 * 80}" fill="#4a3424"/>`).join(''));
      m.chao(`<g stroke="#8a9096" stroke-width="10"><line x1="80" y1="${14 * 80}" x2="${31 * 80}" y2="${14 * 80}"/><line x1="80" y1="${16.8 * 80}" x2="${31 * 80}" y2="${16.8 * 80}"/></g>`);
      m.parede(6, 1, 6, 5).parede(6, 7, 6, 11);
      m.chao(Array.from({ length: 4 }, (_, i) => `<rect x="${6 * 80 - 10}" y="${(5 + i * 0.5) * 80 + 6}" width="20" height="28" fill="#8a9096" stroke="#2a2e32" stroke-width="3"/>`).join(''));
      m.escada(14, 1, 5, 2, 'n').porta(1, 5, 'v', 2);
      for (const x of [10, 16, 22, 28]) m.piso(x - 0.4, 6.6, 0.8, 0.8, '#3a3836');
      m.p('banco-igreja', 13, 7, 2.6).p('banco-igreja', 25, 7, 2.6).p('barril', 9, 10.6, 0.7).p('barril', 21, 10.6, 0.7);
      m.p('poste', 11, 4, 2).p('poste', 26, 4, 2).p('papel', 18.5, 9.4, 0.6, 25).p('mancha', 29, 3, 0.9);
    },
  },
];
