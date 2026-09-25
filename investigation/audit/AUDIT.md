# First-pass audit: Dam Good Maps

Branch: `investigation/audit`, based on `dev` at `cfa5990`.

This first pass prioritizes reproducible release-blocking behavior over a complete review. I read
`CLAUDE.md`, `PLAN.md`, `EDITOR_PLAN.md`, `FORMAT.md`, `ROADMAP.md`, `docs/progress.md` and
`docs/decisions-pending.md` before testing. I excluded items already listed in pending decisions or
the ROADMAP refinement list.

## Baseline

`npm test` completed with 321 passing tests and 15 skipped tests. Two river-property cases exceeded
the suite's 120-second timeout under four-worker load. Re-running those fixed cases individually
passed: 96² seed 11 with 8 rivers completed in 17 seconds; 256² seed 13 with 3 rivers completed in
43 seconds. The timeout was worker contention, not a reproduced product failure.

Skipped cases need local-only official maps or game-save fixtures that are not present in this
checkout. Tests that did run covered generated maps and project rebuilds for all six themes across
the 96–256 size presets, random edit/undo/redo and export/re-import properties at 96², 128², 192²
and 256², and random share-link round trips.

## Confirmed findings

### A1. Python validator accepts maps whose water sources the game will halve — P2

**Where:** `prototype/validate.py:122–133` omits the migration-marker check. The matching
TypeScript check is in `src/core/validate/checks.ts:60–66`. The game-migration effect is documented
at `src/core/format/world.ts:94`.

**What is wrong:** The Python oracle checks for the usual water singletons but does not require
`WaterSimulationMigrator.IsMigrated` to be `true`. The TypeScript validator rejects a missing or
false marker because the game then halves source strengths. As a result, the oracle can report a
map as passing load checks even though the game will load different water behavior. This is a
TypeScript/Python agreement gap and a false pass for the Python oracle.

**Reproduction:** From the repository root, install the audit package and run:

```powershell
npm ci --prefix investigation/audit
$env:NODE_OPTIONS = "--require=$((Resolve-Path 'investigation/audit/test-host-shim.cjs').Path)"
npm test --prefix investigation/audit -- --pool=threads --maxWorkers=1 repros/migrator-validator-parity.test.ts
Remove-Item Env:\NODE_OPTIONS
python prototype/validate.py investigation/audit/repros/.tmp/migrator-false.timber --json --load-only
```

The test generates a valid map with seed 11 at 96×96, changes only
`WaterSimulationMigrator.IsMigrated` to `false`, writes the `.timber`, and verifies that TypeScript
rejects `file.singletons`. The Python command exits successfully and reports both
`file.singletons.ok: true` and overall `passed: true` for the same file.

**Expected:** Both validators reject the false migration marker, since the game halves water-source
strengths when it is false.

**Actual:** TypeScript rejects the file. Python accepts it.

**Suggested fix:** Add the same `WaterSimulationMigrator.IsMigrated === true` requirement and
diagnostic to `prototype/validate.py:122–133`, then include this mutated-file case in the validator
parity checks.

### A2. `.timber` bytes change across time zones for a DST-gap timestamp — P2

**Where:** `src/core/format/timber.ts:33–38` converts the saved timestamp into a local `Date` for
ZIP entry times. A local time inside a spring-forward gap is normalized to a different hour.

**What is wrong:** The writer intends the same map to produce the same bytes in any time zone, but
`new Date(year, month, day, hour, ...)` does not preserve nonexistent local times. For the timestamp
below, Los Angeles normalizes 02:30 to 03:30 while UTC keeps 02:30. `fflate` writes those different
local times into the ZIP headers, so otherwise identical map data produces different archive bytes.

**Reproduction:** From the repository root in PowerShell, run:

```powershell
& .\investigation\audit\compare-timezones.ps1
```

The script generates seed 11 at 96×96, sets its world timestamp to `2026-03-08 02:30:00`, and
launches separate Node test processes with `TZ=America/Los_Angeles` and `TZ=UTC`. It writes both
archives and fails only if their SHA-256 values match. On this run the Los Angeles hash began
`EF0066BE` and the UTC hash began `BDF15662`; they differed.

**Expected:** The same map and timestamp serialize to identical bytes regardless of the machine's
time zone.

**Actual:** The ZIP entry timestamps normalize differently, changing the `.timber` bytes.

**Suggested fix:** Derive ZIP entry times without local-time normalization, or use one fixed ZIP
entry timestamp for every file while preserving the original `world.Timestamp` in `world.json`.

### A3. `__proto__` singleton keys are rewritten as forged sibling data — P3

**Where:** `src/core/format/json.ts:137–151` parses object members into `{}` using direct key assignment; `src/core/format/json.ts:62` serializes with `for...in`, which also walks enumerable prototype properties.

**What is wrong:** A JSON object member named `__proto__` invokes the ordinary object's prototype setter instead of becoming an own data property. On export, the inherited enumerable members are written as siblings, so a valid but unusual imported singleton is changed and its value appears under a different key. This conflicts with the reader/writer's promise to preserve unknown map data.

