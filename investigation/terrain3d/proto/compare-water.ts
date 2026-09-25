// How well the stacked-column water matches the water the maps themselves store.
//
// For every map with terrain above terrain (official maps, and the local workshop maps: read only,
// never committed), these runs:
//  hold:      start from the file's own water and momentum and run one game day with the map's
//             running sources. If our rules are the game's, a stored steady state stays put.
//  empty:     start from no water and run the §11.3 settle test (up to `--days` game days).
//  canonical: (--canonical) the proposed canonical settle: the 3D pre-fill, then the settle test.
//  flat:      today's product: the heightfield port's canonical settle on the top surface.
// Each is compared with the stored water, column by column (a column is one air gap of a tile,
// wet when deeper than 0.05), separately for roofed columns (ceiling below the open sky) and open
// ones. Per-map rows go to the scratch output; only official maps and aggregates are committed.
//
//   npx tsx investigation/terrain3d/proto/compare-water.ts --out <dir> [--maps official|workshop|all]
//        [--days 6] [--mode game|port] [--only Hollows,Pressure] [--canonical] [--no-hold]
//        [--no-empty] [--no-flat]

import { readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadMap, type LoadedMap } from "./loadmap";
import { StackSim, settle, type Mode } from "./stackwater";
import { prefill3d } from "./prefill3d";
import { OPEN_CEILING } from "./columns";
import { readTimber } from "../../../src/core/format/timber";
import { normalizeImport } from "../../../src/core/format/normalize";
import { surfaceOf } from "../../../src/core/format/world";
import { waterModelFromWorld } from "../../../src/core/sim/model";
import { canonicalSettle } from "../../../src/core/sim/prefill";
import { readFileSync } from "node:fs";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const outDir = arg("out", "out/terrain3d");
const which = arg("maps", "all");
const days = Number(arg("days", "6"));
const mode = arg("mode", "game") as Mode;
const only = arg("only", "").split(",").filter(Boolean);
const skipEmpty = process.argv.includes("--no-empty");
const skipFlat = process.argv.includes("--no-flat");
const skipHold = process.argv.includes("--no-hold");
const canon = process.argv.includes("--canonical");
mkdirSync(outDir, { recursive: true });

const WET = 0.05;
const OFFICIAL = "C:/Users/Kyler/code/DamGoodMaps/investigation/raw/builtin";
const WORKSHOP = "C:/dgm-workshop/items";

interface MapRef { name: string; path: string; source: "official" | "workshop" }

function listMaps(): MapRef[] {
  const out: MapRef[] = [];
  if (which !== "workshop" && existsSync(OFFICIAL)) {
    for (const f of readdirSync(OFFICIAL).sort()) {
      if (!f.endsWith(".timber") || f.startsWith("_")) continue;
      out.push({ name: f.replace(/\.timber$/, ""), path: join(OFFICIAL, f), source: "official" });
    }
  }
  if (which !== "official" && existsSync(WORKSHOP)) {
    for (const id of readdirSync(WORKSHOP).sort()) {
      const dir = join(WORKSHOP, id);
      for (const f of readdirSync(dir)) if (f.endsWith(".timber")) out.push({ name: `w${id}`, path: join(dir, f), source: "workshop" });
    }
  }
  return only.length ? out.filter((m) => only.some((o) => m.name.includes(o))) : out;
}

interface Cmp {
  wetStored: number; wetSim: number; iou: number;
  roofedStored: number; roofedSim: number; iouRoofed: number;
  openStored: number; openSim: number; iouOpen: number;
  /** Share of the union of wet columns whose depths agree within 0.05 (0.25 on roofed ones). */
  depthAgree: number; depthAgreeRoofed: number;
  volStored: number; volSim: number; volRoofedStored: number; volRoofedSim: number;
  overflowStored: number; overflowSim: number;
  /** Tiles (any column) wet in both / in either. */
  tileIou: number;
  /** Depth error over the union of wet columns: largest, mean, and 99th percentile; roofed only. */
  maxErr: number; meanErr: number; p99Err: number; maxErrRoofed: number; meanErrRoofed: number;
  /** Largest overflow (pressure) difference. */
  maxOverflowErr: number;
}

