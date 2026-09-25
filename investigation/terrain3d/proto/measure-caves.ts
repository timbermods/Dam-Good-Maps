// How maps use terrain above terrain (step 2). For every map: the air under terrain ("roofed air":
// an air voxel with solid somewhere above it in its tile), split into 3D-connected spaces, each
// classified by its openings to the sky-open air and its depth:
//   shelter:  open on one side, every cell within 3 tiles of its opening (an overhang, a ledge's
//             underside, a cliff notch);
//   cave:     one opening cluster, reaching more than 3 tiles in;
//   tunnel:   two or more opening clusters at least 4 tiles apart, with a passage longer than 3;
//   arch:     two or more opening clusters, passage at most 3 long (a hole you can see through);
//   sealed:   no opening (a closed pocket).
// Plus: floating runs (solid over air that reaches down to the ground or z 0), terrain above 16,
// water under roofs (stored), starts under or beside a roof, resources and water objects under
// roofs, and slopes inside caves. Per-map rows stay local; aggregates are committed.
//
//   npx tsx investigation/terrain3d/proto/measure-caves.ts --out <dir>

import { readdirSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readTimber } from "../../../src/core/format/timber";
import { normalizeImport } from "../../../src/core/format/normalize";
import { mapObjects } from "../../../src/core/sim/model";
import { terrainRuns, waterColumns, OPEN_CEILING } from "./columns";
import { isObject, num, type JsonObject } from "../../../src/core/format/json";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const outDir = arg("out", "out/terrain3d");
mkdirSync(outDir, { recursive: true });
const OFFICIAL = "C:/Users/Kyler/code/DamGoodMaps/investigation/raw/builtin";
const WORKSHOP = "C:/dgm-workshop/items";

interface Space {
  kind: "shelter" | "cave" | "tunnel" | "arch" | "sealed";
  cells: number;
  tiles: number;
  floorTiles: number; // walkable floor cells (air on solid) in the space
  height: number; // tallest air gap
  reach: number; // deepest horizontal distance from an opening
  zMin: number;
  zMax: number;
  openings: number;
  wetColumns: number;
  /** Median layers of ground (and pockets) above the space, over its tiles. */
  roof: number;
}

