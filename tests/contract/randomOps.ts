// Random edit operations for the E1 property tests (EDITOR_PLAN §9, §10): every kind the engine
// takes, drawn from a seeded stream so a failure reproduces. Each one targets what exists on the
// map now, so almost all pass their check; the rest must be rejected cleanly.

import type { MapSession } from "../../src/core/doc/session";
import type { EditOp } from "../../src/core/doc/ops";
import type { Feature, LandformFeature } from "../../src/core/features/schema";
import type { Orientation } from "../../src/core/format/footprints";
import { tilesToRuns } from "../../src/core/math/grid";
import type { Rng } from "../../src/core/math/rng";

const ORIENT: Orientation[] = ["Cw0", "Cw90", "Cw180", "Cw270"];

export function guid(rng: Rng): string {
  let hex = "";
  for (let i = 0; i < 32; i++) hex += "0123456789abcdef"[rng.int(0, 16)];
  const v = "89ab"[rng.int(0, 4)];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${v}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function rect(rng: Rng, W: number, H: number, maxW: number, maxH: number): { x0: number; y0: number; x1: number; y1: number } {
  const w = rng.int(2, maxW + 1);
  const h = rng.int(2, maxH + 1);
  const x0 = rng.int(1, W - w - 1);
  const y0 = rng.int(1, H - h - 1);
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
}

function rectRuns(r: { x0: number; y0: number; x1: number; y1: number }, W: number) {
  const tiles: number[] = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) tiles.push(y * W + x);
  return tilesToRuns(tiles, W);
}

const pick = <T>(rng: Rng, xs: readonly T[]): T | undefined => (xs.length ? xs[rng.int(0, xs.length)] : undefined);

