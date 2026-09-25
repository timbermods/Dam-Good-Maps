// Step 2's committed numbers from measure-caves' local rows: per map for the official maps, and
// aggregates only for the workshop maps (split by era: saved by 1.0 or later, or before).
// Spaces smaller than 8 cells (a stray notch) are left out.
//
//   npx tsx investigation/terrain3d/proto/aggregate-caves.ts <caves.json> [--out investigation/terrain3d/results]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const rows = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, any>[];
const i = process.argv.indexOf("--out");
const out = i >= 0 ? process.argv[i + 1] : "investigation/terrain3d/results";
mkdirSync(out, { recursive: true });
const KINDS = ["cave", "tunnel", "arch", "shelter", "sealed"] as const;
const q = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return s.length ? { n: s.length, median: at(0.5), p90: at(0.9), max: s[s.length - 1] } : { n: 0 };
};

function summary(g: Record<string, any>[]) {
  const big = (r: Record<string, any>) => (r.spaces as any[]).filter((s) => s.cells >= 8);
  const withAny = g.filter((r) => big(r).length > 0);
  const share = (r: Record<string, any>) => r.multiRun / (r.W * r.H);
  const perKind: Record<string, unknown> = {};
  for (const k of KINDS) {
    const counts = g.map((r) => big(r).filter((s) => s.kind === k).length);
    const spaces = g.flatMap((r) => big(r).filter((s) => s.kind === k));
    perKind[k] = {
      mapsWithOne: counts.filter((c) => c > 0).length,
      perMap: q(counts.filter((c) => c > 0)),
      cells: q(spaces.map((s) => s.cells)),
      tiles: q(spaces.map((s) => s.tiles)),
      height: q(spaces.map((s) => s.height)),
      reach: q(spaces.map((s) => s.reach)),
      roof: q(spaces.map((s) => s.roof)),
      floorLevel: q(spaces.map((s) => s.zMin)),
      withWater: spaces.filter((s) => s.wetColumns > 0).length,
      of: spaces.length,
    };
  }
  return {
    maps: g.length,
    withRoofedSpaces: withAny.length,
    multiRunShareAtLeast5pc: g.filter((r) => share(r) >= 0.05).length,
    multiRunShare: q(withAny.map((r) => Math.round(share(r) * 1000) / 1000)),
    perKind,
    water: {
      mapsWithRoofedWater: g.filter((r) => r.roofedWetCols > 0).length,
      roofedWetColumns: q(g.filter((r) => r.roofedWetCols > 0).map((r) => r.roofedWetCols)),
      mapsWithPressure: g.filter((r) => r.pressurised > 0).length,
      sourcesUnderRoofsMaps: g.filter((r) => r.sourcesUnder > 0).length,
    },
    starts: {
      underARoof: g.filter((r) => r.start?.under).length,
      within5OfARoof: g.filter((r) => r.start?.beside).length,
      measured: g.filter((r) => r.start).length,
    },
    underRoofs: {
      mapsWithTrees: g.filter((r) => r.treesUnder > 0).length,
      mapsWithBushes: g.filter((r) => r.bushesUnder > 0).length,
      mapsWithRuins: g.filter((r) => r.ruinsUnder > 0).length,
      mapsWithRelics: g.filter((r) => r.relicsUnder > 0).length,
      mapsWithSlopes: g.filter((r) => r.slopesUnder > 0).length,
      walkableFloorTilesPerMap: q(g.map((r) => big(r).reduce((s: number, x: any) => s + x.floorTiles, 0)).filter((v) => v > 0)),
    },
    floatingGround: g.filter((r) => r.floating > 0).length,
    above16: g.filter((r) => r.above16 > 0).length,
    naturalOverhangObjects: g.filter((r) => r.overhangObjects > 0).length,
    badtideDrains: g.filter((r) => r.drains > 0).length,
  };
}

const official = rows.filter((r) => r.source === "official");
const ws = rows.filter((r) => r.source === "workshop");
const result = {
  note: "Spaces of 8+ cells of air under terrain, by kind (see proto/measure-caves.ts). Workshop maps: aggregates only.",
  official: summary(official),
  officialPerMap: official.map((r) => {
    const big = (r.spaces as any[]).filter((s) => s.cells >= 8);
    const count = (k: string) => big.filter((s) => s.kind === k).length;
    return { name: r.name, size: `${r.W}x${r.H}`, multiRunTiles: r.multiRun, caves: count("cave"), tunnels: count("tunnel"), arches: count("arch"), shelters: count("shelter"), sealed: count("sealed"), roofedWetColumns: r.roofedWetCols, pressurised: r.pressurised, startUnderRoof: r.start?.under ?? null, maxTop: r.maxTop };
  }),
  workshop10plus: summary(ws.filter((r) => r.era === "1.0+")),
  workshopPre10: summary(ws.filter((r) => r.era === "pre-1.0")),
};
writeFileSync(join(out, "caves.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ official: result.official, w10: result.workshop10plus }, null, 1).slice(0, 6000));
