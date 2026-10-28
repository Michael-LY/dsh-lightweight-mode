param(
  [string]$Asar = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app.asar",
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = "Stop"
$procs = Get-Process -Name "DeepSeek Harness" -ErrorAction SilentlyContinue
if ($procs) {
  Write-Error "DSH Desktop is running. Quit it completely before uninstalling."
  exit 2
}
$state = Join-Path $ProjectRoot "state\patch-state.json"
python (Join-Path $ProjectRoot "scripts\rollback_patch.py") --asar $Asar --state-file $state
if ($LASTEXITCODE -ne 0) { Write-Error "rollback failed with code $LASTEXITCODE"; exit $LASTEXITCODE }
Write-Host "Rollback OK. DSH Desktop is back to the original app.asar."
