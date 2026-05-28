# Exposes local OpenSky API (port 5000) to the internet for app.adms.lk webhooks.
# Requires Node.js (for npx). Run in a separate terminal and keep it open.

Write-Host "Starting tunnel to http://localhost:5000 ..."
Write-Host ""
Write-Host "When you see a URL like https://xxxx.loca.lt"
Write-Host "set ADMS webhook to: https://xxxx.loca.lt/api/biometric/adms/logs"
Write-Host ""
Write-Host "Do NOT use localhost or /health"
Write-Host ""

npx --yes localtunnel --port 5000
