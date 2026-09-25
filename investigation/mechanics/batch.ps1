param([string]$Seeds = '1-30')
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskRepo = [IO.Path]::GetFullPath((Join-Path $taskRoot '..\..'))
$taskThemes = @('riverValley', 'canyon', 'highlands', 'lakeBasin', 'delta', 'islands')
$taskFailed = 0
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'results\logs') | Out-Null
Push-Location $taskRepo
try {
  foreach ($taskTheme in $taskThemes) {
    $env:MECHANICS_THEME = $taskTheme
    Write-Output "Generating $taskTheme seeds $Seeds via tools/gen.ts"
    node --experimental-transform-types --disable-warning=ExperimentalWarning --import ./investigation/mechanics/runtime.mjs ./tools/gen.ts --seeds $Seeds --sizes 128 --difficulty normal --out "investigation/mechanics/results/maps/$taskTheme" 2>&1 | Tee-Object -FilePath "investigation/mechanics/results/logs/$taskTheme.txt"
    if ($LASTEXITCODE -ne 0) { $taskFailed++ }
  }
} finally {
  Remove-Item Env:MECHANICS_THEME -ErrorAction SilentlyContinue
  Pop-Location
}
if ($taskFailed) { throw "$taskFailed theme batches failed; keep their failure rows" }
