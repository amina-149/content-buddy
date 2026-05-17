@echo off
setlocal

set "PROJECT_DIR=%~dp0."
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

if not exist "%NPM_CMD%" (
  echo [ERROR] npm.cmd not found at:
  echo %NPM_CMD%
  echo Install Node.js LTS, then try again.
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"
echo Starting Content Buddy (UI + pipeline) in two terminals...

start "Content Buddy UI (3000)" cmd /k "cd /d \"%PROJECT_DIR%\" && call \"%NPM_CMD%\" run dev"
start "Content Buddy Pipeline (3002)" cmd /k "cd /d \"%PROJECT_DIR%\" && call \"%NPM_CMD%\" run dev --prefix pipeline-server"

echo.
echo Waiting for services to boot...
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo Launched.
echo Use stop-content-buddy.bat to stop project processes.
