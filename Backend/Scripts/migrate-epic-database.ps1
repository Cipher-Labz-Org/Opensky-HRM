# Apply pending EF Core migrations to the epic PostgreSQL database.
# Run from repo root or Backend folder on the machine where PostgreSQL epic DB lives.

$ErrorActionPreference = "Stop"

$connection = "Host=localhost;Port=5432;Database=epic;Username=postgres;Password=postgres"
$env:ConnectionStrings__DefaultConnection = $connection
$env:ConnectionStrings__HangfireConnection = $connection
$env:Hangfire__ResetSchemaOnStartup = "false"

Push-Location (Join-Path $PSScriptRoot "..")
try {
    Write-Host "Applying migrations to database 'epic'..." -ForegroundColor Cyan
    dotnet ef database update --project OpenSkyHRM.Persistence --startup-project OpenSkyHRM.Api
    Write-Host "Done. Recycle the Epic IIS app pool and retry login." -ForegroundColor Green
}
finally {
    Pop-Location
}
