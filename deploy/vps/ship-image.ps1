# Plan B: construir la imagen en el PC y enviarla al VPS (si GHCR/Actions fallan).
# Uso (PowerShell, raíz del monorepo):
#   .\deploy\vps\ship-image.ps1 -ServerIp 1.2.3.4 -User deploy -Tag local-20261114-1200
param(
  [Parameter(Mandatory = $true)][string]$ServerIp,
  [string]$User = 'deploy',
  [string]$Tag = $(Get-Date -Format "'local-'yyyyMMdd-HHmm")
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Rama actual: $branch"
if ($branch -ne 'main' -and $branch -notlike 'feat/*' -and $branch -notlike 'chore/*') {
  $ans = Read-Host "La rama no parece la esperada. Continuar? [s/N]"
  if ($ans -notin @('s', 'S')) { throw 'Abortado.' }
}

docker version | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no responde.' }

$image = "luxtimee-api:$Tag"
$tar = Join-Path $env:TEMP "luxtimee-api-$Tag.tar"
Write-Host "Construyendo $image (linux/amd64)…"
docker build -f apps/api/Dockerfile -t $image --platform linux/amd64 .
if ($LASTEXITCODE -ne 0) { throw 'docker build falló' }

Write-Host "Guardando $tar …"
docker save -o $tar $image
if ($LASTEXITCODE -ne 0) { throw 'docker save falló' }

Write-Host "Subiendo al servidor…"
scp $tar "${User}@${ServerIp}:/home/${User}/luxtimee-api-$Tag.tar"
ssh "${User}@${ServerIp}" "docker load -i ~/luxtimee-api-$Tag.tar && docker tag $image $image && rm -f ~/luxtimee-api-$Tag.tar"

Remove-Item -Force $tar -ErrorAction SilentlyContinue

Write-Host @"

Listo. En el servidor:
  cd ~/luxtimee
  # Edita API_IMAGE=luxtimee-api:$Tag en .env (o):
  bash ./deploy.sh $Tag

"@
