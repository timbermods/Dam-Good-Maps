// A cut-off bend (D199, high Wander): a long bend on one side of its shortcut, with a narrow neck
// the river can cut through. Only one cutoff per carve.
//
// Ported from investigation/carve/oxbow.ts (PR #47), kept to its structure.

import type { Point } from "./course";
import type { Station } from "./run";

export interface Oxbow {
  start: number;
  end: number;
  step: number;
  floor: number;
  neck: Point[];
  pool: Point[];
  cap: Point;
}

/** Detect an actual long bend with a short neck, not a decorative pond added beside an arbitrary
 *  channel. */
export function findNeck(path: Station[], step: number): Oxbow | null {
  const end = path.length - 1;
  const B = path[end];
  if (!B || B.bed < 2 || end < 25) return null;
  for (let start = Math.max(5, end - 100); start < end - 20; start++) {
    const A = path[start];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    const radius = Math.min(A.width, B.width);
    const arc = (end - start) * 1.35;
    if (d < radius * 2 + 3 || d > radius * 4 + 10 || arc < d * 2.2) continue;
    const bow = path.slice(start, end + 1);
    const sides = bow.map((p) => ((p.x - A.x) * dy - (p.y - A.y) * dx) / d);
    const swing = Math.max(...sides.map(Math.abs));
    if (Math.min(...sides) < -0.25 && Math.max(...sides) > 0.25) continue;
    if (swing < radius * 2 + 3) continue;
    const neck = Array.from({ length: Math.ceil(d / 1.1) + 1 }, (_, k) => {
      const t = k / Math.ceil(d / 1.1);
      return { x: A.x + dx * t, y: A.y + dy * t };
    });
    // Keep the downstream arm perched. The old upstream arm becomes a quiet backwater off the
    // shortcut; the game's water decides its actual level.
    const pool = bow.filter((p) => Math.hypot(p.x - B.x, p.y - B.y) > radius * 2.8 + 3);
    if (pool.length < 12) continue;
    const cap = bow.find((p) => Math.hypot(p.x - B.x, p.y - B.y) < radius * 2.8 + 2 && Math.hypot(p.x - B.x, p.y - B.y) > radius * 2 + 2);
    if (!cap) continue;
    return { start, end, step, floor: B.bed - 1, neck, pool, cap };
  }
  return null;
}
