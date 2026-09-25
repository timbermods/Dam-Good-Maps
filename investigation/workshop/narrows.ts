// The dam narrows, measured where it is: the dam site the validator counts (the best within 40
// tiles of the start, water.reservoir), its dam line, its shoulders and the ridge crests beside it
// (lib/naturalness.ts narrowsOf). Spur narrows (the recipe) against the straight ridge of the same
// River Valley seeds, and against the workshop and official maps.
//
//   npx tsx investigation/workshop/narrows.ts     → C:\dgm-workshop\narrows.json (aggregates)

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { damSites, maxFloodFor, type DamSite } from "../../src/core/analysis/damsites";
import { readTimber } from "../../src/core/format/timber";
import { surfaceOf } from "../../src/core/format/world";
import { distanceFrom } from "../../src/core/math/grid";
import { mapObjects } from "../../src/core/sim/model";
import { listMaps, lowPriority, ROOT } from "./lib/paths";
import { loadMap } from "./lib/load";
import { readSettled } from "./lib/settled";
import { startCentre } from "./lib/measures";
import { narrowsOf } from "./lib/naturalness";
import { stat } from "./lib/table";

lowPriority();
type N = NonNullable<ReturnType<typeof narrowsOf>>;

function measure(h: Uint8Array, W: number, H: number, D: ArrayLike<number>, C: ArrayLike<number>, st: { x: number; y: number }): N | null {
  const N = W * H;
  const clean = new Uint8Array(N);
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    clean[i] = D[i] > 0.05 && C[i] < 0.05 ? 1 : 0;
    surf[i] = h[i] + D[i];
  }
  const m = new Uint8Array(N);
  for (let y = st.y - 1; y <= st.y + 1; y++) for (let x = st.x - 1; x <= st.x + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1;
  const sd = distanceFrom(m, W, H);
  const sites = damSites(h, clean, surf, W, H, sd, 60, [1, 2, 3], 2, 30, 0);
  let best: DamSite | null = null;
  for (const s of sites) if (sd[s.y * W + s.x] <= 40 && (!best || s.volume > best.volume)) best = s;
  return best ? narrowsOf(h, W, H, best, maxFloodFor(W, H)) : null;
}

function fromFolder(dir: string, prefix: string): N[] {
  const out: N[] = [];
  for (const f of readdirSync(dir).filter((x) => x.startsWith(prefix) && x.endsWith(".timber"))) {
    const key = f.replace(/\.timber$/, "");
    const w = readTimber(new Uint8Array(readFileSync(join(dir, f)))).world;
    const N = w.sizeX * w.sizeY;
    const b = readFileSync(join(dir, `${key}.f32`));
    const a = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    const s = mapObjects(w).find((o) => o.template === "StartingLocation");
    if (!s) continue;
    const r = measure(surfaceOf(w), w.sizeX, w.sizeY, a.subarray(0, N), a.subarray(N, 2 * N), startCentre(s));
    if (r) out.push(r);
  }
  return out;
}

const spurs = fromFolder(join(ROOT, "recipes"), "spur-narrows-128-");
const ridge = fromFolder(join(ROOT, "generated"), "riverValley-128-").slice(0, 30);
const ws: N[] = [];
const off: N[] = [];
for (const ref of listMaps()) {
  const p = join(ROOT, "measured", `${ref.key}.json`);
  if (!existsSync(p)) continue;
  const r = JSON.parse(readFileSync(p, "utf8"));
  const special = (r.mechanics?.special ?? []).filter((x: string) => x !== "caves: water under roofs" && x !== "unstable cores");
  if (!r.start || special.length || r.terrain.caveShare >= 0.05 || !r.checks["start.dry"].ok) continue;
  const l = loadMap(ref);
  const w = l.file!.world;
  const set = readSettled(ref.key, w.sizeX * w.sizeY)!;
  const n = measure(surfaceOf(w), w.sizeX, w.sizeY, set.depth, set.contam, r.start);
  if (n) (ref.source === "workshop" ? ws : off).push(n);
}
const sum = (a: N[]) => ({
  maps: a.length,
  damLength: stat(a.map((x) => x.length), 1),
  shoulderCV: stat(a.map((x) => x.shoulderCV)),
  shoulderStd: stat(a.map((x) => x.shoulderStd)),
  crestStd: stat(a.map((x) => x.crestStd)),
  crestCV: stat(a.map((x) => x.crestCV)),
});
const out = { note: "The best dam site within 40 tiles of the start (the validator's), measured where it is", spurs128: sum(spurs), straightRidge128: sum(ridge), workshop: sum(ws), official: sum(off) };
writeFileSync(join(ROOT, "narrows.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
