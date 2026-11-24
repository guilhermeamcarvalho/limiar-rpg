// Gera a arte pronta da mesa e os catálogos que o app usa:
//   client/src/mesa/props-prontos/*.webp   props (fundo transparente, o dobro da resolução)
//   client/src/mesa/npcs-prontos/*.webp    retratos dos modelos de NPC
//   client/src/mesa/mapas-prontos/*.webp   mapas
//   shared/src/mesa/prontos.ts             catálogo (ids, nomes, categorias, medidas)
//   client/src/mesa/imagens-prontas.ts     o endereço de cada imagem (imports do Vite)
//   design/prontos/prompts.md              prompts para gerar a arte numa IA de imagem
//   design/prontos/previa.html             tudo junto, para conferir de olho
// A arte sai de dois lugares (veja LEIAME.md):
//   1. procedural: os desenhos dos arte-*.mjs com o acabamento de acabamento.mjs;
//   2. externa: uma imagem em externos/<mapas|props|npcs>/<id>.png|jpg|webp substitui a procedural
//      do mesmo id; itens novos entram por externos/novos.json.
// Rode da raiz do repositório: `node design/prontos/gerar.mjs` (depois, `pnpm format`).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { FILTROS } from './acabamento.mjs';
import { CELULA, criarMapa, MAPAS } from './arte-mapas.mjs';
import { LADO_DO_RETRATO, LUZ_DO_RETRATO, NPCS } from './arte-npcs.mjs';
import { acabar, ACABAMENTO, PROPS } from './arte-props.mjs';

const RAIZ = join(import.meta.dirname, '../..');
// O sharp é dependência do servidor; o gerador usa o mesmo.
const sharp = createRequire(join(RAIZ, 'server/package.json'))('sharp');

const PASTA = {
  props: join(RAIZ, 'client/src/mesa/props-prontos'),
  npcs: join(RAIZ, 'client/src/mesa/npcs-prontos'),
  mapas: join(RAIZ, 'client/src/mesa/mapas-prontos'),
};
const EXTERNOS = join(import.meta.dirname, 'externos');
const lerJson = (nome, reserva) => {
  const caminho = join(EXTERNOS, nome);
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : reserva;
};
const NOVOS = lerJson('novos.json', {});
const AJUSTES = lerJson('ajustes.json', {});

/** O arquivo externo do item, se houver (externos/<tipo>/<id>.png|jpg|jpeg|webp). */
function externo(tipo, id) {
  for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
    const caminho = join(EXTERNOS, tipo, `${id}.${ext}`);
    if (existsSync(caminho)) return caminho;
  }
  return null;
}

/** Itens novos (só externos) precisam de imagem; o que vier sem imagem é erro, não buraco no app. */
function novos(tipo) {
  const lista = NOVOS[tipo] ?? [];
  for (const item of lista) {
    if (!externo(tipo, item.id)) {
      throw new Error(`externos/novos.json: "${item.id}" (${tipo}) não tem imagem em externos/${tipo}/`);
    }
  }
  return lista;
}

