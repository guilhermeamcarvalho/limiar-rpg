// Escreve prompts.md: um prompt por item, para gerar a arte numa IA de imagem (ou passar para um
// ilustrador) com o mesmo estilo em tudo. A imagem pronta vai para externos/<tipo>/<id>.png e o
// gerar.mjs troca a arte procedural por ela (veja LEIAME.md).

const ESTILO =
  'Ilustração digital pintada, horror investigativo contemporâneo no Brasil, paleta escura e dessaturada ' +
  '(marrons, cinzas, verdes apagados) com acentos de vermelho-sangue e luz âmbar, iluminação dramática de ' +
  'cima, textura sutil, sem texto, sem marca d’água.';

const PROP =
  'Vista de cima, perfeitamente ortográfica (top-down), objeto inteiro centralizado, fundo transparente ' +
  '(PNG com alpha) ou fundo branco liso, sombra curta e suave para baixo-direita, sem chão em volta.';

const NPC =
  'Retrato de busto, enquadramento quadrado, rosto no terço de cima, olhando para frente, fundo escuro ' +
  'liso com leve vinheta, sem moldura, legível pequeno (vai virar um token redondo de 64 px).';

const MAPA =
  'Mapa de batalha para RPG de mesa, vista de cima perfeitamente ortográfica, sem grade desenhada, sem ' +
  'texto ou legendas, iluminação noturna com poças de luz, cômodos e móveis em escala humana (uma célula ' +
  'de 1,5 m), bordas do mapa preenchidas até o fim.';

const linha = (id, nome, extra) => `- **\`${id}\`** — ${nome}${extra ? ` · ${extra}` : ''}`;

export function escreverPrompts({ props, npcs, mapas }) {
  const porCategoria = (lista) =>
    Object.entries(Object.groupBy(lista, (i) => i.categoria))
      .map(([cat, itens]) => `### ${cat}\n\n${itens.map((i) => linha(i.id, i.nome)).join('\n')}`)
      .join('\n\n');
  return `# Prompts da arte pronta

Gerado por \`gerar.mjs\`: não edite à mão. Para cada item, junte **estilo + tipo + o nome** do item
num prompt só. Salve a imagem em \`externos/<tipo>/<id>.png\` (ou .jpg/.webp) e rode
\`node design/prontos/gerar.mjs\` — o resto está em \`LEIAME.md\`.

## Estilo (vale para tudo)

> ${ESTILO}

## Props (${props.length}) — \`externos/props/<id>.png\`

> ${PROP}

Exemplo: _"${ESTILO} ${PROP} Objeto: ${props[0]?.nome.toLowerCase() ?? 'caixote'}."_

${porCategoria(props)}

## NPCs e ameaças (${npcs.length}) — \`externos/npcs/<id>.png\`

> ${NPC}

Exemplo: _"${ESTILO} ${NPC} Personagem: ${npcs[0]?.nome.toLowerCase() ?? 'policial'}."_

${porCategoria(npcs)}

## Mapas (${mapas.length}) — \`externos/mapas/<id>.png\`

> ${MAPA}

Proporção: a mesma do mapa procedural (colunas × linhas abaixo). Se a imagem não tiver exatamente
uma célula a cada \`largura / colunas\` pixels, diga o tamanho da célula em \`externos/ajustes.json\`.

${mapas.map((m) => linha(m.id, m.nome, `${m.descricao}${m.colunas ? ` (${m.colunas} × ${m.linhas} células)` : ''}`)).join('\n')}
`;
}
