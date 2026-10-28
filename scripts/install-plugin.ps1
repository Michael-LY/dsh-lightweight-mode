param(
  [string]$ProfilePath = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
if (-not $DryRun) {
  $p = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
  if ($p) { Write-Error 'DSH Desktop is running. Quit it completely before installing the plugin.'; exit 2 }
}
$pkgPath = Join-Path $ProfilePath 'package.json'
if (-not (Test-Path $pkgPath)) { Write-Error "profile package.json not found: $pkgPath"; exit 3 }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$j = Get-Content $pkgPath -Raw | ConvertFrom-Json
$dep = 'file:' + ($ProjectRoot -replace '\\', '/')
if ($null -eq $j.dependencies) { $j | Add-Member -NotePropertyName dependencies -NotePropertyValue (New-Object PSObject) -Force }
$j.dependencies | Add-Member -NotePropertyName 'dsh-lightweight-mode' -NotePropertyValue $dep -Force
if ($null -eq $j.dsh) { $j | Add-Member -NotePropertyName dsh -NotePropertyValue (New-Object PSObject) -Force }
if ($null -eq $j.dsh.profile) { $j.dsh | Add-Member -NotePropertyName profile -NotePropertyValue (New-Object PSObject) -Force }
$bundles = @()
if ($j.dsh.profile.bundles) { $bundles = @($j.dsh.profile.bundles) }
if ($bundles -notcontains 'dsh-lightweight-mode') { $bundles += 'dsh-lightweight-mode' }
$j.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles -Force
$json = $j | ConvertTo-Json -Depth 30
if ($DryRun) { Write-Output '--- DRY RUN package.json ---'; Write-Output $json; exit 0 }
Copy-Item -LiteralPath $pkgPath -Destination ("$pkgPath.bak-lm-$stamp") -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($pkgPath, $json, $utf8)
$nm = Join-Path $ProfilePath 'node_modules'
if (-not (Test-Path $nm)) { New-Item -ItemType Directory -Force -Path $nm | Out-Null }
$link = Join-Path $nm 'dsh-lightweight-mode'
if (-not (Test-Path $link)) {
  cmd /c mklink /J "$link" "$ProjectRoot" | Out-Null
}
if (-not (Test-Path (Join-Path $link 'package.json'))) { Write-Error "link failed: $link"; exit 4 }
Write-Host "Plugin installed into profile. Restart DSH Desktop to load the sidebar settings panel."
Write-Host "Backup: $pkgPath.bak-lm-$stamp"
