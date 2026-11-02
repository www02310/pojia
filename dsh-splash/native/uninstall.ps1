# DSH 启动画面 — 卸载（还原原始 app.asar）
# 用法：双击 卸载.cmd（推荐），或 powershell -ExecutionPolicy Bypass -File uninstall.ps1

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$patcher = Join-Path $here 'apply-splash.mjs'

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkGray
Write-Host '   DeepSeek Harness 启动画面 — 卸载' -ForegroundColor Cyan
Write-Host '  ============================================' -ForegroundColor DarkGray
Write-Host ''

function Find-AppDir {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($r in $roots) {
    $p = Get-ItemProperty $r -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like 'DeepSeek Harness*' -and $_.InstallLocation } |
      Select-Object -First 1
    if ($p) { return $p.InstallLocation.TrimEnd('\') }
  }
  foreach ($c in @((Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'), 'C:\Program Files\DeepSeek Harness')) {
    if ($c -and (Test-Path (Join-Path $c 'DeepSeek Harness.exe'))) { return $c }
  }
  return $null
}

function Find-Node([string]$app) {
  $bundled = Join-Path $app 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
  if (Test-Path $bundled) { return $bundled }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
if ($running) {
  Write-Host '  [需要退出] 检测到 DeepSeek Harness 正在运行，请先完全退出（托盘右键 → 退出）。' -ForegroundColor Yellow
  exit 1
}

$app = Find-AppDir
if (-not $app) {
  Write-Host '  [未自动找到] 请粘贴 DeepSeek Harness 安装目录：' -ForegroundColor Yellow
  $app = Read-Host '  目录'
  if ($app) { $app = $app.Trim().Trim('"').TrimEnd('\') }
}
if (-not $app -or -not (Test-Path (Join-Path $app 'DeepSeek Harness.exe'))) {
  Write-Host '  [失败] 目录无效，已退出。' -ForegroundColor Red
  exit 1
}

$node = Find-Node $app
if (-not $node) {
  Write-Host '  [失败] 找不到 node 运行时。' -ForegroundColor Red
  exit 1
}

& $node $patcher --restore $app
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '  [失败] 还原未完成（详见上方输出）。' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '  已还原。启动画面已移除，其余功能不受影响。' -ForegroundColor Green
