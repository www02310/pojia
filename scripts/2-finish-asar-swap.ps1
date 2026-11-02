# finish-dsh-purge-swap.ps1
# Purpose: finish the dsh-purge asar swap that the UI aborted on timeout.
# The patches are already written into resources\app. Electron still loads
# resources\app.asar (asar wins over the app folder), so the asar must be
# moved aside while the harness is fully closed.
#
# Run this AFTER quitting DeepSeek Harness completely (tray -> Quit).

$ErrorActionPreference = "Continue"

$res    = "D:\deepseek harness\resources"
$asar   = Join-Path $res "app.asar"
$bak    = Join-Path $res "app.asar.bak"
$lock   = Join-Path $res "app.asar.rename-pending"
$appDir = Join-Path $res "app"
$exe    = "D:\deepseek harness\DeepSeek Harness.exe"

Write-Host "=== dsh-purge asar swap ===" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $appDir)) {
    Write-Host "ABORT: $appDir not found. Nothing to switch to." -ForegroundColor Red
    exit 1
}

$entry = Join-Path $appDir "package.json"
if (-not (Test-Path -LiteralPath $entry)) {
    Write-Host "ABORT: app\package.json missing, unpack incomplete." -ForegroundColor Red
    exit 1
}

function Get-HarnessProcs {
    @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -eq $exe } catch { $false }
    })
}

$running = Get-HarnessProcs
if ($running.Count -gt 0) {
    Write-Host "DeepSeek Harness is still running ($($running.Count) processes)." -ForegroundColor Yellow
    Write-Host "Quit it completely first: right-click the tray icon -> Quit."
    Write-Host "Waiting up to 10 minutes for it to exit..."
    $deadline = (Get-Date).AddMinutes(10)
    while ((Get-Date) -lt $deadline) {
        if ((Get-HarnessProcs).Count -eq 0) { break }
        Start-Sleep -Milliseconds 500
    }
    $still = Get-HarnessProcs
    if ($still.Count -gt 0) {
        Write-Host "ABORT: harness still running. Quit it, then run this script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Harness closed. Swapping asar..."

if (Test-Path -LiteralPath $asar) {
    if (Test-Path -LiteralPath $bak) {
        Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue
    }
    $moved = $false
    for ($i = 0; $i -lt 20; $i++) {
        try {
            Move-Item -LiteralPath $asar -Destination $bak -Force -ErrorAction Stop
            $moved = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $moved) {
        Write-Host "ABORT: app.asar is still locked. Something is holding it." -ForegroundColor Red
        Write-Host "Check Task Manager for leftover DeepSeek Harness processes."
        exit 1
    }
    Write-Host "Renamed app.asar -> app.asar.bak" -ForegroundColor Green
} else {
    Write-Host "app.asar already moved; nothing to do."
}

Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
Write-Host "Lock cleared."

if (Test-Path -LiteralPath $exe) {
    Write-Host "Starting DeepSeek Harness..."
    Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
    Write-Host "Done. Patches should now be active." -ForegroundColor Green
} else {
    Write-Host "Done. EXE not found, start the harness manually." -ForegroundColor Yellow
}
