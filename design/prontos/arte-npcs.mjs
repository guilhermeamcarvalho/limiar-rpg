// Retratos dos modelos de NPC (RF-19): 256 × 256, o token recorta em círculo no centro.
// Pessoas saem de um gerador de busto (pele, cabelo, roupa e acessórios); criaturas e animais têm
// desenho próprio. Tudo em tons escuros, no clima de horror investigativo. O acabamento (grão e
// vinheta) entra no gerar.mjs.
import { tom } from './acabamento.mjs';

const L = 256;
/** Fundo do retrato: luz no centro, borda escura. */
const fundo = (cor) =>
  `<defs><radialGradient id="g-fundo" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${tom(cor, 0.22)}"/><stop offset="1" stop-color="${tom(cor, -0.35)}"/></radialGradient></defs>
  <rect width="${L}" height="${L}" fill="url(#g-fundo)"/>`;

/** A luz que vem de cima e da esquerda, por cima de tudo (dá volume ao retrato inteiro). */
export const LUZ_DO_RETRATO = `<defs><linearGradient id="g-luz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4e0" stop-opacity="0.16"/><stop offset="0.5" stop-color="#fff4e0" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient></defs><rect width="${L}" height="${L}" fill="url(#g-luz)"/>`;

const PELES = { clara: '#e8c2a0', media: '#c99872', morena: '#9a6844', escura: '#6a4630', palida: '#d8d4cc' };

/** O busto: ombros (roupa com dobras), pescoço, orelhas, rosto sombreado, olhos, nariz e boca. */
function busto({ pele, roupa, olhos = '#4a3424', boca, semRosto = false }) {
  const claro = tom(pele, 0.22);
  const escuro = tom(pele, -0.32);
  const labios = boca ?? tom(pele, -0.3);
  const rosto = semRosto
    ? ''
    : `<path d="M100 96 Q110 90 120 95 M136 95 Q146 90 156 96" stroke="${tom(pele, -0.6)}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g><ellipse cx="110" cy="108" rx="9" ry="5.5" fill="#efe9df"/><circle cx="110" cy="108" r="4.6" fill="${olhos}"/><circle cx="110" cy="108" r="2.2" fill="#0a0806"/><circle cx="108.4" cy="106.4" r="1.3" fill="#fff"/>
       <ellipse cx="146" cy="108" rx="9" ry="5.5" fill="#efe9df"/><circle cx="146" cy="108" r="4.6" fill="${olhos}"/><circle cx="146" cy="108" r="2.2" fill="#0a0806"/><circle cx="144.4" cy="106.4" r="1.3" fill="#fff"/></g>
    <path d="M101 104 Q110 99 119 104 M137 104 Q146 99 155 104" stroke="${tom(pele, -0.5)}" stroke-width="2.4" fill="none"/>
    <path d="M124 110 Q120 124 122 128 Q128 132 135 128" stroke="${escuro}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M130 112 Q131 120 131 124" stroke="${claro}" stroke-width="2" fill="none" opacity="0.8"/>
    <ellipse cx="100" cy="126" rx="10" ry="6" fill="#d0706a" opacity="0.14"/><ellipse cx="156" cy="126" rx="10" ry="6" fill="#d0706a" opacity="0.14"/>
    <path d="M116 140 Q128 136 140 140 Q128 147 116 140 Z" fill="${labios}"/><path d="M117 140 Q128 142 139 140" stroke="${tom(labios, -0.35)}" stroke-width="1.6" fill="none"/>`;
  return `<defs>
      <radialGradient id="g-pele" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="${claro}"/><stop offset="0.55" stop-color="${pele}"/><stop offset="1" stop-color="${escuro}"/></radialGradient>
      <linearGradient id="g-roupa" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${tom(roupa, 0.18)}"/><stop offset="1" stop-color="${tom(roupa, -0.5)}"/></linearGradient>
    </defs>
    <path d="M30 256 C34 196 76 172 128 172 C180 172 222 196 226 256 Z" fill="url(#g-roupa)" stroke="#00000066" stroke-width="3"/>
    <path d="M70 256 C74 226 88 206 104 196 M186 256 C182 226 168 206 152 196 M128 214 V256" stroke="${tom(roupa, -0.55)}" stroke-width="3" fill="none" opacity="0.45"/>
    <rect x="110" y="140" width="36" height="42" fill="${escuro}"/>
    <ellipse cx="128" cy="160" rx="22" ry="10" fill="#000" opacity="0.25"/>
    <ellipse cx="82" cy="112" rx="8" ry="13" fill="${pele}"/><ellipse cx="174" cy="112" rx="8" ry="13" fill="${escuro}"/>
    <ellipse cx="128" cy="106" rx="46" ry="54" fill="url(#g-pele)" stroke="#00000040" stroke-width="2"/>
    ${rosto}`;
}

