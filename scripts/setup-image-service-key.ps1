param(
    [string]$ProjectId = "project-65793168-a509-4f95-818",
    [string]$Region = "southamerica-east1"
)

$ErrorActionPreference = "Continue"

if (-not $env:IMAGE_SERVICE_API_KEY) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $env:IMAGE_SERVICE_API_KEY = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$key = $env:IMAGE_SERVICE_API_KEY.Trim()
Write-Host "=== IMAGE_SERVICE_API_KEY -> Secret Manager ===" -ForegroundColor Cyan

Set-Content -Path "$env:TEMP\img-key.txt" -Value $key -NoNewline
Set-Content -Path "$env:TEMP\img-key-create.txt" -Value $key -NoNewline
gcloud secrets create IMAGE_SERVICE_API_KEY --data-file="$env:TEMP\img-key-create.txt" --project=$ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    gcloud secrets versions add IMAGE_SERVICE_API_KEY --data-file="$env:TEMP\img-key.txt" --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar IMAGE_SERVICE_API_KEY" }
}

$projectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
$runSa = "$projectNumber-compute@developer.gserviceaccount.com"
$githubSa = "github-actions-deploy@$ProjectId.iam.gserviceaccount.com"

foreach ($member in @("serviceAccount:$runSa", "serviceAccount:$ghSa")) {
    gcloud secrets add-iam-policy-binding IMAGE_SERVICE_API_KEY `
        --member=$member `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId 2>&1 | Out-Null
}

Write-Host "Actualizando Cloud Run..." -ForegroundColor Cyan
gcloud run services update luxtime-image-service `
    --region $Region `
    --project $ProjectId `
    --min-instances 0 `
    --cpu 2 `
    --memory 2Gi `
    --set-env-vars "REMBG_MODEL=u2netp" `
    --update-secrets "IMAGE_SERVICE_API_KEY=IMAGE_SERVICE_API_KEY:latest" 2>&1 | Out-Null

gcloud run services update luxtime-api `
    --region $Region `
    --project $ProjectId `
    --update-secrets "IMAGE_SERVICE_API_KEY=IMAGE_SERVICE_API_KEY:latest" 2>&1 | Out-Null

Write-Host "OK. Agrega IMAGE_SERVICE_API_KEY a apps/api/.env local" -ForegroundColor Green
Write-Host $key
