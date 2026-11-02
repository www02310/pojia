# 1-extract-installer.ps1
# Purpose: deploy DeepSeek Harness from the official NSIS installer without
# running the interactive setup wizard.
#
# Why not just run the .exe? Because the official updater/installer fails on
# this machine at the "backup old directory" step (MoveFileExW -> Windows
# error 32) and leaves a half-written program directory with an empty
# resources\runtime, which makes the app crash on startup with
# ENOENT ... resources\runtime\office-skills\office\SKILL.md.
# Extracting the archive directly is deterministic and verifiable.
#
# Usage:
#   .\1-extract-installer.ps1                        # default target D:\deepseek harness
#   .\1-extract-installer.ps1 -Target "D:\ds"        # custom target
#   .\1-extract-installer.ps1 -Force                 # overwrite existing target

param(
    [string]$Target = "D:\deepseek harness",
    [string]$Installer = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ---- locate installer -------------------------------------------------------
if (-not $Installer) {
    $here = Split-Path -Parent $MyInvocation.MyCommand.Path
    $cand = Get-ChildItem -Path (Join-Path (Split-Path -Parent $here) "installer") -Filter "*.exe" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1
    if (-not $cand) {
        Write-Host "ERROR: no *.exe under .\installer" -ForegroundColor Red
        exit 1
    }
    $Installer = $cand.FullName
}
if (-not (Test-Path -LiteralPath $Installer)) {
    Write-Host "ERROR: installer not found: $Installer" -ForegroundColor Red
    exit 1
}

# ---- locate 7-Zip -----------------------------------------------------------
$sevenZip = $null
foreach ($p in @(
    "C:\Program Files\7-Zip\7z.exe",
    "C:\Program Files (x86)\7-Zip\7z.exe"
)) {
    if (Test-Path -LiteralPath $p) { $sevenZip = $p; break }
}
if (-not $sevenZip) {
    $cmd = Get-Command 7z -ErrorAction SilentlyContinue
    if ($cmd) { $sevenZip = $cmd.Source }
}
if (-not $sevenZip) {
    Write-Host "ERROR: 7-Zip not found. Install it or put 7z.exe on PATH." -ForegroundColor Red
    exit 1
}

Write-Host "=== DeepSeek Harness deploy ===" -ForegroundColor Cyan
Write-Host "installer : $Installer"
Write-Host "7z        : $sevenZip"
Write-Host "target    : $Target"

# ---- target checks ----------------------------------------------------------
if (Test-Path -LiteralPath $Target) {
    if (-not $Force) {
        Write-Host ""
        Write-Host "Target already exists: $Target" -ForegroundColor Yellow
        Write-Host "Re-run with -Force to overwrite, or rename it first:"
        Write-Host "  Move-Item -LiteralPath '$Target' -Destination '$Target.old'"
        exit 1
    }
    $running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -like "$Target\*" } catch { $false }
    })
    if ($running.Count -gt 0) {
        Write-Host "ERROR: $($running.Count) process(es) still running from that directory. Quit the app first." -ForegroundColor Red
        exit 1
    }
}

# ---- extract $PLUGINSDIR\app-64.7z -----------------------------------------
$work = Join-Path $env:TEMP "dsh-deploy"
if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
New-Item -ItemType Directory -Force -Path $work | Out-Null

Write-Host "extracting app-64.7z from installer..."
$inner = Join-Path $work "app-64.7z"
& $sevenZip e "$Installer" "-o$work" '$PLUGINSDIR/app-64.7z' -y | Out-Null
if (-not (Test-Path -LiteralPath $inner)) {
    Write-Host "ERROR: app-64.7z not found inside installer. Unexpected package layout." -ForegroundColor Red
    exit 1
}

# ---- unpack to target -------------------------------------------------------
if (-not (Test-Path -LiteralPath $Target)) {
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
}
Write-Host "unpacking to target..."
& $sevenZip x "$inner" "-o$Target" -y | Out-Null

# ---- verify -----------------------------------------------------------------
Write-Host ""
Write-Host "=== verify ===" -ForegroundColor Cyan
$checks = @(
    "DeepSeek Harness.exe",
    "version",
    "resources\app.asar",
    "resources\runtime\office-skills\office\SKILL.md",
    "resources\runtime\primary-runtime\dependencies\node"
)
$fail = 0
foreach ($c in $checks) {
    $full = Join-Path $Target $c
    if (Test-Path -LiteralPath $full) {
        Write-Host "OK   $c" -ForegroundColor Green
    } else {
        Write-Host "MISS $c" -ForegroundColor Red
        $fail++
    }
}

Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "FAILED: $fail check(s) missing. Do not launch yet." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done. Launch: $Target\DeepSeek Harness.exe" -ForegroundColor Green
