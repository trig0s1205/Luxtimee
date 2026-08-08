# Crea el job de Cloud Scheduler para recordatorios de pre-pedidos.
# Ejecutar DESPUÉS de que luxtime-api esté desplegado y funcionando.
# Uso: .\scripts\setup-cloud-scheduler.ps1 -ProjectId "tu-project-id" -ApiUrl "https://....run.app" -CronSecret "tu-cron-secret"

param(
    [Parameter(Mandatory)][string]$ProjectId,
    [Parameter(Mandatory)][string]$ApiUrl,
    [Parameter(Mandatory)][string]$CronSecret,
    [string]$Region    = "southamerica-east1",
    [string]$JobName   = "luxtimee-pre-order-reminders",
    [string]$Schedule  = "0 10 * * *"   # 10:00 AM todos los días (hora GCP = UTC; ajusta si necesitas hora Colombia UTC-5)
)

$TargetUrl = "$ApiUrl/api/v1/internal/cron/pre-order-reminders"

Write-Host "Habilitando Cloud Scheduler API..." -ForegroundColor Cyan
gcloud services enable cloudscheduler.googleapis.com --project=$ProjectId

Write-Host "Creando job '$JobName'..." -ForegroundColor Cyan
gcloud scheduler jobs create http $JobName `
    --location=$Region `
    --schedule=$Schedule `
    --uri=$TargetUrl `
    --http-method=POST `
    --headers="x-cron-secret=$CronSecret" `
    --time-zone="America/Bogota" `
    --project=$ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Job creado. Disparo manual de prueba:" -ForegroundColor Green
    gcloud scheduler jobs run $JobName --location=$Region --project=$ProjectId
    Write-Host "Revisa los logs en Cloud Run -> luxtime-api para confirmar que se ejecutó."
} else {
    Write-Host "El job ya existe o hubo un error. Para actualizarlo:" -ForegroundColor Yellow
    Write-Host "  gcloud scheduler jobs update http $JobName --schedule=`"$Schedule`" --location=$Region --project=$ProjectId"
}