function measure(path: string) {
  const file = readTimber(new Uint8Array(readFileSync(path)));
  const gameVersion = file.world.gameVersion;
  normalizeImport(file);
  const w = file.world;
  const W = w.sizeX, H = w.sizeY, N = W * H, Z = w.layers;
  const vox = w.voxels;
  const solid = (x: number, y: number, z: number) => vox[z * N + y * W + x] === 1;
  // top: first air layer above the topmost solid voxel
  const top = new Int16Array(N);
  for (let i = 0; i < N; i++) for (let z = Z - 1; z >= 0; z--) if (vox[z * N + i]) { top[i] = z + 1; break; }
  // roofed air: air below the tile's top solid voxel
  const roofed = (x: number, y: number, z: number) => z < top[y * W + x] - 1 && !solid(x, y, z) && hasSolidAbove(x, y, z);
  function hasSolidAbove(x: number, y: number, z: number) {
    const i = y * W + x;
    for (let zz = z + 1; zz < top[i]; zz++) if (vox[zz * N + i]) return true;
    return false;
  }
  const isRoofed = new Uint8Array(N * Z);
  let roofedCells = 0;
  for (let i = 0; i < N; i++) {
    let above = false;
    for (let z = top[i] - 1; z >= 0; z--) {
      if (vox[z * N + i]) above = true;
      else if (above) { isRoofed[z * N + i] = 1; roofedCells++; }
    }
  }
  void roofed;
  const runs = terrainRuns(W, H, vox, Z);
  let multiRun = 0, floating = 0, above16 = 0, maxTop = 0;
  for (let i = 0; i < N; i++) {
    if (runs.count[i] > 1) multiRun++;
    if (runs.ceil[i] === 0 && top[i] > 0) floating++;
    if (top[i] > 16) above16++;
    if (top[i] > maxTop) maxTop = top[i];
  }
  // water per column (stored)
  const objects = mapObjects(w);
  const cols = waterColumns(W, H, vox, objects, Z);
  const wm = w.singletons.WaterMapNew;
  const wetRoofed = new Uint8Array(N * Z); // roofed air cell under stored water
  let roofedWetCols = 0, pressurised = 0, roofedWaterVol = 0;
  if (isObject(wm) && isObject(wm.WaterColumns)) {
    const levels = num(wm.Levels ?? 1);
    const t = String((wm.WaterColumns as JsonObject).Array).split(" ");
    if (t.length >= levels * N) {
      for (let i = 0; i < N; i++) for (let s = 0; s < Math.min(levels, cols.count[i]); s++) {
        const tok = t[s * N + i];
        if (tok === "0") continue;
        const f = tok.split(":");
        const d = Number(f[0]) || 0, o = Number(f[2]) || 0;
        const c = s * N + i;
        if (d > 0.05 && cols.ceil[c] < OPEN_CEILING) {
          roofedWetCols++;
          roofedWaterVol += d + o;
          if (o > 0) pressurised++;
          for (let z = cols.floor[c]; z < Math.min(cols.ceil[c], cols.floor[c] + Math.ceil(d)); z++) if (z < Z) wetRoofed[z * N + i] = 1;
        }
      }
    }
  }
  // spaces: 6-connected components of roofed air
  const comp = new Int32Array(N * Z).fill(-1);
  const spaces: Space[] = [];
  const queue = new Int32Array(N * Z);
  const dist = new Int32Array(N * Z);
  for (let v0 = 0; v0 < N * Z; v0++) {
    if (!isRoofed[v0] || comp[v0] >= 0) continue;
    const id = spaces.length;
    let head = 0, tail = 0;
    queue[tail++] = v0;
    comp[v0] = id;
    const cells: number[] = [];
    while (head < tail) {
      const v = queue[head++];
      cells.push(v);
      const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
      const nb = [x > 0 ? v - 1 : -1, x < W - 1 ? v + 1 : -1, y > 0 ? v - W : -1, y < H - 1 ? v + W : -1, z > 0 ? v - N : -1, z < Z - 1 ? v + N : -1];
      for (const u of nb) if (u >= 0 && isRoofed[u] && comp[u] < 0) { comp[u] = id; queue[tail++] = u; }
    }
    // openings: cells beside (same z, 4-neighbour) open air, i.e. air that is not roofed; the map
    // edge counts as an opening too
    const mouths: number[] = [];
    const tiles = new Set<number>();
    let floorTiles = 0, zMin = Z, zMax = 0, wet = 0;
    const gapH = new Map<number, number>();
    const topZ = new Map<number, number>();
    for (const v of cells) {
      const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
      tiles.add(i);
      gapH.set(i, (gapH.get(i) ?? 0) + 1);
      if (z > (topZ.get(i) ?? -1)) topZ.set(i, z);
      if (z > 0 && vox[v - N]) floorTiles++;
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
      if (wetRoofed[v]) wet++;
      let mouth = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const u = z * N + yy * W + xx;
        if (!vox[u] && !isRoofed[u]) mouth = true;
      }
      if (mouth) mouths.push(v);
    }
    // opening clusters: 26-connected groups of mouth cells
    const mouthSet = new Set(mouths);
    const seen = new Set<number>();
    const clusters: { x: number; y: number }[] = [];
    for (const m of mouths) {
      if (seen.has(m)) continue;
      const st = [m];
      seen.add(m);
      let sx = 0, sy = 0, n = 0;
      while (st.length) {
        const v = st.pop()!;
        const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
        sx += x; sy += y; n++;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, zz = z + dz;
          if (xx < 0 || yy < 0 || zz < 0 || xx >= W || yy >= H || zz >= Z) continue;
          const u = zz * N + yy * W + xx;
          if (mouthSet.has(u) && !seen.has(u)) { seen.add(u); st.push(u); }
        }
      }
      clusters.push({ x: sx / n, y: sy / n });
    }
    // reach: BFS inside the space from its openings, horizontal steps counted
    for (const v of cells) dist[v] = -1;
    head = 0; tail = 0;
    for (const m of mouths) { dist[m] = 0; queue[tail++] = m; }
    let reach = 0;
    while (head < tail) {
      const v = queue[head++];
      const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
      const steps: [number, number][] = [];
      if (x > 0) steps.push([v - 1, 1]);
      if (x < W - 1) steps.push([v + 1, 1]);
      if (y > 0) steps.push([v - W, 1]);
      if (y < H - 1) steps.push([v + W, 1]);
      if (z > 0) steps.push([v - N, 0]);
      if (z < Z - 1) steps.push([v + N, 0]);
      for (const [u, c] of steps) {
        if (comp[u] !== id || dist[u] >= 0) continue;
        dist[u] = dist[v] + c;
        if (dist[u] > reach) reach = dist[u];
        queue[tail++] = u;
      }
    }
    let far = false;
    for (let a = 0; a < clusters.length && !far; a++) for (let b = a + 1; b < clusters.length; b++) {
      if (Math.abs(clusters[a].x - clusters[b].x) + Math.abs(clusters[a].y - clusters[b].y) >= 4) { far = true; break; }
    }
    let height = 0;
    for (const h of gapH.values()) if (h > height) height = h;
    const roofs = [...topZ.entries()].map(([i, z]) => top[i] - 1 - z).sort((a, b) => a - b);
    const roof = roofs[Math.floor(roofs.length / 2)];
    let kind: Space["kind"];
    if (!mouths.length) kind = "sealed";
    else if (clusters.length >= 2 && far) kind = reach > 1 ? "tunnel" : "arch";
    else kind = reach > 3 ? "cave" : "shelter";
    spaces.push({ kind, cells: cells.length, tiles: tiles.size, floorTiles, height, reach, zMin, zMax, openings: clusters.length, wetColumns: wet, roof });
  }
  // objects under roofs
  const underRoof = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x;
    for (let zz = z; zz < top[i]; zz++) if (vox[zz * N + i]) return true;
    return false;
  };
  let start: { under: boolean; beside: boolean; z: number; top: number } | null = null;
  let treesUnder = 0, bushesUnder = 0, ruinsUnder = 0, sourcesUnder = 0, slopesUnder = 0, relicsUnder = 0, overhangObjects = 0, drains = 0;
  for (const o of objects) {
    const t = o.template;
    const u = underRoof(o.x, o.y, o.z);
    if (t === "StartingLocation") {
      // under: a roof over the 5×5 round the anchor (it holds the 3×3 footprint in any facing);
      // beside: a roof within 5 tiles of the anchor, at or above the start's level
      let under = false, beside = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (underRoof(o.x + dx, o.y + dy, o.z)) under = true;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (underRoof(o.x + dx, o.y + dy, o.z)) beside = true;
      start = { under, beside, z: o.z, top: top[o.y * W + o.x] };
    } else if (/^(Pine|Birch|Oak|Maple|ChestnutTree|Mangrove|Succulent)$/.test(t)) { if (u) treesUnder++; }
    else if (t === "BlueberryBush" || t === "Dandelion" || t === "CoffeeBush") { if (u) bushesUnder++; }
    else if (t.startsWith("RuinColumn")) { if (u) ruinsUnder++; }
    else if (/Source|Seep|Aquifer/.test(t)) { if (u) sourcesUnder++; }
    else if (t === "Slope") { if (u) slopesUnder++; }
    else if (/Relic/.test(t)) { if (u) relicsUnder++; }
    if (t.startsWith("NaturalOverhang")) overhangObjects++;
    if (t === "BadtideDrain") drains++;
  }
  return { W, H, gameVersion, roofedCells, multiRun, floating, above16, maxTop, roofedWetCols, pressurised, roofedWaterVol, spaces, start, treesUnder, bushesUnder, ruinsUnder, sourcesUnder, slopesUnder, relicsUnder, overhangObjects, drains };
}

