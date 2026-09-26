# Integration proposals

These are proposals for D147, not changes to the product or its saved settings.

## Adopt the two effects

Keep Standard exactly as it is. Add a water-material factory and a sun-shadow hook to `MapRenderer`; replace this investigation's private-field bridge and in-memory Vite transform with those explicit interfaces. High selects the new water material and actual-mesh shadows. Keep Light's existing software path. Keep grass, dirt, cobbles, contamination veins, models, contact darkening, sky and output colour handling unchanged. Stronger distant contamination cracks from D154 are outside this experiment's two-effect scope.

The water shader keeps the accepted clean depth/angle palette, real bed transmission and angular sky reflection. Fine irregular crests and tiny white flecks share one continuous detail field across clean, mixed and badwater. Flecks become denser with speed. Two overlapping flow phases limit stretching without reset pops. Final visual polish belongs to Map look 2 against DGM Probe's in-game shots.

Carry the generator/Real-place settle's directional outflows into the view, convert face volumes to centre velocities, and cache a linearly filtered texture for the shader. Compress velocity magnitude while retaining direction; still lakes get only slow wind drift. This demo estimates imported M9 flow by running 128 ticks from stored water in the repository simulator, without replacing any displayed depths. Production should prefer trusted stored flow when available and identify estimated flow explicitly; no new simulation belongs in the frame loop.

The same texture carries contamination. Two small wet-neighbour smoothing passes and bilinear sampling create a multi-tile front while preserving pure clean/badwater regions. Do not diffuse across dry separators or different surface heights. Colour follows concentration through a mostly-clean warm tint, then murky brick red-brown; no stochastic red/blue mask. Retain raw contamination for inspection/editing. Clean colours are unchanged. Badwater uses darker troughs and lighter drifting streaks from the same advected texture, with much weaker cool reflection and warm dull glints. Contrast is compensated for shallow transmission without changing opacity; poisoned ground stays visible while deep water stays murky. Keep the existing slow glowing bubble cue. Calibrate body, trough and streak samples through final lighting/blending at documented depths and angles. Waterfall curtains and foam formulas retain their treatment.

The baseline terrain shader replaces all submerged soil with a plain wet bed. Restore its existing contamination art only under High polluted water, weighted by the smooth water concentration. The demo's `badwater-bed.ts` hook reuses the existing ground-colour function and glow; it introduces no texture. Exposed ground, clean-water beds and Standard remain unchanged. Bind this hook to the water toggle, including failure/fallback recovery. No refraction render, mirrored-scene reflection, texture download or game asset is needed. Keep existing overlays/hatching in the editor.

The shadow pass draws the actual terrain, trees and ruin scaffolds from the sun into a 2048² depth texture. A 25-tap PCF filter softens the edge; receiver-plane depth correction avoids self-shadow stripes. It replaces the baked sun term rather than multiplying a second shadow over it. Existing foot-of-wall and object contact darkening remains. The warm sun is slightly stronger and sky fill slightly lower only while this effect is enabled; there is no new global colour grade or AO pass.

The prototype redraws depth on every displayed High frame, including a moving sun. In the product, invalidate it on terrain/object changes, sun changes and shadow-frustum changes. A fixed sun over an unchanged map can reuse the depth texture during water animation. Water neither casts an opaque shadow nor enters the depth pass.

## Choose High automatically

Start with Standard while compiling High in the background. Use WebGL2/depth-texture support, texture limits and successful framebuffer allocation as eligibility checks, not proof of speed. Do not select High from a GPU name alone. Software renderers keep Light under the existing policy; unavailable or uncertain High performance falls back to Standard on hardware.

Warm up on a representative 256² scene at the actual viewport/DPR, then sample frames over a short orbit with both effects active. Prefer disjoint-safe GPU timers; otherwise use conservative frame-time observations. Provisional thresholds: sustained p95 below 22 ms selects High; repeated p95 above 30 ms returns to Standard. These thresholds need Kyler's PC and an integrated-GPU check before adoption. Exclude loading, shader compilation, hidden tabs and pauses. Use hysteresis and a cooldown so the mode does not flicker. Keep a remembered manual High/Standard/Light choice. Re-check after a major resolution change, not on every map load.

If High allocation or compilation fails, dispose its resources and recreate Standard without losing the map/camera. After context loss, recreate from the existing CPU map data and choose Standard before trying High again. This demo reports context loss and asks for reload; it deliberately forces both full looks in software so the captures compare the intended shaders. It does not implement automatic GPU selection.

## M9 and caves

- **M9:** the effects consume `MapView`, shared meshes and a supplemental flow/concentration field. Existing M9 `.timber` prototypes use the same importer plus estimated surface flow. Preserve these attributes and supply authoritative flow when M9 can expose it.
- **3D terrain:** actual-mesh shadow depth can occlude cave floors, ceilings and overhangs; it does not flatten them into a heightfield. Preserve instancing, normals and the same visible geometry in both passes. Keep a stable sun frustum and test thin roofs to tune bias without leaks.
- **Cave water:** the existing mesher preserves water's separate floor/depth columns. The demo's 2D flow/concentration texture covers the top surface only. Supply per-column flow and contamination, plus layer-aware adjacency, before adopting it for lower cave water; otherwise a cave could inherit water data from above. Lower water also has limited shore/fall flags. Existing baked sky/contact lighting will need cave-aware visibility separately. That is not new AO in this task.
- **New terrain formats:** if continuous heights or a different voxel range replaces today's bytes, update shadow bounds and water depth/adjacency at that boundary. No art replacement is required.

## Likely cost and limits

| Effect | Likely cost | First adjustment if needed |
|---|---|---|
| Water | One transparent pass, two advected detail evaluations, flow/concentration lookup, flecks, badwater bubbles and blending. Under polluted water, terrain evaluates its existing poisoned-ground shading too. A 256² RGBA8 field costs 256 KiB. Preparation happens on map change; no extra render target. | Reduce distant fine noise; retain depth, concentration, flow and poisoned-bed cues. |
| Soft shadows | An extra geometry pass when refreshed, plus 25 depth reads per shaded fragment. The prototype's RGBA8 colour attachment and 32-bit depth texture total about 32 MiB at 2048², excluding driver overhead. | Reuse unchanged depth; then try a depth-only target, fewer PCF taps, or 1024² on smaller maps. |

The single map-wide shadow texture is stable but small trees soften at 256². A camera-focused/cascaded map could improve close views later, at extra memory and complexity. Transparent-water chunk sorting and tile-based foam remain inherited limitations. No millisecond or FPS claim here: SwiftShader captures validate appearance and execution only. The demo's FPS counters include the cost of drawing both panes, so compare toggles on the same PC/window and measure a single product view before setting defaults.

Before adoption, require unchanged Standard output, independent toggles, no shader errors, both camera directions, 128²/256² maps, mixed badwater, all soil meanings, waterfall curtains, actual cave geometry and context recovery. Kyler decides whether the look is ready; this PR remains a prototype.
