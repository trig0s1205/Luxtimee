# Deploy manual de luxtime-image-service a Cloud Run.
# Uso: .\scripts\deploy-image-service.ps1 -ProjectId "tu-project-id"

param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region     = "southamerica-east1",
    [string]$Repository = "luxtime",
    [string]$Service    = "luxtime-image-service"
)

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/image-service:latest"

Write-Host "=== Build y push de luxtime-image-service ===" -ForegroundColor Cyan
gcloud builds submit `
    --tag $Image `
    apps/image-service

if ($LASTEXITCODE -ne 0) { Write-Host "Build fallido." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Deploy a Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy $Service `
    --image $Image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8001 `
    --memory 2Gi `
    --cpu 2 `
    --timeout 300 `
    --concurrency 1 `
    --min-instances 1 `
    --max-instances 3 `
    --set-env-vars "REMBG_MODEL=u2netp" `
    --update-secrets "IMAGE_SERVICE_API_KEY=IMAGE_SERVICE_API_KEY:latest" `
    --project $ProjectId

if ($LASTEXITCODE -ne 0) { Write-Host "Deploy fallido." -ForegroundColor Red; exit 1 }

$Url = gcloud run services describe $Service --region $Region --project $ProjectId --format 'value(status.url)'
Write-Host ""
Write-Host "Image-service desplegado en: $Url" -ForegroundColor Green
Write-Host "Health check:" -ForegroundColor Cyan
curl "$Url/health"
