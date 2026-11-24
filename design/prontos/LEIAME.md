# Arte pronta da mesa

Props, modelos de NPC e mapas que já vêm no app. Tudo sai daqui por um comando, da raiz do repositório:

```sh
node design/prontos/gerar.mjs
pnpm format
```

Ele grava as imagens WebP em `client/src/mesa/{props,npcs,mapas}-prontos/`, o catálogo em
`shared/src/mesa/prontos.ts`, os endereços em `client/src/mesa/imagens-prontas.ts`, os prompts em
`prompts.md` e uma prévia em `previa.html` (abra no navegador para conferir tudo de uma vez).

## De onde vem cada imagem

1. **Arte externa** (gerada numa IA de imagem, comprada ou desenhada): se existir
   `externos/<props|npcs|mapas>/<id>.png` (ou `.jpg`, `.jpeg`, `.webp`), ela é usada.
2. **Arte procedural**: senão, o desenho dos `arte-*.mjs` com o acabamento de `acabamento.mjs`
   (textura, volume, sombra, luz e grão), renderizado pelo sharp.

O id é o que liga uma à outra, e é ele que fica salvo nos casos: **nunca renomeie nem remova um id**
(o que já estiver na mesa com ele fica sem imagem). Trocar a arte de um id é seguro.

## Trocar a arte de um item que já existe

1. Pegue o prompt do item em `prompts.md` (estilo + tipo + nome).
2. Salve a imagem com o nome do id: `externos/props/barril.png`, `externos/npcs/policial.png`,
   `externos/mapas/hospital.png`.
3. Rode o gerador e confira em `previa.html`.

O que o gerador faz com cada tipo:

- **Props**: corta a borda vazia (transparente ou da cor do canto) e reduz para no máximo 640 px.
  Use PNG com fundo transparente; o tamanho na mesa continua o do catálogo (`tamanho` em células).
- **NPCs**: recorta um quadrado de 384 px no ponto de mais interesse (o rosto, quase sempre).
- **Mapas**: reduz para no máximo 4096 px no lado maior. A grade sai de
  `largura da imagem / colunas do mapa procedural`; se a imagem tiver outra proporção, diga quantos
  pixels tem uma célula **na imagem original** em `externos/ajustes.json`:

  ```json
  { "mapas": { "hospital": { "celula": 140 } } }
  ```

## Itens novos

Um item que não tem desenho procedural entra por `externos/novos.json` e precisa de imagem (sem ela o
gerador para com erro):

```json
{
  "props": [{ "id": "geladeira", "nome": "Geladeira", "categoria": "Casa", "tamanho": 1 }],
  "npcs": [{ "id": "padre", "nome": "Padre", "categoria": "Pessoas" }],
  "mapas": [{ "id": "fazenda", "nome": "Fazenda", "descricao": "Casa, celeiro e o pasto.", "celula": 120 }]
}
```

- ids em minúsculas, com hífen (`cadeira-de-rodas`), sem repetir os que já existem;
- a `categoria` pode ser uma das que já existem ou uma nova (vira aba no seletor);
- `celula` do mapa: quantos pixels tem uma célula da grade na imagem original.

Depois rode o gerador; os testes (`pnpm test`) conferem que toda entrada do catálogo tem imagem.
