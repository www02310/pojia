# 3-apply-patches.ps1
# Purpose: unpack the host asar (if needed) and apply all dsh-purge patches
# through the CLI, deliberately bypassing the UI "Apply" button.
#
# Why not the UI: while the backend unpacks a 179MB asar and writes ~85
# patches, the Node main thread blocks. The renderer polls status every 5s
# with a 60s timeout, aborts, shows "读取失败: timeout", and - critically -
# never sends the follow-up restart+swap request. The patches do land, but you
# are left thinking it failed and the asar swap never happens.
#
# Usage:
#   .\3-apply-patches.ps1
#   .\3-apply-patches.ps1 -Target "D:\deepseek harness"

param(
    [string]$Target = "D:\deepseek harness",
    [string]$DshHome = ""
)

$ErrorActionPreference = "Stop"

if (-not $DshHome) {
    if ($env:DSH_HOME -and (Test-Path $env:DSH_HOME)) { $DshHome = $env:DSH_HOME }
    else { $DshHome = Join-Path $env:USERPROFILE ".dsh" }
}

$profileDir = Join-Path $DshHome "profiles\desktop"
$purgeLib   = Join-Path $profileDir "node_modules\dsh-purge\lib\extract-asar.js"
$purgeBin   = Join-Path $profileDir "node_modules\dsh-purge\bin\dsh-purge.js"

if (-not (Test-Path $purgeBin)) {
    Write-Host "ERROR: dsh-purge not installed. Run .\2-deploy-plugins.ps1 first." -ForegroundColor Red
    exit 1
}

$res    = Join-Path $Target "resources"
$asar   = Join-Path $res "app.asar"
$appDir = Join-Path $res "app"

if (-not (Test-Path $res)) {
    Write-Host "ERROR: $res not found. Wrong -Target?" -ForegroundColor Red
    exit 1
}

Write-Host "=== apply dsh-purge patches ===" -ForegroundColor Cyan
Write-Host "target : $Target"
Write-Host "profile: $profileDir"

# ---- 1. ensure resources\app exists ----------------------------------------
if (Test-Path (Join-Path $appDir "package.json")) {
    Write-Host "host already unpacked (resources\app present), skipping extract" -ForegroundColor Green
} elseif (Test-Path $asar) {
    Write-Host "unpacking app.asar -> resources\app ..."
    $tmp = Join-Path $env:TEMP ("dsh-unpack-" + [Guid]::NewGuid().ToString("N") + ".mjs")
    $script = @"
const m = await import('file:///$($purgeLib -replace '\\','/')');
const asar = '$($asar -replace '\\','/')';
const dest = '$($appDir -replace '\\','/')';
const n = m.extractAsar(asar, dest);
const ov = m.overlayAsarUnpacked(asar, dest);
console.log('entries=' + n + ' unpacked=' + JSON.stringify(ov));
"@
    Set-Content -LiteralPath $tmp -Value $script -Encoding UTF8
    try {
        & node $tmp
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
    if (-not (Test-Path (Join-Path $appDir "package.json"))) {
        Write-Host "ERROR: extract failed, resources\app\package.json missing." -ForegroundColor Red
        exit 1
    }
    $count = (Get-ChildItem -Path $appDir -Recurse -File -ErrorAction SilentlyContinue).Count
    Write-Host "unpacked: $count files" -ForegroundColor Green
} else {
    Write-Host "ERROR: neither resources\app nor resources\app.asar exists." -ForegroundColor Red
    Write-Host "If you already swapped the asar (app.asar.bak), the host is running in"
    Write-Host "unpacked mode - re-run this script after confirming resources\app is intact."
    exit 1
}

# ---- 2. run CLI apply -------------------------------------------------------
$base = Join-Path $appDir "dsh\node_modules\@deepseek-ai"
if (-not (Test-Path $base)) {
    Write-Host "ERROR: $base not found - unpack incomplete." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "applying patches via CLI (this takes a while)..."
$env:DSH_BASE = $base
Push-Location $profileDir
try {
    & node $purgeBin --apply
} finally {
    Pop-Location
    Remove-Item Env:\DSH_BASE -ErrorAction SilentlyContinue
}

# ---- 3. summary -------------------------------------------------------------
Write-Host ""
Write-Host "=== summary ===" -ForegroundColor Cyan
$env:DSH_BASE = $base
Push-Location $profileDir
try {
    & node $purgeBin --status | Select-String -Pattern "补丁 \d+/\d+" | ForEach-Object { $_.Line.Trim() }
} finally {
    Pop-Location
    Remove-Item Env:\DSH_BASE -ErrorAction SilentlyContinue
}

$bakCount = (Get-ChildItem -Path $appDir -Recurse -Filter "*.dshpurge.bak" -File -ErrorAction SilentlyContinue).Count
Write-Host "backup files: $bakCount"
Write-Host ""
Write-Host "Done. NEXT STEP IS REQUIRED:" -ForegroundColor Yellow
Write-Host "  Quit DeepSeek Harness COMPLETELY (tray -> Quit), then run:"
Write-Host "    .\4-finish-asar-swap.ps1" -ForegroundColor Green
Write-Host "  Without the swap, Electron keeps loading app.asar and NONE of these"
Write-Host "  patches take effect."
