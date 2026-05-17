@echo off
setlocal

echo Stopping Content Buddy node processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$targets = Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -match 'content-buddy' -or $_.CommandLine -match 'vite' -or $_.CommandLine -match 'index.mjs' }; foreach($p in $targets){ try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Host ('Stopped PID ' + $p.ProcessId) } catch {} }"

echo Done.
timeout /t 2 /nobreak >nul
