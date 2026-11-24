// Arte dos props prontos (RF-20), vistos de cima, com fundo transparente.
// Cada prop: id, nome, categoria, tamanho (quantas células de largura ocupa ao entrar na mesa),
// medidas do desenho (w × h) e `arte(u)`, que devolve o miolo do SVG. `u(nome)` dá um id único
// para gradientes, para o mesmo desenho poder entrar várias vezes dentro de um mapa.
// Os cinco primeiros já existiam (caixote, contorno, papel, mancha, rádio): os arquivos deles
// ficam como estão (`manter: true`), só entram no catálogo.

export const C = {
  madeira: '#7a5532',
  madeiraClara: '#9a7148',
  madeiraEscura: '#4a3220',
  borda: '#24170c',
  metal: '#8a9096',
  metalEscuro: '#474c52',
  ferro: '#2f3236',
  tecido: '#5b3a3a',
  tecidoAzul: '#33475b',
  tecidoVerde: '#3c4f3a',
  lencol: '#e2ddd2',
  branco: '#eeeae2',
  papel: '#ece5d6',
  sangue: '#6e120d',
  sangueVivo: '#8f1a12',
  pedra: '#7d7a74',
  pedraEscura: '#55524d',
  folha: '#3f5a32',
  folhaEscura: '#2a3d22',
  vidro: '#9fb7c4',
  ouro: '#d9b25a',
  chama: '#f2a33a',
  sombra: '#000000',
};

/**
 * A sombra agora vem do acabamento (acabamento.mjs: sombra suave, textura e volume). Os desenhos
 * ainda chamam `sombra(...)`; ela não desenha mais nada.
 */
const sombra = () => '';

/**
 * Marcas de acabamento de cada prop (o que não estiver aqui ganha sombra, textura e volume):
 *   chao: rente ao chão, sem sombra nem volume (mancha, pegadas, tapete, símbolo...)
 *   organico: borda irregular (sangue, pintura)
 *   brilho: emite luz, sem textura por cima do brilho
 *   luz: { raio (em células), cor }: acende o mapa em volta quando o prop está num mapa pronto
 */
export const ACABAMENTO = {
  contorno: { chao: true },
  mancha: { chao: true, organico: true },
  papel: { chao: true },
  tapete: { chao: true },
  'circulo-ritual': { chao: true, organico: true },
  simbolo: { chao: true, organico: true },
  pegadas: { chao: true, organico: true },
  'fita-isolamento': { chao: true },
  vela: { brilho: true, luz: { raio: 1.8, cor: 'chama' } },
  fogueira: { luz: { raio: 4.5, cor: 'chama' } },
  poste: { brilho: true, luz: { raio: 3.6, cor: 'poste' } },
  lanterna: { brilho: true, luz: { raio: 2.4, cor: 'quente' } },
  altar: { luz: { raio: 2.2, cor: 'chama' } },
  televisao: { luz: { raio: 1.4, cor: 'fria' } },
  computador: { luz: { raio: 1.2, cor: 'fria' } },
};

/** Embrulha o desenho de um prop com o acabamento das marcas dele (ids dos filtros: acabamento.mjs). */
export function acabar(id, miolo) {
  const a = ACABAMENTO[id] ?? {};
  let g = miolo;
  if (!a.chao && !a.brilho) g = `<g filter="url(#f-volume)">${g}</g>`;
  if (!a.brilho) g = `<g filter="url(#f-textura)">${g}</g>`;
  if (a.organico) g = `<g filter="url(#f-organico)">${g}</g>`;
  if (!a.chao) g = `<g filter="url(#f-sombra)">${g}</g>`;
  return g;
}

