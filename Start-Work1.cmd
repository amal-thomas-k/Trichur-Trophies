@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-work1.ps1"
if errorlevel 1 (
  echo.
  echo Work1 did not finish normally. Read the message above.
  pause
)
endlocal