/** Degradê e fios do cabelo, na cor dada. */
const corDeCabelo = (c) =>
  `<defs><linearGradient id="g-cabelo" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${tom(c, 0.28)}"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="${tom(c, -0.4)}"/></linearGradient></defs>`;
const fios = (c) =>
  `<path d="M96 70 Q112 58 126 56 M106 74 Q124 62 142 60 M120 72 Q140 64 160 70" stroke="${tom(c, 0.35)}" stroke-width="2" fill="none" opacity="0.5"/>`;

const CABELOS = {
  curto: (c) => `${corDeCabelo(c)}<path d="M82 100 C80 60 104 46 128 46 C152 46 176 60 174 100 C168 78 150 70 128 70 C106 70 88 78 82 100 Z" fill="url(#g-cabelo)"/>${fios(c)}`,
  longo: (c) => `${corDeCabelo(c)}<path d="M80 104 C76 58 104 44 128 44 C152 44 180 58 176 104 L182 176 C168 160 170 120 164 92 C150 74 106 74 92 92 C86 120 88 160 74 176 Z" fill="url(#g-cabelo)"/>${fios(c)}`,
  coque: (c) => `${corDeCabelo(c)}<circle cx="128" cy="44" r="18" fill="url(#g-cabelo)"/><path d="M82 100 C80 62 104 52 128 52 C152 52 176 62 174 100 C166 80 150 74 128 74 C106 74 90 80 82 100 Z" fill="url(#g-cabelo)"/>${fios(c)}`,
  careca: (c) => `<path d="M84 110 C84 100 86 94 88 92 M172 110 C172 100 170 94 168 92" stroke="${c}" stroke-width="6" fill="none"/>`,
  lateral: (c) => `${corDeCabelo(c)}<path d="M82 100 C80 58 112 44 140 48 C164 52 178 68 174 100 C160 76 120 64 82 100 Z" fill="url(#g-cabelo)"/>${fios(c)}`,
};

