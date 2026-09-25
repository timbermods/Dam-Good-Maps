# Creates a proposal artifact only. It never applies the patch or writes src/.
$ErrorActionPreference = 'Stop'
$simRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$simTemp = Join-Path $PSScriptRoot '.work/proposal'
New-Item -ItemType Directory -Force $simTemp | Out-Null
$simPatch = @()
foreach ($simFile in @('water.ts', 'drought.ts')) {
    $simPrototype = if ($simFile -eq 'water.ts') { 'prototypes/combined/water.ts' } else { 'prototypes/drought.ts' }
    $simText = (Get-Content -LiteralPath (Join-Path $PSScriptRoot $simPrototype) -Raw).Replace("`r`n", "`n")
    $simText = $simText.Substring($simText.IndexOf("`n") + 1)
    if ($simFile -eq 'drought.ts') {
        $simText = $simText.Replace('../../../src/core/sim/', './')
    }
    [System.IO.File]::WriteAllText((Join-Path $simTemp $simFile), $simText, [System.Text.UTF8Encoding]::new($false))
    $simRelative = "investigation/simspeed/.work/proposal/$simFile"
    $simDiff = (& git -C $simRepo diff --no-index --ignore-cr-at-eol -- "src/core/sim/$simFile" $simRelative) -join "`n"
    if ($LASTEXITCODE -gt 1) { throw "git diff failed for $simFile" }
    $simPatch += $simDiff.Replace("b/$simRelative", "b/src/core/sim/$simFile").Replace("`r", '')
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'proposed-core.patch'), ($simPatch -join "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
& git -C $simRepo apply --check --ignore-whitespace investigation/simspeed/proposed-core.patch
if ($LASTEXITCODE -ne 0) { throw 'Proposal does not apply cleanly to the base' }
Write-Output 'PASS proposal applies in check-only mode; src/ was not changed'
