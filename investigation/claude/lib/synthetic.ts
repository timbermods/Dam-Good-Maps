// Synthetic maps for the vocabulary tests: a tilted plain with one drawn river, in any direction,
// built by the real pipeline (the river planner, the rasterizer and the canonical water settle).

import { buildMap, type BuildResult } from "../../../src/core/features/build";
import type { PlanContext } from "../../../src/core/features/setpieces";
import type { Feature, Point, StartFeature } from "../../../src/core/features/schema";
import { planRiver } from "../../../src/core/doc/tools";
import type { MapView } from "./view";

let n = 0;

/** A W×H plain that falls from `high` to `low` toward `downhill` (a compass direction), with a
 *  river drawn through `points` (source first) and, optionally, a start. */
export function syntheticMap(opts: { W?: number; H?: number; points: Point[]; downhill: "north" | "south" | "east" | "west"; flow?: number; start?: [number, number]; high?: number; low?: number }): { view: MapView; built: BuildResult; features: Feature[] } {
  const W = opts.W ?? 96;
  const H = opts.H ?? 96;
  const high = opts.high ?? 12;
  const low = opts.low ?? 4;
  const heights = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = opts.downhill === "east" ? x / (W - 1) : opts.downhill === "west" ? 1 - x / (W - 1) : opts.downhill === "north" ? y / (H - 1) : 1 - y / (H - 1);
      heights[y * W + x] = Math.round(high - t * (high - low));
    }
  const ctx: PlanContext = { W, H, seed: 1, features: [], heights, channel: new Uint8Array(W * H) };
  const r = planRiver({ points: opts.points, flow: opts.flow ?? 2 }, ctx, `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
  if (!r.ok) throw new Error(`river: ${r.errors.join("; ")}`);
  const features: Feature[] = [r.feature];
  if (opts.start) {
    const [sx, sy] = opts.start;
    const start: StartFeature = {
      id: "00000000-0000-4000-8000-5a0000000001",
      kind: "start",
      origin: "user",
      locked: false,
      params: { position: [sx, sy], orientation: "Cw0", benchRadius: 5, benchLevel: Math.max(1, heights[sy * W + sx]), player: 0 },
    };
    features.push(start);
  }
  // a plain landform carries the tilted ground: a hill outline over the whole map would level it,
  // so the ground comes from a base layer instead
  const built = buildMap({ W, H, seed: 1, features, base: { heights, columns: new Map(), entities: [] } });
  const view: MapView = {
    W,
    H,
    heights: built.heights,
    water: built.water,
    contamination: built.contamination,
    soilContamination: built.soilContamination,
    moisture: built.moisture,
    channel: built.channel,
    features,
    entities: built.entities,
    start: built.start ? { x: built.start.x, y: built.start.y, z: built.start.z } : null,
    spec: null,
    name: "synthetic",
    premise: "",
    key: `synthetic-${n}`,
  };
  return { view, built, features };
}