const EXTRAS = {
  oculos: () => `<g fill="none" stroke="#1a1a1a" stroke-width="3"><circle cx="110" cy="108" r="12"/><circle cx="146" cy="108" r="12"/><path d="M122 108 H134"/></g>`,
  barba: (c) => `<path d="M86 118 C88 156 108 166 128 166 C148 166 168 156 170 118 C162 140 148 148 128 148 C108 148 94 140 86 118 Z" fill="${c}"/>`,
  bigode: (c) => `<path d="M112 130 Q128 122 144 130 Q128 134 112 130 Z" fill="${c}"/>`,
  quepe: () => `<path d="M78 82 C80 48 176 48 178 82 Z" fill="#1d2a44"/><path d="M76 82 H180 L170 92 H86 Z" fill="#111827"/><circle cx="128" cy="66" r="7" fill="#d9b25a"/>`,
  chapeu: () => `<ellipse cx="128" cy="66" rx="70" ry="14" fill="#2a2420"/><path d="M92 66 C92 30 164 30 164 66 Z" fill="#3a322c"/><path d="M92 58 H164" stroke="#1a1410" stroke-width="6"/>`,
  capuz: (c) => `<path d="M66 256 C66 150 76 40 128 34 C180 40 190 150 190 256 Z" fill="${c}"/><path d="M90 120 C90 70 166 70 166 120 C166 156 150 170 128 170 C106 170 90 156 90 120 Z" fill="#0c0a0a"/>`,
  mascara: () => `<path d="M84 96 C84 64 172 64 172 96 C172 142 152 160 128 160 C104 160 84 142 84 96 Z" fill="#e8e2d4" stroke="#6a645a" stroke-width="3"/><ellipse cx="110" cy="106" rx="9" ry="6" fill="#111"/><ellipse cx="146" cy="106" rx="9" ry="6" fill="#111"/><path d="M118 140 H138" stroke="#6a645a" stroke-width="3"/>`,
  colarinho: () => `<path d="M112 176 H144 V188 H112 Z" fill="#f4f2ec"/>`,
  touca: () => `<path d="M82 82 C84 50 172 50 174 82 L170 90 H86 Z" fill="#7fb3b0"/>`,
  enfermagem: () => `<path d="M92 66 L164 66 L156 50 L100 50 Z" fill="#f4f2ec" stroke="#b8b2a6" stroke-width="2"/><path d="M124 54 H132 M128 50 V62" stroke="#c4322a" stroke-width="3"/>`,
  estetoscopio: () => `<path d="M100 186 C96 220 120 226 128 210 C136 226 160 220 156 186" stroke="#2a2a2a" stroke-width="4" fill="none"/><circle cx="128" cy="214" r="7" fill="#8a9096"/>`,
  jaleco: () => `<path d="M60 256 C64 200 90 182 112 178 L128 230 L144 178 C166 182 192 200 196 256 Z" fill="#f2f0ea"/><path d="M112 178 L128 230 L144 178" stroke="#c8c2b6" stroke-width="3" fill="none"/>`,
  terno: (c) => `<path d="M96 180 L128 232 L160 180 L150 176 L128 210 L106 176 Z" fill="#f2f0ea"/><path d="M124 196 L128 236 L132 196 Z" fill="${c}"/>`,
  distintivo: () => `<path d="M168 206 L176 196 L184 206 L180 218 H172 Z" fill="#d9b25a" stroke="#7a5a1a" stroke-width="2"/>`,
  microfone: () => `<rect x="186" y="176" width="14" height="44" rx="4" fill="#2a2a2a" transform="rotate(20 193 198)"/><circle cx="184" cy="170" r="13" fill="#555" stroke="#222" stroke-width="3"/>`,
  rugas: () => `<path d="M100 124 Q104 128 108 124 M148 124 Q152 128 156 124 M114 84 H142" stroke="#00000033" stroke-width="2" fill="none"/>`,
  cicatriz: () => `<path d="M150 90 L162 128" stroke="#8a3a2a" stroke-width="4" stroke-linecap="round"/>`,
  olhosVazios: () => `<ellipse cx="110" cy="108" rx="8" ry="9" fill="#050505"/><ellipse cx="146" cy="108" rx="8" ry="9" fill="#050505"/>`,
  sangueNaBoca: () => `<path d="M120 140 Q128 160 136 140" stroke="#8f1a12" stroke-width="4" fill="none"/>`,
};

/** Monta uma pessoa a partir das escolhas. */
function pessoa({ fundo: f, pele, roupa, cabelo, corDoCabelo = '#2a1d14', extras = [] }) {
  const antes = extras.filter((e) => e[0] === 'capuz');
  const depois = extras.filter((e) => e[0] !== 'capuz');
  const desenhar = ([nome, cor]) => EXTRAS[nome](cor ?? corDoCabelo);
  return `${fundo(f)}${antes.map(desenhar).join('')}${busto({ pele: PELES[pele] ?? pele, roupa })}${
    cabelo ? CABELOS[cabelo](corDoCabelo) : ''
  }${depois.map(desenhar).join('')}`;
}

/* ---------- Criaturas ---------- */