export const PROPS = [
  // ---------- já existentes (arquivos mantidos) ----------
  { id: 'caixote', nome: 'Caixote', categoria: 'Objetos', tamanho: 1, manter: true },
  { id: 'contorno', nome: 'Contorno', categoria: 'Cena do crime', tamanho: 2, manter: true },
  { id: 'papel', nome: 'Papel', categoria: 'Cena do crime', tamanho: 1, manter: true },
  { id: 'mancha', nome: 'Mancha', categoria: 'Cena do crime', tamanho: 1.5, manter: true },
  { id: 'radio', nome: 'Rádio', categoria: 'Objetos', tamanho: 1, manter: true },

  // ---------- Mobília ----------
  {
    id: 'mesa', nome: 'Mesa', categoria: 'Mobília', tamanho: 3, w: 240, h: 140,
    arte: () => `${sombra('<rect x="10" y="10" width="220" height="120" rx="6"/>')}
      <rect x="10" y="10" width="220" height="120" rx="6" fill="${C.madeira}" stroke="${C.borda}" stroke-width="5"/>
      <g stroke="${C.madeiraEscura}" stroke-width="2" opacity="0.7">
        <line x1="14" y1="40" x2="226" y2="40"/><line x1="14" y1="70" x2="226" y2="70"/><line x1="14" y1="100" x2="226" y2="100"/>
      </g>`,
  },
  {
    id: 'mesa-redonda', nome: 'Mesa redonda', categoria: 'Mobília', tamanho: 2, w: 180, h: 180,
    arte: () => `${sombra('<circle cx="90" cy="90" r="80"/>')}
      <circle cx="90" cy="90" r="80" fill="${C.madeira}" stroke="${C.borda}" stroke-width="5"/>
      <circle cx="90" cy="90" r="56" fill="none" stroke="${C.madeiraEscura}" stroke-width="2" opacity="0.6"/>
      <circle cx="90" cy="90" r="28" fill="none" stroke="${C.madeiraEscura}" stroke-width="2" opacity="0.5"/>`,
  },
  {
    id: 'cadeira', nome: 'Cadeira', categoria: 'Mobília', tamanho: 0.8, w: 90, h: 96,
    arte: () => `${sombra('<rect x="10" y="14" width="70" height="72" rx="6"/>')}
      <rect x="10" y="22" width="70" height="66" rx="6" fill="${C.madeiraClara}" stroke="${C.borda}" stroke-width="4"/>
      <rect x="8" y="6" width="74" height="18" rx="4" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="4"/>`,
  },
  {
    id: 'poltrona', nome: 'Poltrona', categoria: 'Mobília', tamanho: 1.2, w: 130, h: 126,
    arte: () => `${sombra('<rect x="8" y="8" width="114" height="110" rx="18"/>')}
      <rect x="8" y="8" width="114" height="110" rx="18" fill="${C.tecido}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="28" y="34" width="74" height="74" rx="10" fill="#6e4848"/>
      <rect x="10" y="10" width="110" height="24" rx="10" fill="#4a2e2e"/>`,
  },
  {
    id: 'sofa', nome: 'Sofá', categoria: 'Mobília', tamanho: 3, w: 270, h: 116,
    arte: () => `${sombra('<rect x="8" y="8" width="254" height="100" rx="16"/>')}
      <rect x="8" y="8" width="254" height="100" rx="16" fill="${C.tecidoAzul}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="10" y="10" width="250" height="26" rx="10" fill="#26374a"/>
      <g fill="#3e5670" stroke="#1d2a38" stroke-width="2">
        <rect x="30" y="40" width="68" height="58" rx="8"/><rect x="101" y="40" width="68" height="58" rx="8"/><rect x="172" y="40" width="68" height="58" rx="8"/>
      </g>`,
  },
  {
    id: 'cama', nome: 'Cama', categoria: 'Mobília', tamanho: 1.6, w: 140, h: 240,
    arte: () => `${sombra('<rect x="8" y="8" width="124" height="224" rx="6"/>')}
      <rect x="8" y="8" width="124" height="224" rx="6" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="16" y="16" width="108" height="208" rx="4" fill="${C.lencol}"/>
      <rect x="28" y="24" width="84" height="40" rx="12" fill="#f6f3ec" stroke="#c8c1b3" stroke-width="2"/>
      <path d="M16 96 H124 V224 H16 Z" fill="#7d5a5a"/>
      <path d="M16 96 H124" stroke="#5d3e3e" stroke-width="4"/>`,
  },
  {
    id: 'cama-casal', nome: 'Cama de casal', categoria: 'Mobília', tamanho: 2.6, w: 220, h: 250,
    arte: () => `${sombra('<rect x="8" y="8" width="204" height="234" rx="6"/>')}
      <rect x="8" y="8" width="204" height="234" rx="6" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="16" y="16" width="188" height="218" rx="4" fill="${C.lencol}"/>
      <rect x="26" y="24" width="78" height="40" rx="12" fill="#f6f3ec" stroke="#c8c1b3" stroke-width="2"/>
      <rect x="116" y="24" width="78" height="40" rx="12" fill="#f6f3ec" stroke="#c8c1b3" stroke-width="2"/>
      <path d="M16 100 H204 V234 H16 Z" fill="#4f5f74"/>
      <path d="M16 100 H204" stroke="#364252" stroke-width="4"/>`,
  },
  {
    id: 'armario', nome: 'Armário', categoria: 'Mobília', tamanho: 2.4, w: 200, h: 80,
    arte: () => `${sombra('<rect x="6" y="6" width="188" height="68"/>')}
      <rect x="6" y="6" width="188" height="68" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>
      <line x1="100" y1="8" x2="100" y2="72" stroke="${C.borda}" stroke-width="4"/>
      <rect x="12" y="12" width="82" height="56" fill="none" stroke="${C.madeira}" stroke-width="3"/>
      <rect x="106" y="12" width="82" height="56" fill="none" stroke="${C.madeira}" stroke-width="3"/>`,
  },
  {
    id: 'estante', nome: 'Estante de livros', categoria: 'Mobília', tamanho: 2.6, w: 220, h: 70,
    arte: () => {
      const cores = ['#7a2e24', '#2e4a6a', '#3f5a32', '#8a6a2a', '#4a3a5e', '#6a3a2a', '#2a4a4a'];
      let livros = '';
      for (let x = 14, i = 0; x < 204; i++) {
        const w = 8 + ((i * 7) % 9);
        livros += `<rect x="${x}" y="14" width="${w}" height="44" fill="${cores[i % cores.length]}" stroke="#1a120a" stroke-width="1"/>`;
        x += w + 1;
      }
      return `${sombra('<rect x="6" y="6" width="208" height="58"/>')}
        <rect x="6" y="6" width="208" height="58" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>${livros}`;
    },
  },
  {
    id: 'escrivaninha', nome: 'Escrivaninha', categoria: 'Mobília', tamanho: 2.6, w: 220, h: 120,
    arte: () => `${sombra('<rect x="8" y="8" width="204" height="104" rx="4"/>')}
      <rect x="8" y="8" width="204" height="104" rx="4" fill="${C.madeira}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="30" y="26" width="60" height="76" fill="${C.papel}" stroke="#b9ae9b" stroke-width="2" transform="rotate(-8 60 64)"/>
      <rect x="44" y="34" width="60" height="76" fill="#f4eee2" stroke="#b9ae9b" stroke-width="2" transform="rotate(5 74 72)"/>
      <circle cx="176" cy="40" r="22" fill="#c9a24a" stroke="#5a4420" stroke-width="3"/>
      <circle cx="176" cy="40" r="8" fill="#fff4c8"/>
      <rect x="126" y="76" width="54" height="10" rx="3" fill="#2a2a2a"/>`,
  },
  {
    id: 'tapete', nome: 'Tapete', categoria: 'Mobília', tamanho: 3.5, w: 300, h: 200,
    arte: () => `<rect x="4" y="4" width="292" height="192" rx="4" fill="#6a2a24" stroke="#3a1612" stroke-width="4"/>
      <rect x="20" y="20" width="260" height="160" fill="none" stroke="#c9a24a" stroke-width="4"/>
      <rect x="40" y="40" width="220" height="120" fill="#7e352c" stroke="#3a1612" stroke-width="2"/>
      <path d="M150 54 L196 100 L150 146 L104 100 Z" fill="none" stroke="#c9a24a" stroke-width="4"/>
      <circle cx="150" cy="100" r="14" fill="#c9a24a"/>`,
  },
  {
    id: 'banco-igreja', nome: 'Banco de igreja', categoria: 'Mobília', tamanho: 4, w: 320, h: 74,
    arte: () => `${sombra('<rect x="6" y="6" width="308" height="62"/>')}
      <rect x="6" y="30" width="308" height="38" fill="${C.madeira}" stroke="${C.borda}" stroke-width="4"/>
      <rect x="6" y="6" width="308" height="22" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="4"/>
      <g stroke="${C.madeiraEscura}" stroke-width="2"><line x1="10" y1="48" x2="310" y2="48"/></g>`,
  },

  // ---------- Cozinha e banheiro ----------
  {
    id: 'fogao', nome: 'Fogão', categoria: 'Cozinha e banheiro', tamanho: 1.3, w: 120, h: 110,
    arte: () => `${sombra('<rect x="6" y="6" width="108" height="98" rx="4"/>')}
      <rect x="6" y="6" width="108" height="98" rx="4" fill="#d8d4cc" stroke="#3a3a3a" stroke-width="4"/>
      <g fill="#2a2a2a" stroke="#555" stroke-width="3">
        <circle cx="36" cy="36" r="17"/><circle cx="84" cy="36" r="17"/><circle cx="36" cy="80" r="17"/><circle cx="84" cy="80" r="17"/>
      </g>`,
  },
  {
    id: 'geladeira', nome: 'Geladeira', categoria: 'Cozinha e banheiro', tamanho: 1.2, w: 110, h: 100,
    arte: () => `${sombra('<rect x="6" y="6" width="98" height="88" rx="8"/>')}
      <rect x="6" y="6" width="98" height="88" rx="8" fill="#e6e2da" stroke="#3a3a3a" stroke-width="4"/>
      <rect x="14" y="70" width="82" height="10" rx="4" fill="#b8b2a6"/>`,
  },
  {
    id: 'pia', nome: 'Pia', categoria: 'Cozinha e banheiro', tamanho: 1.6, w: 160, h: 90,
    arte: () => `${sombra('<rect x="6" y="6" width="148" height="78" rx="4"/>')}
      <rect x="6" y="6" width="148" height="78" rx="4" fill="#cfcac1" stroke="#3a3a3a" stroke-width="4"/>
      <rect x="40" y="18" width="80" height="54" rx="12" fill="#a9b2b8" stroke="#5a6066" stroke-width="3"/>
      <circle cx="80" cy="46" r="5" fill="#3a3f44"/><rect x="76" y="8" width="8" height="16" fill="${C.metal}"/>`,
  },
  {
    id: 'banheira', nome: 'Banheira', categoria: 'Cozinha e banheiro', tamanho: 1.5, w: 140, h: 260,
    arte: () => `${sombra('<rect x="8" y="8" width="124" height="244" rx="40"/>')}
      <rect x="8" y="8" width="124" height="244" rx="40" fill="#f0ede6" stroke="#3a3a3a" stroke-width="4"/>
      <rect x="22" y="22" width="96" height="216" rx="32" fill="#bccbd3" stroke="#8a9aa2" stroke-width="3"/>
      <circle cx="70" cy="214" r="6" fill="#3a3f44"/>`,
  },
  {
    id: 'vaso', nome: 'Vaso sanitário', categoria: 'Cozinha e banheiro', tamanho: 0.8, w: 80, h: 110,
    arte: () => `${sombra('<ellipse cx="40" cy="70" rx="32" ry="36"/>')}
      <rect x="10" y="6" width="60" height="30" rx="6" fill="#f0ede6" stroke="#3a3a3a" stroke-width="4"/>
      <ellipse cx="40" cy="70" rx="32" ry="36" fill="#f0ede6" stroke="#3a3a3a" stroke-width="4"/>
      <ellipse cx="40" cy="72" rx="20" ry="24" fill="#bccbd3"/>`,
  },

  // ---------- Hospital ----------
  {
    id: 'maca', nome: 'Maca', categoria: 'Hospital', tamanho: 1.3, w: 120, h: 260,
    arte: () => `${sombra('<rect x="8" y="8" width="104" height="244" rx="8"/>')}
      <rect x="8" y="8" width="104" height="244" rx="8" fill="${C.metal}" stroke="${C.ferro}" stroke-width="4"/>
      <rect x="16" y="16" width="88" height="228" rx="6" fill="#dfe6e8"/>
      <rect x="26" y="22" width="68" height="36" rx="12" fill="#f4f7f8" stroke="#b6c2c6" stroke-width="2"/>
      <path d="M16 110 H104 V244 H16 Z" fill="#8fb3b8"/>
      <g fill="${C.ferro}"><circle cx="14" cy="14" r="6"/><circle cx="106" cy="14" r="6"/><circle cx="14" cy="246" r="6"/><circle cx="106" cy="246" r="6"/></g>`,
  },
  {
    id: 'cadeira-de-rodas', nome: 'Cadeira de rodas', categoria: 'Hospital', tamanho: 1.1, w: 120, h: 130,
    arte: () => `${sombra('<rect x="10" y="10" width="100" height="110" rx="10"/>')}
      <rect x="6" y="30" width="16" height="84" rx="6" fill="${C.ferro}"/><rect x="98" y="30" width="16" height="84" rx="6" fill="${C.ferro}"/>
      <rect x="24" y="40" width="72" height="70" rx="6" fill="#33475b" stroke="${C.ferro}" stroke-width="4"/>
      <rect x="24" y="14" width="72" height="22" rx="4" fill="#26374a" stroke="${C.ferro}" stroke-width="4"/>
      <line x1="30" y1="120" x2="30" y2="126" stroke="${C.metal}" stroke-width="5"/><line x1="90" y1="120" x2="90" y2="126" stroke="${C.metal}" stroke-width="5"/>`,
  },
  {
    id: 'carrinho', nome: 'Carrinho de instrumentos', categoria: 'Hospital', tamanho: 1.1, w: 120, h: 84,
    arte: () => `${sombra('<rect x="6" y="6" width="108" height="72" rx="4"/>')}
      <rect x="6" y="6" width="108" height="72" rx="4" fill="#c9d1d4" stroke="${C.ferro}" stroke-width="4"/>
      <rect x="16" y="16" width="50" height="40" rx="3" fill="#e8edef" stroke="#8a9aa2" stroke-width="2"/>
      <path d="M24 30 L58 30 M24 40 L52 40" stroke="${C.metalEscuro}" stroke-width="3" stroke-linecap="round"/>
      <rect x="74" y="18" width="10" height="44" rx="3" fill="#7e9bb0"/><rect x="90" y="18" width="10" height="44" rx="3" fill="#b07e7e"/>`,
  },
  {
    id: 'soro', nome: 'Suporte de soro', categoria: 'Hospital', tamanho: 0.8, w: 90, h: 90,
    arte: () => `<g stroke="${C.ferro}" stroke-width="5" stroke-linecap="round">
        <line x1="45" y1="45" x2="12" y2="20"/><line x1="45" y1="45" x2="78" y2="20"/><line x1="45" y1="45" x2="12" y2="74"/><line x1="45" y1="45" x2="78" y2="74"/>
      </g>
      <circle cx="45" cy="45" r="8" fill="${C.metal}" stroke="${C.ferro}" stroke-width="3"/>
      <rect x="32" y="24" width="26" height="34" rx="8" fill="#d8eef0" stroke="#7da7ab" stroke-width="3" opacity="0.9"/>`,
  },

  // ---------- Ritual ----------
  {
    id: 'altar', nome: 'Altar', categoria: 'Ritual', tamanho: 3, w: 260, h: 120,
    arte: (u) => `<defs><radialGradient id="${u('l')}"><stop offset="0" stop-color="${C.chama}" stop-opacity="0.7"/><stop offset="1" stop-color="${C.chama}" stop-opacity="0"/></radialGradient></defs>
      ${sombra('<rect x="8" y="8" width="244" height="104"/>')}
      <rect x="8" y="8" width="244" height="104" fill="${C.pedra}" stroke="${C.pedraEscura}" stroke-width="5"/>
      <rect x="20" y="20" width="220" height="80" fill="#5c1a16" stroke="#3a0e0b" stroke-width="3"/>
      <path d="M130 30 V90 M106 54 H154" stroke="${C.ouro}" stroke-width="6"/>
      <circle cx="40" cy="40" r="26" fill="url(#${u('l')})"/><circle cx="220" cy="40" r="26" fill="url(#${u('l')})"/>
      <circle cx="40" cy="40" r="7" fill="#efe6cf"/><circle cx="220" cy="40" r="7" fill="#efe6cf"/>`,
  },
  {
    id: 'vela', nome: 'Vela', categoria: 'Ritual', tamanho: 0.6, w: 70, h: 70,
    arte: (u) => `<defs><radialGradient id="${u('l')}"><stop offset="0" stop-color="${C.chama}" stop-opacity="0.8"/><stop offset="1" stop-color="${C.chama}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="35" cy="35" r="34" fill="url(#${u('l')})"/>
      <circle cx="35" cy="35" r="12" fill="#efe6cf" stroke="#b5a988" stroke-width="2"/>
      <circle cx="35" cy="35" r="4" fill="#ffd27a"/>`,
  },
  {
    id: 'circulo-ritual', nome: 'Círculo ritual', categoria: 'Ritual', tamanho: 3.5, w: 300, h: 300,
    arte: () => {
      let marcas = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = 150 + Math.cos(a) * 124;
        const y = 150 + Math.sin(a) * 124;
        marcas += `<path d="M${x - 7} ${y} L${x} ${y - 9} L${x + 7} ${y} L${x} ${y + 9} Z" fill="${C.sangueVivo}"/>`;
      }
      const pontos = [0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        return `${150 + Math.cos(a) * 100},${150 + Math.sin(a) * 100}`;
      });
      return `<circle cx="150" cy="150" r="140" fill="none" stroke="${C.sangue}" stroke-width="7" opacity="0.9"/>
        <circle cx="150" cy="150" r="108" fill="none" stroke="${C.sangue}" stroke-width="4" opacity="0.9"/>
        <polygon points="${pontos.join(' ')}" fill="none" stroke="${C.sangueVivo}" stroke-width="5" opacity="0.9"/>${marcas}`;
    },
  },
  {
    id: 'simbolo', nome: 'Símbolo pintado', categoria: 'Ritual', tamanho: 1.5, w: 160, h: 160,
    arte: () => `<g fill="none" stroke="${C.sangue}" stroke-width="8" stroke-linecap="round" opacity="0.9">
        <circle cx="80" cy="80" r="64"/><path d="M80 16 V144 M30 50 L130 110 M30 110 L130 50"/><circle cx="80" cy="80" r="18"/>
      </g>`,
  },
  {
    id: 'caixao', nome: 'Caixão', categoria: 'Ritual', tamanho: 1.3, w: 110, h: 280,
    arte: () => `${sombra('<path d="M30 8 H80 L104 60 L84 272 H26 L6 60 Z"/>')}
      <path d="M30 8 H80 L104 60 L84 272 H26 L6 60 Z" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>
      <path d="M36 24 H74 L88 64 L72 252 H38 L22 64 Z" fill="none" stroke="${C.madeira}" stroke-width="3"/>
      <path d="M55 90 V160 M40 114 H70" stroke="${C.ouro}" stroke-width="6"/>`,
  },
  {
    id: 'lapide', nome: 'Lápide', categoria: 'Ritual', tamanho: 1.2, w: 120, h: 80,
    arte: () => `${sombra('<path d="M10 70 V30 Q60 -6 110 30 V70 Z"/>')}
      <path d="M10 70 V30 Q60 -6 110 30 V70 Z" fill="${C.pedra}" stroke="${C.pedraEscura}" stroke-width="5"/>
      <path d="M40 40 H80 M46 52 H74" stroke="${C.pedraEscura}" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: 'cruz', nome: 'Cruz', categoria: 'Ritual', tamanho: 1, w: 100, h: 150,
    arte: () => `${sombra('<path d="M40 6 H60 V44 H94 V64 H60 V144 H40 V64 H6 V44 H40 Z"/>')}
      <path d="M40 6 H60 V44 H94 V64 H60 V144 H40 V64 H6 V44 H40 Z" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="4"/>`,
  },
  {
    id: 'cranio', nome: 'Crânio', categoria: 'Ritual', tamanho: 0.7, w: 90, h: 100,
    arte: () => `<path d="M45 6 C16 6 6 28 8 50 C10 64 18 70 22 74 V90 H68 V74 C72 70 80 64 82 50 C84 28 74 6 45 6 Z" fill="#e6dfcf" stroke="#5a5346" stroke-width="4"/>
      <ellipse cx="30" cy="48" rx="11" ry="13" fill="#2a2620"/><ellipse cx="60" cy="48" rx="11" ry="13" fill="#2a2620"/>
      <path d="M45 58 L39 70 H51 Z" fill="#2a2620"/>
      <path d="M30 80 V90 M40 80 V90 M50 80 V90 M60 80 V90" stroke="#5a5346" stroke-width="3"/>`,
  },

  // ---------- Cena do crime ----------
  {
    id: 'corpo-coberto', nome: 'Corpo coberto', categoria: 'Cena do crime', tamanho: 1.5, w: 130, h: 280,
    arte: () => `${sombra('<path d="M65 10 C100 10 116 40 116 80 C122 150 118 240 100 270 H30 C12 240 8 150 14 80 C14 40 30 10 65 10 Z"/>')}
      <path d="M65 10 C100 10 116 40 116 80 C122 150 118 240 100 270 H30 C12 240 8 150 14 80 C14 40 30 10 65 10 Z" fill="${C.lencol}" stroke="#9c9486" stroke-width="4"/>
      <path d="M40 90 C60 110 70 110 90 90 M50 160 C60 190 70 190 80 160" fill="none" stroke="#b9b1a2" stroke-width="3"/>
      <ellipse cx="80" cy="150" rx="18" ry="12" fill="${C.sangue}" opacity="0.7"/>`,
  },
  {
    id: 'pegadas', nome: 'Pegadas', categoria: 'Cena do crime', tamanho: 2, w: 220, h: 120,
    arte: () => {
      const pe = (x, y, r) =>
        `<g transform="translate(${x} ${y}) rotate(${r})" fill="${C.sangue}" opacity="0.85"><ellipse cx="0" cy="0" rx="9" ry="15"/><ellipse cx="0" cy="22" rx="7" ry="8"/></g>`;
      return pe(24, 80, 80) + pe(64, 50, 75) + pe(108, 82, 82) + pe(150, 50, 78) + pe(194, 80, 85);
    },
  },
  {
    id: 'faca', nome: 'Faca', categoria: 'Cena do crime', tamanho: 0.8, w: 160, h: 40,
    arte: () => `<path d="M60 12 H140 L156 20 L140 28 H60 Z" fill="#c9ced2" stroke="${C.metalEscuro}" stroke-width="3"/>
      <rect x="6" y="10" width="56" height="20" rx="6" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="3"/>
      <path d="M100 20 H150" stroke="${C.sangueVivo}" stroke-width="5" opacity="0.8"/>`,
  },
  {
    id: 'revolver', nome: 'Revólver', categoria: 'Cena do crime', tamanho: 0.8, w: 150, h: 80,
    arte: () => `<rect x="50" y="18" width="94" height="16" rx="4" fill="${C.ferro}" stroke="#15171a" stroke-width="3"/>
      <circle cx="60" cy="34" r="16" fill="#3a3e44" stroke="#15171a" stroke-width="3"/>
      <path d="M44 30 L14 64 L34 74 L58 44 Z" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="3"/>`,
  },
  {
    id: 'fita-isolamento', nome: 'Fita de isolamento', categoria: 'Cena do crime', tamanho: 5, w: 400, h: 40,
    arte: () => {
      let listras = '';
      for (let x = -20; x < 400; x += 40) listras += `<path d="M${x} 34 L${x + 20} 6 H${x + 34} L${x + 14} 34 Z" fill="#1a1a1a"/>`;
      return `<rect x="0" y="6" width="400" height="28" fill="#f2c22e"/>${listras}
        <rect x="120" y="10" width="160" height="20" fill="#f2c22e"/>
        <text x="200" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#1a1a1a">NÃO ULTRAPASSE</text>`;
    },
  },
  {
    id: 'marcador', nome: 'Marcador de evidência', categoria: 'Cena do crime', tamanho: 0.5, w: 60, h: 60,
    arte: () => `<path d="M8 52 L30 8 L52 52 Z" fill="#f2c22e" stroke="#1a1a1a" stroke-width="3"/>
      <text x="30" y="46" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="20" fill="#1a1a1a">1</text>`,
  },

  // ---------- Objetos ----------
  {
    id: 'barril', nome: 'Barril', categoria: 'Objetos', tamanho: 1, w: 110, h: 110,
    arte: () => `${sombra('<circle cx="55" cy="55" r="48"/>')}
      <circle cx="55" cy="55" r="48" fill="${C.madeira}" stroke="${C.borda}" stroke-width="5"/>
      <circle cx="55" cy="55" r="38" fill="none" stroke="${C.ferro}" stroke-width="5"/>
      <circle cx="55" cy="55" r="18" fill="none" stroke="${C.madeiraEscura}" stroke-width="2"/>`,
  },
  {
    id: 'caixas', nome: 'Pilha de caixas', categoria: 'Objetos', tamanho: 2, w: 200, h: 180,
    arte: () => {
      const caixa = (x, y, w, h, c) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#4a3a24" stroke-width="4"/><path d="M${x} ${y + h / 2} H${x + w}" stroke="#a08458" stroke-width="6" opacity="0.8"/>`;
      return `${sombra('<rect x="8" y="8" width="184" height="164"/>')}${caixa(8, 8, 100, 90, '#b8946a')}${caixa(96, 30, 96, 84, '#a8845a')}${caixa(30, 96, 110, 76, '#c4a074')}`;
    },
  },
  {
    id: 'televisao', nome: 'Televisão antiga', categoria: 'Objetos', tamanho: 1.6, w: 170, h: 120,
    arte: () => `${sombra('<rect x="6" y="6" width="158" height="108" rx="10"/>')}
      <rect x="6" y="6" width="158" height="108" rx="10" fill="${C.madeiraEscura}" stroke="${C.borda}" stroke-width="5"/>
      <rect x="18" y="18" width="104" height="84" rx="14" fill="#2b3a33" stroke="#111" stroke-width="3"/>
      <path d="M24 40 H116 M24 60 H116 M24 80 H116" stroke="#4d6a5c" stroke-width="2" opacity="0.6"/>
      <circle cx="144" cy="40" r="9" fill="#c9a24a"/><circle cx="144" cy="70" r="9" fill="#c9a24a"/>`,
  },
  {
    id: 'computador', nome: 'Computador', categoria: 'Objetos', tamanho: 1.6, w: 170, h: 120,
    arte: () => `${sombra('<rect x="20" y="8" width="130" height="104"/>')}
      <rect x="30" y="8" width="110" height="22" rx="4" fill="#cfcac1" stroke="#3a3a3a" stroke-width="4"/>
      <rect x="44" y="12" width="82" height="12" fill="#2b4a5a"/>
      <rect x="16" y="56" width="138" height="38" rx="4" fill="#d8d4cc" stroke="#3a3a3a" stroke-width="4"/>
      <g fill="#9e9a92">${Array.from({ length: 24 }, (_, i) => `<rect x="${24 + (i % 12) * 10.5}" y="${62 + Math.floor(i / 12) * 14}" width="8" height="10" rx="1"/>`).join('')}</g>
      <ellipse cx="150" cy="104" rx="9" ry="12" fill="#d8d4cc" stroke="#3a3a3a" stroke-width="3"/>`,
  },
  {
    id: 'telefone', nome: 'Telefone', categoria: 'Objetos', tamanho: 0.7, w: 90, h: 80,
    arte: () => `<rect x="10" y="20" width="70" height="52" rx="10" fill="#2a2a2a" stroke="#111" stroke-width="3"/>
      <circle cx="45" cy="48" r="17" fill="#e8e4dc" stroke="#111" stroke-width="2"/>
      <circle cx="45" cy="48" r="6" fill="#2a2a2a"/>
      <path d="M6 18 Q45 -2 84 18 L76 28 Q45 14 14 28 Z" fill="#1a1a1a"/>`,
  },
  {
    id: 'lanterna', nome: 'Lanterna acesa', categoria: 'Objetos', tamanho: 2.4, w: 260, h: 120,
    arte: (u) => `<defs><linearGradient id="${u('l')}" x1="0" x2="1"><stop offset="0" stop-color="#fff3c0" stop-opacity="0.75"/><stop offset="1" stop-color="#fff3c0" stop-opacity="0"/></linearGradient></defs>
      <path d="M70 52 L256 6 V114 L70 68 Z" fill="url(#${u('l')})"/>
      <rect x="8" y="48" width="54" height="24" rx="4" fill="${C.ferro}"/><rect x="60" y="44" width="14" height="32" rx="3" fill="${C.metal}"/>`,
  },
  {
    id: 'livro', nome: 'Livro aberto', categoria: 'Objetos', tamanho: 1, w: 120, h: 90,
    arte: () => `${sombra('<rect x="6" y="8" width="108" height="76"/>')}
      <rect x="6" y="8" width="108" height="76" rx="4" fill="#5a2a24" stroke="#2a120e" stroke-width="3"/>
      <path d="M12 14 H58 V78 H12 Z" fill="${C.papel}"/><path d="M62 14 H108 V78 H62 Z" fill="#f1ead9"/>
      <g stroke="#9a907e" stroke-width="2"><path d="M18 26 H52 M18 36 H50 M18 46 H52 M18 56 H44 M68 26 H102 M68 36 H98 M68 46 H102"/></g>
      <circle cx="84" cy="62" r="9" fill="none" stroke="${C.sangue}" stroke-width="3"/>`,
  },
  {
    id: 'quadro-de-pistas', nome: 'Quadro de pistas', categoria: 'Objetos', tamanho: 2.6, w: 240, h: 160,
    arte: () => `${sombra('<rect x="6" y="6" width="228" height="148"/>')}
      <rect x="6" y="6" width="228" height="148" fill="#a8845a" stroke="${C.madeiraEscura}" stroke-width="6"/>
      <rect x="22" y="20" width="44" height="54" fill="${C.papel}" transform="rotate(-4 44 47)"/>
      <rect x="96" y="24" width="50" height="40" fill="#d9d1c0" transform="rotate(3 121 44)"/>
      <rect x="172" y="30" width="44" height="54" fill="${C.papel}" transform="rotate(-2 194 57)"/>
      <rect x="60" y="94" width="54" height="44" fill="#e4dccb" transform="rotate(5 87 116)"/>
      <rect x="150" y="100" width="46" height="40" fill="${C.papel}"/>
      <path d="M44 30 L121 34 L194 40 M121 34 L87 104 L173 110 M44 30 L87 104" stroke="${C.sangueVivo}" stroke-width="2" fill="none"/>
      <g fill="${C.sangueVivo}"><circle cx="44" cy="30" r="4"/><circle cx="121" cy="34" r="4"/><circle cx="194" cy="40" r="4"/><circle cx="87" cy="104" r="4"/><circle cx="173" cy="110" r="4"/></g>`,
  },
  {
    id: 'gerador', nome: 'Gerador', categoria: 'Objetos', tamanho: 1.8, w: 180, h: 120,
    arte: () => `${sombra('<rect x="8" y="8" width="164" height="104" rx="6"/>')}
      <rect x="8" y="8" width="164" height="104" rx="6" fill="#6b7a3a" stroke="#2a3014" stroke-width="5"/>
      <rect x="20" y="20" width="80" height="80" rx="4" fill="#4e5a28"/>
      <g stroke="#2a3014" stroke-width="3">${Array.from({ length: 6 }, (_, i) => `<line x1="26" y1="${30 + i * 12}" x2="94" y2="${30 + i * 12}"/>`).join('')}</g>
      <circle cx="136" cy="40" r="14" fill="#2a2a2a"/><rect x="118" y="70" width="40" height="22" rx="3" fill="#c9a24a"/>`,
  },
  {
    id: 'cofre', nome: 'Cofre', categoria: 'Objetos', tamanho: 1.1, w: 110, h: 110,
    arte: () => `${sombra('<rect x="6" y="6" width="98" height="98" rx="6"/>')}
      <rect x="6" y="6" width="98" height="98" rx="6" fill="#4b5056" stroke="#1d2023" stroke-width="5"/>
      <rect x="18" y="18" width="74" height="74" rx="4" fill="#5d636a" stroke="#2a2e32" stroke-width="3"/>
      <circle cx="55" cy="55" r="18" fill="#8a9096" stroke="#2a2e32" stroke-width="3"/><path d="M55 40 V55 L66 62" stroke="#2a2e32" stroke-width="3" fill="none"/>`,
  },
  {
    id: 'mala', nome: 'Mala', categoria: 'Objetos', tamanho: 1.3, w: 140, h: 100,
    arte: () => `${sombra('<rect x="6" y="14" width="128" height="80" rx="10"/>')}
      <rect x="6" y="14" width="128" height="80" rx="10" fill="#6a4a2a" stroke="#2a1a0c" stroke-width="4"/>
      <rect x="52" y="4" width="36" height="14" rx="5" fill="none" stroke="#2a1a0c" stroke-width="5"/>
      <path d="M36 14 V94 M104 14 V94" stroke="#4a321c" stroke-width="6"/>`,
  },

  // ---------- Exterior ----------
  {
    id: 'arvore', nome: 'Árvore', categoria: 'Exterior', tamanho: 3, w: 260, h: 260,
    arte: () => `<g opacity="0.35" transform="translate(10 14)"><circle cx="130" cy="130" r="112"/></g>
      <circle cx="92" cy="100" r="64" fill="${C.folhaEscura}"/><circle cx="168" cy="96" r="60" fill="${C.folhaEscura}"/>
      <circle cx="150" cy="170" r="66" fill="${C.folhaEscura}"/><circle cx="84" cy="160" r="58" fill="${C.folhaEscura}"/>
      <circle cx="100" cy="96" r="48" fill="${C.folha}"/><circle cx="164" cy="104" r="44" fill="${C.folha}"/>
      <circle cx="144" cy="160" r="50" fill="${C.folha}"/><circle cx="92" cy="152" r="42" fill="${C.folha}"/>
      <circle cx="124" cy="126" r="40" fill="#4f6e3e"/>`,
  },
  {
    id: 'arvore-morta', nome: 'Árvore morta', categoria: 'Exterior', tamanho: 3, w: 240, h: 240,
    arte: () => `<g stroke="#2e2218" stroke-linecap="round" fill="none">
        <path d="M120 120 L40 50 M120 120 L210 60 M120 120 L200 200 M120 120 L30 190 M120 120 L120 14" stroke-width="12"/>
        <path d="M70 76 L40 96 M170 88 L200 110 M160 160 L150 210 M74 156 L90 214 M120 60 L90 30" stroke-width="7"/>
      </g><circle cx="120" cy="120" r="22" fill="#3a2a1c" stroke="#2e2218" stroke-width="4"/>`,
  },
  {
    id: 'arbusto', nome: 'Arbusto', categoria: 'Exterior', tamanho: 1.4, w: 140, h: 120,
    arte: () => `<g opacity="0.35" transform="translate(6 8)"><ellipse cx="70" cy="60" rx="62" ry="50"/></g>
      <circle cx="46" cy="62" r="36" fill="${C.folhaEscura}"/><circle cx="92" cy="54" r="40" fill="${C.folhaEscura}"/><circle cx="72" cy="80" r="34" fill="${C.folhaEscura}"/>
      <circle cx="52" cy="58" r="24" fill="${C.folha}"/><circle cx="92" cy="54" r="28" fill="${C.folha}"/>`,
  },
  {
    id: 'pedra', nome: 'Pedra', categoria: 'Exterior', tamanho: 1.2, w: 120, h: 90,
    arte: () => `${sombra('<path d="M14 60 L30 18 L74 8 L110 34 L102 76 L48 84 Z"/>')}
      <path d="M14 60 L30 18 L74 8 L110 34 L102 76 L48 84 Z" fill="${C.pedra}" stroke="${C.pedraEscura}" stroke-width="4"/>
      <path d="M30 18 L58 44 L102 76 M58 44 L48 84" stroke="${C.pedraEscura}" stroke-width="2" fill="none" opacity="0.6"/>`,
  },
  {
    id: 'fogueira', nome: 'Fogueira', categoria: 'Exterior', tamanho: 1.5, w: 150, h: 150,
    arte: (u) => `<defs><radialGradient id="${u('l')}"><stop offset="0" stop-color="${C.chama}" stop-opacity="0.65"/><stop offset="1" stop-color="${C.chama}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="75" cy="75" r="74" fill="url(#${u('l')})"/>
      <g fill="${C.pedraEscura}">${Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle cx="${75 + Math.cos(a) * 44}" cy="${75 + Math.sin(a) * 44}" r="11"/>`; }).join('')}</g>
      <path d="M40 60 L110 90 M40 90 L110 60" stroke="${C.madeiraEscura}" stroke-width="12" stroke-linecap="round"/>
      <path d="M75 48 C92 62 92 80 75 96 C58 80 58 62 75 48 Z" fill="${C.chama}"/><path d="M75 62 C84 70 84 80 75 88 C66 80 66 70 75 62 Z" fill="#ffe08a"/>`,
  },
  {
    id: 'carro', nome: 'Carro', categoria: 'Exterior', tamanho: 2.2, w: 200, h: 400,
    arte: () => `${sombra('<rect x="14" y="10" width="172" height="380" rx="50"/>')}
      <rect x="14" y="10" width="172" height="380" rx="50" fill="#5a1e1a" stroke="#1a0a08" stroke-width="5"/>
      <path d="M34 110 Q100 84 166 110 L156 160 Q100 146 44 160 Z" fill="#2c3d48" stroke="#111" stroke-width="3"/>
      <path d="M44 290 Q100 304 156 290 L162 330 Q100 344 38 330 Z" fill="#2c3d48" stroke="#111" stroke-width="3"/>
      <rect x="44" y="164" width="112" height="122" rx="10" fill="#6a2620"/>
      <g fill="#fff2b0"><rect x="30" y="18" width="34" height="14" rx="5"/><rect x="136" y="18" width="34" height="14" rx="5"/></g>
      <g fill="#c4322a"><rect x="30" y="370" width="34" height="12" rx="4"/><rect x="136" y="370" width="34" height="12" rx="4"/></g>`,
  },
  {
    id: 'poste', nome: 'Poste de luz', categoria: 'Exterior', tamanho: 2.5, w: 240, h: 240,
    arte: (u) => `<defs><radialGradient id="${u('l')}"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.55"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient></defs>
      <circle cx="120" cy="120" r="118" fill="url(#${u('l')})"/>
      <circle cx="120" cy="120" r="14" fill="#2a2e32" stroke="#111" stroke-width="3"/>
      <rect x="120" y="114" width="50" height="12" fill="#2a2e32"/><ellipse cx="172" cy="120" rx="16" ry="10" fill="#fff3c8" stroke="#2a2e32" stroke-width="3"/>`,
  },
  {
    id: 'lixeira', nome: 'Caçamba de lixo', categoria: 'Exterior', tamanho: 2, w: 200, h: 120,
    arte: () => `${sombra('<rect x="8" y="8" width="184" height="104" rx="6"/>')}
      <rect x="8" y="8" width="184" height="104" rx="6" fill="#2f5a3a" stroke="#132818" stroke-width="5"/>
      <path d="M8 60 H192" stroke="#132818" stroke-width="5"/>
      <g fill="#555"><rect x="30" y="20" width="40" height="30" rx="4" opacity="0.8"/><rect x="120" y="70" width="50" height="28" rx="4" opacity="0.8"/></g>`,
  },
  {
    id: 'cerca', nome: 'Cerca', categoria: 'Exterior', tamanho: 5, w: 400, h: 40,
    arte: () => `<rect x="0" y="16" width="400" height="8" fill="${C.madeiraEscura}"/>
      <g fill="${C.madeira}" stroke="${C.borda}" stroke-width="3">${Array.from({ length: 10 }, (_, i) => `<rect x="${6 + i * 40}" y="6" width="28" height="28" rx="3"/>`).join('')}</g>`,
  },
];
