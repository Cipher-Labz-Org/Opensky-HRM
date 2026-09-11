@echo off
setlocal EnableExtensions
title Paste OpenSky HRM binaries onto one company site
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo Drag a company folder onto this file, or run:
  echo   PASTE-TO-SITE.bat "C:\inetpub\StageCafe"
  echo   PASTE-TO-SITE.bat "C:\Users\asus\OneDrive\Desktop\gamma"
  echo.
  echo Copies EVERY dll/exe from this pack ^(the Stage Cafe break was old leftover dlls^).
  echo Does NOT overwrite appsettings, keys, logs, uploads, or wwwroot.
  echo.
  pause
  exit /b 1
)

set "DEST=%~1"
if not exist "%DEST%\" (
  echo Destination not found: %DEST%
  pause
  exit /b 1
)

echo From: %CD%
echo To:   %DEST%
echo.

robocopy "%CD%" "%DEST%" /E /IS /IT /R:2 /W:2 /NFL /NDL /NP ^
  /XF appsettings.json appsettings.*.json *.log ^
  /XD keys logs uploads wwwroot

echo.
echo robocopy exit %ERRORLEVEL% ^(0-7 is OK^)
echo Recycle that company's IIS app pool, then open its /health URL.
echo.
pause
endlocal