const criaturas = {
  zumbi: () => `${fundo('#2a1210')}${busto({ pele: '#8a9a7a', roupa: '#3a2a24', olhos: '#c8c0a0' })}
    ${CABELOS.longo('#2a241c')}<path d="M96 120 L104 150 M156 116 L150 146 M128 150 V170" stroke="#6e120d" stroke-width="4"/>
    ${EXTRAS.sangueNaBoca()}<path d="M40 256 L60 220 L80 256 M176 256 L196 214 L214 256" fill="#2a1a16"/>`,
  abominacao: () => `${fundo('#1e0806')}
    <path d="M30 256 C20 170 60 70 128 66 C196 70 236 170 226 256 Z" fill="#7a1a14" stroke="#3a0806" stroke-width="5"/>
    <path d="M70 200 C90 150 110 160 120 120 M180 210 C160 170 150 150 150 110" stroke="#4a0a08" stroke-width="10" fill="none"/>
    ${[[100, 120, 14], [150, 104, 10], [128, 164, 18], [176, 150, 9], [82, 170, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f0e6c8"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="#1a0604"/>`).join('')}
    <path d="M92 212 Q128 240 164 212 Q128 226 92 212 Z" fill="#1a0604"/><path d="M100 214 L104 224 L110 216 L116 228 L122 218 L128 230 L134 218 L140 228 L146 216 L152 224 L156 214" fill="#f0e6c8"/>`,
  espectro: () => `${fundo('#101216')}
    <path d="M50 256 C50 150 74 44 128 38 C182 44 206 150 206 256 C190 236 180 250 168 232 C156 252 146 236 128 254 C110 236 100 252 88 232 C76 250 66 236 50 256 Z" fill="#3a3e46" stroke="#1a1c22" stroke-width="4"/>
    <path d="M92 116 C92 74 164 74 164 116 C164 150 150 168 128 168 C106 168 92 150 92 116 Z" fill="#0a0b0e"/>
    <ellipse cx="112" cy="116" rx="9" ry="12" fill="#d8dde6"/><ellipse cx="144" cy="116" rx="9" ry="12" fill="#d8dde6"/>
    <g fill="#8a8e96" opacity="0.6"><circle cx="60" cy="80" r="3"/><circle cx="200" cy="60" r="2"/><circle cx="190" cy="120" r="3"/><circle cx="70" cy="150" r="2"/></g>`,
  conhecimento: () => `${fundo('#1a1608')}${busto({ pele: '#c4b48a', roupa: '#3a3220', olhos: '#d9b25a' })}
    <g fill="none" stroke="#e8c45a" stroke-width="3">
      <circle cx="128" cy="100" r="74" stroke-dasharray="6 8"/>
      <path d="M110 70 L118 84 L104 84 Z M150 72 V90 M142 80 H158 M96 136 Q106 126 116 136 M140 134 L156 144"/>
    </g>
    <ellipse cx="110" cy="108" rx="7" ry="8" fill="#ffe08a"/><ellipse cx="146" cy="108" rx="7" ry="8" fill="#ffe08a"/>`,
  energia: () => `${fundo('#0c0a1e')}
    <path d="M44 256 C50 176 80 150 128 150 C176 150 206 176 212 256 Z" fill="#3a2a6a"/>
    <path d="M86 110 C84 60 112 40 128 40 C150 40 176 64 172 112 C168 150 148 170 128 170 C104 170 88 150 86 110 Z" fill="#5a4ab0" stroke="#a89cff" stroke-width="3"/>
    <path d="M128 20 L116 70 L136 76 L120 130 M60 160 L92 150 L84 176 L112 168 M196 150 L168 156 L176 132 L150 140" stroke="#7ef0ff" stroke-width="4" fill="none" stroke-linejoin="bevel"/>
    <ellipse cx="110" cy="104" rx="8" ry="10" fill="#e8fdff"/><ellipse cx="146" cy="104" rx="8" ry="10" fill="#e8fdff"/>`,
  sombra: () => `${fundo('#14100e')}
    <path d="M40 256 C44 186 84 164 128 164 C172 164 212 186 216 256 Z" fill="#050404"/>
    <ellipse cx="128" cy="104" rx="48" ry="58" fill="#050404"/>
    <ellipse cx="110" cy="104" rx="7" ry="5" fill="#f4f0e8"/><ellipse cx="146" cy="104" rx="7" ry="5" fill="#f4f0e8"/>`,
  possuido: () => `${fundo('#1a0e0c')}${busto({ pele: '#cdbfae', roupa: '#2a2a32' })}${CABELOS.longo('#1a1410')}${EXTRAS.olhosVazios()}
    <path d="M100 82 L92 70 M156 82 L166 68 M104 140 L96 160 M150 136 L162 158" stroke="#2a1a16" stroke-width="3"/>
    <path d="M116 140 Q128 150 140 140" stroke="#1a0604" stroke-width="4" fill="none"/>`,
  boneca: () => `${fundo('#24161a')}
    <path d="M40 256 C46 190 86 170 128 170 C170 170 210 190 216 256 Z" fill="#7a2a3a"/>
    <path d="M92 180 L128 210 L164 180" stroke="#f0e6ea" stroke-width="10" fill="none"/>
    <ellipse cx="128" cy="104" rx="48" ry="56" fill="#f2ece4" stroke="#b8aca0" stroke-width="3"/>
    <path d="M80 104 C76 50 180 50 176 104 C170 70 86 70 80 104 Z" fill="#d9b25a"/>
    <circle cx="108" cy="108" r="11" fill="#2a5a8a"/><circle cx="148" cy="108" r="11" fill="#2a5a8a"/>
    <circle cx="108" cy="108" r="4" fill="#0a0a0a"/><circle cx="148" cy="108" r="4" fill="#0a0a0a"/>
    <circle cx="98" cy="128" r="8" fill="#e8a8a8" opacity="0.7"/><circle cx="158" cy="128" r="8" fill="#e8a8a8" opacity="0.7"/>
    <path d="M150 70 L136 120 L148 150" stroke="#6a5a50" stroke-width="2" fill="none"/>
    <path d="M118 138 Q128 144 138 138" stroke="#8a2a2a" stroke-width="3" fill="none"/>`,
  semRosto: () => `${fundo('#16141a')}${busto({ pele: '#d8d0c6', roupa: '#1e1e24', semRosto: true })}
    <ellipse cx="128" cy="106" rx="46" ry="54" fill="#d8d0c6"/>${EXTRAS.chapeu()}`,
};

/* ---------- Animais ---------- */

const animais = {
  cao: () => `${fundo('#1e1a16')}
    <path d="M50 256 C56 196 90 176 128 176 C166 176 200 196 206 256 Z" fill="#3a2a1c"/>
    <path d="M76 70 L60 140 L96 120 Z M180 70 L196 140 L160 120 Z" fill="#2a1c12"/>
    <ellipse cx="128" cy="118" rx="54" ry="58" fill="#5a4028"/>
    <ellipse cx="128" cy="152" rx="30" ry="24" fill="#7a5a3c"/><ellipse cx="128" cy="140" rx="12" ry="9" fill="#111"/>
    <path d="M110 166 Q128 176 146 166" stroke="#111" stroke-width="3" fill="none"/><path d="M116 168 L120 178 L124 168 M132 168 L136 178 L140 168" fill="#f0e6c8"/>
    <ellipse cx="106" cy="108" rx="7" ry="8" fill="#d9a020"/><ellipse cx="150" cy="108" rx="7" ry="8" fill="#d9a020"/>
    <ellipse cx="106" cy="108" rx="3" ry="6" fill="#111"/><ellipse cx="150" cy="108" rx="3" ry="6" fill="#111"/>`,
  corvo: () => `${fundo('#1a1c22')}
    <path d="M40 256 C50 180 90 150 128 150 C166 150 206 180 216 256 Z" fill="#0e0f12"/>
    <ellipse cx="128" cy="116" rx="50" ry="52" fill="#16181c"/>
    <path d="M128 112 L212 132 L128 148 Z" fill="#2a2a2a" stroke="#111" stroke-width="3"/>
    <circle cx="108" cy="104" r="10" fill="#e8e4dc"/><circle cx="108" cy="104" r="5" fill="#0a0a0a"/>
    <path d="M70 150 L92 140 M64 170 L90 160" stroke="#2a2e34" stroke-width="3"/>`,
  gato: () => `${fundo('#1c1418')}
    <path d="M50 256 C56 196 90 176 128 176 C166 176 200 196 206 256 Z" fill="#0e0c0e"/>
    <path d="M80 92 L84 40 L116 74 Z M176 92 L172 40 L140 74 Z" fill="#0e0c0e"/>
    <ellipse cx="128" cy="116" rx="54" ry="52" fill="#141214"/>
    <ellipse cx="106" cy="110" rx="12" ry="10" fill="#c8e040"/><ellipse cx="150" cy="110" rx="12" ry="10" fill="#c8e040"/>
    <ellipse cx="106" cy="110" rx="3" ry="9" fill="#0a0a0a"/><ellipse cx="150" cy="110" rx="3" ry="9" fill="#0a0a0a"/>
    <path d="M122 134 L128 140 L134 134 Z" fill="#6a4a4a"/>
    <path d="M90 140 H60 M92 148 L64 156 M166 140 H196 M164 148 L192 156" stroke="#5a5a5a" stroke-width="2"/>`,
  rato: () => `${fundo('#1e1a16')}
    <path d="M60 256 C66 200 96 184 128 184 C160 184 190 200 196 256 Z" fill="#4a4440"/>
    <circle cx="84" cy="80" r="30" fill="#6a605a"/><circle cx="172" cy="80" r="30" fill="#6a605a"/>
    <circle cx="84" cy="80" r="18" fill="#c89a9a"/><circle cx="172" cy="80" r="18" fill="#c89a9a"/>
    <path d="M80 120 C80 84 176 84 176 120 C176 160 150 196 128 200 C106 196 80 160 80 120 Z" fill="#6a605a"/>
    <circle cx="128" cy="194" r="9" fill="#d89a9a"/>
    <circle cx="110" cy="128" r="7" fill="#c41a1a"/><circle cx="146" cy="128" r="7" fill="#c41a1a"/>
    <path d="M120 194 H90 M122 200 L94 210 M136 194 H166 M134 200 L162 210" stroke="#8a8a8a" stroke-width="2"/>`,
  lobo: () => `${fundo('#14161a')}
    <path d="M44 256 C50 190 86 170 128 170 C170 170 206 190 212 256 Z" fill="#3a3e44"/>
    <path d="M78 96 L76 34 L118 70 Z M178 96 L180 34 L138 70 Z" fill="#4a4e54"/>
    <path d="M74 104 C74 64 182 64 182 104 C182 150 150 184 128 200 C106 184 74 150 74 104 Z" fill="#5a5e64"/>
    <path d="M104 150 C110 190 146 190 152 150 Z" fill="#8a8e94"/><ellipse cx="128" cy="160" rx="12" ry="8" fill="#111"/>
    <path d="M94 104 L120 112 M162 104 L136 112" stroke="#2a2e34" stroke-width="4"/>
    <ellipse cx="108" cy="116" rx="7" ry="6" fill="#e8c040"/><ellipse cx="148" cy="116" rx="7" ry="6" fill="#e8c040"/>`,
};

export const NPCS = [
  // ---------- Pessoas ----------
  { id: 'morador', nome: 'Morador', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#2a2420', pele: 'media', roupa: '#4a5a3a', cabelo: 'curto', extras: [['bigode']] }) },
  { id: 'moradora', nome: 'Moradora', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#2a2024', pele: 'clara', roupa: '#6a3a4a', cabelo: 'longo', corDoCabelo: '#6a4020' }) },
  { id: 'idoso', nome: 'Idoso', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#24221e', pele: 'clara', roupa: '#5a4a3a', cabelo: 'careca', corDoCabelo: '#c8c4bc', extras: [['oculos'], ['rugas'], ['bigode', '#d8d4cc']] }) },
  { id: 'idosa', nome: 'Idosa', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#22201e', pele: 'morena', roupa: '#3a4a5a', cabelo: 'coque', corDoCabelo: '#d8d4cc', extras: [['rugas']] }) },
  { id: 'crianca', nome: 'Criança', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#1e2228', pele: 'media', roupa: '#8a3a2a', cabelo: 'lateral', corDoCabelo: '#2a1d14' }) },
  { id: 'jornalista', nome: 'Jornalista', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#1e2026', pele: 'escura', roupa: '#3a3a44', cabelo: 'coque', corDoCabelo: '#1a1410', extras: [['microfone']] }) },
  { id: 'estudante', nome: 'Estudante', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#20242a', pele: 'clara', roupa: '#2e4a6a', cabelo: 'lateral', corDoCabelo: '#8a5a2a', extras: [['oculos']] }) },
  { id: 'motorista', nome: 'Caminhoneiro', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#26221c', pele: 'morena', roupa: '#6a4a2a', cabelo: 'curto', extras: [['barba']] }) },
  { id: 'ocultista', nome: 'Ocultista', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#1a1420', pele: 'palida', roupa: '#2a1a3a', cabelo: 'longo', corDoCabelo: '#0e0a10', extras: [['cicatriz']] }) },
  { id: 'cultista', nome: 'Cultista', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#1a0e0c', pele: 'palida', roupa: '#3a0e0c', extras: [['capuz', '#4a120e']] }) },
  { id: 'mascarado', nome: 'Mascarado', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#141214', pele: 'media', roupa: '#1a1a1e', extras: [['capuz', '#1e1e22'], ['mascara']] }) },
  { id: 'padre', nome: 'Padre', categoria: 'Pessoas', arte: () => pessoa({ fundo: '#1c1a1e', pele: 'clara', roupa: '#121216', cabelo: 'curto', corDoCabelo: '#8a8478', extras: [['colarinho'], ['oculos']] }) },
  // ---------- Autoridades ----------
  { id: 'policial', nome: 'Policial', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#141a24', pele: 'media', roupa: '#1d2a44', cabelo: 'curto', extras: [['quepe'], ['distintivo']] }) },
  { id: 'policial-mulher', nome: 'Policial (mulher)', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#141a24', pele: 'escura', roupa: '#1d2a44', cabelo: 'coque', corDoCabelo: '#120c08', extras: [['quepe'], ['distintivo']] }) },
  { id: 'detetive', nome: 'Detetive', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1e1c1a', pele: 'clara', roupa: '#4a3e32', cabelo: 'curto', extras: [['chapeu'], ['terno', '#6e1e1a'], ['bigode']] }) },
  { id: 'agente', nome: 'Agente', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#161618', pele: 'morena', roupa: '#1a1a1e', cabelo: 'careca', extras: [['terno', '#1a1a1e'], ['oculos']] }) },
  { id: 'seguranca', nome: 'Segurança', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1a1a1e', pele: 'escura', roupa: '#2a2a30', cabelo: 'careca', corDoCabelo: '#1a1410', extras: [['distintivo']] }) },
  { id: 'medica', nome: 'Médica', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1a2224', pele: 'clara', roupa: '#3a5a6a', cabelo: 'coque', corDoCabelo: '#4a2a14', extras: [['jaleco'], ['estetoscopio'], ['oculos']] }) },
  { id: 'enfermeiro', nome: 'Enfermeiro', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1a2224', pele: 'media', roupa: '#5a8a8a', extras: [['touca']] }) },
  { id: 'enfermeira', nome: 'Enfermeira', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1e2222', pele: 'morena', roupa: '#d8d4cc', cabelo: 'coque', corDoCabelo: '#1a1410', extras: [['enfermagem']] }) },
  { id: 'cientista', nome: 'Cientista', categoria: 'Autoridades', arte: () => pessoa({ fundo: '#1a1e22', pele: 'palida', roupa: '#3a4a3a', cabelo: 'lateral', corDoCabelo: '#c8c4bc', extras: [['jaleco'], ['oculos']] }) },
  // ---------- Criaturas ----------
  { id: 'zumbi', nome: 'Zumbi de Sangue', categoria: 'Criaturas', arte: criaturas.zumbi },
  { id: 'abominacao', nome: 'Abominação de Sangue', categoria: 'Criaturas', arte: criaturas.abominacao },
  { id: 'espectro', nome: 'Espectro da Morte', categoria: 'Criaturas', arte: criaturas.espectro },
  { id: 'conhecimento', nome: 'Criatura de Conhecimento', categoria: 'Criaturas', arte: criaturas.conhecimento },
  { id: 'energia', nome: 'Criatura de Energia', categoria: 'Criaturas', arte: criaturas.energia },
  { id: 'sombra', nome: 'Sombra', categoria: 'Criaturas', arte: criaturas.sombra },
  { id: 'possuido', nome: 'Possuído', categoria: 'Criaturas', arte: criaturas.possuido },
  { id: 'boneca', nome: 'Boneca', categoria: 'Criaturas', arte: criaturas.boneca },
  { id: 'sem-rosto', nome: 'Homem sem rosto', categoria: 'Criaturas', arte: criaturas.semRosto },
  // ---------- Animais ----------
  { id: 'cao', nome: 'Cão', categoria: 'Animais', arte: animais.cao },
  { id: 'lobo', nome: 'Lobo', categoria: 'Animais', arte: animais.lobo },
  { id: 'corvo', nome: 'Corvo', categoria: 'Animais', arte: animais.corvo },
  { id: 'gato', nome: 'Gato preto', categoria: 'Animais', arte: animais.gato },
  { id: 'rato', nome: 'Rato', categoria: 'Animais', arte: animais.rato },
];

export const LADO_DO_RETRATO = L;
