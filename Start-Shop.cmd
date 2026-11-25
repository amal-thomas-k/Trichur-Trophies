@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-shop.ps1" %*
set "shopExit=%ERRORLEVEL%"
if not "%shopExit%"=="0" (
    echo.
    echo Shop did not start. Read the message above; no existing service was stopped.
    pause
)
exit /b %shopExit%
