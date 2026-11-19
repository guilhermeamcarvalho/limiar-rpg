# Gera a versão navegável das telas a partir de design/fonte/.
#
#   design/telas/<Tela>.html   uma página por tela, sem o runtime do canvas
#   design/png/<Tela>.png      captura de cada tela (só com -Png; usa o Edge headless)
#   design/index.html          índice agrupado como no canvas (Computador, Celular, Componentes)
#
# Uso, na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File design/gerar.ps1          # HTML + índice
#   powershell -ExecutionPolicy Bypass -File design/gerar.ps1 -Png     # também refaz os PNGs
#
# A fonte da verdade continua sendo design/fonte/. Não edite telas/ nem png/ à mão.

param([switch]$Png)
$ErrorActionPreference = 'Stop'

$raiz   = $PSScriptRoot
$fonte  = Join-Path $raiz 'fonte'
$telas  = Join-Path $raiz 'telas'
$pngDir = Join-Path $raiz 'png'
$utf8   = New-Object System.Text.UTF8Encoding($false)
$S      = [Text.RegularExpressions.RegexOptions]::Singleline

function Ler($p)            { [IO.File]::ReadAllText($p, $utf8) }
function Gravar($p, $texto) { [IO.File]::WriteAllText($p, ($texto -replace "`r`n", "`n"), $utf8) }
function Esc($s)            { $s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;' }

$canvas = Ler (Join-Path $fonte 'canvas.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force $telas | Out-Null

# 1. Uma página HTML por tela ---------------------------------------------------
$itens = @()
foreach ($arq in $canvas.order) {
    $b   = $canvas.boards.$arq
    $src = Ler (Join-Path $fonte $arq)

    $helmet = [regex]::Match($src, '<helmet>(.*?)</helmet>', $S).Groups[1].Value.Trim()
    $corpo  = [regex]::Match($src, '</helmet>(.*?)</x-dc>', $S).Groups[1].Value.Trim()
    if (-not $corpo) { throw "Estrutura inesperada em $arq (sem <helmet> ou <x-dc>)" }

    # Links entre telas: Central.dc.html -> Central.html
    $corpo = [regex]::Replace($corpo, '(href="[^"#]*?)\.dc\.html', '$1.html')

    $nome    = $arq -replace '\.dc\.html$', ''
    $celular = $b.page -eq 'cel'
    $extra   = if ($celular) { "<style>@media (min-width:640px){.phone{margin:32px auto}}</style>`n" } else { '' }

    $html = "<!doctype html>`n<html lang=`"pt-BR`">`n<head>`n<meta charset=`"utf-8`">`n" +
            "<meta name=`"viewport`" content=`"width=device-width, initial-scale=1`">`n" +
            "<title>$(Esc $b.title) · LIMIAR</title>`n" +
            "<!-- Gerado por design/gerar.ps1 a partir de design/fonte/$arq. Não edite à mão. -->`n" +
            "<link rel=`"stylesheet`" href=`"../fonte/lm.css`">`n" +
            "$helmet`n$extra</head>`n<body>`n$corpo`n</body>`n</html>`n"
    Gravar (Join-Path $telas "$nome.html") $html

    $itens += [pscustomobject]@{ Nome = $nome; Titulo = $b.title; Pagina = $b.page; W = [int]$b.w; H = [int]$b.h }
}
Write-Host "telas/: $($itens.Count) páginas"

# 2. PNGs com o Edge headless (opcional) ---------------------------------------
if ($Png) {
    $edge = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $edge) { throw 'Edge ou Chrome não encontrado para gerar os PNGs.' }

    New-Item -ItemType Directory -Force $pngDir | Out-Null
    $perfil = Join-Path ([IO.Path]::GetTempPath()) "limiar-png-$PID"
    try {
        foreach ($t in $itens) {
            $saida = Join-Path $pngDir "$($t.Nome).png"
            $url   = ([Uri](Join-Path $telas "$($t.Nome).html")).AbsoluteUri
            if (Test-Path $saida) { Remove-Item $saida }
            $argv = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
                      "--user-data-dir=`"$perfil`"", '--virtual-time-budget=8000',
                      "--window-size=$($t.W),$($t.H)", "--screenshot=`"$saida`"", $url)
            Start-Process -FilePath $edge -ArgumentList $argv -Wait -WindowStyle Hidden
            if (-not (Test-Path $saida)) { throw "Falhou ao capturar $($t.Nome)" }
        }
    } finally {
        Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
    }
    Write-Host "png/: $($itens.Count) imagens"
}

# 3. Índice --------------------------------------------------------------------
$grupos = @(
    @{ Id = 'desk'; Nome = 'Computador'; Nota = '1440 px de largura' },
    @{ Id = 'cel';  Nome = 'Celular';    Nota = '390 × 844' },
    @{ Id = 'base'; Nome = 'Componentes'; Nota = 'tokens, componentes e estados' }
)
$secoes = ''
foreach ($g in $grupos) {
    # Ordena pelo número do título: "01 · Entrar", "01b · …", "02 · …", "10b · …"
    $arr = @($itens | Where-Object { $_.Pagina -eq $g.Id } | Sort-Object {
        $m = [regex]::Match($_.Titulo, '(\d+)([a-z]?) ·')
        if ($m.Success) { '{0:D3}{1}' -f [int]$m.Groups[1].Value, $m.Groups[2].Value } else { $_.Titulo }
    })

    $cards = ''
    foreach ($t in $arr) {
        $rotulo = Esc ($t.Titulo -replace '^Celular · ', '')
        $temPng = Test-Path (Join-Path $pngDir "$($t.Nome).png")
        $thumb  = if ($temPng) { "<img src=`"png/$($t.Nome).png`" alt=`"`" loading=`"lazy`">" } else { "<span class=`"sem`">$($t.W) × $($t.H)</span>" }
        $pngLink = if ($temPng) { "<a class=`"aux`" href=`"png/$($t.Nome).png`">PNG</a>" } else { '' }
        $cards += "<li class=`"tela`"><a class=`"thumb`" href=`"telas/$($t.Nome).html`">$thumb</a>" +
                  "<div class=`"meta`"><a href=`"telas/$($t.Nome).html`">$rotulo</a>$pngLink</div></li>`n"
    }
    $classe = if ($g.Id -eq 'cel') { 'grade cel' } else { 'grade' }
    $secoes += "<section><header class=`"sec`"><h2>$($g.Nome)</h2><span>$($arr.Count) telas · $($g.Nota)</span></header>`n" +
               "<ul class=`"$classe`">`n$cards</ul></section>`n"
}

$indice = @"
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LIMIAR · Telas finais</title>
<!-- Gerado por design/gerar.ps1. Não edite à mão. -->
<link rel="stylesheet" href="fonte/lm.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oranienbaum&amp;family=Mulish:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet">
<style>
body{background:var(--bg)}
.pg{max-width:1280px;margin:0 auto;padding:48px 16px 80px}
.topo{display:flex;flex-direction:column;gap:10px;margin-bottom:40px}
.topo h1{font:400 56px/1 var(--f-disp);text-transform:uppercase;letter-spacing:.01em}
.topo h1 b{color:var(--red);font-weight:400}
.topo p{color:var(--muted);max-width:640px}
section{margin-top:48px}
.sec{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:20px}
.sec h2{font:400 32px/1 var(--f-disp);text-transform:uppercase}
.sec span{color:var(--muted-2);font-size:13px}
.grade{list-style:none;margin:0;padding:0;display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.grade.cel{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
.tela{display:flex;flex-direction:column;gap:8px}
.thumb{display:block;aspect-ratio:1440/900;background:var(--panel);border:1px solid var(--line);overflow:hidden}
.cel .thumb{aspect-ratio:390/844}
.thumb:hover{border-color:var(--red)}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.sem{display:flex;height:100%;align-items:center;justify-content:center;color:var(--muted-2);font-size:12px}
.meta{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:700}
.meta a{text-decoration:none}
.meta .aux{color:var(--muted-2);font-weight:600}
@media (max-width:600px){.topo h1{font-size:40px}}
</style>
</head>
<body>
<main class="pg">
<div class="topo">
<span class="lab">Design · versão navegável</span>
<h1>LIMIAR · <b>Telas finais</b></h1>
<p>Cada tela abre como página HTML estática; os links entre telas funcionam. Gerado a partir de <code>design/fonte/</code>, que é a fonte da verdade.</p>
</div>
$secoes
</main>
</body>
</html>
"@
Gravar (Join-Path $raiz 'index.html') $indice
Write-Host 'index.html gerado'
