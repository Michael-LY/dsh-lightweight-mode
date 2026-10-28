param(
  [string]$ProfilePath = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop')
)
$ErrorActionPreference = 'Stop'
$p = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
if ($p) { Write-Error 'DSH Desktop is running. Quit it completely first.'; exit 2 }
$pkgPath = Join-Path $ProfilePath 'package.json'
if (Test-Path $pkgPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $j = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if ($j.dependencies) { $j.dependencies.PSObject.Properties.Remove('dsh-lightweight-mode') }
  if ($j.dsh -and $j.dsh.profile -and $j.dsh.profile.bundles) {
    $j.dsh.profile.bundles = @($j.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-lightweight-mode' })
  }
  Copy-Item -LiteralPath $pkgPath -Destination ("$pkgPath.bak-lm-$stamp") -Force
  $json = $j | ConvertTo-Json -Depth 30
  [System.IO.File]::WriteAllText($pkgPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}
$link = Join-Path $ProfilePath 'node_modules\dsh-lightweight-mode'
if (Test-Path $link) {
  $item = Get-Item $link -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "$link" | Out-Null }
  else { Write-Warning "Not a junction, left in place: $link" }
}
Write-Host "Plugin removed from profile. Restart DSH Desktop."
