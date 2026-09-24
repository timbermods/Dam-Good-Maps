// Where the workshop study keeps its local data. Everything under ROOT stays on this machine: map
// copies, renders and per-map numbers are other creators' work and are never committed.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { setPriority } from "node:os";
import { basename, join } from "node:path";

export const ROOT = process.env.DGM_WORKSHOP ?? "C:\\dgm-workshop";
export const ITEMS = join(ROOT, "items");
export const OFFICIAL = join(ROOT, "official");
export const MEASURED = join(ROOT, "measured");
export const SETTLED = join(ROOT, "settled");
export const RENDERS = join(ROOT, "renders");
export const META = join(ROOT, "meta.json");
export const RATINGS = join(ROOT, "ratings.json");

export interface MapRef {
  /** "w<steam id>" for workshop items, "o<name>" for official maps. */
  key: string;
  source: "workshop" | "official";
  /** The Steam item id (workshop only). */
  id?: string;
  path: string;
  fileName: string;
}

/** Every workshop item with a .timber file, and the 19 official maps, in a fixed order. */
export function listMaps(): MapRef[] {
  const out: MapRef[] = [];
  if (existsSync(ITEMS)) {
    for (const id of readdirSync(ITEMS).filter((d) => /^\d+$/.test(d)).sort()) {
      const file = findTimber(join(ITEMS, id));
      if (file) out.push({ key: `w${id}`, source: "workshop", id, path: file, fileName: basename(file) });
    }
  }
  if (existsSync(OFFICIAL)) {
    for (const f of readdirSync(OFFICIAL).filter((f) => f.endsWith(".timber") && !f.startsWith("_")).sort()) {
      out.push({ key: `o${f.replace(/\.timber$/, "")}`, source: "official", path: join(OFFICIAL, f), fileName: f });
    }
  }
  return out;
}

function findTimber(dir: string): string | null {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase().endsWith(".timber")) return p;
    if (e.isDirectory()) {
      const inner = findTimber(p);
      if (inner) return inner;
    }
  }
  return null;
}

export interface WorkshopMeta {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  author_url: string | null;
  visitors: number | null;
  subscribers: number | null;
  favourites: number | null;
  stars: number | null;
  ratings: number | null;
  tags: string[];
  posted?: string | null;
  updated?: string | null;
  change_notes: number | null;
  description: string;
}

export function readMeta(): Record<string, WorkshopMeta> {
  return existsSync(META) ? JSON.parse(readFileSync(META, "utf8")) : {};
}

/** Heavy work runs below normal priority, so the milestone session's benchmarks keep the CPU. */
export function lowPriority(): void {
  try {
    setPriority(0, 10);
  } catch {
    /* not allowed: carry on */
  }
}
