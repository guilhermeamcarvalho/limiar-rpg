# MEMBRANA

Plataforma para jogar RPG de mesa de horror investigativo com um grupo de amigos.

## Rodar na sua máquina

Precisa do Node 26 e do pnpm. No PowerShell com scripts bloqueados, use `pnpm.cmd` no lugar de `pnpm`.

```powershell
pnpm install
copy server\.env.example server\.env   # e preencha SESSION_SECRET (o arquivo explica como gerar)
pnpm db:migrate                         # cria data/membrana.db e cadastra Ordem Paranormal II
pnpm dev                                # client em http://localhost:5173, API em :3000
```

- `pnpm test`, `pnpm lint`, `pnpm typecheck`: o mesmo que o CI roda em cada PR.
- `pnpm db:generate`: depois de mudar `server/src/db/schema.ts`, gera a migração. Versione no Git; nunca altere o banco à mão.
- `http://localhost:3000/health`: responde `{ "ok": true, "versao": "…" }` quando o servidor está de pé.
- `http://localhost:5173/dev/componentes`: todos os componentes da interface, só no `pnpm dev`.

## Documentação

Em [`docs/`](docs/), exportada da "Documentação do Sistema MEMBRANA" em 19/11/2026:

- [Produto e funcionalidades](docs/produto-e-funcionalidades.md): o que o sistema faz, requisitos RF-01 a RF-87, permissões.
- [Arquitetura técnica](docs/arquitetura-tecnica.md): pilha, estrutura do código, mesa ao vivo, modelo de dados, hospedagem.
- [Regras do jogo](docs/regras-do-jogo.md): o que o motor de regras implementa.
- [Servidor](docs/servidor.md): montar o VPS, publicar (`sudo membrana-deploy`), backup e restauração, Sentry e monitor de queda.

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
