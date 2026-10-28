param([int]$Seconds=0,[string]$Out="")
$end=(Get-Date).AddSeconds($Seconds)
do {
  $p=Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
  $total=[math]::Round((($p|Measure-Object WorkingSet64 -Sum).Sum)/1MB,1)
  $count=($p|Measure-Object).Count
  $line=(Get-Date -Format 'HH:mm:ss')+',total_mb='+$total+',procs='+$count
  if($Out){ Add-Content -Path $Out -Value $line }
  Write-Output $line
  if($Seconds -le 0){ break }
  Start-Sleep -Seconds 2
} while((Get-Date) -lt $end)
