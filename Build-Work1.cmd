@echo off
setlocal
rem Set telemetry opt-outs BEFORE starting any PowerShell process.
set "POWERSHELL_TELEMETRY_OPTOUT=1"
set "DOTNET_CLI_TELEMETRY_OPTOUT=1"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-work1.ps1"
set "WORK1_EXIT=%ERRORLEVEL%"
echo.
if not "%WORK1_EXIT%"=="0" echo Work1 did not complete. Read the error above; existing saved work is retained.
pause
exit /b %WORK1_EXIT%