function compare(lm: LoadedMap, D: Float64Array, O: Float64Array | null): Cmp {
  const { cols, stored } = lm;
  const N = cols.N;
  const r: Cmp = { wetStored: 0, wetSim: 0, iou: 0, roofedStored: 0, roofedSim: 0, iouRoofed: 0, openStored: 0, openSim: 0, iouOpen: 0, depthAgree: 0, depthAgreeRoofed: 0, volStored: 0, volSim: 0, volRoofedStored: 0, volRoofedSim: 0, overflowStored: 0, overflowSim: 0, tileIou: 0, maxErr: 0, meanErr: 0, p99Err: 0, maxErrRoofed: 0, meanErrRoofed: 0, maxOverflowErr: 0 };
  const errs: number[] = [];
  let sumErrR = 0;
  let inter = 0, union = 0, interR = 0, unionR = 0, interO = 0, unionO = 0, agree = 0, agreeR = 0;
  let tInter = 0, tUnion = 0;
  for (let i = 0; i < N; i++) {
    let ts = false, tp = false;
    for (let s = 0; s < cols.count[i]; s++) {
      const c = s * N + i;
      const roofed = cols.ceil[c] < OPEN_CEILING;
      const ds = stored.depth[c];
      const dp = D[c];
      const ws = ds > WET;
      const wp = dp > WET;
      ts ||= ws;
      tp ||= wp;
      r.volStored += ds + stored.overflow[c];
      r.volSim += dp + (O ? O[c] : 0);
      if (stored.overflow[c] > 0) r.overflowStored++;
      if (O && O[c] > 0) r.overflowSim++;
      if (roofed) { r.volRoofedStored += ds + stored.overflow[c]; r.volRoofedSim += dp + (O ? O[c] : 0); }
      if (ws) r.wetStored++;
      if (wp) r.wetSim++;
      if (ws && wp) inter++;
      const oe = Math.abs(stored.overflow[c] - (O ? O[c] : 0));
      if (oe > r.maxOverflowErr) r.maxOverflowErr = oe;
      if (ws || wp) {
        union++;
        const err = Math.abs(ds - dp);
        errs.push(err);
        if (err > r.maxErr) r.maxErr = err;
        if (roofed) { sumErrR += err; if (err > r.maxErrRoofed) r.maxErrRoofed = err; }
        const tol = roofed ? 0.25 : 0.05;
        if (Math.abs(ds - dp) <= tol) { agree++; if (roofed) agreeR++; }
      }
      if (roofed) {
        if (ws) r.roofedStored++;
        if (wp) r.roofedSim++;
        if (ws && wp) interR++;
        if (ws || wp) unionR++;
      } else {
        if (ws) r.openStored++;
        if (wp) r.openSim++;
        if (ws && wp) interO++;
        if (ws || wp) unionO++;
      }
    }
    if (ts && tp) tInter++;
    if (ts || tp) tUnion++;
  }
  r.iou = union ? inter / union : 1;
  r.iouRoofed = unionR ? interR / unionR : 1;
  r.iouOpen = unionO ? interO / unionO : 1;
  r.depthAgree = union ? agree / union : 1;
  r.depthAgreeRoofed = unionR ? agreeR / unionR : 1;
  r.tileIou = tUnion ? tInter / tUnion : 1;
  if (errs.length) {
    let sum = 0;
    for (const e of errs) sum += e;
    r.meanErr = sum / errs.length;
    errs.sort((a, b) => a - b);
    r.p99Err = errs[Math.min(errs.length - 1, Math.floor(0.99 * errs.length))];
  }
  r.meanErrRoofed = unionR ? sumErrR / unionR : 0;
  return r;
}

/** Today's product on the same map: the heightfield canonical settle on the top surface, compared
 *  tile by tile (any stored column wet) since it has one column per tile. */
function flatBaseline(path: string, lm: LoadedMap): { tileIou: number; ticks: number; settled: boolean; cpuMs: number } {
  const file = readTimber(new Uint8Array(readFileSync(path)));
  normalizeImport(file);
  const m = waterModelFromWorld(file.world, surfaceOf(file.world));
  const t0 = process.cpuUsage();
  const r = canonicalSettle(m);
  const t = process.cpuUsage(t0);
  const N = lm.cols.N;
  let inter = 0, union = 0;
  for (let i = 0; i < N; i++) {
    let ws = false;
    for (let s = 0; s < lm.cols.count[i]; s++) if (lm.stored.depth[s * N + i] > WET) ws = true;
    const wp = r.depth[i] > WET;
    if (ws && wp) inter++;
    if (ws || wp) union++;
  }
  return { tileIou: union ? inter / union : 1, ticks: r.ticks, settled: r.settled, cpuMs: Math.round((t.user + t.system) / 1000) };
}

