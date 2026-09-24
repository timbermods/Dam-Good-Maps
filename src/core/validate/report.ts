// The validation report (PLAN §11.6, §19.5): every check yields {id, class, severity, ok, value,
// limit, message, where?, fix?}. `where` names the tiles, feature or entities involved; `fix` is a
// list of edit operations the editor offers as a one-click fix (EDITOR_PLAN §6), in the envelope
// the operations engine takes (core/doc/ops.ts), applied as one step with `MapSession.applyAll`.

import type { EditOp } from "../doc/ops";

export type CheckClass = "load" | "playability" | "design";
export type Severity = "error" | "warning" | "info";
export type Profile = "generate" | "export" | "import";

/** One edit operation proposed as a fix, with a plain-language label for its button. */
export type FixOp = EditOp & { label: string };

export interface CheckResult {
  id: string;
  class: CheckClass;
  severity: Severity;
  ok: boolean;
  value?: number | string;
  limit?: number | string;
  message: string;
  /** Tiles ([x, y]), a feature or entities involved. */
  where?: { tiles?: [number, number][]; feature?: string; entities?: string[] };
  fix?: FixOp[];
  /** Advisory checks are reported in every profile and never block (today: plants.drought). */
  advisory?: boolean;
  /** False when the check does not apply to this map (no such feature, no start, ...): it is
   *  reported, passes, and says why. */
  applicable?: boolean;
}

export interface ValidationReport {
  profile: Profile;
  checks: CheckResult[];
  passed: boolean;
}

/** Severity of a result in a profile (PLAN §19.5): load problems are errors everywhere;
 *  playability and design problems must pass in `generate`, warn in `export`, and are reported in
 *  `import` (design as information). Advisory checks warn. */
export function severityOf(profile: Profile, cls: CheckClass, ok: boolean, advisory = false): Severity {
  if (ok) return "info";
  if (advisory) return "warning";
  if (cls === "load") return "error";
  if (profile === "generate") return "error";
  if (profile === "export") return "warning";
  return cls === "design" ? "info" : "warning";
}

/** Whether a result blocks the profile's action: the download in `generate`, the export in
 *  `export`. Nothing blocks an import: the importer reports, and fixes what the game would. */
export function blocks(profile: Profile, r: CheckResult): boolean {
  if (r.ok || r.advisory || r.applicable === false) return false;
  if (profile === "generate") return true;
  if (profile === "export") return r.class === "load";
  return false;
}

export class Collector {
  readonly checks: CheckResult[] = [];
  constructor(readonly profile: Profile) {}

  add(r: Omit<CheckResult, "severity">): CheckResult {
    const out = { ...r, severity: severityOf(this.profile, r.class, r.ok, r.advisory) } as CheckResult;
    this.checks.push(out);
    return out;
  }

  /** A check that does not apply to this map: reported as passing, with the reason. */
  notApplicable(id: string, cls: CheckClass, message: string, advisory = false): void {
    this.add({ id, class: cls, ok: true, applicable: false, message, ...(advisory ? { advisory } : {}) });
  }
}

/** The map card's groups (PLAN §11.6). */
export type CheckGroup = "File" | "Terrain and objects" | "Water" | "Start and resources";

export function groupOf(id: string): CheckGroup {
  if (id.startsWith("file.")) return "File";
  if (id.startsWith("water.")) return "Water";
  if (id.startsWith("terrain.") || id.startsWith("entities.") || id.startsWith("slopes.") || id === "start.clear") return "Terrain and objects";
  return "Start and resources";
}
