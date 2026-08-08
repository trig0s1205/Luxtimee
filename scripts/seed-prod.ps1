param(
    [string]$ProjectId = "project-65793168-a509-4f95-818"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$apiDir = Join-Path $root "apps\api"

Write-Host "=== Seed producción (Supabase) ===" -ForegroundColor Cyan

$directUrl = gcloud secrets versions access latest --secret=DIRECT_URL --project=$ProjectId
$databaseUrl = gcloud secrets versions access latest --secret=DATABASE_URL --project=$ProjectId

$env:DATABASE_URL = $directUrl
$env:DIRECT_URL = $directUrl

Push-Location $apiDir
try {
    pnpm exec prisma db seed
    Write-Host "Seed OK" -ForegroundColor Green
} finally {
    Pop-Location
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
}
