// Where the M9 design step keeps its local data: every generated map, its settled water and its
// measured record, the renders and the rating page. Everything under ROOT stays on this machine;
// only code, aggregate numbers and a few renders of our own prototype maps are committed.

import { setPriority } from "node:os";
import { join } from "node:path";

export const WORKSHOP = process.env.DGM_WORKSHOP ?? "C:/dgm-workshop";
export const ROOT = process.env.DGM_GENERATIVE ?? join(WORKSHOP, "generative");
/** One folder per generator and size: `<ROOT>\maps\<gen>-<size>\<theme>-<seed>.{json,timber,f32}`. */
export const MAPS = join(ROOT, "maps");
export const RENDERS = join(ROOT, "renders");
export const RATE = join(ROOT, "rate");
/** The id → theme, seed and recipe key of the blind rating page (never shown on the page). */
export const KEY_FILE = join(WORKSHOP, "generative-key.json");
export const RATINGS = join(WORKSHOP, "ratings.json");
export const GEN_RATINGS = join(WORKSHOP, "generative-ratings.json");

export function mapDir(gen: string, size: number): string {
  return join(MAPS, `${gen}-${size}`);
}

/** Heavy work runs below normal priority, so another session's benchmarks keep the CPU. */
export function lowPriority(): void {
  if (process.env.DGM_PRIORITY === "normal") return;
  try {
    setPriority(0, 10);
  } catch {
    /* not allowed: carry on */
  }
}

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function parseSeeds(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) for (let k = Number(m[1]); k <= Number(m[2]); k++) out.push(k);
    else if (part) out.push(Number(part));
  }
  return out;
}
