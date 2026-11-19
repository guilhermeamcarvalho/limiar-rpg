# LIMIAR

Plataforma para jogar RPG de mesa de horror investigativo com um grupo de amigos.

## Documentação

Em [`docs/`](docs/), exportada da "Documentação do Sistema LIMIAR" em 19/11/2026:

- [Produto e funcionalidades](docs/produto-e-funcionalidades.md): o que o sistema faz, requisitos RF-01 a RF-87, permissões.
- [Arquitetura técnica](docs/arquitetura-tecnica.md): pilha, estrutura do código, mesa ao vivo, modelo de dados, hospedagem.
- [Regras do jogo](docs/regras-do-jogo.md): o que o motor de regras implementa.

## Design

As telas finais estão em [`design/`](design/):

- [`design/fonte/`](design/fonte/): arquivos-fonte das 40 telas (`*.dc.html`), o `lm.css` com tokens e componentes, e o `canvas.json` com a organização do canvas. É a fonte da verdade do design.
- [`design/index.html`](design/index.html): índice navegável. Cada tela abre como página HTML estática em [`design/telas/`](design/telas/), com os links entre telas funcionando.
- [`design/png/`](design/png/): captura de cada tela, para usar em issues.

Com o GitHub Pages ativo, o índice fica em `https://guilhermeamcarvalho.github.io/limiar-rpg/design/`.

`telas/`, `png/` e `index.html` são gerados por [`design/gerar.ps1`](design/gerar.ps1). Depois de mudar algo em `fonte/`:

```powershell
powershell -ExecutionPolicy Bypass -File design/gerar.ps1 -Png
```

Sem `-Png`, refaz só o HTML e o índice. Os PNGs usam o Edge (ou Chrome) em modo headless.
