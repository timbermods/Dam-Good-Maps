# Signature water in Pick a place — proposal only

Follow D161's journey and the current D175 placement after M11: explore a place, frame it, build, inspect Weather, refine in Live editing, then play. This investigation supplies a water-design proposal; it does not build another picker or change production code.

## Water before the start

Preserve the feature that gives the place its character. A passing start pond is not a substitute for a crater lake, fjord, delta or valley river. The source rule still applies: a source begins water. This follow-up explicitly permits a spring inside the basin of a newly designed lake; it does not permit adding a booster inside an already supplied lake or river.

These origin constraints apply to generated maps. Manual Source placement in the editor stays free, as D184 specifies. A future repair pass can remove a head that a settled counterfactual proves is already supplied, then resimulate and recheck the signature; an unsettled counterfactual is not proof that removal is safe.

1. Read the terrain and an independent open water reference before choosing the start. Identify significant lakes, open sea boundaries and river corridors. Retain stable feature identities across scale and framing changes.
2. Design the whole feature. Fill an independent lake from its own spring. Feed a sea opening across its boundary mouth. Feed a river at its upstream boundary or at its head below a ridge. A tributary starts at its own head. Increase strength or use adjacent cells at that head; never add downstream boosters. The prototype first removes interior origins flooded in whole-head counterfactual prefill; final acceptance also requires canonical settling with each interior head off and its site dry under the other heads.
3. Where the DEM measures the water surface, infer the missing underwater bed explicitly. This prototype lowers only water-classified cells by one or two game levels, with a shared level for broad lakes. It preserves all cells outside that mask after height mapping and adds no terrain wall or rim. At mixed shoreline cells this is a game approximation, not measured bathymetry. Production should let the player inspect this difference.
4. Simulate the water using the shared simulator. Select a start with a walking path to the actual connected signature shoreline, allowing natural slopes. Screen potential starts from that shore before ranking moist land. Keep a minor pond as a last resort only where no signature exists.
5. Accept only when both the feature and the start work. Keep playability, feature presence, water retention and extra flooding as separate measurements. Do not optimise an average that lets a great start compensate for a missing lake.

The prototype tries four scales at the same centre and size, plus stronger inflow and gentler height mapping. It does not perform the former size/offset search, which could quietly abandon the place. Production can restore that search only with feature locks and a minimum retained share of the original footprint. The returned frame must be visible. If no candidate works, highlight feature-preserving alternatives with previews; never present an incomplete feature as a finished download.

Some full searches take minutes in this study. Worker isolation keeps cancellation responsive but does not solve that latency. Before integration, set a measured search budget, show progressive previews, reuse unchanged simulation work, and stop rejected origin audits early. Any shortened simulation must remain a preview until the authoritative settling and start checks finish; do not replace the measured failures with an optimistic “ready” state.

## Data and the small proxy

Keep AWS Terrain Tiles / Terrarium for elevation: the browser Worker fetches it directly. Add **ESA WorldCover 2021 v200, class 80**, as a 10 m permanent-water reference. It is open CC BY 4.0 Sentinel-derived data, not Google imagery/elevation. The tested official AWS endpoints did not permit direct browser range reads. `water-proxy.mjs` is a minimal proposed same-origin range proxy: GET only, one fixed version and filename pattern, one byte range at most 8 MiB, upstream timeout, no arbitrary destination or credentials. The local Node server exercises the same handler and caches immutable range bytes under this folder. Nothing is deployed.

A production Cloudflare Worker can use this handler behind the same origin, cache range responses using explicit range keys, bound request concurrency and bytes per build, and reject unsupported requests. Use the existing worker pricing proposal in SOURCES.md as an indicative starting point; recheck current prices before deployment. Capacity and billing follow range requests and CPU, not map count; caching reduces upstream reads and CPU, but request charges can still apply. Reusing native blocks and screening a coarse mask first are needed before promising interactive latency. No geographic lookup request needs an account, secret or player identifier.

The existing GitHub Pages host cannot itself run this handler. A separate Worker endpoint needs an explicit CORS allowlist for the app origin (`https://timbermods.github.io`), with `Content-Range`, `ETag` and `Last-Modified` exposed and any range preflight handled. The supplied handler is tested behind the local app's same origin; that cross-origin deployment path is proposed, not tested or deployed. For a Worker Cache API implementation, store a normal 200 response under a range-specific key and reconstruct the 206 response; do not assume partial responses can be cached directly. [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