const QUALIDADE = { props: 86, npcs: 86, mapas: 78 };
const svg = (w, h, miolo, { saidaW = w, saidaH = h, viewBox = `0 0 ${w} ${h}` } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${saidaW}" height="${saidaH}" viewBox="${viewBox}"><defs>${FILTROS}</defs>${miolo}</svg>`;

async function gravar(entrada, destino, qualidade, alpha) {
  const imagem = sharp(entrada, { limitInputPixels: 200_000_000 });
  await imagem.webp({ quality: qualidade, alphaQuality: alpha ? 90 : 100, effort: 5 }).toFile(destino);
  return sharp(destino).metadata();
}

// Começa do zero: o que não for mais gerado (um id removido, um SVG antigo) sai das pastas.
for (const pasta of Object.values(PASTA)) {
  mkdirSync(pasta, { recursive: true });
  for (const f of readdirSync(pasta)) {
    if (/\.(svg|webp)$/.test(f)) rmSync(join(pasta, f));
  }
}

/* ---------- Props ---------- */

const ESCALA_DOS_PROPS = 2;
const propsParaMapas = new Map();
const catalogoDeProps = [];
for (const prop of PROPS) {
  let w = prop.w;
  let h = prop.h;
  let corpo = prop.arte;
  if (prop.manter) {
    // Os cinco primeiros vieram de arquivo; o desenho deles mora em origem/.
    const texto = readFileSync(join(import.meta.dirname, 'origem', `${prop.id}.svg`), 'utf8');
    w = Number(/width="(\d+)"/.exec(texto)[1]);
    h = Number(/height="(\d+)"/.exec(texto)[1]);
    const miolo = texto.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    corpo = () => miolo;
  }
  const a = ACABAMENTO[prop.id] ?? {};
  propsParaMapas.set(prop.id, { w, h, corpo, acabar: (m) => acabar(prop.id, m), luz: a.luz });
  catalogoDeProps.push({ id: prop.id, nome: prop.nome, categoria: prop.categoria, tamanho: prop.tamanho });

  const destino = join(PASTA.props, `${prop.id}.webp`);
  const fora = externo('props', prop.id);
  if (fora) {
    await gravarPropExterno(fora, destino);
    continue;
  }
  // Uma folga em volta para a sombra suave caber.
  const folga = Math.round(Math.max(w, h) * 0.06);
  const miolo = acabar(prop.id, corpo((n) => `p-${n}`));
  await gravar(
    Buffer.from(
      svg(w + 2 * folga, h + 2 * folga, miolo, {
        saidaW: (w + 2 * folga) * ESCALA_DOS_PROPS,
        saidaH: (h + 2 * folga) * ESCALA_DOS_PROPS,
        viewBox: `${-folga} ${-folga} ${w + 2 * folga} ${h + 2 * folga}`,
      }),
    ),
    destino,
    QUALIDADE.props,
    true,
  );
}

async function gravarPropExterno(origem, destino) {
  const recortado = await sharp(origem).trim().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  await gravar(recortado, destino, QUALIDADE.props, true);
}

for (const item of novos('props')) {
  await gravarPropExterno(externo('props', item.id), join(PASTA.props, `${item.id}.webp`));
  catalogoDeProps.push({ id: item.id, nome: item.nome, categoria: item.categoria, tamanho: item.tamanho ?? 1 });
}

/* ---------- NPCs ---------- */

const LADO_DO_TOKEN = 384;
const catalogoDeNpcs = [];
async function gravarNpcExterno(origem, destino) {
  const quadrado = await sharp(origem)
    .resize(LADO_DO_TOKEN, LADO_DO_TOKEN, { fit: 'cover', position: sharp.strategy.attention })
    .png()
    .toBuffer();
  await gravar(quadrado, destino, QUALIDADE.npcs, false);
}
for (const npc of NPCS) {
  catalogoDeNpcs.push({ id: npc.id, nome: npc.nome, categoria: npc.categoria });
  const destino = join(PASTA.npcs, `${npc.id}.webp`);
  const fora = externo('npcs', npc.id);
  if (fora) {
    await gravarNpcExterno(fora, destino);
    continue;
  }
  const L = LADO_DO_RETRATO;
  const miolo = `${npc.arte()}${LUZ_DO_RETRATO}<rect width="${L}" height="${L}" fill="url(#g-vinheta)"/><rect width="${L}" height="${L}" fill="#fff" filter="url(#f-grao)"/>`;
  const vinheta = `<radialGradient id="g-vinheta" cx="50%" cy="45%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>`;
  await gravar(
    Buffer.from(svg(L, L, `<defs>${vinheta}</defs>${miolo}`, { saidaW: LADO_DO_TOKEN, saidaH: LADO_DO_TOKEN })),
    destino,
    QUALIDADE.npcs,
    false,
  );
}
for (const item of novos('npcs')) {
  await gravarNpcExterno(externo('npcs', item.id), join(PASTA.npcs, `${item.id}.webp`));
  catalogoDeNpcs.push({ id: item.id, nome: item.nome, categoria: item.categoria });
}

/* ---------- Mapas ---------- */

const LADO_MAXIMO = 4096;
const catalogoDeMapas = [];
/**
 * Mapa externo: a grade dele (em pixels da imagem original) vem de ajustes.json ou novos.json;
 * sem ela, vale a contagem de colunas do mapa procedural do mesmo id.
 */
async function gravarMapaExterno(origem, destino, celulaOriginal) {
  const info = await sharp(origem).metadata();
  const escala = Math.min(1, LADO_MAXIMO / Math.max(info.width, info.height));
  const largura = Math.round(info.width * escala);
  const altura = Math.round(info.height * escala);
  const redimensionado = await sharp(origem, { limitInputPixels: 200_000_000 }).resize(largura, altura).png().toBuffer();
  await gravar(redimensionado, destino, QUALIDADE.mapas, false);
  return { largura, altura, celula: Math.max(10, Math.min(500, Math.round(celulaOriginal * escala))) };
}
for (const def of MAPAS) {
  const destino = join(PASTA.mapas, `${def.id}.webp`);
  const fora = externo('mapas', def.id);
  if (fora) {
    const info = await sharp(fora).metadata();
    const celula = AJUSTES.mapas?.[def.id]?.celula ?? info.width / def.colunas;
    const medidas = await gravarMapaExterno(fora, destino, celula);
    catalogoDeMapas.push({ ...def, ...medidas });
    continue;
  }
  const m = criarMapa({
    colunas: def.colunas,
    linhas: def.linhas,
    fundo: def.fundo,
    props: propsParaMapas,
    ...(def.luz ?? {}),
  });
  def.desenhar(m);
  await gravar(Buffer.from(m.svg()), destino, QUALIDADE.mapas, false);
  catalogoDeMapas.push({ ...def, largura: m.W, altura: m.H, celula: CELULA });
}
for (const item of novos('mapas')) {
  if (!item.celula) throw new Error(`externos/novos.json: o mapa "${item.id}" precisa de "celula" (px da grade na imagem)`);
  const medidas = await gravarMapaExterno(externo('mapas', item.id), join(PASTA.mapas, `${item.id}.webp`), item.celula);
  catalogoDeMapas.push({ id: item.id, nome: item.nome, descricao: item.descricao ?? '', ...medidas });
}

/* ---------- Catálogo (shared) ---------- */

const q = (s) => `'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const unicas = (lista) => [...new Set(lista)];
const catalogo = `// Gerado por design/prontos/gerar.mjs a partir da arte em design/prontos/: não edite à mão.
// Os ids ficam salvos nos casos (props, tokens e mapas): um id que sumir daqui deixa sem imagem o
// que já usa ele.

/** Props prontos (RF-20). \`tamanho\`: quantas células de largura o prop ocupa ao entrar na mesa. */
export const PROPS_PRONTOS = [
${catalogoDeProps.map((p) => `  { id: ${q(`pronto:${p.id}`)}, nome: ${q(p.nome)}, categoria: ${q(p.categoria)}, tamanho: ${p.tamanho} },`).join('\n')}
] as const;

export const CATEGORIAS_DE_PROPS = [${unicas(catalogoDeProps.map((p) => q(p.categoria))).join(', ')}] as const;

/** Modelos prontos de NPC e ameaça (RF-19): a imagem do token. */
export const NPCS_PRONTOS = [
${catalogoDeNpcs.map((n) => `  { id: ${q(`npc:${n.id}`)}, nome: ${q(n.nome)}, categoria: ${q(n.categoria)} },`).join('\n')}
] as const;

export const CATEGORIAS_DE_NPCS = [${unicas(catalogoDeNpcs.map((n) => q(n.categoria))).join(', ')}] as const;

/** Mapas prontos (RF-14): medidas em pixels do mapa e a célula da grade que bate com o desenho. */
export const MAPAS_PRONTOS = [
${catalogoDeMapas.map((m) => `  {\n    id: ${q(`mapa:${m.id}`)},\n    nome: ${q(m.nome)},\n    descricao: ${q(m.descricao)},\n    largura: ${m.largura},\n    altura: ${m.altura},\n    celula: ${m.celula},\n  },`).join('\n')}
] as const;
`;
writeFileSync(join(RAIZ, 'shared/src/mesa/prontos.ts'), catalogo);

/* ---------- Endereços das imagens (client) ---------- */

const variavel = (prefixo, id) => `${prefixo}_${id.replaceAll('-', '_')}`;
const entradas = [
  ...catalogoDeProps.map((p) => ({ id: `pronto:${p.id}`, v: variavel('prop', p.id), arquivo: `./props-prontos/${p.id}.webp` })),
  ...catalogoDeNpcs.map((n) => ({ id: `npc:${n.id}`, v: variavel('npc', n.id), arquivo: `./npcs-prontos/${n.id}.webp` })),
  ...catalogoDeMapas.map((m) => ({ id: `mapa:${m.id}`, v: variavel('mapa', m.id), arquivo: `./mapas-prontos/${m.id}.webp` })),
];
writeFileSync(
  join(RAIZ, 'client/src/mesa/imagens-prontas.ts'),
  `// Gerado por design/prontos/gerar.mjs: não edite à mão.
// O endereço de cada imagem pronta (o Vite dá o caminho final de cada arquivo no build).
${entradas.map((e) => `import ${e.v} from '${e.arquivo}';`).join('\n')}

export const IMAGENS_PRONTAS: Readonly<Record<string, string>> = {
${entradas.map((e) => `  ${q(e.id)}: ${e.v},`).join('\n')}
};
`,
);

/* ---------- Prompts e prévia ---------- */

const { escreverPrompts } = await import('./prompts.mjs');
writeFileSync(join(import.meta.dirname, 'prompts.md'), escreverPrompts({ props: catalogoDeProps, npcs: catalogoDeNpcs, mapas: catalogoDeMapas }));

const cartao = (titulo, src, largura) =>
  `<figure><img src="${src}" style="width:${largura}px"/><figcaption>${titulo}</figcaption></figure>`;
writeFileSync(
  join(import.meta.dirname, 'previa.html'),
  `<!doctype html><meta charset="utf-8"><title>Prontos</title>
<style>body{background:#1a1614;color:#ddd;font:14px sans-serif;margin:16px}section{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}figure{margin:0;background:#2a2420;padding:8px;text-align:center}img{display:block;max-height:440px;object-fit:contain}h2{margin:8px 0}</style>
<h2>Props (${catalogoDeProps.length})</h2><section>${catalogoDeProps.map((p) => cartao(p.nome, `../../client/src/mesa/props-prontos/${p.id}.webp`, 110)).join('')}</section>
<h2>NPCs (${catalogoDeNpcs.length})</h2><section>${catalogoDeNpcs.map((n) => cartao(n.nome, `../../client/src/mesa/npcs-prontos/${n.id}.webp`, 110)).join('')}</section>
<h2>Mapas (${catalogoDeMapas.length})</h2><section>${catalogoDeMapas.map((m) => cartao(m.nome, `../../client/src/mesa/mapas-prontos/${m.id}.webp`, 640)).join('')}</section>`,
);

console.log(`props: ${catalogoDeProps.length} · npcs: ${catalogoDeNpcs.length} · mapas: ${catalogoDeMapas.length}`);
