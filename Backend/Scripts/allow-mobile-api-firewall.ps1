# Run as Administrator so phones on the same Wi-Fi can reach local Kestrel (:5000).
# Usage: Right-click PowerShell → Run as administrator → .\allow-mobile-api-firewall.ps1

$ErrorActionPreference = "Stop"
$ruleName = "OpenSky HRM API 5000"

# Remove prior allow rules for this helper.
netsh advfirewall firewall delete rule name="$ruleName" | Out-Null

# Visual Studio / Windows "Allow access" prompt sometimes creates per-app BLOCK rules
# named after the exe (e.g. "OpenSkyHRM.Api") on the Public profile. Those override
# port allows and block phones on the same Wi-Fi.
$blockRules = Get-NetFirewallRule -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Enabled -eq $true -and
    $_.Direction -eq "Inbound" -and
    $_.Action -eq "Block" -and
    (
      $_.DisplayName -like "*OpenSkyHRM.Api*" -or
      $_.DisplayName -like "*OpenSky HRM*" -or
      $_.Name -like "*OpenSkyHRM*"
    )
  }

foreach ($rule in $blockRules) {
  Write-Host "Removing inbound BLOCK rule: $($rule.DisplayName) ($($rule.Name))"
  Remove-NetFirewallRule -Name $rule.Name -ErrorAction SilentlyContinue
}

netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=5000 profile=any

Write-Host "OK: inbound TCP 5000 allowed ($ruleName)."
Write-Host "Phone and PC must share the same Wi-Fi. QR URL should look like http://<your-lan-ip>:5000"
