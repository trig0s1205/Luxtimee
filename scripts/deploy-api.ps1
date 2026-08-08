# Deploy manual de luxtime-api a Cloud Run.
# Uso: .\scripts\deploy-api.ps1 -ProjectId "tu-project-id"

param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region      = "southamerica-east1",
    [string]$Repository  = "luxtime",
    [string]$Service     = "luxtime-api",
    [string]$FrontendUrl = "",
    [string]$ImageServiceUrl = ""
)

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/api:latest"

Write-Host "=== Build y push de luxtime-api ===" -ForegroundColor Cyan
gcloud builds submit . `
    --config apps/api/cloudbuild.yaml `
    --substitutions=_IMAGE=$Image `
    --project=$ProjectId

if ($LASTEXITCODE -ne 0) { Write-Host "Build fallido." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Deploy a Cloud Run ===" -ForegroundColor Cyan
gcloud run deploy $Service `
    --image $Image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 3001 `
    --memory 1Gi `
    --cpu 1 `
    --timeout 300 `
    --min-instances 0 `
    --max-instances 5 `
    --set-env-vars "NODE_ENV=production,USE_MOCKS=false,JWT_ACCESS_EXPIRES=15m,JWT_REFRESH_EXPIRES=7d,CLOUDINARY_FOLDER=luxtime/watches" `
    --update-secrets "DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,JWT_SECRET=JWT_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,FRONTEND_URL=FRONTEND_URL:latest,IMAGE_SERVICE_URL=IMAGE_SERVICE_URL:latest"

if ($LASTEXITCODE -ne 0) { Write-Host "Deploy fallido." -ForegroundColor Red; exit 1 }

$Url = gcloud run services describe $Service --region $Region --format 'value(status.url)'
Write-Host ""
Write-Host "API desplegada en: $Url" -ForegroundColor Green
Write-Host "Health check:" -ForegroundColor Cyan
curl "$Url/api/v1/health"