**Reproduction:** Run the audit test from the repository root:

```powershell
$env:NODE_OPTIONS = "--require=$((Resolve-Path 'investigation/audit/test-host-shim.cjs').Path)"
npm test --prefix investigation/audit -- --pool=threads --maxWorkers=1 repros/malformed-input.test.ts
Remove-Item Env:\NODE_OPTIONS
```

The first test builds a `.timber` whose `Singletons` object has a `__proto__` member containing `ForgedSingleton`. `readTimber(writeTimber(readTimber(bytes)))` loses the `__proto__` own member and instead has an own `ForgedSingleton` singleton.

**Expected:** Unknown JSON keys, including `__proto__`, round-trip as data without changing their names or adding sibling fields.

**Actual:** The key changes during read/write and creates an extra singleton field.

**Suggested fix:** Parse JSON objects into null-prototype records or define each parsed key as an own data property; serialize only own enumerable keys. Add this special-key round trip to format tests.

### A4. The JSON parser accepts invalid raw control characters in strings — P3

**Where:** `src/core/format/json.ts:98–103` returns the fast-path string slice without checking for unescaped control characters. `src/core/format/timber.ts:68` uses this parser for imported `map_metadata.json`.

**What is wrong:** JSON forbids literal newlines and other U+0000–U+001F characters inside a quoted string. The parser fast path accepts them, so malformed metadata is treated as a valid imported map.

**Reproduction:** Run the same `repros/malformed-input.test.ts` command above. Its second test makes `map_metadata.json` contain `"MapDescription":"first line` followed by a literal line break and `second line"`. Native `JSON.parse` rejects the metadata; `readTimber` accepts it and returns the two-line description.

**Expected:** Reject invalid JSON metadata during import with a parse error.

**Actual:** `readTimber` accepts the malformed string.

**Suggested fix:** Reject unescaped control characters on the fast path (or use a standards-compliant string parser) and add raw newline/control-character cases to parser tests.

## Unconfirmed suspicions

- Official-map and game-save import checks that depend on local-only investigation fixtures did
  not run. The relevant import/mechanics test cases were skipped because those files are absent in
  this checkout. Hand-made 0.6 and 0.7 imports and current generated round trips passed, but the
  actual 1.0/1.1 map fixtures were unavailable; no bug is claimed from that gap.
- The full suite's river timeouts may recur on slower or more heavily loaded machines. Both seeded
  cases passed in isolation here, so this is not reported as a product performance bug.
- `Math.sqrt` remains in generator-output and feature-raster paths (for example,
  `src/core/gen/extras.ts:240`), while the cross-engine determinism test was not run in this pass.
  No cross-engine byte mismatch was reproduced; this is a coverage gap, not a finding.
- In `src/editor/Editor.tsx:337–344`, each queued plan request independently calls `setPlan` and
  clears the shared `planning` flag. If a second drawing request is queued before the first finishes,
  the first result may re-enable Place with its older plan while the newer request is still pending;
  `src/editor/panels.tsx:443–444` does not disable Place while pending. This looks like a stale-plan
  race, but I did not reproduce it in a mounted editor, so it remains unconfirmed. The Playwright
  browser tests, including the autosave reload flow, were not run in this pass.

## Area coverage

1. **Map correctness:** Generated maps and project rebuilds passed for every theme at the 96–256 size presets. A1 reproduces the Python/TypeScript migration-marker disagreement.
2. **Determinism:** Share-link property checks passed. A2 reproduces a cross-time-zone `.timber` byte mismatch for the DST-gap timestamp.
3. **Files:** Synthetic 0.6 and 0.7 imports, generated `.timber` files, and project round trips passed. A2–A3 are reproducible writer/parser issues.
4. **Editor:** Existing undo/redo, regeneration, water preview and stale-background contract tests passed. The queued plan race remains unconfirmed.
5. **Safety:** Source inspection found no raw HTML sinks; imported descriptions use Preact text interpolation. A3 and A4 reproduce import/parser issues.
6. **256² performance:** The seed 11 core generation sweep passed for all six themes. Results are in `repros/perf-256-results.json`; the test is `repros/perf-256.test.ts`. Times were 10.1 s river valley, 5.1 s canyon, 9.4 s highlands, 7.6 s lake basin, 21.1 s delta, and 14.0 s islands. Post-GC heap deltas ranged from −1.0 to +2.7 MiB, external ArrayBuffer deltas were 0 MiB, and process RSS reached 315 MiB after the sweep. These are one-run Node measurements, not proof of long-run leak absence.

## Areas not reached

- Official map and game-save fixture imports: the required local fixtures were absent. Synthetic legacy imports and generated round trips were used instead.
- Cross-engine Node/browser generation hashes were not rerun; remaining `Math.sqrt` call sites are an unconfirmed determinism coverage gap.
- Playwright browser checks were not run. In particular, editor autosave/restore and a mounted reproduction of the queued plan race were not exercised.
- Browser 3D rendering and long-running editor memory at 256² were not measured; area 6 covers core Node generation only.
