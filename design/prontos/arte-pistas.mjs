// Ilustrações genéricas de pistas: 480 × 360 (4:3), pensadas como anexos de dossiê sobre mesa
// escura com foco de luz dramático, vinheta e grão. O mestre escolhe uma quando não quer subir
// uma foto própria (ou usa imagem enviada).
import { tom } from './acabamento.mjs';

export const LARGURA_DA_PISTA = 480;
export const ALTURA_DA_PISTA = 360;

const W = LARGURA_DA_PISTA;
const H = ALTURA_DA_PISTA;

function baseMesa(cor = '#241d19') {
  return `<defs>
    <radialGradient id="g-pista-fundo" cx="50%" cy="45%" r="72%">
      <stop offset="0" stop-color="${tom(cor, 0.18)}"/>
      <stop offset="1" stop-color="${tom(cor, -0.58)}"/>
    </radialGradient>
    <linearGradient id="g-papel" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#f0e6d0"/>
      <stop offset="0.6" stop-color="#dfd1b4"/>
      <stop offset="1" stop-color="#c3b18e"/>
    </linearGradient>
    <linearGradient id="g-papel-escuro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d8ccb4"/>
      <stop offset="1" stop-color="#a8987a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g-pista-fundo)"/>
  <path d="M0 72 H${W} M0 198 H${W} M0 310 H${W}" stroke="#000" stroke-opacity="0.18" stroke-width="2"/>`;
}

export const ACABAMENTO_DA_PISTA = `<defs>
  <radialGradient id="g-pista-vinheta" cx="50%" cy="48%" r="75%">
    <stop offset="0.52" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.68"/>
  </radialGradient>
  <linearGradient id="g-pista-luz" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff3dc" stop-opacity="0.14"/>
    <stop offset="0.5" stop-color="#fff3dc" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#g-pista-luz)"/>
<rect width="${W}" height="${H}" fill="url(#g-pista-vinheta)"/>
<rect width="${W}" height="${H}" fill="#fff" filter="url(#f-grao)"/>`;

