$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $manifest = Get-Content -LiteralPath 'results/weather/build.json' -Raw | ConvertFrom-Json
    $auditRoot = Join-Path $PSScriptRoot '.work/weather/current-dev'
    New-Item -ItemType Directory -Path $auditRoot -Force | Out-Null
    $archive = Join-Path $PSScriptRoot '.work/weather/current-dev.tar'
    $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    git -C $repo archive --format=tar --output=$archive $manifest.reference src/core investigation/cycles
    if ($LASTEXITCODE -ne 0) { throw 'Could not archive the pinned current-dev source' }
    tar -xf $archive -C $auditRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract the pinned source under .work' }
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.work/weather/current-dev-reference.txt'), $manifest.reference)
    node weather-audit.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Source audit failed' }
} finally { Pop-Location }
