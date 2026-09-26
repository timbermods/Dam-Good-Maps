// A natural narrows on a river, as an edit (#63: no Dam site tool in the editor; the builder stays an
// internal operation for M12's Claude, ROADMAP M9a "Keep M12 ready"): two hillside spurs closing in
// from the banks (land/narrows.ts), written as flattens of the ground they raise, one per level, so
// the edit log keeps them and undo takes them back. The channel keeps its gap: a dam across it is
// the player's to build.

import { hash32 } from "../math/hash";
import { tilesToRuns } from "../math/grid";
import { planNarrows } from "../land/narrows";
import type { EditOp } from "./ops";
import type { MapSession } from "./session";

export interface NarrowsEditRequest {
  /** The river's feature id. */
  river: string;
  /** Where along it, 0–1 of its length from its head. */
  at: number;
  /** How far each spur reaches toward the river, 0.5–1 (default 0.8). */
  reach?: number;
  /** Levels the spurs stand above the channel's banks at their roots, 1–4 (default 2). */
  rise?: number;
}

export type NarrowsEdit = { ok: true; ops: EditOp[]; report: string[]; label: string; tiles: number[]; gap: number } | { ok: false; errors: string[] };

export const NARROWS_LIMITS = { at: [0, 1], reach: [0.5, 1], rise: [1, 4] } as const;

export function planNarrowsEdit(s: MapSession, req: NarrowsEditRequest): NarrowsEdit {
  const f = s.features.find((g) => g.id === req.river);
  if (!f || f.kind !== "river") return { ok: false, errors: ["pick a river"] };
  if (!(req.at >= 0 && req.at <= 1)) return { ok: false, errors: ["at is where along the river, 0 at its head to 1 at its end"] };
  if (req.reach !== undefined && !(req.reach >= 0.5 && req.reach <= 1)) return { ok: false, errors: ["reach is 0.5–1: how far each spur reaches toward the river"] };
  if (req.rise !== undefined && !(Number.isInteger(req.rise) && req.rise >= 1 && req.rise <= 4)) return { ok: false, errors: ["rise is 1–4 levels above the banks"] };
  const { x: W, y: H } = s.size;
  const b = s.built;
  const seed = hash32(s.spec?.seed ?? 0, "narrows", req.river, Math.round(req.at * 1000));
  const plan = planNarrows(b.heights, W, H, b.water, { path: f.params.path, width: f.params.width, at: req.at, reach: req.reach, rise: req.rise, seed });
  if (!plan.ok) return { ok: false, errors: plan.errors };
  const byLevel = new Map<number, number[]>();
  for (const [i, lv] of plan.raise) {
    const list = byLevel.get(lv);
    if (list) list.push(i);
    else byLevel.set(lv, [i]);
  }
  const ops: EditOp[] = [...byLevel]
    .sort((a, c) => a[0] - c[0])
    .map(([level, tiles]) => ({ op: "sculpt", params: { mode: "flatten", cells: tilesToRuns(tiles.sort((a, c) => a - c), W), level } }));
  const tiles = [...plan.raise.keys()].sort((a, c) => a - c);
  return {
    ok: true,
    ops,
    report: [...plan.report, `the river keeps a gap of ${plan.gap} tiles between the spurs: a dam across it is yours to build`],
    label: "Add a natural narrows",
    tiles,
    gap: plan.gap,
  };
}
