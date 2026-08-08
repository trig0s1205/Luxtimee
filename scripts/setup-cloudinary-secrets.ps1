param(
    [string]$ProjectId = "project-65793168-a509-4f95-818",
    [string]$Region = "southamerica-east1",
    [string]$Service = "luxtime-api"
)

function Set-GcpSecret {
    param([string]$Name, [string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Host "  SKIP $Name (vacío)" -ForegroundColor DarkGray
        return
    }

    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Value | gcloud secrets create $Name --data-file=- --project=$ProjectId 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $Value | gcloud secrets versions add $Name --data-file=- --project=$ProjectId 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "No se pudo guardar el secreto $Name"
            }
        }
        Write-Host "  OK   $Name" -ForegroundColor Green
    } finally {
        $ErrorActionPreference = $prev
    }
}

Write-Host "=== Cloudinary -> Secret Manager ===" -ForegroundColor Cyan
$cloudName = Read-Host "CLOUDINARY_CLOUD_NAME"
$apiKey    = Read-Host "CLOUDINARY_API_KEY"
$apiSecret = Read-Host "CLOUDINARY_API_SECRET"

$secrets = [ordered]@{
    CLOUDINARY_CLOUD_NAME = $cloudName
    CLOUDINARY_API_KEY    = $apiKey
    CLOUDINARY_API_SECRET = $apiSecret
}

foreach ($name in $secrets.Keys) {
    Set-GcpSecret -Name $name -Value $secrets[$name]
}

$projectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
$runSa = "$projectNumber-compute@developer.gserviceaccount.com"
$githubSa = "github-actions-deploy@$ProjectId.iam.gserviceaccount.com"

foreach ($name in $secrets.Keys) {
    if ([string]::IsNullOrWhiteSpace($secrets[$name])) { continue }
    gcloud secrets add-iam-policy-binding $name `
        --member="serviceAccount:$runSa" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId 2>&1 | Out-Null
    gcloud secrets add-iam-policy-binding $name `
        --member="serviceAccount:$githubSa" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId 2>&1 | Out-Null
}

Write-Host "`n=== Actualizar Cloud Run ===" -ForegroundColor Cyan
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    gcloud run services update $Service `
        --region $Region `
        --project $ProjectId `
        --update-secrets "CLOUDINARY_CLOUD_NAME=CLOUDINARY_CLOUD_NAME:latest,CLOUDINARY_API_KEY=CLOUDINARY_API_KEY:latest,CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET:latest" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy de Cloud Run falló"
    }
} finally {
    $ErrorActionPreference = $prev
}

Write-Host "Listo. Sube fotos desde /admin/inventario." -ForegroundColor Green