/** One random operation for the session's current map, or null when the drawn kind has no target. */
export function randomOp(s: MapSession, rng: Rng): EditOp | null {
  const { x: W, y: H } = s.size;
  const features = s.features;
  const entities = s.built.entities;
  const byKind = (k: Feature["kind"]) => features.filter((f) => f.kind === k);
  const roll = rng.int(0, 100);
  if (roll < 12) {
    const f = pick(rng, [...byKind("forest"), ...byKind("berryPatch"), ...byKind("ruinField")]);
    if (!f) return null;
    if (f.kind === "forest") {
      const patch = [
        { density: Math.round(rng.range(0.2, 1) * 100) / 100 },
        { life: pick(rng, ["auto", "alive", "dead"] as const) },
        { youngShare: Math.round(rng.float() * 100) / 100 },
        { speciesMix: { Pine: 1, Oak: rng.int(0, 3) } },
      ][rng.int(0, 4)];
      return { op: "updateFeature", params: { id: f.id, patch: { params: patch } } };
    }
    if (f.kind === "berryPatch") return { op: "updateFeature", params: { id: f.id, patch: { params: { density: Math.round(rng.range(0.3, 1) * 100) / 100, ripeShare: Math.round(rng.float() * 100) / 100 } } } };
    return { op: "updateFeature", params: { id: f.id, patch: { params: { centerBias: Math.round(rng.range(0, 2) * 100) / 100 } } } };
  }
  if (roll < 17) {
    // terrain features of the generated layout: the terraces (the whole map), the valley floor
    const lf = pick(rng, byKind("landform")) as LandformFeature | undefined;
    if (!lf?.params.along) return null;
    if (lf.params.kind === "terraces") {
      const bands = (lf.params.along.bands ?? []).map((b, k) => (k === 0 ? { at: b.at + rng.int(-2, 3), rise: b.rise } : b));
      return { op: "updateFeature", params: { id: lf.id, patch: { params: { along: { bands } } } } };
    }
    return { op: "updateFeature", params: { id: lf.id, patch: { params: { along: { halfWidth: Math.max(4, lf.params.along.halfWidth + rng.int(-2, 3)) } } } } };
  }
  if (roll < 21) {
    const r = pick(rng, byKind("river"));
    if (!r || r.kind !== "river") return null;
    return { op: "updateFeature", params: { id: r.id, patch: { params: { flow: Math.round(r.params.flow * rng.range(0.7, 1.3) * 100) / 100 } } } };
  }
  if (roll < 25) {
    const st = pick(rng, byKind("start"));
    if (!st || st.kind !== "start") return null;
    const [x, y] = st.params.position;
    const nx = Math.min(W - 10, Math.max(9, x + rng.int(-2, 3)));
    const ny = Math.min(H - 10, Math.max(9, y + rng.int(-2, 3)));
    return { op: "updateFeature", params: { id: st.id, patch: { params: { position: [nx, ny] } } } };
  }
  if (roll < 38) {
    const id = guid(rng);
    const kind = pick(rng, ["plateau", "forest", "berryPatch", "ruinField", "lake"] as const)!;
    const r = rect(rng, W, H, 14, 12);
    if (kind === "plateau") {
      return {
        op: "addFeature",
        params: {
          feature: { id, kind: "landform", origin: "user", locked: false, params: { kind: "plateau", edgeStyle: "cliff", outline: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], height: rng.int(3, 17) } },
        },
      };
    }
    if (kind === "lake") {
      const sill = rng.int(3, 12);
      return {
        op: "addFeature",
        params: {
          feature: {
            id,
            kind: "lake",
            origin: "user",
            locked: false,
            params: { outline: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], floorDepth: 2, outlet: { at: [r.x1, r.y0], sill, to: "none" }, inflow: { spring: 1 }, planned: false },
          },
        },
      };
    }
    const area = rectRuns(r, W);
    if (kind === "forest") return { op: "addFeature", params: { feature: { id, kind: "forest", origin: "user", locked: false, params: { area, density: 0.8, speciesMix: { Birch: 1, Pine: 1 }, life: "auto", youngShare: 0.3 } } } };
    if (kind === "berryPatch") return { op: "addFeature", params: { feature: { id, kind: "berryPatch", origin: "claude", locked: false, params: { area, density: 1, ripeShare: 0.5 } } } };
    return { op: "addFeature", params: { feature: { id, kind: "ruinField", origin: "user", locked: false, params: { area, scrapTarget: 500, heightMix: [0.3, 0.2, 0.2, 0.1, 0.1, 0.05, 0.03, 0.02], centerBias: 0.5 } } } };
  }
  if (roll < 44) {
    const candidates = features.filter((f) => f.origin !== "generated" || f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField");
    const f = pick(rng, candidates);
    return f ? { op: "deleteFeature", params: { id: f.id } } : null;
  }
  if (roll < 46) {
    const f = pick(rng, features.filter((g) => g.origin !== "generated"));
    return f ? { op: "reorderFeature", params: { id: f.id, index: rng.int(0, features.length) } } : null;
  }
  if (roll < 60) {
    const mode = pick(rng, ["raise", "lower", "flatten", "terrace", "smooth"] as const)!;
    const cells = rectRuns(rect(rng, W, H, 10, 8), W);
    if (mode === "raise" || mode === "lower") return { op: "sculpt", params: { mode, cells, amount: rng.int(1, 4) } };
    if (mode === "flatten") return { op: "sculpt", params: { mode, cells, level: rng.int(2, 15) } };
    if (mode === "terrace") return { op: "sculpt", params: { mode, cells, step: rng.int(2, 5) } };
    return { op: "sculpt", params: { mode, cells } };
  }
  if (roll < 67) {
    const template = pick(rng, ["Pine", "Oak", "BlueberryBush", "RuinColumnH3", "Thorns", "Blockage", "WaterSource"])!;
    return { op: "placeEntity", params: { id: guid(rng), template, x: rng.int(1, W - 1), y: rng.int(1, H - 1), orientation: pick(rng, ORIENT)! } };
  }
  const movable = entities.filter((e) => /^(Pine|Birch|Oak|Succulent|BlueberryBush|RuinColumnH\d|Thorns|Blockage)$/.test(e.template));
  if (roll < 72) {
    const e = pick(rng, movable);
    if (!e) return null;
    return { op: "moveEntity", params: { id: e.id, x: Math.min(W - 2, Math.max(1, e.x + rng.int(-3, 4))), y: Math.min(H - 2, Math.max(1, e.y + rng.int(-3, 4))), orientation: pick(rng, ORIENT) } };
  }
  if (roll < 80) {
    const n = rng.int(1, 6);
    const ids = new Set<string>();
    for (let k = 0; k < n; k++) {
      const e = pick(rng, movable);
      if (e) ids.add(e.id);
    }
    return ids.size ? { op: "deleteEntities", params: { entities: [...ids] } } : null;
  }
  if (roll < 84) {
    const e = pick(rng, entities.filter((x) => x.template === "Pine" || x.template === "Oak" || x.template === "Birch"));
    if (!e) return null;
    return { op: "setEntityProps", params: { id: e.id, components: rng.float() < 0.5 ? { Growable: { GrowthProgress: Math.round(rng.range(0.2, 0.9) * 100) / 100 } } : { LivingNaturalResource: { IsDead: true } } } };
  }
  if (roll < 88) {
    const sl = pick(rng, entities.filter((e) => e.template === "Slope"));
    return sl ? { op: "removeSlope", params: { x: sl.x, y: sl.y } } : null;
  }
  if (roll < 91) return { op: "pinSlope", params: { x: rng.int(1, W - 1), y: rng.int(1, H - 1), orientation: pick(rng, ORIENT)! } };
  if (roll < 96) {
    const locks = s.state.locks;
    if (locks.length && rng.float() < 0.4) return { op: "setLock", params: { id: pick(rng, locks)!.id, region: null } };
    return { op: "setLock", params: { id: `lock-${rng.int(0, 1000)}`, region: { runs: rectRuns(rect(rng, W, H, 12, 12), W) } } };
  }
  // an invalid operation: it must be rejected with a reason, and change nothing
  return pick(rng, [
    { op: "sculpt", params: { mode: "naturalize", cells: [[1, 1, 3]] } },
    { op: "deleteFeature", params: { id: "f-aaaaaaaaaaaaa" } },
    { op: "moveEntity", params: { id: guid(rng), x: 1, y: 1 } },
    { op: "sculpt", params: { mode: "raise", cells: [[H + 3, 0, 4]], amount: 1 } },
    { op: "placeEntity", params: { id: guid(rng), template: "Maple", x: 3, y: 3, orientation: "Cw0" } },
    { op: "regenerateRegion", params: { area: { runs: [[1, 1, 4]] }, seedVariant: 1, layers: ["terrain"] } },
  ] as EditOp[])!;
}
