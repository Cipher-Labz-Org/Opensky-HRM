# Publish OpenSky HRM API for IIS deployment (MBKH, Gamma, or any tenant site).
# Usage:
#   .\scripts\publish-iis.ps1 -OutputPath "C:\inetpub\mbkh-api"
#   .\scripts\publish-iis.ps1 -OutputPath "D:\publish\mbkh" -Environment Production

param(
    [Parameter(Mandatory = $true)]
    [string] $OutputPath,
    [string] $Environment = "Production"
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $backendRoot "OpenSkyHRM.Api\OpenSkyHRM.Api.csproj"

Write-Host "Publishing OpenSkyHRM.Api -> $OutputPath" -ForegroundColor Cyan

dotnet publish $apiProject -c Release -o $OutputPath /p:EnvironmentName=$Environment

$logsDir = Join-Path $OutputPath "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
    Write-Host "Created logs folder: $logsDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Next steps on the server:" -ForegroundColor Yellow
Write-Host "  1. Point IIS site physical path to: $OutputPath"
Write-Host "  2. App pool: .NET CLR = No Managed Code, 64-bit"
Write-Host "  3. Install ASP.NET Core 8 Hosting Bundle if not installed"
Write-Host "  4. Edit appsettings.json (Database=mbkh or gamma2, CORS frontend URL)"
Write-Host "  5. Recycle app pool"
Write-Host "  6. Test https://your-backend/swagger and /health"
Write-Host "  7. If 500: read $logsDir\stdout_*.log"
