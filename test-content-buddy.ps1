$ErrorActionPreference = "Stop"

function Check-Endpoint($name, $url) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 8
    Write-Host "[OK] $name -> $($resp.StatusCode) $url" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "[FAIL] $name -> $url" -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
    return $false
  }
}

function Check-Json($name, $url) {
  try {
    $raw = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
    $obj = $raw.Content | ConvertFrom-Json
    Write-Host "[OK] $name -> JSON received" -ForegroundColor Green
    return $obj
  } catch {
    Write-Host "[FAIL] $name -> JSON parse/read failed" -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
    return $null
  }
}

Write-Host "== Content Buddy Local System Test ==" -ForegroundColor Cyan

$uiOk = Check-Endpoint "UI" "http://localhost:3000"
$pipeHealth = Check-Json "Pipeline health" "http://localhost:3002/health"
$jobs = Check-Json "Pipeline jobs list" "http://localhost:3000/pipeline/jobs"
$schedules = Check-Json "Pipeline schedules list" "http://localhost:3000/pipeline/schedules"

Write-Host ""
if ($uiOk -and $pipeHealth -and $jobs -ne $null -and $schedules -ne $null) {
  Write-Host "PASS: Core services and proxy paths are reachable." -ForegroundColor Green
  Write-Host "Fallback note: if UI shows 502 for pipeline actions, pipeline process is down." -ForegroundColor Yellow
  exit 0
}

Write-Host "FAIL: One or more required checks failed." -ForegroundColor Red
Write-Host "Action: run start-content-buddy.bat, wait 10 seconds, then rerun this test." -ForegroundColor Yellow
exit 1
