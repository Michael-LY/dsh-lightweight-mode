param(
  [string]$Asar = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app.asar",
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = "Stop"
$procs = Get-Process -Name "DeepSeek Harness" -ErrorAction SilentlyContinue
if ($procs) {
  Write-Error "DSH Desktop is running. Quit it completely (tray icon -> Quit) before installing."
  exit 2
}
$kernel = Join-Path $ProjectRoot "lib\patch\kernel.js"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectRoot ("backups\" + $stamp)
$state = Join-Path $ProjectRoot "state\patch-state.json"
python (Join-Path $ProjectRoot "scripts\apply_patch.py") --asar $Asar --kernel $kernel --backup-dir $backup --state-file $state
if ($LASTEXITCODE -ne 0) { Write-Error "apply_patch failed with code $LASTEXITCODE"; exit $LASTEXITCODE }
python (Join-Path $ProjectRoot "scripts\verify_patch.py") --asar $Asar
if ($LASTEXITCODE -ne 0) { Write-Error "verify_patch failed"; exit $LASTEXITCODE }
$cfgDir = Join-Path $env:USERPROFILE ".dsh"
$cfg = Join-Path $cfgDir "lightweight-mode.json"
if (-not (Test-Path $cfg)) {
  New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
  $json = '{"enabled":true,"delaySeconds":30,"mode":"auto"}
  [System.IO.File]::WriteAllText($cfg, $json, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Host "Install OK. Restart DSH Desktop to activate. Rollback: scripts\uninstall.ps1"