export const PISTAS = [
  {
    id: 'carta',
    nome: 'Carta manchada',
    categoria: 'Documentos',
    arte: () => `${baseMesa('#261d18')}
      <g filter="url(#f-sombra)" transform="rotate(-4 240 180)">
        <path d="M128 48 H332 L362 78 V308 H128 Z" fill="url(#g-papel)" stroke="#8c7a5b" stroke-width="2"/>
        <path d="M332 48 V78 H362 Z" fill="#bfa982"/>
        <path d="M128 176 H362" stroke="#9e8b6b" stroke-width="1.5" stroke-opacity="0.55"/>
        <g stroke="#3d3226" stroke-width="3.2" stroke-linecap="round" opacity="0.78">
          <path d="M156 96 H268"/>
          <path d="M156 126 H330"/>
          <path d="M156 146 H318"/>
          <path d="M156 166 H292"/>
          <path d="M156 198 H334"/>
          <path d="M156 218 H306"/>
          <path d="M156 238 H254"/>
        </g>
        <circle cx="310" cy="268" r="20" fill="#7c1d18" stroke="#4f0f0c" stroke-width="3"/>
        <circle cx="310" cy="268" r="12" fill="none" stroke="#b53b32" stroke-width="1.5"/>
        <ellipse cx="172" cy="274" rx="28" ry="18" fill="#6b4423" opacity="0.25"/>
      </g>`,
  },
  {
    id: 'recorte-jornal',
    nome: 'Recorte de jornal',
    categoria: 'Documentos',
    arte: () => `${baseMesa('#202224')}
      <g filter="url(#f-sombra)" transform="rotate(3 240 180)">
        <path d="M104 58 L374 52 L380 298 L346 306 L312 296 L274 308 L232 298 L188 308 L142 296 L100 304 Z" fill="url(#g-papel-escuro)" stroke="#756a58" stroke-width="2"/>
        <rect x="124" y="74" width="232" height="26" fill="#231f1c"/>
        <rect x="132" y="82" width="164" height="10" fill="#d8ccb4" opacity="0.85"/>
        <rect x="124" y="114" width="108" height="86" fill="#3a3530" stroke="#231f1c" stroke-width="2"/>
        <circle cx="178" cy="146" r="16" fill="#70685e"/>
        <path d="M144 198 C148 174 208 174 212 198 Z" fill="#59524a"/>
        <g stroke="#2d2925" stroke-width="3" opacity="0.75">
          <path d="M246 118 H354 M246 132 H350 M246 146 H354 M246 160 H338 M246 174 H352 M246 188 H326"/>
          <path d="M124 218 H230 M124 232 H226 M124 246 H232 M124 260 H210 M124 274 H224"/>
          <path d="M246 218 H354 M246 232 H348 M246 246 H352 M246 260 H340 M246 274 H318"/>
        </g>
        <ellipse cx="298" cy="152" rx="58" ry="30" fill="none" stroke="#9e201a" stroke-width="4" transform="rotate(-6 298 152)"/>
      </g>`,
  },
  {
    id: 'prontuario',
    nome: 'Prontuário médico',
    categoria: 'Documentos',
    arte: () => `${baseMesa('#1c2424')}
      <g filter="url(#f-sombra)">
        <rect x="128" y="38" width="224" height="288" rx="10" fill="#5c3d28" stroke="#362214" stroke-width="3"/>
        <rect x="142" y="56" width="196" height="256" fill="#ece8de" stroke="#b5afa0" stroke-width="1.5"/>
        <rect x="196" y="28" width="88" height="26" rx="5" fill="#8b9398" stroke="#474d52" stroke-width="2"/>
        <path d="M162 84 H186 M174 72 V96" stroke="#a6241d" stroke-width="6"/>
        <g stroke="#2c3336" stroke-width="3" stroke-linecap="round" opacity="0.78">
          <path d="M202 78 H314"/>
          <path d="M202 94 H276"/>
          <path d="M162 126 H316"/>
          <path d="M162 144 H296"/>
        </g>
        <rect x="162" y="162" width="132" height="14" fill="#181a1b"/>
        <rect x="162" y="192" width="156" height="54" fill="#dfe4e2" stroke="#9aa6a4" stroke-width="1.5"/>
        <path d="M168 222 H198 L208 202 L220 238 L232 210 L244 224 H276 L286 206 L296 228 H312" fill="none" stroke="#9e201a" stroke-width="2.6"/>
        <rect x="242" y="264" width="76" height="26" rx="2" fill="none" stroke="#a6241d" stroke-width="3" transform="rotate(-8 280 277)"/>
      </g>`,
  },
  {
    id: 'cracha',
    nome: 'Crachá de acesso',
    categoria: 'Documentos',
    arte: () => `${baseMesa('#1e2026')}
      <path d="M210 0 C206 46 218 68 232 82 M270 0 C274 46 262 68 248 82" stroke="#7c1d18" stroke-width="12" fill="none"/>
      <g filter="url(#f-sombra)" transform="rotate(2 240 196)">
        <rect x="148" y="84" width="184" height="236" rx="12" fill="#e9e6dd" stroke="#9d988c" stroke-width="2.5"/>
        <rect x="148" y="84" width="184" height="42" rx="10" fill="#232c38"/>
        <rect x="220" y="68" width="40" height="26" rx="5" fill="#9ba2a8" stroke="#4e5459" stroke-width="2"/>
        <rect x="168" y="142" width="74" height="90" rx="4" fill="#323840"/>
        <circle cx="205" cy="174" r="17" fill="#9ea4aa"/>
        <path d="M176 230 C180 202 230 202 234 230 Z" fill="#7c838a"/>
        <g stroke="#2a2f36" stroke-width="3.5" stroke-linecap="round">
          <path d="M256 154 H312"/>
          <path d="M256 172 H302"/>
          <path d="M256 196 H292"/>
        </g>
        <rect x="256" y="210" width="52" height="16" rx="3" fill="#a6241d"/>
        <g stroke="#1b1e22" stroke-width="3">
          <path d="M170 262 V296 M178 262 V296 M184 262 V296 M194 262 V296 M200 262 V296 M210 262 V296 M218 262 V296 M228 262 V296 M234 262 V296 M244 262 V296 M252 262 V296 M262 262 V296 M270 262 V296 M278 262 V296 M288 262 V296 M296 262 V296 M306 262 V296"/>
        </g>
      </g>`,
  },
  {
    id: 'mapa-rabiscado',
    nome: 'Mapa rabiscado',
    categoria: 'Documentos',
    arte: () => `${baseMesa('#241e18')}
      <g filter="url(#f-sombra)" transform="rotate(-2 240 180)">
        <rect x="86" y="54" width="308" height="252" fill="url(#g-papel)" stroke="#857355" stroke-width="2"/>
        <path d="M188 54 V306 M292 54 V306 M86 178 H394" stroke="#8c7a5b" stroke-width="1.5" opacity="0.45"/>
        <g fill="none" stroke="#4a3e2e" stroke-width="3">
          <rect x="114" y="82" width="84" height="62"/>
          <rect x="234" y="78" width="126" height="74"/>
          <rect x="122" y="198" width="112" height="78"/>
          <path d="M198 114 H234 M296 152 V224 H234"/>
        </g>
        <path d="M148 242 C178 214 190 166 228 164 C266 162 282 126 316 114" fill="none" stroke="#9e201a" stroke-width="4" stroke-dasharray="9 7" stroke-linecap="round"/>
        <path d="M304 102 L328 126 M328 102 L304 126" stroke="#9e201a" stroke-width="5" stroke-linecap="round"/>
        <g transform="translate(344 256)" stroke="#3d3226" stroke-width="2">
          <circle r="18" fill="none"/>
          <path d="M0 -22 V22 M-22 0 H22"/>
        </g>
      </g>`,
  },
  {
    id: 'fotografia',
    nome: 'Fotografia antiga',
    categoria: 'Mídia e registros',
    arte: () => `${baseMesa('#221a16')}
      <g filter="url(#f-sombra)" transform="rotate(-5 240 180)">
        <rect x="136" y="38" width="208" height="278" rx="3" fill="#f2ede2" stroke="#b9b1a0" stroke-width="2"/>
        <defs>
          <linearGradient id="g-foto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2b333a"/>
            <stop offset="0.65" stop-color="#171c20"/>
            <stop offset="1" stop-color="#0d1012"/>
          </linearGradient>
        </defs>
        <rect x="152" y="54" width="176" height="196" fill="url(#g-foto)"/>
        <circle cx="286" cy="92" r="18" fill="#dfd5bc" opacity="0.35"/>
        <path d="M152 214 L198 176 L242 210 L286 166 L328 206 V250 H152 Z" fill="#101417"/>
        <path d="M214 250 V192 L240 170 L266 192 V250 Z" fill="#090b0d"/>
        <rect x="234" y="204" width="12" height="18" fill="#d99b38" opacity="0.85"/>
        <path d="M174 282 Q212 274 248 284 T302 280" fill="none" stroke="#3c352d" stroke-width="2.8" stroke-linecap="round"/>
      </g>`,
  },
  {
    id: 'fita-cassete',
    nome: 'Fita cassete',
    categoria: 'Mídia e registros',
    arte: () => `${baseMesa('#1e1b1a')}
      <g filter="url(#f-sombra)" transform="rotate(-2 240 180)">
        <rect x="92" y="88" width="296" height="186" rx="12" fill="#262628" stroke="#111113" stroke-width="3"/>
        <rect x="112" y="106" width="256" height="114" rx="6" fill="#dfd4bc"/>
        <rect x="112" y="106" width="256" height="26" rx="4" fill="#9e2a22"/>
        <path d="M132 120 H252" stroke="#f3ead8" stroke-width="4" stroke-linecap="round"/>
        <rect x="148" y="144" width="184" height="58" rx="28" fill="#1b1b1d" stroke="#45454a" stroke-width="2"/>
        <circle cx="188" cy="173" r="20" fill="#d8d2c5"/><circle cx="188" cy="173" r="9" fill="#1b1b1d"/>
        <circle cx="292" cy="173" r="20" fill="#d8d2c5"/><circle cx="292" cy="173" r="9" fill="#1b1b1d"/>
        <rect x="218" y="156" width="44" height="34" fill="#33261e"/>
        <path d="M138 274 L152 242 H328 L342 274 Z" fill="#1e1e20" stroke="#111" stroke-width="2"/>
        <circle cx="176" cy="258" r="5" fill="#0d0d0e"/><circle cx="304" cy="258" r="5" fill="#0d0d0e"/>
      </g>`,
  },
  {
    id: 'celular',
    nome: 'Celular trincado',
    categoria: 'Mídia e registros',
    arte: () => `${baseMesa('#181c22')}
      <g filter="url(#f-sombra)" transform="rotate(6 240 180)">
        <rect x="166" y="34" width="148" height="292" rx="20" fill="#1b1f26" stroke="#464e59" stroke-width="3"/>
        <rect x="176" y="56" width="128" height="244" rx="6" fill="#111923"/>
        <rect x="220" y="43" width="40" height="5" rx="2.5" fill="#38404a"/>
        <rect x="188" y="96" width="104" height="44" rx="6" fill="#203040" stroke="#3c5a78" stroke-width="1.5"/>
        <path d="M198 112 H256 M198 126 H278" stroke="#bcd6f0" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="188" y="154" width="104" height="40" rx="6" fill="#2d1a1e" stroke="#8a2a2a" stroke-width="1.5"/>
        <path d="M200 174 H210 L216 162 L224 186 L232 166 L240 180 L248 170 L256 176 H280" fill="none" stroke="#e05a4f" stroke-width="2.5" stroke-linecap="round"/>
        <g stroke="#dce8f5" stroke-width="1.4" opacity="0.55">
          <path d="M176 78 L232 128 L294 106 M232 128 L214 218 L176 254 M232 128 L278 214 L304 246"/>
        </g>
      </g>`,
  },
  {
    id: 'pendrive',
    nome: 'Pendrive marcado',
    categoria: 'Mídia e registros',
    arte: () => `${baseMesa('#1f1d1b')}
      <g filter="url(#f-sombra)" transform="rotate(-24 240 180)">
        <rect x="118" y="150" width="66" height="60" rx="4" fill="#adb4ba" stroke="#5d646b" stroke-width="2.5"/>
        <rect x="132" y="162" width="16" height="12" fill="#2c3136"/>
        <rect x="132" y="186" width="16" height="12" fill="#2c3136"/>
        <rect x="180" y="138" width="176" height="84" rx="14" fill="#25282c" stroke="#111315" stroke-width="3"/>
        <rect x="206" y="148" width="102" height="64" rx="2" fill="#dfd2b5" transform="rotate(1 257 180)"/>
        <path d="M220 174 H288 M220 190 H264" stroke="#7c1d18" stroke-width="4" stroke-linecap="round"/>
        <circle cx="336" cy="180" r="9" fill="#181a1c" stroke="#555b61" stroke-width="2"/>
      </g>`,
  },
  {
    id: 'diario',
    nome: 'Diário encadernado',
    categoria: 'Objetos e vestígios',
    arte: () => `${baseMesa('#231a15')}
      <g filter="url(#f-sombra)" transform="rotate(-4 240 180)">
        <path d="M250 38 L352 24 L366 96 L264 110 Z" fill="#e5d8be" stroke="#9e8e70" stroke-width="1.5"/>
        <rect x="134" y="48" width="212" height="268" rx="8" fill="#4a2818" stroke="#261209" stroke-width="3"/>
        <rect x="134" y="48" width="24" height="268" rx="4" fill="#33190d"/>
        <path d="M214 316 V344 L226 334 L238 344 V316 Z" fill="#8f1d18"/>
        <rect x="130" y="168" width="220" height="26" fill="#2b160c" stroke="#170b05" stroke-width="2"/>
        <rect x="296" y="164" width="28" height="34" rx="4" fill="#b89246" stroke="#6b511d" stroke-width="2"/>
        <circle cx="246" cy="118" r="28" fill="none" stroke="#b89246" stroke-width="2" opacity="0.7"/>
        <path d="M246 94 L266 132 H226 Z" fill="none" stroke="#b89246" stroke-width="2" opacity="0.7"/>
      </g>`,
  },
  {
    id: 'chave',
    nome: 'Chave antiga',
    categoria: 'Objetos e vestígios',
    arte: () => `${baseMesa('#211b16')}
      <g filter="url(#f-sombra)">
        <path d="M162 152 C126 176 122 222 154 242" fill="none" stroke="#8a7250" stroke-width="3"/>
        <g transform="rotate(14 166 258)">
          <rect x="116" y="226" width="104" height="58" rx="6" fill="#dfd1b4" stroke="#877659" stroke-width="2"/>
          <circle cx="132" cy="255" r="6" fill="#211b16"/>
          <path d="M150 248 H198 M150 264 H182" stroke="#3a2f23" stroke-width="4" stroke-linecap="round"/>
        </g>
        <g transform="rotate(-18 260 156)">
          <circle cx="176" cy="156" r="38" fill="none" stroke="#b58d3d" stroke-width="12"/>
          <circle cx="176" cy="156" r="20" fill="none" stroke="#7d5e22" stroke-width="4"/>
          <rect x="210" y="150" width="154" height="12" rx="4" fill="#b58d3d" stroke="#6e521c" stroke-width="2"/>
          <path d="M324 162 V192 H338 V178 H350 V196 H364 V162 Z" fill="#b58d3d" stroke="#6e521c" stroke-width="2"/>
        </g>
      </g>`,
  },
  {
    id: 'amuleto',
    nome: 'Objeto ritualístico',
    categoria: 'Objetos e vestígios',
    arte: () => `${baseMesa('#1d1719')}
      <path d="M156 26 C140 108 184 156 240 162 C296 156 340 108 324 26" fill="none" stroke="#6e1916" stroke-width="7"/>
      <g filter="url(#f-sombra)">
        <circle cx="240" cy="212" r="76" fill="#3a332c" stroke="#9e7b3b" stroke-width="6"/>
        <circle cx="240" cy="212" r="58" fill="none" stroke="#9e7b3b" stroke-width="2.5"/>
        <polygon points="240,156 288,240 192,240" fill="none" stroke="#c9a255" stroke-width="3"/>
        <polygon points="240,268 288,184 192,184" fill="none" stroke="#c9a255" stroke-width="3"/>
        <circle cx="240" cy="212" r="16" fill="#8f1a14" stroke="#d99b38" stroke-width="3"/>
        <circle cx="240" cy="130" r="10" fill="none" stroke="#9e7b3b" stroke-width="5"/>
      </g>`,
  },
  {
    id: 'simbolo-ritual',
    nome: 'Símbolo ocultista',
    categoria: 'Objetos e vestígios',
    arte: () => `${baseMesa('#1a1516')}
      <g filter="url(#f-sombra)">
        <path d="M108 44 L368 50 L382 310 L116 316 L98 184 Z" fill="#2c2522" stroke="#52453e" stroke-width="2"/>
        <g transform="translate(240 180)" fill="none" stroke="#b3261e" stroke-width="3.5">
          <circle r="96"/>
          <circle r="76" stroke-width="2"/>
          <polygon points="0,-94 82,48 -82,48"/>
          <polygon points="0,94 82,-48 -82,-48" opacity="0.85"/>
          <circle r="28" fill="#1a1516"/>
          <ellipse rx="22" ry="11"/>
          <circle r="6" fill="#b3261e"/>
          <circle cx="0" cy="-86" r="4" fill="#dfd1b4" stroke="none"/>
          <circle cx="75" cy="43" r="4" fill="#dfd1b4" stroke="none"/>
          <circle cx="-75" cy="43" r="4" fill="#dfd1b4" stroke="none"/>
        </g>
      </g>`,
  },
  {
    id: 'vestigio-sangue',
    nome: 'Vestígio de sangue',
    categoria: 'Objetos e vestígios',
    arte: () => `${baseMesa('#211c1a')}
      <g filter="url(#f-organico)">
        <ellipse cx="216" cy="196" rx="74" ry="52" fill="#5e0f0c"/>
        <ellipse cx="268" cy="224" rx="42" ry="28" fill="#781511"/>
        <circle cx="142" cy="148" r="12" fill="#6b110e"/>
        <circle cx="314" cy="164" r="8" fill="#6b110e"/>
      </g>
      <path d="M168 124 L254 112 L272 178 L184 188 Z" fill="#cfc5b4" stroke="#8a7f6d" stroke-width="2" opacity="0.9"/>
      <ellipse cx="228" cy="162" rx="32" ry="18" fill="#6e120e" opacity="0.88"/>
      <g filter="url(#f-sombra)" transform="translate(306 96) rotate(8)">
        <polygon points="0,78 22,0 74,0 56,78" fill="#d9a426" stroke="#6e5008" stroke-width="2.5"/>
        <text x="38" y="52" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="34" fill="#1a1612">1</text>
      </g>`,
  },
];
