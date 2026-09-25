$ErrorActionPreference = 'Stop'
$auditRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $auditRoot '..\..')).Path
$outputDir = Join-Path $auditRoot 'repros\.tmp'
$laFile = Join-Path $outputDir 'los-angeles.timber'
$utcFile = Join-Path $outputDir 'utc.timber'
$env:NODE_OPTIONS = "--require=$($auditRoot)\test-host-shim.cjs"
$env:TZ = 'America/Los_Angeles'
$env:AUDIT_TZ_OUTPUT = $laFile
npm test --prefix $auditRoot -- --pool=threads --maxWorkers=1 repros/timber-timezone-determinism.test.ts
if ($LASTEXITCODE -ne 0) { throw 'Los Angeles reproduction process failed' }
$env:TZ = 'UTC'
$env:AUDIT_TZ_OUTPUT = $utcFile
npm test --prefix $auditRoot -- --pool=threads --maxWorkers=1 repros/timber-timezone-determinism.test.ts
if ($LASTEXITCODE -ne 0) { throw 'UTC reproduction process failed' }
$laHash = (Get-FileHash -LiteralPath $laFile -Algorithm SHA256).Hash
$utcHash = (Get-FileHash -LiteralPath $utcFile -Algorithm SHA256).Hash
Remove-Item Env:\NODE_OPTIONS
Remove-Item Env:\TZ
Remove-Item Env:\AUDIT_TZ_OUTPUT
[pscustomobject]@{ losAngeles = $laHash; utc = $utcHash; byteIdentical = ($laHash -eq $utcHash) }
if ($laHash -eq $utcHash) { throw 'Expected a reproducible byte difference across time zones was not observed' }
