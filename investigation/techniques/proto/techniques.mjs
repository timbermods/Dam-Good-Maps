// Original experimental adaptations of public ideas, using only DGM's own M9 helpers.
import { m9 } from './m9.mjs';
const { fbm } = await m9('src/core/math/noise.ts');
const { hash32 } = await m9('src/core/math/hash.ts');
const { stream } = await m9('src/core/math/rng.ts');
export const { drainage, erode } = await m9('investigation/generative/proto/erode.ts');
export const { drawGenome } = await m9('investigation/generative/proto/genome.ts');
export const { upliftField } = await m9('investigation/generative/proto/field.ts');
export const { snapLevels, mergeSmallRegions, cleanPitsAndSpikes } = await m9('investigation/generative/proto/levels.ts');
export const { levelRegions } = await m9('src/core/math/grid.ts');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Experiment 1: three independent, slow fields steer base height, relief and ridge/valley
// balance. Minecraft's climate-space idea, NOT its functions, curves, data or implementation.
// M9 parts remain in the input. The recipe and random streams are unchanged for paired runs.
export function spatialControls(input, genome, seed, W, H) {
  const rng = stream(seed, 'techniques/controls/v1');
  const scales = [rng.range(35, 90), rng.range(24, 65), rng.range(18, 48)];
  const out = input.slice(), center = genome.base + genome.relief * 0.45;
  const seeds = ['continental', 'erosion-proxy', 'peaks-valleys'].map(k => hash32(seed, k));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const c = fbm(seeds[0], x, y, scales[0], 2);
    const e = (fbm(seeds[1], x, y, scales[1], 2) + 1) / 2;
    const p = fbm(seeds[2], x, y, scales[2], 2);
    out[i] = center + (input[i] - center) * (1.35 - e)
      + genome.relief * (0.34 * c + 0.22 * p * (1 - e));
  }
  return { field: out, scales };
}

// For cap=16 the control is M9's unmodified snapLevels. 22 is an explicit experimental
// extension: stretch its output, NOT a claim that M9 v1 supports 22 levels.
export function baselineLevels(field, g, seed, W, H, cap) {
  const h = snapLevels(field, g, seed, W, H);
  if (cap === 22) for (let i = 0; i < h.length; i++) h[i] = Math.round(h[i] * 22 / 16);
  return h;
}

// Both sides use the same four-neighbour drainage tree and the same one-level channel cut.
// High accumulation is a geomorphic candidate mask, not a Timberborn WaterSource simulation.
export function channelCandidates(field, W, H) {
  const d = drainage(field, W, H, { eight: false });
  const keep = Uint8Array.from(d.area, a => +(a >= Math.max(36, W * H / 100)));
  return { ...d, keep };
}
export function cutChannels(h, d) {
  const out = h.slice();
  for (let i = 0; i < h.length; i++) if (d.keep[i]) out[i] = Math.max(0, h[i] - 1);
  return out;
}

// Experiment 2: coherent irregular contours, cleanup with river protection, then a bounded
// bed-repair proposal on the receiver DAG. Reject expensive repairs instead of silently
// flattening the land. This does not add terrain or construct a dam wall.
export function constrainedLevels(field, g, seed, W, H, cap, d) {
  const sorted = [...field].sort((a,b) => a-b);
  const lo = sorted[Math.floor(sorted.length * .02)], hi = sorted[Math.floor(sorted.length * .98)];
  const top = Math.min(cap - .6, (g.base + g.relief) * cap / 16);
  const h = new Uint8Array(field.length);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i=y*W+x, c=fbm(hash32(seed,'techniques/contour'), x,y,12,2);
    let z = g.base + (field[i]-lo) / Math.max(1e-6,hi-lo) * (top-g.base);
    if (z > cap-2) z=cap-2+2*(z-cap+2)/(z-cap+4);
    // Horizontal coherence matters: no independent per-tile dithering.
    h[i]=clamp(Math.round(z + .35*c),1,cap);
  }
  mergeSmallRegions(h,W,H,6,d.keep);
  cleanPitsAndSpikes(h,W,H,d.keep);
  const before = cutChannels(h,d), proposed = before.slice();
  // Upstream first. Area threshold makes the mask downstream-closed.
  for (let k=d.order.length-1;k>=0;k--) {
    const i=d.order[k], r=d.rcv[i];
    if(d.keep[i] && r>=0) proposed[r]=Math.min(proposed[r],proposed[i]);
  }
  let changed=0, volume=0, maxCut=0;
  for(let i=0;i<h.length;i++) { const cut=before[i]-proposed[i]; changed+=+(cut>0); volume+=cut; maxCut=Math.max(maxCut,cut); }
  // Diagnostic limits chosen before the batch; unsuccessful candidates remain rejected.
  const accepted=maxCut<=3 && volume<=W*H*.08;
  return { before, proposed, accepted, repair: { changed, volume, maxCut } };
}

export function metrics(h,d,W,H) {
  let uphill=0, falls=0, riverEdges=0, cliffEdges=0, edges=0;
  for(let i=0;i<h.length;i++) {
    const r=d.rcv[i];
    if(d.keep[i] && r>=0) {riverEdges++; uphill+=+(h[r]>h[i]); falls+=+(h[i]-h[r]>=2);}
    for(const j of [(i%W<W-1)?i+1:-1, i+W<h.length?i+W:-1]) if(j>=0) {edges++; cliffEdges+=+(Math.abs(h[i]-h[j])>=2);}
  }
  const regions=levelRegions(h,W,H);
  let tiny=0, bench=0;
  for(const n of regions.size) {if(n<6)tiny+=n; if(n>=25)bench+=n;}
  // Count natural flat 3x3 + Cw0 entrance, only a geometry proxy for a start.
  let pads=0;
  for(let y=1;y<H-2;y++)for(let x=0;x<W-2;x++){
    const z=h[y*W+x]; let ok=h[(y-1)*W+x+1]===z;
    for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)ok &&=h[(y+dy)*W+x+dx]===z;
    pads+=+ok;
  }
  return { uphill, riverEdges, falls, cliffShare:cliffEdges/edges, tinyShare:tiny/h.length,
    benchShare:bench/h.length, padCandidates:pads, range:Math.max(...h)-Math.min(...h), levels:new Set(h).size };
}
