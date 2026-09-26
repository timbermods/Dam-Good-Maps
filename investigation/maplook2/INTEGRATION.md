# Integration proposals

These are proposals for D147, not changes to the product or its saved settings.

## Adopt the two effects

Keep Standard exactly as it is. Add a water-material factory and a sun-shadow hook to `MapRenderer`; replace this investigation's private-field bridge and in-memory Vite transform with those explicit interfaces. High selects the new water material and actual-mesh shadows. Keep Light's existing software path. Keep grass, dirt, cobbles, contamination veins, models, contact darkening, sky and output colour handling unchanged. Stronger distant contamination cracks from D154 are outside this experiment's two-effect scope.

The water shader uses the existing mesh's depth, badwater share and shore/fall flags. Clean surfaces now interpolate the user's measured depth and viewing-angle colours, with drifting procedural streaks, sparse near-white flecks and faint real bed transmission. The angular reflection envelope represents sky lightening rather than a mirrored render of the sky or terrain. The displayed palette is calibrated through the current sun, finish and blending; recheck it if that pipeline changes. Badwater, waterfall curtains and foam retain the accepted prior paths. No refraction render, screen-space reflection, texture download or game asset is needed. Keep the current overlay/hatching logic when adding this material to the editor; this demo intentionally draws only the clean comparison.

The shadow pass draws the actual terrain, trees and ruin scaffolds from the sun into a 2048² depth texture. A 25-tap PCF filter softens the edge; receiver-plane depth correction avoids self-shadow stripes. It replaces the baked sun term rather than multiplying a second shadow over it. Existing foot-of-wall and object contact darkening remains. The warm sun is slightly stronger and sky fill slightly lower only while this effect is enabled; there is no new global colour grade or AO pass.

The prototype redraws depth on every displayed High frame, including a moving sun. In the product, invalidate it on terrain/object changes, sun changes and shadow-frustum changes. A fixed sun over an unchanged map can reuse the depth texture during water animation. Water neither casts an opaque shadow nor enters the depth pass.

## Choose High automatically

Start with Standard while compiling High in the background. Use WebGL2/depth-texture support, texture limits and successful framebuffer allocation as eligibility checks, not proof of speed. Do not select High from a GPU name alone. Software renderers keep Light under the existing policy; unavailable or uncertain High performance falls back to Standard on hardware.

Warm up on a representative 256² scene at the actual viewport/DPR, then sample frames over a short orbit with both effects active. Prefer disjoint-safe GPU timers; otherwise use conservative frame-time observations. Provisional thresholds: sustained p95 below 22 ms selects High; repeated p95 above 30 ms returns to Standard. These thresholds need Kyler's PC and an integrated-GPU check before adoption. Exclude loading, shader compilation, hidden tabs and pauses. Use hysteresis and a cooldown so the mode does not flicker. Keep a remembered manual High/Standard/Light choice. Re-check after a major resolution change, not on every map load.

If High allocation or compilation fails, dispose its resources and recreate Standard without losing the map/camera. After context loss, recreate from the existing CPU map data and choose Standard before trying High again. This demo reports context loss and asks for reload; it deliberately forces both full looks in software so the captures compare the intended shaders. It does not implement automatic GPU selection.

## M9 and caves

- **M9:** the effects consume `MapView` and the shared meshes, not generator-specific features. The existing M9 `.timber` prototypes run through the same importer. If M9 retains these attributes, the water and depth shadow pass carry over directly.
- **3D terrain:** actual-mesh shadow depth can occlude cave floors, ceilings and overhangs; it does not flatten them into a heightfield. Preserve instancing, normals and the same visible geometry in both passes. Keep a stable sun frustum and test thin roofs to tune bias without leaks.
- **Cave water:** the existing mesher preserves water's separate floor/depth columns. Those surfaces can use the shader, but lower cave-water surfaces currently have limited shore/fall flags. Add layer-aware adjacency before claiming cave foam is complete. The existing baked sky/contact term is still based largely on surface heights; it will need cave-aware visibility separately. That is not new AO in this task.
- **New terrain formats:** if continuous heights or a different voxel range replaces today's bytes, update shadow bounds and water depth/adjacency at that boundary. No art replacement is required.

## Likely cost and limits

| Effect | Likely cost | First adjustment if needed |
|---|---|---|
| Water | One transparent pass over the existing geometry. A few procedural-noise reads, ripple/Fresnel arithmetic and blending; cost grows with visible water and overdraw. No extra render target. | Reduce ripple detail at small screen sizes; keep depth and contamination cues. |
| Soft shadows | An extra geometry pass when refreshed, plus 25 depth reads per shaded fragment. The prototype's RGBA8 colour attachment and 32-bit depth texture total about 32 MiB at 2048², excluding driver overhead. | Reuse unchanged depth; then try a depth-only target, fewer PCF taps, or 1024² on smaller maps. |

The single map-wide shadow texture is stable but small trees soften at 256². A camera-focused/cascaded map could improve close views later, at extra memory and complexity. Transparent-water chunk sorting and tile-based foam remain inherited limitations. No millisecond or FPS claim here: SwiftShader captures validate appearance and execution only. The demo's FPS counters include the cost of drawing both panes, so compare toggles on the same PC/window and measure a single product view before setting defaults.

Before adoption, require unchanged Standard output, independent toggles, no shader errors, both camera directions, 128²/256² maps, mixed badwater, all soil meanings, waterfall curtains, actual cave geometry and context recovery. Kyler decides whether the look is ready; this PR remains a prototype.
