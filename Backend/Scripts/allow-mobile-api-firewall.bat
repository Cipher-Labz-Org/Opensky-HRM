@echo off
:: Right-click this file → Run as administrator
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0allow-mobile-api-firewall.ps1"
echo.
pause
