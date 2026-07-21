# Saves your SendGrid API key so the API can send email using one key for all flows:
# leave confirmations, recruitment (new candidate application to HR inbox), interviews, offers.
# You must create a key once at https://app.sendgrid.com/settings/api_keys (Mail Send permission).
# Run from repo root:  .\Backend\Scripts\configure-sendgrid.ps1
# Or:  powershell -File .\Backend\Scripts\configure-sendgrid.ps1
#
# Key source order (first non-empty wins; copied into dotnet user-secrets as SendGrid:ApiKey):
#   1) SENDGRID_API_KEY — Process, then User, then Machine (same names the API reads at runtime)
#   2) SendGrid__ApiKey — Process, User, Machine (ASP.NET nested config env form)
# If none are set, you are prompted to paste the key (stored only in user secrets on this PC).

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\OpenSkyHRM.Api" | Resolve-Path

function Get-FirstSendGridKeyFromEnvironment {
    $names = @("SENDGRID_API_KEY", "SendGrid__ApiKey")
    $scopes = @("Process", "User", "Machine")
    foreach ($name in $names) {
        foreach ($scope in $scopes) {
            try {
                $v = [Environment]::GetEnvironmentVariable($name, $scope)
                if (-not [string]::IsNullOrWhiteSpace($v)) {
                    return @{ Value = $v.Trim(); Source = "$name ($scope)" }
                }
            } catch {
                # Machine scope can fail for non-elevated scripts; ignore
            }
        }
    }
    return $null
}

Set-Location $apiDir

$fromEnv = Get-FirstSendGridKeyFromEnvironment
if ($null -ne $fromEnv) {
    Write-Host "Using $($fromEnv.Source) — copying into dotnet user-secrets as SendGrid:ApiKey."
    dotnet user-secrets set "SendGrid:ApiKey" $fromEnv.Value
    Write-Host "Stored. Restart the API. Verify FromEmail as a SendGrid Single Sender (or domain auth) if mail bounces."
    exit 0
}

Write-Host "No SENDGRID_API_KEY or SendGrid__ApiKey found in Process, User, or Machine environment."
Write-Host "Paste your SendGrid API key (starts with SG.). It will be stored in dotnet user-secrets only on this machine."
Write-Host "Create a key: https://app.sendgrid.com/settings/api_keys"
$key = Read-Host "ApiKey"

if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "Aborted (empty key)."
    exit 1
}

$key = $key.Trim()
dotnet user-secrets set "SendGrid:ApiKey" $key
Write-Host ""
Write-Host "Done. User secrets are saved under this project."
Write-Host ""
Write-Host "INBOX DELIVERABILITY (avoid spam folder):"
Write-Host "  1. SendGrid -> Settings -> Sender Authentication -> authenticate your COMPANY DOMAIN (SPF + DKIM)."
Write-Host "     Use hr@yourcompany.com — not a personal Gmail address."
Write-Host "  2. If you must use Gmail: verify Single Sender for that exact address in SendGrid."
Write-Host "  3. Set SendGrid:FromEmail and SendGrid:ReplyTo to the same verified address in appsettings.Local.json."
Write-Host "  4. Ask the first recipient to mark 'Not spam' once; Gmail learns from that."
Write-Host "Restart the API (stop dotnet run, then start again)."
