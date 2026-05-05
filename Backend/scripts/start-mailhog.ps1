# Starts MailHog (Docker) for local SMTP — no SendGrid required.
# Web UI: http://localhost:8025  (all outbound mail appears here)

$ErrorActionPreference = "Stop"
$compose = Join-Path $PSScriptRoot "..\docker-compose.mailhog.yml" | Resolve-Path
docker compose -f $compose.FullName up -d
Write-Host "MailHog is running. Open http://localhost:8025 to see messages."
Write-Host "Start API with:  dotnet run --project Backend\OpenSkyHRM.Api\OpenSkyHRM.Api.csproj --launch-profile http-MailHog"
