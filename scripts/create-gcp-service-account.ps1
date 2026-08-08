# Crea la service account de GCP para GitHub Actions CI/CD.
# Ejecutar UNA sola vez, después de completar Fase 2.
# Uso: .\scripts\create-gcp-service-account.ps1 -ProjectId "tu-project-id"

param(
    [Parameter(Mandatory)][string]$ProjectId
)

$SA_NAME   = "github-actions-deploy"
$SA_EMAIL  = "$SA_NAME@$ProjectId.iam.gserviceaccount.com"
$KEY_FILE  = "gcp-sa-key.json"

Write-Host "Creando service account '$SA_NAME'..." -ForegroundColor Cyan
gcloud iam service-accounts create $SA_NAME `
    --display-name="GitHub Actions Deploy" `
    --project=$ProjectId

Write-Host "Asignando roles..." -ForegroundColor Cyan
$roles = @(
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/cloudbuild.builds.builder",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountUser"
)
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SA_EMAIL" `
        --role=$role | Out-Null
    Write-Host "  OK $role" -ForegroundColor Green
}

Write-Host "Generando clave JSON..." -ForegroundColor Cyan
gcloud iam service-accounts keys create $KEY_FILE `
    --iam-account=$SA_EMAIL `
    --project=$ProjectId

Write-Host ""
Write-Host "Clave guardada en: $KEY_FILE" -ForegroundColor Yellow
Write-Host "IMPORTANTE: Añade el contenido de '$KEY_FILE' como GitHub Secret 'GCP_SA_KEY'." -ForegroundColor Yellow
Write-Host "Añade tambien '$ProjectId' como GitHub Secret 'GCP_PROJECT_ID'." -ForegroundColor Yellow
Write-Host ""
Write-Host "En GitHub: Settings → Secrets and variables → Actions → New repository secret"
Write-Host ""
Write-Host "BORRA '$KEY_FILE' de tu disco después de añadirlo a GitHub!" -ForegroundColor Red
