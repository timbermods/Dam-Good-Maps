$ErrorActionPreference = 'Stop'
# Work entirely below this investigation; never apply to production/reference modules.
$relativeFolder = '.work/weather/proposal'
$proposalRoot = Join-Path (Get-Location) $relativeFolder
foreach ($side in @('a','b','check')) {
    New-Item -ItemType Directory -Force (Join-Path $proposalRoot ($side + '/investigation/cycles')) | Out-Null
}
foreach ($name in @('game-water.ts','game-soil.ts')) {
    $before = [IO.File]::ReadAllText((Join-Path (Get-Location) ('weather/reference/' + $name))).Replace('../../../../src/', '../../src/')
    foreach ($side in @('a','check')) { [IO.File]::WriteAllText((Join-Path $proposalRoot ($side + '/investigation/cycles/' + $name)), $before) }
    $after = [IO.File]::ReadAllText((Join-Path (Get-Location) ('weather/prototypes/combined/' + $name))).Replace('../../../../../src/', '../../src/')
    if ($name -eq 'game-water.ts') {
        $after = $after.Replace('declare const __waterWasm: WebAssembly.Module;', "import { waterKernel } from './water-kernel';")
        $after = $after.Replace('        this.kernel = new WebAssembly.Instance(__waterWasm,', "        if (!waterKernel) { this.kernel = null; return; }`n        this.kernel = new WebAssembly.Instance(waterKernel,")
        $after = $after.Replace('if (this.legacy.bookkeeping || this.legacy.contamination)', 'if (!this.kernel || this.legacy.bookkeeping || this.legacy.contamination)')
    }
    [IO.File]::WriteAllText((Join-Path $proposalRoot ('b/investigation/cycles/' + $name)), $after)
}
$loader = @'
// Proposal: load once inside the Weather worker, before constructing a model.
// The bytes must be produced with the pinned strict scalar compiler configuration.
import encoded from './water-kernel.json';
export const waterKernel: WebAssembly.Module | null = (() => {
    if (typeof WebAssembly === 'undefined') return null;
    try {
        const bytes = Uint8Array.from(atob(encoded.base64), c => c.charCodeAt(0));
        return new WebAssembly.Module(bytes);
    } catch {
        return null; // GameWater retains its JS substep when compilation is unavailable.
    }
})();
'@
[IO.File]::WriteAllText((Join-Path $proposalRoot 'b/investigation/cycles/water-kernel.ts'), $loader.Replace("`r`n", "`n") + "`n")
Copy-Item -LiteralPath weather/kernel-bytes.json -Destination (Join-Path $proposalRoot 'b/investigation/cycles/water-kernel.json')
$patchLines = git -c core.autocrlf=false diff --no-index -- "$relativeFolder/a" "$relativeFolder/b"
if ($LASTEXITCODE -ne 1) { throw 'Expected a nonempty proposal diff' }
$patch = (($patchLines -join "`n") + "`n").Replace("a/$relativeFolder/a/", 'a/').Replace("b/$relativeFolder/b/", 'b/')
# For new files Git may use the destination prefix on both sides of diff --git.
$patch = $patch.Replace("a/$relativeFolder/b/", 'a/')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'weather/proposed-weather.patch'), $patch)
git -C ../.. apply --check --directory=investigation/simspeed-cycles/.work/weather/proposal/check investigation/simspeed-cycles/weather/proposed-weather.patch
if ($LASTEXITCODE -ne 0) { throw 'Proposal failed applicability check against the copied current-dev files' }
Write-Output 'PASS proposed-weather.patch applicability; no model file was changed'
