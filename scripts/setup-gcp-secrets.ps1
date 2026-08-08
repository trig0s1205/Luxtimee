# Ejecutar DESPUÉS de completar Fase 1 (Supabase) y Fase 2 (gcloud auth).
# Uso: .\scripts\setup-gcp-secrets.ps1 -ProjectId "tu-project-id"

param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "southamerica-east1"
)

Write-Host "=== Configurando secretos en Secret Manager ===" -ForegroundColor Cyan

# Generar valores aleatorios para JWT y cron
$jwtSecret   = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$cronSecret  = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host ""
Write-Host "Secretos generados (copia estos valores):" -ForegroundColor Yellow
Write-Host "  JWT_SECRET   = $jwtSecret"
Write-Host "  CRON_SECRET  = $cronSecret"
Write-Host ""
Write-Host "Ahora ingresa los valores que obtuviste de Supabase y Cloudinary:" -ForegroundColor Yellow

$databaseUrl        = Read-Host "DATABASE_URL (pooler Supabase, puerto 6543)"
$directUrl          = Read-Host "DIRECT_URL   (directa Supabase, puerto 5432)"
$frontendUrl        = Read-Host "FRONTEND_URL (URL exacta de Vercel, sin / final)"
$imageServiceUrl    = Read-Host "IMAGE_SERVICE_URL (URL Cloud Run image-service)"
$cloudinaryName     = Read-Host "CLOUDINARY_CLOUD_NAME"
$cloudinaryKey      = Read-Host "CLOUDINARY_API_KEY"
$cloudinarySecret   = Read-Host "CLOUDINARY_API_SECRET"

$secrets = @{
    DATABASE_URL          = $databaseUrl
    DIRECT_URL            = $directUrl
    JWT_SECRET            = $jwtSecret
    CRON_SECRET           = $cronSecret
    FRONTEND_URL          = $frontendUrl
    IMAGE_SERVICE_URL     = $imageServiceUrl
    CLOUDINARY_CLOUD_NAME = $cloudinaryName
    CLOUDINARY_API_KEY    = $cloudinaryKey
    CLOUDINARY_API_SECRET = $cloudinarySecret
}

foreach ($name in $secrets.Keys) {
    $value = $secrets[$name]
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "  SKIP $name (vacío)" -ForegroundColor DarkGray
        continue
    }
    $value | gcloud secrets create $name --data-file=- --project=$ProjectId 2>$null
    if ($LASTEXITCODE -ne 0) {
        # El secreto ya existe, añadir nueva versión
        $value | gcloud secrets versions add $name --data-file=- --project=$ProjectId
    }
    Write-Host "  OK   $name" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Dar acceso al service account de Cloud Run ===" -ForegroundColor Cyan
$saEmail = "$(gcloud projects describe $ProjectId --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
foreach ($name in $secrets.Keys) {
    gcloud secrets add-iam-policy-binding $name `
        --member="serviceAccount:$saEmail" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId | Out-Null
}
Write-Host "Permisos concedidos a $saEmail" -ForegroundColor Green
Write-Host ""
Write-Host "Secretos listos. Ahora ejecuta el deploy (Fase 4)." -ForegroundColor Cyan
