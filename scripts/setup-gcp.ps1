# Fase 2: preparar GCP para Cloud Run y Artifact Registry.
# Uso: .\scripts\setup-gcp.ps1 -ProjectId "tu-project-id"

param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "southamerica-east1",
    [string]$Repository = "luxtime"
)

$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $gcloud)) {
    $gcloud = "gcloud"
}

Write-Host "=== Fase 2: GCP setup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId | Region: $Region" -ForegroundColor Gray

& $gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Habilitando APIs..." -ForegroundColor Cyan
& $gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    cloudscheduler.googleapis.com `
    --project=$ProjectId

Write-Host "Creando repositorio Docker '$Repository'..." -ForegroundColor Cyan
& $gcloud artifacts repositories describe $Repository `
    --location=$Region `
    --project=$ProjectId 2>$null

if ($LASTEXITCODE -ne 0) {
    & $gcloud artifacts repositories create $Repository `
        --repository-format=docker `
        --location=$Region `
        --description="LuxTimee images" `
        --project=$ProjectId
} else {
    Write-Host "  Repo '$Repository' ya existe." -ForegroundColor Yellow
}

Write-Host "Configurando permisos Cloud Build..." -ForegroundColor Cyan
$projectNumber = & $gcloud projects describe $ProjectId --format="value(projectNumber)"
$cloudBuildSa = "${projectNumber}@cloudbuild.gserviceaccount.com"
$computeSa = "${projectNumber}-compute@developer.gserviceaccount.com"
$buildRoles = @(
    "roles/artifactregistry.writer",
    "roles/logging.logWriter",
    "roles/storage.admin",
    "roles/run.admin",
    "roles/iam.serviceAccountUser"
)
foreach ($sa in @($cloudBuildSa, $computeSa)) {
    foreach ($role in $buildRoles) {
        & $gcloud projects add-iam-policy-binding $ProjectId `
            --member="serviceAccount:$sa" `
            --role=$role `
            --condition=None 2>$null | Out-Null
    }
}

Write-Host "Configurando Docker auth..." -ForegroundColor Cyan
& $gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet
& $gcloud auth application-default set-quota-project $ProjectId 2>$null

Write-Host ""
Write-Host "=== Verificación ===" -ForegroundColor Cyan
$currentProject = & $gcloud config get-value project 2>$null
Write-Host "  Project activo: $currentProject" -ForegroundColor Green
& $gcloud artifacts repositories list --location=$Region --project=$ProjectId

Write-Host ""
Write-Host "Fase 2 lista. Siguiente: .\scripts\deploy-image-service.ps1 -ProjectId `"$ProjectId`"" -ForegroundColor Green