const results: Record<string, unknown>[] = [];
for (const ref of listMaps()) {
  let lm: LoadedMap;
  try {
    lm = loadMap(ref.path, ref.name);
  } catch (e) {
    console.log(`${ref.name}\tskipped: ${(e as Error).message}`);
    continue;
  }
  const N = lm.cols.N;
  let multiRunTiles = 0, multiWaterTiles = 0, roofedCols = 0;
  for (let i = 0; i < N; i++) {
    if (lm.runs.count[i] > 1) multiRunTiles++;
    if (lm.cols.count[i] > 1) multiWaterTiles++;
    for (let s = 0; s < lm.cols.count[i]; s++) if (lm.cols.ceil[s * N + i] < OPEN_CEILING) roofedCols++;
  }
  if (multiRunTiles === 0 && multiWaterTiles === 0) continue; // a plain heightfield: nothing to test
  if (!lm.stored.ok) { console.log(`${ref.name}\tno stored water`); continue; }
  const row: Record<string, unknown> = {
    name: ref.name, source: ref.source, W: lm.W, H: lm.H, gameVersion: lm.gameVersion, migrated: lm.migrated,
    multiRunTiles, multiWaterTiles, roofedCols, levels: lm.cols.L, emitters: lm.model.emitters.length,
    running: lm.model.emitters.filter((e) => e.strength > 0).length,
  };
  // hold: one day from the stored state
  if (!skipHold) {
    const sim = new StackSim(lm.model, mode);
    sim.setState(lm.stored.depth, lm.stored.overflow, lm.stored.cont);
    row.momentumDropped = sim.setMomentum(lm.stored.momentum);
    row.momentumEntries = lm.stored.momentum.length;
    const t0 = process.cpuUsage();
    sim.run(768);
    const t = process.cpuUsage(t0);
    row.hold = { ...compare(lm, sim.D, sim.O), cpuMs: Math.round((t.user + t.system) / 1000) };
  }
  if (!skipEmpty) {
    const sim = new StackSim(lm.model, mode);
    const t0 = process.cpuUsage();
    const s = settle(sim, days);
    const t = process.cpuUsage(t0);
    row.empty = { ...compare(lm, sim.D, sim.O), settled: s.settled, ticks: s.ticks, cpuMs: Math.round((t.user + t.system) / 1000), edgeOut: sim.edgeOutflow() };
  }
  if (canon) {
    // the proposed canonical settle: the 3D pre-fill, then the §11.3 test
    const sim = new StackSim(lm.model, mode);
    const pf = prefill3d(sim);
    sim.setState(pf.depth, pf.overflow, pf.cont);
    const t0 = process.cpuUsage();
    const s = settle(sim, days);
    const t = process.cpuUsage(t0);
    row.canonical = { ...compare(lm, sim.D, sim.O), settled: s.settled, ticks: s.ticks, cpuMs: Math.round((t.user + t.system) / 1000) };
  }
  if (!skipFlat) row.flat = flatBaseline(ref.path, lm);
  results.push(row);
  const h = (row.hold ?? row.canonical ?? row.empty) as Cmp;
  const e = (row.canonical ?? row.empty) as (Cmp & { settled: boolean; ticks: number }) | undefined;
  const f = row.flat as { tileIou: number } | undefined;
  console.log(
    [ref.name, `${lm.W}x${lm.H}`, `multi-run ${multiRunTiles}`, `roofed wet stored ${h.roofedStored}`,
      `hold iou ${h.iou.toFixed(3)} roofed ${h.iouRoofed.toFixed(3)} depth ${h.depthAgree.toFixed(3)} vol ${(h.volSim / Math.max(h.volStored, 1e-9)).toFixed(3)}`,
      e ? `${row.canonical ? "canonical" : "empty"} iou ${e.iou.toFixed(3)} roofed ${e.iouRoofed.toFixed(3)} tile ${e.tileIou.toFixed(3)} ${e.settled ? "settled" : "not settled"} ${e.ticks}` : "",
      f ? `flat tile iou ${f.tileIou.toFixed(3)}` : ""].join("\t"),
  );
  writeFileSync(join(outDir, `water-${which}-${mode}${canon ? "-canonical" : ""}.json`), JSON.stringify(results, null, 1));
}
console.log(`${results.length} maps compared; rows in ${join(outDir, `water-${which}-${mode}${canon ? "-canonical" : ""}.json`)}`);
