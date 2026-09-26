// The edge-wall rule (terrain.edge_wall, src/core/analysis/edges.ts; D151) over a set
// of maps: how much of each map's most walled edge is walled, and which maps have an edge wall.
// Information for choosing and checking the thresholds; nothing it reads is committed.
//
//   npx tsx tools/edge-walls.ts <.timber files or folders>...   (official or workshop maps, locally)
//   npx tsx tools/edge-walls.ts --places                          (public/real-places/data)
//   npx tsx tools/edge-walls.ts --generated 1-30 --size 128       (every theme, the defaults)
//
// Prints one line per map (most walled edge's share, and the walled edges), then how many maps
// have an edge wall and the largest share among the rest.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EDGE_SHARE, edgeRuleApplies, edgeWalls } from "../src/core/analysis/edges";
import { readTimber } from "../src/core/format/timber";
import { surfaceOf } from "../src/core/format/world";
import { generate } from "../src/core/gen/generate";
import { decodeHeights, decodePlaceFile } from "../src/core/places/place";
import { AVAILABLE_THEMES, makeSpec } from "../src/core/spec/mapspec";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const maps: { name: string; W: number; H: number; h: ArrayLike<number> }[] = [];
if (process.argv.includes("--places")) {
  const dir = "public/real-places/data";
  for (const n of readdirSync(dir).sort()) {
    const p = decodePlaceFile(new Uint8Array(readFileSync(join(dir, n))));
    maps.push({ name: p.id, W: p.W, H: p.H, h: decodeHeights(p.heights) });
  }
} else if (process.argv.includes("--generated")) {
  const [a, b] = arg("generated", "1-30").split("-").map(Number);
  const size = Number(arg("size", "128"));
  for (const theme of AVAILABLE_THEMES)
    for (let seed = a; seed <= (b ?? a); seed++) {
      const r = generate(makeSpec({ seed, theme, size: { x: size, y: size } }));
      maps.push({ name: `${theme} ${seed} ${size}²`, W: size, H: size, h: r.built.heights });
    }
} else {
  const files: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) for (const n of readdirSync(p).sort()) walk(join(p, n));
    else if (p.endsWith(".timber")) files.push(p);
  };
  for (const p of process.argv.slice(2)) if (existsSync(p)) walk(p);
  for (const p of files) {
    try {
      const f = readTimber(new Uint8Array(readFileSync(p)));
      maps.push({ name: p, W: f.world.sizeX, H: f.world.sizeY, h: surfaceOf(f.world) });
    } catch (e) {
      console.log(`skipped ${p}: ${(e as Error).message}`);
    }
  }
}

let walled = 0;
let most = 0;
for (const m of maps) {
  if (!edgeRuleApplies(m.W, m.H)) {
    console.log(`${m.name}: too small`);
    continue;
  }
  const edges = edgeWalls(m.h, m.W, m.H);
  const top = Math.max(...edges.map((e) => e.share));
  const hit = edges.filter((e) => e.share >= EDGE_SHARE);
  if (hit.length) walled++;
  else most = Math.max(most, top);
  console.log(`${m.name}: ${Math.round(top * 100)}%${hit.length ? `  WALL on ${hit.map((e) => `${e.edge} ${Math.round(e.share * 100)}%`).join(", ")}` : ""}`);
}
console.log(`\n${walled} of ${maps.length} maps have an edge wall (${Math.round(EDGE_SHARE * 100)}% of an edge); the others' most walled edge is at most ${Math.round(most * 100)}%`);
