// Regenerates src/core/data/footprints.json from investigation/notes/footprints.json: the block
// layout of every map template (size, per-block matter-below rule, occupation flags, stackable top,
// OccupyAllBelow), in the compact form the validator and the placement code read.
//
//   npx tsx tools/export-footprints.ts

import { readFileSync, writeFileSync } from "node:fs";

const OCC: Record<string, number> = { Floor: 1, Bottom: 2, Top: 4, Corners: 8, Path: 16, Middle: 32, All: 63, None: 0 };
const BELOW: Record<string, string> = { G: "ground", GS: "groundOrStackable", A: "any", Air: "air", S: "stackable" };

interface Out {
  size: [number, number, number];
  flippable: boolean;
  overridable: boolean;
  /** [x, y, z, matterBelow, occupationFlags, stackableTop (0/1), occupyAllBelow (0/1)] */
  blocks: [number, number, number, string, number, number, number][];
  entrance?: [number, number, number];
}

const src = JSON.parse(readFileSync("investigation/notes/footprints.json", "utf8"));
const out: Record<string, Out> = {};
for (const [name, spec] of Object.entries<any>(src)) {
  if (name.startsWith("_")) continue;
  const blocks: Out["blocks"] = [];
  for (const [x, y, z, desc] of spec.blocks as [number, number, number, string][]) {
    const parts = desc.split(":");
    const below = BELOW[parts[0]];
    if (!below) throw new Error(`${name}: unknown matter-below ${parts[0]}`);
    let flags = 0;
    for (const o of parts[1].split("|")) {
      if (!(o in OCC)) throw new Error(`${name}: unknown occupation ${o}`);
      flags |= OCC[o];
    }
    const stack = parts.some((p) => p.startsWith("stack")) ? 1 : 0;
    const oab = parts.includes("OAB") ? 1 : 0;
    blocks.push([x, y, z, below, flags, stack, oab]);
  }
  const size = (typeof spec.size === "string" ? JSON.parse(spec.size) : spec.size) as [number, number, number];
  const entry: Out = {
    size,
    flippable: spec.flippable === true || spec.flippable === "True",
    overridable: spec.overridable === true || spec.overridable === "True",
    blocks,
  };
  if (spec.entrance_local) entry.entrance = (typeof spec.entrance_local === "string" ? JSON.parse(spec.entrance_local) : spec.entrance_local);
  out[name] = entry;
}
writeFileSync("src/core/data/footprints.json", JSON.stringify(out) + "\n");
console.log(`wrote ${Object.keys(out).length} templates`);
