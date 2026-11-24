// Acabamento da arte pronta: textura, volume, sombra suave, sujeira, luz e grão. Tudo em filtros
// SVG, que o sharp (librsvg) aplica ao gerar a imagem final em WebP. Os desenhos continuam nos
// arte-*.mjs; aqui fica só o que transforma o desenho chapado numa imagem com material e luz.

/** Mistura uma cor hex com branco (t > 0) ou preto (t < 0). */
export function tom(hex, t) {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const alvo = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return `#${c
    .map((v) => Math.round(v + (alvo - v) * k)
      .toString(16)
      .padStart(2, '0'))
    .join('')}`;
}

/**
 * Filtros comuns. Cada filtro age no próprio desenho (SourceGraphic), então serve para um prop,
 * um piso ou o mapa inteiro.
 */
export const FILTROS = `
<filter id="f-textura" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4" result="ruido"/>
  <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0" result="cinza"/>
  <feComposite in="cinza" in2="SourceAlpha" operator="in" result="grao"/>
  <feBlend in="grao" in2="SourceGraphic" mode="multiply" result="com-grao"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="9" result="manchas"/>
  <feColorMatrix in="manchas" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 -1.1 0.66" result="sujo"/>
  <feComposite in="sujo" in2="SourceAlpha" operator="in" result="sujo-dentro"/>
  <feComposite in="sujo-dentro" in2="com-grao" operator="atop"/>
</filter>
<filter id="f-volume" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="borda"/>
  <feSpecularLighting in="borda" surfaceScale="3" specularConstant="0.55" specularExponent="18" lighting-color="#fff6e8" result="brilho">
    <feDistantLight azimuth="225" elevation="50"/>
  </feSpecularLighting>
  <feComposite in="brilho" in2="SourceAlpha" operator="in" result="brilho-dentro"/>
  <feComposite in="SourceGraphic" in2="brilho-dentro" operator="arithmetic" k1="0" k2="1" k3="0.45" k4="0"/>
</filter>
<filter id="f-sombra" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="borrado"/>
  <feOffset in="borrado" dx="5" dy="8" result="deslocado"/>
  <feComponentTransfer in="deslocado" result="sombra"><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
  <feMerge><feMergeNode in="sombra"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="f-organico" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="7" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="14" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="f-desfoque" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="f-sujeira" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="21" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.04  0 0 0 -2.2 1.25"/>
  <feComposite in2="SourceAlpha" operator="in"/>
</filter>
<filter id="f-grao" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="13" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 -0.08"/>
  <feComposite in2="SourceAlpha" operator="in"/>
</filter>`;

/** Gradiente de luz (para a máscara da escuridão e para o brilho colorido). */
export const gradientesDeLuz = (cor) => `
<radialGradient id="g-furo"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.55" stop-color="#000" stop-opacity="0.75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="g-vinheta" cx="50%" cy="50%" r="72%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/></radialGradient>
${Object.entries(cor)
  .map(
    ([nome, c]) =>
      `<radialGradient id="g-brilho-${nome}"><stop offset="0" stop-color="${c}" stop-opacity="0.32"/><stop offset="0.5" stop-color="${c}" stop-opacity="0.12"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`,
  )
  .join('')}`;

/** Cores das luzes. */
export const CORES_DE_LUZ = {
  quente: '#ffb35c',
  chama: '#ff8a2a',
  fria: '#cfe4ff',
  poste: '#ffe2a0',
  sangue: '#ff3a2a',
};