WorldCover is a **reference, not a hard requirement for water to exist**. It misses narrow and seasonal streams, does not provide bathymetry and is unavailable in some ocean/polar tiles. Missing data remains unknown, not dry terrain. Where no usable observed feature exists, the prototype designs a drainage route from the DEM. Production should combine the reference with D175's licensed OpenFreeMap/OSM context and morphology, especially for rivers and delta branches; those extra sources are not implemented here. A network failure must not silently erase a known feature.

## Measurements and interface

Keep the single D175 flow. The block preview should show the intended water outline and proposed source origins while the worker fills it. Its progress can say “Lakes and rivers → Shore and start → Forests → Checks.” The current research UI shows the result and measurements; it is not a production frame or styling proposal (D176).

Hand the result to the existing desktop-first, brush-based editor (D184–D185). Its Drought and Badtide buttons show those conditions; the optional Weather view is the separate full-cycle timeline (D186). Keep the editor's quiet checks and existing export behaviour.

Show the main feature, its water retention and a visible shore path. The comparison here measures both each returned frame and the **same previous geographic footprint**. Water cropped out counts as lost. This catches a misleading improvement caused by zooming away from the feature. Use native-area-weighted recall for preservation; show precision too, because flooding everything would otherwise score perfectly. Feature presence requires at least 70% of each significant reference component to be wet. This is a declared prototype threshold, not a calibrated fun score, channel-connectivity proof or a claim of hydrological accuracy.

For a place with no reference water, label designed drainage separately and give native-water retention as n/a. For a lake district, expose individual lake results rather than one combined water percentage. Before production, add explicit river continuity, delta branch survival, connected shore access, floodplain budget and dry-season storage tests. Also score the surrounding land: Crater Lake's default frame can fill its water while clipping part of its rim. A feature-bounds margin should keep that rim in view instead of accepting water coverage alone as visual drama. Preserve the current failures and rerun the same 150 requests when those criteria change.

Keep full Terrain Tiles notices and the required ESA acknowledgement on the picker/preview page, on shared renders, and inside each map's description and `ATTRIBUTION.txt`. `pickplace.json` records sources, byte-range hashes/ETags, masks' version, frame, mapping, water design and attempts. The exact export contains the full notices. A reproduced share must pin source content as well as its URL; provider versions and water classifications can change.

## What the milestone replaces

This study uses core `9198151`, with the **LOCAL D151–D153 adapter**, conservative dry walking and the old Normal tree/resource thresholds. The branch was then updated to fetched dev `2f8b4e6` after #34 merged; `src/` and `investigation/landscapes/` are identical between those commits, so the running study's shared code is unchanged. Shared core files are untouched. Current dev still had the old same-level water validator when work started. The local source-origin filter is separate from D153 and must eventually use the shared D171 implementation.

| Local code | Replace after the shared work lands |
|---|---|
| `rules.ts` pump-shore verdict and dry-path mask | Shared D153 walking-to-pumpable-shore analysis. Reconcile dry walking with the authoritative game policy. Delete the local verdict and port only missing regressions. |
| Old water-rule allowlist in `currentRules` | Shared D152 real-place profile; keep settling and load checks. |
| Copied no-wall converter and natural-slope builder | M11's shared heightmap conversion and the milestone's slope/edge implementation. Keep an invariant that dry-land cells are unchanged; no second rim system. |
| Old living-tree and resource gates | Shared D164 log-yield/grown-tree and resource rules. Do not hide their present failures by drying the water. Re-run all cases and report rate changes. |
| Local source-origin prefill and canonical audits | Shared D171 feature/head check, including this follow-up's new-lake spring semantics. Test whole head clusters together; downstream boosters stay forbidden. |
| Copied `convert.ts`, `adapt.mjs` and old drainage copies | Remove once the shared browser-safe heightmap entry point exists. Retain only reference sampling, signature planning, feature-aware search and measurement adapters. |

Shore-first candidate screening is part of start **selection**; the shared validator remains the authority for acceptance. The new reference/feature identity and water measurements are not competing validators. No site, proxy, release or production integration is published by this PR; it remains open and unmerged.
