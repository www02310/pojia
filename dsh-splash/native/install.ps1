# DSH 启动画面 — 一键安装
# 用法：双击 安装.cmd（推荐），或 powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$patcher = Join-Path $here 'apply-splash.mjs'

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkGray
Write-Host '   DeepSeek Harness 启动画面 — 安装' -ForegroundColor Cyan
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
  $cands = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    (Join-Path $env:LOCALAPPDATA 'DeepSeek Harness'),
    'C:\Program Files\DeepSeek Harness',
    'C:\Program Files (x86)\DeepSeek Harness'
  )
  foreach ($c in $cands) {
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

# 0) DSH 必须完全退出（Windows 无法替换被占用的 app.asar）
$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
if ($running) {
  Write-Host '  [需要退出] 检测到 DeepSeek Harness 正在运行。' -ForegroundColor Yellow
  Write-Host '  请右键托盘图标 →「退出」完全关闭（不是关窗口），然后重新运行本安装。' -ForegroundColor Yellow
  Write-Host ''
  exit 1
}

# 1) 找安装目录
$app = Find-AppDir
if (-not $app) {
  Write-Host '  [未自动找到] 请粘贴 DeepSeek Harness 安装目录（含 DeepSeek Harness.exe 的文件夹）：' -ForegroundColor Yellow
  $app = Read-Host '  目录'
  if ($app) { $app = $app.Trim().Trim('"').TrimEnd('\') }
}
if (-not $app -or -not (Test-Path (Join-Path $app 'DeepSeek Harness.exe'))) {
  Write-Host '  [失败] 目录无效，已退出，未做任何修改。' -ForegroundColor Red
  exit 1
}
Write-Host "  安装目录: $app" -ForegroundColor Gray

# 2) 找 node（优先用 DSH 自带的，互不依赖外部环境）
$node = Find-Node $app
if (-not $node) {
  Write-Host '  [失败] 找不到 node 运行时（DSH 自带的也缺失）。' -ForegroundColor Red
  exit 1
}

# 3) 写入权限自检（Program Files 安装需要管理员）
$asar = Join-Path $app 'resources\app.asar'
try {
  $fs = [System.IO.File]::Open($asar, 'Open', 'ReadWrite', 'None')
  $fs.Close()
} catch {
  Write-Host '  [失败] 没有写入权限。请右键 安装.cmd →「以管理员身份运行」后重试。' -ForegroundColor Red
  exit 1
}

# 4) 执行补丁
Write-Host ''
& $node $patcher $app
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '  [失败] 安装未完成（详见上方输出），未做任何修改或已自动回滚。' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkGray
Write-Host '   完成！启动 DeepSeek Harness 即可看到效果。' -ForegroundColor Green
Write-Host '  ============================================' -ForegroundColor DarkGray
Write-Host ''
$ans = Read-Host '  现在启动 DeepSeek Harness 吗？(Y/n)'
if ($ans -eq '' -or $ans -eq 'y' -or $ans -eq 'Y') {
  Start-Process -FilePath (Join-Path $app 'DeepSeek Harness.exe')
}
