# Instala (ou reinstala) o WorldBox 2 como aplicativo, com atalho e botao de atualizar.
#
#   Da pasta do projeto:  instalar.bat   (monta o pacote com o codigo da pasta e instala)
#   De qualquer lugar:    & ([scriptblock]::Create((irm https://github.com/FelipeWASD83/worldbox-2/releases/latest/download/instalar.ps1)))
#   Remover:              powershell -File instalar.ps1 -Remover   (os mundos salvos ficam)
#
# O que faz:
#   1. Pega o pacote do jogo: o da pasta do projeto (npm run pacote) ou o da
#      release mais nova do GitHub, conferido pelo SHA-256.
#   2. Baixa o Electron oficial da versao que o pacote pede e confere pelo
#      SHA256SUMS da propria release do Electron. Nao ha .exe proprio: o Smart
#      App Control barra binario novo, e o electron.exe oficial passa.
#   3. Poe o jogo em <Pasta>\app, o inicializador em <Pasta>\inicio e cria os
#      atalhos na area de trabalho e no menu Iniciar.
#
# Os mundos salvos ficam em %APPDATA%\worldbox-2\mundos e nunca sao tocados.
# Texto so em ASCII de proposito: o Windows PowerShell 5.1 le .ps1 sem BOM
# como ANSI, e acento viraria lixo.
param(
  [string]$Pasta = (Join-Path $env:LOCALAPPDATA 'WorldBox 2'),
  [string]$Pacote = '',
  [string]$CacheElectron = (Join-Path $env:TEMP 'worldbox-2-electron'),
  [switch]$Remover,
  [switch]$SemAtalho
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem

$Repo = 'FelipeWASD83/worldbox-2'
$Api = if ($env:WB2_API_ATUALIZACAO) { $env:WB2_API_ATUALIZACAO.TrimEnd('/') } else { 'https://api.github.com' }
$atalhoMesa = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WorldBox 2.lnk'
$atalhoMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'WorldBox 2.lnk'

function Titulo([string]$t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Sha256([string]$arq) { (Get-FileHash -Algorithm SHA256 -LiteralPath $arq).Hash.ToLower() }
function Baixar([string]$url, [string]$destino) {
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destino -Headers @{ 'User-Agent' = 'WorldBox-2-instalador' }
}

# ------------------------------------------------------------------ remover
if ($Remover) {
  Titulo 'Removendo o WorldBox 2'
  foreach ($a in @($atalhoMesa, $atalhoMenu)) { if (Test-Path -LiteralPath $a) { Remove-Item -LiteralPath $a -Force } }
  if (Test-Path -LiteralPath $Pasta) { Remove-Item -LiteralPath $Pasta -Recurse -Force }
  Write-Host 'Removido. Os mundos salvos continuam em %APPDATA%\worldbox-2\mundos.'
  return
}

# ------------------------------------------------------------------ 1. pacote
Titulo '1/4 Pacote do jogo'
$temp = Join-Path $env:TEMP ('worldbox-2-instalar-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $temp | Out-Null
if (-not $Pacote) {
  $projeto = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { '' }
  if ($projeto -and (Test-Path (Join-Path $projeto 'package.json')) -and (Test-Path (Join-Path $projeto 'node_modules\electron'))) {
    Write-Host "Montando o pacote com o codigo da pasta $projeto"
    Push-Location $projeto
    try {
      & npm.cmd run pacote | Out-Host
      if ($LASTEXITCODE -ne 0) { throw 'npm run pacote falhou.' }
      $versaoPasta = (Get-Content (Join-Path $projeto 'package.json') -Raw | ConvertFrom-Json).version
      $Pacote = Join-Path $projeto "release\worldbox-2-$versaoPasta.zip"
    } finally { Pop-Location }
  } else {
    Write-Host "Procurando a versao mais nova em github.com/$Repo"
    $rel = Invoke-RestMethod -UseBasicParsing -Uri "$Api/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'WorldBox-2-instalador' }
    $v = ($rel.tag_name -replace '^[vV]', '')
    $nome = "worldbox-2-$v.zip"
    $asset = $rel.assets | Where-Object { $_.name -eq $nome } | Select-Object -First 1
    if (-not $asset) { throw "A release $v nao tem o pacote $nome." }
    $esperado = ''
    if ($asset.digest -and ($asset.digest -like 'sha256:*')) { $esperado = $asset.digest.Substring(7).ToLower() }
    else {
      $shaAsset = $rel.assets | Where-Object { $_.name -eq "$nome.sha256" } | Select-Object -First 1
      if ($shaAsset) {
        $shaArq = Join-Path $temp 'pacote.sha256'
        Baixar $shaAsset.browser_download_url $shaArq
        $esperado = ((Get-Content -LiteralPath $shaArq -Raw) -split '\s+')[0].ToLower()
      }
    }
    if (-not $esperado) { throw 'A release nao diz o SHA-256 do pacote: sem conferir, nao instalo.' }
    $Pacote = Join-Path $temp $nome
    Baixar $asset.browser_download_url $Pacote
    if ((Sha256 $Pacote) -ne $esperado) { throw 'O pacote baixado nao confere com o SHA-256 da release.' }
    Write-Host "Pacote $v conferido."
  }
}
if (-not (Test-Path -LiteralPath $Pacote)) { throw "Pacote nao encontrado: $Pacote" }

$zip = [IO.Compression.ZipFile]::OpenRead($Pacote)
try {
  $entrada = $zip.GetEntry('package.json')
  if (-not $entrada) { throw 'O pacote nao tem package.json: nao e o WorldBox 2.' }
  $leitor = New-Object IO.StreamReader($entrada.Open())
  $pkg = $leitor.ReadToEnd() | ConvertFrom-Json
  $leitor.Close()
} finally { $zip.Dispose() }
if ($pkg.name -ne 'worldbox-2') { throw 'O pacote nao e do WorldBox 2.' }
$versaoJogo = $pkg.version
$versaoElectron = $pkg.versaoElectron
if (-not $versaoElectron) { throw 'O pacote nao diz que Electron usa (versaoElectron).' }
Write-Host "WorldBox 2 $versaoJogo, Electron $versaoElectron"

# ------------------------------------------------------------------ 2. Electron
Titulo '2/4 Electron oficial'
New-Item -ItemType Directory -Force $Pasta | Out-Null
$dirElectron = Join-Path $Pasta 'electron'
$arqVersao = Join-Path $dirElectron 'version'
$temCerto = (Test-Path -LiteralPath $arqVersao) -and ((Get-Content -LiteralPath $arqVersao -Raw).Trim() -eq $versaoElectron)
if ($temCerto) {
  Write-Host "Electron $versaoElectron ja instalado."
} else {
  New-Item -ItemType Directory -Force $CacheElectron | Out-Null
  $nomeZip = "electron-v$versaoElectron-win32-x64.zip"
  $base = "https://github.com/electron/electron/releases/download/v$versaoElectron"
  $somas = Join-Path $CacheElectron "SHASUMS256-$versaoElectron.txt"
  if (-not (Test-Path -LiteralPath $somas)) { Baixar "$base/SHASUMS256.txt" $somas }
  $linha = Get-Content -LiteralPath $somas | Where-Object { $_ -match "\*?$([regex]::Escape($nomeZip))$" } | Select-Object -First 1
  if (-not $linha) { throw "O SHASUMS256.txt do Electron nao tem $nomeZip." }
  $esperado = ($linha -split '\s+')[0].ToLower()
  $zipElectron = Join-Path $CacheElectron $nomeZip
  if (-not ((Test-Path -LiteralPath $zipElectron) -and ((Sha256 $zipElectron) -eq $esperado))) {
    Write-Host "Baixando $nomeZip (uns 110 MB)..."
    Baixar "$base/$nomeZip" $zipElectron
  }
  if ((Sha256 $zipElectron) -ne $esperado) {
    Remove-Item -LiteralPath $zipElectron -Force
    throw 'O Electron baixado nao confere com o SHA256SUMS oficial. Nada foi instalado.'
  }
  $tmpElectron = Join-Path $temp 'electron'
  [IO.Compression.ZipFile]::ExtractToDirectory($zipElectron, $tmpElectron)
  if (Test-Path -LiteralPath $dirElectron) { Remove-Item -LiteralPath $dirElectron -Recurse -Force }
  Move-Item -LiteralPath $tmpElectron -Destination $dirElectron
  Write-Host "Electron $versaoElectron conferido e instalado."
}

# ------------------------------------------------------------------ 3. jogo e inicializador
Titulo '3/4 Jogo'
$tmpApp = Join-Path $temp 'app'
[IO.Compression.ZipFile]::ExtractToDirectory($Pacote, $tmpApp)
foreach ($obrigatorio in @('electron\main.js', 'dist\index.html', 'instalador\inicio\inicio.js')) {
  if (-not (Test-Path -LiteralPath (Join-Path $tmpApp $obrigatorio))) { throw "O pacote esta incompleto (falta $obrigatorio)." }
}
$dirApp = Join-Path $Pasta 'app'
$dirAnterior = Join-Path $Pasta 'anterior'
foreach ($d in @('nova', 'nova-baixando', 'recusada')) {
  $p = Join-Path $Pasta $d
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
}
if (Test-Path -LiteralPath $dirApp) {
  if (Test-Path -LiteralPath $dirAnterior) { Remove-Item -LiteralPath $dirAnterior -Recurse -Force }
  Move-Item -LiteralPath $dirApp -Destination $dirAnterior
}
Move-Item -LiteralPath $tmpApp -Destination $dirApp
$dirInicio = Join-Path $Pasta 'inicio'
if (Test-Path -LiteralPath $dirInicio) { Remove-Item -LiteralPath $dirInicio -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $dirApp 'instalador\inicio') -Destination $dirInicio -Recurse
$estado = @{ versao = $versaoJogo; emTeste = $false } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $Pasta 'estado.json'), $estado, (New-Object Text.UTF8Encoding($false)))
Write-Host "Jogo $versaoJogo em $dirApp"

# ------------------------------------------------------------------ 4. atalhos
Titulo '4/4 Atalhos'
$exe = Join-Path $dirElectron 'electron.exe'
if ($SemAtalho) {
  Write-Host 'Sem atalhos (pedido). Para abrir:'
  Write-Host "  `"$exe`" `"$dirInicio`""
} else {
  $shell = New-Object -ComObject WScript.Shell
  foreach ($a in @($atalhoMesa, $atalhoMenu)) {
    $l = $shell.CreateShortcut($a)
    $l.TargetPath = $exe
    $l.Arguments = "`"$dirInicio`""
    $l.WorkingDirectory = $Pasta
    $l.IconLocation = "$exe,0"
    $l.Description = 'WorldBox 2'
    $l.Save()
  }
  Write-Host 'Atalho "WorldBox 2" na area de trabalho e no menu Iniciar.'
}
Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ''
Write-Host "Pronto. WorldBox 2 $versaoJogo instalado em $Pasta" -ForegroundColor Green
