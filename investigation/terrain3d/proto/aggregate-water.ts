// Turn the local per-map water comparisons into the committed results: every official map's row
// (the game's own maps), and aggregates only for the workshop maps (other creators' maps are
// never committed, nor their per-map numbers).
//
//   npx tsx investigation/terrain3d/proto/aggregate-water.ts <scratch dir with water-*.json> [--out investigation/terrain3d/results]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const i = process.argv.indexOf("--out");
const out = i >= 0 ? process.argv[i + 1] : "investigation/terrain3d/results";
mkdirSync(out, { recursive: true });

type Row = Record<string, any>;
const load = (f: string): Row[] => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : []);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pick = (c: Row | undefined) =>
  c && {
    iou: r3(c.iou), iouRoofed: r3(c.iouRoofed), iouOpen: r3(c.iouOpen), tileIou: r3(c.tileIou),
    wetStored: c.wetStored, wetSim: c.wetSim, roofedStored: c.roofedStored, roofedSim: c.roofedSim,
    depthAgree: r3(c.depthAgree), depthAgreeRoofed: r3(c.depthAgreeRoofed), meanErr: r3(c.meanErr ?? 0), p99Err: r3(c.p99Err ?? 0), maxErr: r3(c.maxErr ?? 0),
    volRatio: r3(c.volSim / Math.max(1e-9, c.volStored)), overflowStored: c.overflowStored, overflowSim: c.overflowSim, maxOverflowErr: r3(c.maxOverflowErr ?? 0),
    ...(c.settled !== undefined ? { settled: c.settled, ticks: c.ticks, cpuMs: c.cpuMs } : {}),
  };

// official: every map, every run we have, merged by name
const official = new Map<string, Row>();
for (const f of ["water-official-game.json", "water-official-game-canonical.json", "water-official-port-canonical.json"]) {
  for (const r of load(f)) {
    const o = official.get(r.name) ?? { name: r.name, size: `${r.W}x${r.H}`, multiRunTiles: r.multiRunTiles, multiWaterTiles: r.multiWaterTiles, roofedColumns: r.roofedCols, levels: r.levels, runningEmitters: r.running };
    const mode = f.includes("port") ? "port" : "game";
    if (r.hold) o[`hold_${mode}${f.includes("canonical") ? "" : "_noMomentum"}`] = { ...pick(r.hold), momentumEntries: r.momentumEntries, momentumDropped: r.momentumDropped };
    if (r.empty) o[`empty_${mode}`] = pick(r.empty);
    if (r.canonical) o[`canonical_${mode}`] = pick(r.canonical);
    if (r.flat) o.heightfieldToday = { tileIou: r3(r.flat.tileIou), settled: r.flat.settled, ticks: r.flat.ticks };
    official.set(r.name, o);
  }
}

// workshop: aggregates by era, never per map
const quant = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => r3(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
  return s.length ? { n: s.length, p10: q(0.1), median: q(0.5), p90: q(0.9), atLeast099: s.filter((x) => x >= 0.99).length } : { n: 0 };
};
const ws: Row[] = [...load("water-workshop-game.json")];
const wsCanon = new Map(load("water-workshop-game-canonical.json").map((r) => [r.name, r]));
const eraOf = (r: Row) => (String(r.gameVersion).startsWith("1.") ? "1.0+" : "pre-1.0");
const workshop: Row = {};
for (const era of ["1.0+", "pre-1.0"]) {
  const g = ws.filter((r) => eraOf(r) === era);
  const canon = g.map((r) => wsCanon.get(r.name)).filter(Boolean) as Row[];
  const has = (c: Row | undefined) => c && c.roofedStored > 0;
  workshop[era] = {
    maps: g.length,
    savedWithMigrator: g.filter((r) => r.migrated).length,
    multiRunTilesMedian: quant(g.map((r) => r.multiRunTiles)).median,
    emptyStart: {
      iou: quant(g.map((r) => r.empty.iou)),
      iouRoofed: quant(g.filter((r) => has(r.empty)).map((r) => r.empty.iouRoofed)),
      tileIou: quant(g.map((r) => r.empty.tileIou)),
      settledIn6Days: g.filter((r) => r.empty.settled).length,
    },
    holdWithMomentum: canon.length
      ? { iou: quant(canon.filter((r) => r.hold).map((r) => r.hold.iou)), iouRoofed: quant(canon.filter((r) => has(r.hold)).map((r) => r.hold.iouRoofed)), depthAgree: quant(canon.filter((r) => r.hold).map((r) => r.hold.depthAgree)) }
      : null,
    canonical: canon.length
      ? { iou: quant(canon.map((r) => r.canonical.iou)), iouRoofed: quant(canon.filter((r) => has(r.canonical)).map((r) => r.canonical.iouRoofed)), tileIou: quant(canon.map((r) => r.canonical.tileIou)), settledIn6Days: canon.filter((r) => r.canonical.settled).length }
      : null,
    heightfieldToday: { tileIou: quant(g.filter((r) => r.flat).map((r) => r.flat.tileIou)) },
  };
}
writeFileSync(join(out, "water-official.json"), JSON.stringify([...official.values()], null, 1) + "\n");
writeFileSync(join(out, "water-workshop.json"), JSON.stringify(workshop, null, 1) + "\n");
console.log(JSON.stringify(workshop, null, 1));
