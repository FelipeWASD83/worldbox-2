# Publica a versao atual do WorldBox 2 como release no GitHub. E ela que o
# botao de atualizar do jogo baixa, e e dela que o instalador de uma linha sai.
#
#   powershell -ExecutionPolicy Bypass -File ferramentas\publicar-versao.ps1
#
# Antes: subir a versao no package.json e no CHANGELOG.md, commitar e dar push.
# Precisa do gh logado (gh auth login). Publicar e decisao do Felipe, como o push:
# nenhum agente roda isto por conta propria.
#
# A release leva tres arquivos: worldbox-2-<versao>.zip (o jogo), o .sha256 dele
# (o atualizador e o instalador recusam pacote que nao confere) e o instalar.ps1.
# Texto so em ASCII: o Windows PowerShell 5.1 le .ps1 sem BOM como ANSI.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$Repo = 'FelipeWASD83/worldbox-2'

function Rodar([string]$exe, [string[]]$argumentos) {
  # Com 'Stop', qualquer linha que o git ou o gh escrevam no stderr vira erro
  # fatal mesmo quando deu certo. Aqui quem decide e o codigo de saida.
  $ErrorActionPreference = 'Continue'
  $saida = & $exe @argumentos 2>&1 | ForEach-Object { "$_" }
  return [pscustomobject]@{ codigo = $LASTEXITCODE; saida = (($saida -join "`n").Trim()) }
}

$pkg = [IO.File]::ReadAllText((Join-Path $raiz 'package.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$versao = $pkg.version
$linhas = [IO.File]::ReadAllLines((Join-Path $raiz 'CHANGELOG.md'), [Text.Encoding]::UTF8)
$cabeca = $linhas | Where-Object { $_ -match '^## \d' } | Select-Object -First 1
if (-not $cabeca -or $cabeca -notmatch "^## $([regex]::Escape($versao)) ") {
  throw "O topo do CHANGELOG.md nao e a versao $versao do package.json. Acerte antes."
}

if ((Rodar git @('status', '--porcelain')).saida) { throw 'Ha mudancas nao commitadas. Commite antes de publicar.' }
$r = Rodar git @('fetch', '-q', 'origin')
if ($r.codigo -ne 0) { throw "Nao deu para falar com o GitHub (git fetch): $($r.saida)" }
$local = (Rodar git @('rev-parse', 'HEAD')).saida
$r = Rodar git @('rev-parse', '@{u}')
if ($r.codigo -ne 0) { throw 'Este ramo nao esta ligado ao GitHub. Rode: git push -u origin main' }
if ($local -ne $r.saida) { throw 'O commit atual ainda nao foi enviado (git push) ou esta atras do GitHub.' }
if ((Rodar gh @('release', 'view', "v$versao", '--repo', $Repo)).codigo -eq 0) { throw "A release v$versao ja existe." }

# o pacote sai do mesmo codigo que o atualizador usa para ler (electron/zip.js)
$r = Rodar npm.cmd @('run', 'pacote')
if ($r.codigo -ne 0) { throw "npm run pacote falhou: $($r.saida)" }
$zip = Join-Path $raiz "release\worldbox-2-$versao.zip"
$sha = "$zip.sha256"
if (-not (Test-Path $zip) -or -not (Test-Path $sha)) { throw 'O pacote nao foi gerado.' }

# notas: a secao desta versao no CHANGELOG
$inicio = [array]::IndexOf($linhas, $cabeca)
$notas = @()
for ($i = $inicio + 1; $i -lt $linhas.Length; $i++) {
  if ($linhas[$i] -match '^## ') { break }
  $notas += $linhas[$i]
}
$tmp = Join-Path $env:TEMP "worldbox-2-release-$versao"
New-Item -ItemType Directory -Force $tmp | Out-Null
$arqNotas = Join-Path $tmp 'notas.md'
[IO.File]::WriteAllText($arqNotas, (($notas -join "`n").Trim()), (New-Object Text.UTF8Encoding($false)))

$instalador = Join-Path $raiz 'instalador\instalar.ps1'
Write-Host "Publicando v$versao em $Repo"
$r = Rodar gh @('release', 'create', "v$versao", $zip, $sha, $instalador, '--repo', $Repo,
  '--title', "WorldBox 2 $versao", '--notes-file', $arqNotas, '--target', $local)
if ($r.codigo -ne 0) { throw "O gh nao criou a release: $($r.saida)" }
Write-Host $r.saida
Write-Host 'Pronto. O botao de atualizar das copias instaladas ja enxerga esta versao.'
