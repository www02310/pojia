# 2-deploy-plugins.ps1
# Purpose: install BOTH bundled plugins (dsh-purge + dsh-splash) into the
# desktop profile in one shot: copy sources, register deps + bundles, run
# pnpm install.
#
# Idempotent: safe to re-run. Existing plugin entries are preserved; only the
# two managed entries are added/updated.
#
# Usage:
#   .\2-deploy-plugins.ps1
#   .\2-deploy-plugins.ps1 -DshHome "C:\Users\me\.dsh"

param(
    [string]$DshHome = ""
)

$ErrorActionPreference = "Stop"

# ---- resolve repo root ------------------------------------------------------
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
if (-not (Test-Path (Join-Path $repo "dsh-purge\package.json"))) {
    Write-Host "ERROR: cannot find dsh-purge\package.json under $repo" -ForegroundColor Red
    exit 1
}

# ---- resolve DSH_HOME -------------------------------------------------------
if (-not $DshHome) {
    if ($env:DSH_HOME -and (Test-Path $env:DSH_HOME)) {
        $DshHome = $env:DSH_HOME
    } else {
        $DshHome = Join-Path $env:USERPROFILE ".dsh"
    }
}
$pluginsDir = Join-Path $DshHome "plugins"
$profileDir = Join-Path $DshHome "profiles\desktop"
$pkgPath    = Join-Path $profileDir "package.json"

Write-Host "=== deploy plugins ===" -ForegroundColor Cyan
Write-Host "DSH_HOME : $DshHome"
Write-Host "plugins  : $pluginsDir"
Write-Host "profile  : $profileDir"

if (-not (Test-Path $profileDir)) {
    Write-Host "ERROR: profile not found. Launch DeepSeek Harness once so it creates profiles\desktop." -ForegroundColor Red
    exit 1
}

# ---- 1. copy plugin sources -------------------------------------------------
New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null

$plugins = @(
    @{ Name = "dsh-purge"; Src = Join-Path $repo "dsh-purge" },
    @{ Name = "dsh-splash"; Src = Join-Path $repo "dsh-splash" }
)

foreach ($p in $plugins) {
    $dst = Join-Path $pluginsDir $p.Name
    if (-not (Test-Path $p.Src)) {
        Write-Host "ERROR: source missing: $($p.Src)" -ForegroundColor Red
        exit 1
    }
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
    Copy-Item -LiteralPath $p.Src -Destination $dst -Recurse -Force
    $ver = "?"
    try { $ver = (Get-Content (Join-Path $dst "package.json") -Raw | ConvertFrom-Json).version } catch {}
    Write-Host ("  copied {0,-12} v{1}" -f $p.Name, $ver) -ForegroundColor Green
}

# ---- 2. register in profile package.json ------------------------------------
if (Test-Path $pkgPath) {
    $backup = "$pkgPath.bak-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $pkgPath -Destination $backup
    Write-Host "  backup: $(Split-Path -Leaf $backup)"
    $pj = Get-Content $pkgPath -Raw | ConvertFrom-Json
} else {
    Write-Host "  profile package.json missing; creating a minimal one" -ForegroundColor Yellow
    $pj = [pscustomobject]@{
        name         = "dsh-profile-desktop"
        private      = $true
        dependencies = [pscustomobject]@{}
        dsh          = [pscustomobject]@{
            profile = [pscustomobject]@{
                bundles = @("@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app")
            }
        }
    }
}

if (-not $pj.dependencies) {
    $pj | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force
}
foreach ($p in $plugins) {
    $spec = "file:../../plugins/$($p.Name)"
    $existing = $pj.dependencies.PSObject.Properties[$p.Name]
    if ($existing) { $existing.Value = $spec }
    else { $pj.dependencies | Add-Member -NotePropertyName $p.Name -NotePropertyValue $spec -Force }
}

if (-not $pj.dsh -or -not $pj.dsh.profile) {
    Write-Host "ERROR: package.json has no dsh.profile section; fix it manually." -ForegroundColor Red
    exit 1
}

$bundles = [System.Collections.ArrayList]@()
foreach ($b in $pj.dsh.profile.bundles) { [void]$bundles.Add([string]$b) }

# dsh-splash should load before dsh-purge (splash injects the overlay early)
foreach ($name in @("dsh-splash", "dsh-purge")) {
    if ($bundles -notcontains $name) { [void]$bundles.Add($name) }
}
$pj.dsh.profile.bundles = $bundles.ToArray()

$pj | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $pkgPath -Encoding UTF8
Write-Host "  package.json updated (2 deps + 2 bundles)" -ForegroundColor Green

# ---- 3. pnpm install --------------------------------------------------------
$pnpm = Join-Path $DshHome "dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs"
if (-not (Test-Path $pnpm)) {
    Write-Host "ERROR: bundled pnpm not found at $pnpm" -ForegroundColor Red
    Write-Host "Launch DeepSeek Harness once (it materializes the runtime), then re-run."
    exit 1
}

Write-Host "running pnpm install..."
Push-Location $profileDir
try {
    & node $pnpm install --reporter=append-only
} finally {
    Pop-Location
}

# ---- 4. verify --------------------------------------------------------------
Write-Host ""
Write-Host "=== verify ===" -ForegroundColor Cyan
$fail = 0
foreach ($p in $plugins) {
    $link = Join-Path $profileDir "node_modules\$($p.Name)\package.json"
    if (Test-Path $link) {
        Write-Host "OK   node_modules\$($p.Name)" -ForegroundColor Green
    } else {
        Write-Host "MISS node_modules\$($p.Name)" -ForegroundColor Red
        $fail++
    }
}

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "FAILED: plugin did not land in node_modules. Check pnpm output above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done. Next: .\3-apply-patches.ps1" -ForegroundColor Green
Write-Host "  (patches are applied via CLI on purpose - the UI 'Apply' button times out"
Write-Host "   while the backend unpacks a 179MB asar, see docs/SETUP.md)"
