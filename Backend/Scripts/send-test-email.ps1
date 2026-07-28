# Sends a one-off SendGrid test email using appsettings.Local.json (gitignored).
# Usage: powershell -File .\Backend\Scripts\send-test-email.ps1 -To "recipient@example.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$To,
    [string]$Name = "Test recipient"
)

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\OpenSkyHRM.Api" | Resolve-Path
$localConfigPath = Join-Path $apiDir "appsettings.Local.json"
$devConfigPath = Join-Path $apiDir "appsettings.Development.json"

if (-not (Test-Path $localConfigPath)) {
    Write-Error "Missing appsettings.Local.json. Configure SendGrid:ApiKey first."
}

$local = Get-Content $localConfigPath -Raw | ConvertFrom-Json
$dev = if (Test-Path $devConfigPath) { Get-Content $devConfigPath -Raw | ConvertFrom-Json } else { $null }

$apiKey = $local.SendGrid.ApiKey
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Error "SendGrid:ApiKey is empty in appsettings.Local.json"
}

$fromEmail = if ($local.SendGrid.FromEmail) { $local.SendGrid.FromEmail } elseif ($dev.SendGrid.FromEmail) { $dev.SendGrid.FromEmail } else { "dlbn.work@gmail.com" }
$fromName = if ($local.SendGrid.FromName) { $local.SendGrid.FromName } elseif ($dev.SendGrid.FromName) { $dev.SendGrid.FromName } else { "OpenSky HRM" }

$timestamp = Get-Date -Format "dd MMM yyyy HH:mm"
$html = "<p>Hello $Name,</p><p>This is a dummy test email from OpenSky HRM to confirm SendGrid is working.</p><p>Sent at $timestamp (local time).</p>"

$payload = @{
    personalizations = @(
        @{
            to = @(@{ email = $To.Trim(); name = $Name })
        }
    )
    from    = @{ email = $fromEmail; name = $fromName }
    subject = "OpenSky HRM - SendGrid test email"
    content = @(@{ type = "text/html"; value = $html })
} | ConvertTo-Json -Depth 6

$response = Invoke-WebRequest `
    -Uri "https://api.sendgrid.com/v3/mail/send" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $($apiKey.Trim())" } `
    -ContentType "application/json" `
    -Body $payload `
    -UseBasicParsing

Write-Host "SUCCESS: SendGrid accepted the message (HTTP $($response.StatusCode))."
Write-Host "Recipient: $To"
Write-Host "From: $fromName ($fromEmail)"