const refs: { name: string; path: string; source: string }[] = [];
if (existsSync(OFFICIAL)) for (const f of readdirSync(OFFICIAL).sort()) if (f.endsWith(".timber") && !f.startsWith("_")) refs.push({ name: f.replace(/\.timber$/, ""), path: join(OFFICIAL, f), source: "official" });
if (existsSync(WORKSHOP)) for (const id of readdirSync(WORKSHOP).sort()) for (const f of readdirSync(join(WORKSHOP, id))) if (f.endsWith(".timber")) refs.push({ name: `w${id}`, path: join(WORKSHOP, id, f), source: "workshop" });
const rows: Record<string, unknown>[] = [];
for (const r of refs) {
  try {
    const m = measure(r.path);
    const era = /^1\./.test(m.gameVersion) ? "1.0+" : "pre-1.0";
    rows.push({ name: r.name, source: r.source, era, ...m });
    const big = m.spaces.filter((s) => s.cells >= 8);
    const count = (k: string) => big.filter((s) => s.kind === k).length;
    console.log(`${r.name}\t${m.W}x${m.H}\t${era}\troofed ${m.roofedCells}\tspaces ${big.length} (cave ${count("cave")}, tunnel ${count("tunnel")}, arch ${count("arch")}, shelter ${count("shelter")}, sealed ${count("sealed")})\twet roofed ${m.roofedWetCols}\tmaxTop ${m.maxTop}`);
  } catch (e) {
    console.log(`${r.name}\tskipped: ${(e as Error).message}`);
  }
}
writeFileSync(join(outDir, "caves.json"), JSON.stringify(rows));
console.log(`${rows.length} maps measured`);
