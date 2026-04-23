# Copies appsettings.Local.example.json to appsettings.Local.json so the API uses local MailHog SMTP (127.0.0.1:1025).
# Start MailHog first:  .\Backend\scripts\start-mailhog.ps1  (requires Docker)
# Or run from Backend: docker compose -f docker-compose.mailhog.yml up -d

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\OpenSkyHRM.Api" | Resolve-Path
$example = Join-Path $apiDir "appsettings.Local.example.json"
$target = Join-Path $apiDir "appsettings.Local.json"

if (Test-Path $target) {
    Write-Host "appsettings.Local.json already exists — leaving it unchanged."
    exit 0
}

Copy-Item $example $target
Write-Host "Created $target — local SMTP points at MailHog (127.0.0.1:1025)."
Write-Host "Run MailHog (Docker), then start the API normally (appsettings.Local.json overrides SendGrid when Smtp:Host is set)."
