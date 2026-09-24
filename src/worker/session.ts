// The editor's side of the worker (EDITOR_PLAN §8): one open map document (a `MapSession`), and
// what the page needs of it. Messages stay small: after an edit the page gets the document's
// summary (features, history, orphans) and only the parts of the map view that changed, as
// compact typed arrays; never the document itself.
//
// Export follows the `export` profile (PLAN §19.5): load problems block, playability and design
// problems warn and are noted in the map's description when the player exports anyway. An
// imported map's own problems (those it already had when it was opened) are listed but never
// blamed on the player's edits, so an unedited import always exports unchanged (PLAN §20, D43).

import { damSites as findDamSites } from "../core/analysis/damsites";
import { decodeProject, documentFileName } from "../core/doc/document";
import { MapSession, type DocOrphan, type HistoryItem, type SessionMode } from "../core/doc/session";
import type { EditOp, OpOrigin } from "../core/doc/ops";
import {
  deleteEdit,
  moveEdit,
  moveStartNear,
  planContextOf,
  planLake,
  planLandform,
  planPiece,
  planRiver,
  startCentre,
  type LakeRequest,
  type LandformRequest,
  type PlannedEdit,
  type RiverRequest,
} from "../core/doc/tools";
import type { PlanRecord } from "../core/features/setpieces";
import type { SetPieceKind } from "../core/features/schema";
import { distanceFrom } from "../core/math/grid";
import { toTimberFile } from "../core/gen/pack";
import { thumbnailJpeg } from "../core/render/shade";
import type { EntitySpec } from "../core/format/entities";
import { placementOf } from "../core/format/entities";
import type { ImportReport } from "../core/format/normalize";
import type { Feature } from "../core/features/schema";
import type { MapSpec } from "../core/spec/mapspec";
import { applyMergePatch } from "../core/spec/mergepatch";
import { validateMap, type Validation } from "../core/validate/checks";
import { blocks, type CheckClass, type CheckResult, type FixOp } from "../core/validate/report";
import { changedRect } from "../render3d/mesh";
import { emptyColumns, entityView, LAYERS, waterFromDepth, type EntityView, type MapView, type WaterView } from "../render3d/model";
import { lastGenerated, lifeOf, responseOf, type GenerateResponse } from "./api";

export interface SessionInfo {
  kind: "generated" | "import";
  mode: SessionMode;
  name: string;
  premise: string;
  spec: MapSpec | null;
  W: number;
  H: number;
  features: Feature[];
  history: HistoryItem[];
  canUndo: boolean;
  canRedo: boolean;
  /** Operations in the log: the player's edits on this generation. */
  edits: number;
  orphans: DocOrphan[];
  notices: string[];
  importReport: ImportReport | null;
  timberName: string;
  projectName: string;
  /** Bumped on every change (the page's autosave and checks key on it). */
  version: number;
}

/** The parts of the map view that changed. */
export interface ViewUpdate {
  heights?: Uint8Array;
  terrainRect?: { x0: number; y0: number; x1: number; y1: number } | null;
  water?: WaterView;
  entities?: EntityView;
}

export interface SessionUpdate {
  ok: boolean;
  errors: string[];
  info: SessionInfo;
  view: ViewUpdate;
  ms: number;
  /** The instant checks after the change (PLAN §19.5): null when nothing changed. */
  instant?: InstantCheck | null;
}

/** The instant checks (EDITOR_PLAN §6): the load and design classes, run after every edit on the
 *  map as it now stands; `here` marks the problems in the region the edit changed. */
export interface InstantCheck {
  items: CheckItem[];
  /** The rectangle the edit changed (terrain or objects), or null. */
  region: { x0: number; y0: number; x1: number; y1: number } | null;
  ms: number;
}

export interface SessionOpen {
  info: SessionInfo;
  view: MapView;
  ms: number;
}

export interface CheckItem {
  id: string;
  class: CheckClass;
  message: string;
  where?: CheckResult["where"];
  /** A one-click fix: edit operations applied together as one undo step. */
  fix?: FixOp[];
  /** The problem lies in the region the last edit changed. */
  here?: boolean;
}

/** The export check (PLAN §19.5, `export` profile). */
export interface ExportCheck {
  /** Load problems the edits made: export is blocked until they are fixed. */
  blocking: CheckItem[];
  /** Playability and design problems the edits made: the player confirms, and they are noted in
   *  the map's description. */
  warnings: CheckItem[];
  /** Advice that never blocks (plants.drought). */
  advisory: CheckItem[];
  /** Problems an imported map already had when it was opened: listed, never blamed on edits. */
  existing: CheckItem[];
  /** False for imported maps: water and colony checks are not run on them yet (roadmap M8). */
  playability: boolean;
  checks: number;
  version: number;
  ms: number;
}

let session: MapSession | null = null;
let version = 0;
/** What the page last received, to send only what changed. */
let sent: { heights: Uint8Array; water: unknown; stored: boolean; entities: unknown } | null = null;
let original: Validation | null = null;
let lastCheck: ExportCheck | null = null;

function need(): MapSession {
  if (!session) throw new Error("no map is open in the editor");
  return session;
}

export function sessionInfo(s: MapSession = need()): SessionInfo {
  const { x: W, y: H } = s.size;
  const doc = s.document;
  return {
    kind: s.spec ? "generated" : "import",
    mode: s.mode,
    name: s.meta.name,
    premise: s.meta.premise,
    spec: s.spec,
    W,
    H,
    features: s.features as Feature[],
    history: s.history(),
    canUndo: s.canUndo,
    canRedo: s.canRedo,
    edits: s.editCount,
    orphans: s.orphans(),
    notices: [...s.notices],
    importReport: s.meta.source?.report ?? null,
    timberName: s.exportTimberName(),
    projectName: documentFileName(doc),
    version,
  };
}

// ------------------------------------------------------------------------------------ the view

function entityInputs(list: readonly EntitySpec[]) {
  const out = [];
  for (const e of list) {
    if (e.raw && !placementOf(e.raw)) continue;
    const comps = e.raw ? (e.raw.Components as Record<string, unknown>) : { ...(e.before ?? {}), ...e.components };
    out.push({ template: e.template, x: e.x, y: e.y, z: e.z, orientation: e.orientation, owner: e.owner, flipped: e.flipped, ...lifeOf(comps) });
  }
  return out;
}

function waterOf(s: MapSession): WaterView {
  const b = s.built;
  if (!s.showsStoredWater) return waterFromDepth(b.heights, b.water, b.contamination);
  const w = s.storedWater();
  const floor = Float32Array.from(w.floor, (f, k) => (f < 0 ? b.heights[w.tile[k]] : f));
  return { count: w.tile.length, tile: w.tile.slice(), floor, depth: w.depth.slice(), contamination: w.contamination.slice() };
}

function columnsOf(s: MapSession): MapView["columns"] {
  const cols = s.columns;
  if (!cols.size) return emptyColumns();
  const tiles = new Int32Array(cols.size);
  const voxels = new Uint8Array(cols.size * LAYERS);
  let k = 0;
  for (const [i, c] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    tiles[k] = i;
    voxels.set(c.subarray(0, LAYERS), k * LAYERS);
    k++;
  }
  return { tiles, voxels };
}

function markSent(s: MapSession): void {
  const b = s.built;
  sent = { heights: b.heights, water: s.showsStoredWater ? "stored" : b.water, stored: s.showsStoredWater, entities: b.entities };
}

/** The whole map view (opening a map, or after a regeneration). */
export function sessionView(): SessionOpen {
  const t0 = performance.now();
  const s = need();
  const b = s.built;
  const view: MapView = { W: b.W, H: b.H, heights: b.heights.slice(), columns: columnsOf(s), water: waterOf(s), entities: entityView(entityInputs(b.entities)) };
  markSent(s);
  return { info: sessionInfo(s), view, ms: Math.round(performance.now() - t0) };
}

function viewUpdate(s: MapSession): ViewUpdate {
  const b = s.built;
  const out: ViewUpdate = {};
  const prev = sent;
  if (!prev || prev.heights.length !== b.heights.length) return { heights: b.heights.slice(), terrainRect: null, water: waterOf(s), entities: entityView(entityInputs(b.entities)) };
  if (prev.heights !== b.heights) {
    const rect = changedRect(b.W, b.H, prev.heights, b.heights);
    if (rect) {
      out.heights = b.heights.slice();
      out.terrainRect = rect;
    }
  }
  const water = s.showsStoredWater ? "stored" : b.water;
  if (water !== prev.water) out.water = waterOf(s);
  if (b.entities !== prev.entities) out.entities = entityView(entityInputs(b.entities));
  markSent(s);
  return out;
}

function changed(s: MapSession, ok: boolean, errors: string[], t0: number): SessionUpdate {
  if (ok) {
    version++;
    lastCheck = null;
  }
  const view = ok ? viewUpdate(s) : {};
  const instant = ok ? instantCheck(s) : null;
  return { ok, errors, info: sessionInfo(s), view, ms: Math.round(performance.now() - t0), instant };
}

// ---------------------------------------------------------------------------------- instant checks

/** The load and design checks of the map as it now stands (about 25 ms at 256²), without the
 *  water settle or the thumbnail; `here` marks the problems in the region the edit changed. */
export function instantCheck(s: MapSession = need()): InstantCheck {
  const t0 = performance.now();
  const d = s.built.dirty;
  const region = d ? (d.terrain ?? d.region) : null;
  const file = s.mode === "live" ? toTimberFile(s.spec!, s.built, { thumbnail: blankThumbnail() }) : s.exportFile();
  const v = validateMap(file, { profile: "export", external: s.mode !== "live", spec: s.spec, designedFor: s.meta.designedFor, features: s.features, loadOnly: true });
  const items: CheckItem[] = [];
  const at = entityPositions(s);
  for (const c of v.report.checks) {
    if (c.ok || c.applicable === false || c.advisory) continue;
    const item = itemOf(c, s);
    if (region) item.here = inRegion(c.where, region, at);
    items.push(item);
  }
  return { items, region: region ? { x0: region.x0, y0: region.y0, x1: region.x1, y1: region.y1 } : null, ms: Math.round(performance.now() - t0) };
}

let blank: Uint8Array | null = null;
/** A 960×540 thumbnail for the instant checks, which only read its size. */
function blankThumbnail(): Uint8Array {
  blank ??= thumbnailJpeg(new Uint8Array(1), 1, 1, null);
  return blank;
}

function entityPositions(s: MapSession): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const e of s.built.entities) out.set(e.id, [e.x, e.y]);
  return out;
}

function inRegion(where: CheckResult["where"], r: { x0: number; y0: number; x1: number; y1: number }, at: Map<string, [number, number]>): boolean {
  const pts: [number, number][] = [...(where?.tiles ?? [])];
  for (const id of where?.entities ?? []) {
    const p = at.get(id);
    if (p) pts.push(p);
  }
  return pts.some(([x, y]) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);
}

// ------------------------------------------------------------------------------------ opening

function opened(s: MapSession): SessionOpen {
  session = s;
  sent = null;
  original = null;
  lastCheck = null;
  version++;
  return sessionView();
}

/** "Refine this map": open the map the generator just made. */
export function refine(): SessionOpen {
  const r = lastGenerated();
  if (!r) throw new Error("generate a map first");
  if (!r.report.passed) throw new Error("this map did not pass its checks: generate another one first");
  return opened(MapSession.fromGenerated(r, r.file));
}

/** Open any .timber (PLAN §19.6). Saves are refused with a message (ImportError). */
export function openTimber(bytes: Uint8Array, fileName: string): SessionOpen {
  return opened(MapSession.importMap(bytes, fileName));
}

/** Open a project file (.damgoodmaps.json). */
export function openProject(bytes: Uint8Array): SessionOpen {
  return opened(MapSession.open(decodeProject(bytes)));
}

export function closeSession(): void {
  session = null;
  sent = null;
  original = null;
  lastCheck = null;
  version++;
}

export function hasSession(): boolean {
  return session !== null;
}

// ------------------------------------------------------------------------------------ editing

export function check(op: EditOp): string[] {
  return need().check(op);
}

export function apply(op: EditOp, origin: OpOrigin = "user", label?: string): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const r = s.apply(op, origin, label);
  return changed(s, r.ok, r.errors, t0);
}

export function applyAll(ops: EditOp[], label: string, origin: OpOrigin = "user"): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const r = s.applyAll(ops, origin, label);
  return changed(s, r.ok, r.errors, t0);
}

export function undo(): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  return changed(s, s.undo(), [], t0);
}

export function redo(): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  return changed(s, s.redo(), [], t0);
}

/** Step back or forward to history entry `index` (the state after it; −1: before the first). */
export function jump(index: number): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  let applied = s.history().filter((h) => h.applied).length - 1;
  let moved = false;
  while (applied > index && s.undo()) {
    applied--;
    moved = true;
  }
  while (applied < index && s.redo()) {
    applied++;
    moved = true;
  }
  return changed(s, moved, [], t0);
}

// ------------------------------------------------------------------------------ regeneration

/** The settings page's view of the open document: its current map, validated. */
export async function settingsResponse(): Promise<GenerateResponse> {
  const t0 = performance.now();
  const s = need();
  if (!s.spec) throw new Error("an imported map has no settings");
  const v = s.validate("export");
  return responseOf({
    spec: s.spec,
    features: s.features as Feature[],
    built: s.built,
    checks: v.report.checks,
    passed: v.report.passed,
    analysis: v.analysis,
    attempts: 1,
    ms: Math.round(performance.now() - t0),
    timber: new Uint8Array(),
    project: new Uint8Array(),
    edits: s.editCount,
  });
}

/** Change the settings and regenerate, keeping the player's edits (a `specPatch`, PLAN §19.1). */
export async function regenerate(target: MapSpec): Promise<{ ok: boolean; errors: string[]; response: GenerateResponse | null; info: SessionInfo; orphans: DocOrphan[]; unfit: { id: string; reason: string }[] }> {
  const t0 = performance.now();
  const s = need();
  const old = s.spec;
  if (!old) throw new Error("an imported map has no settings to change");
  const patch = specPatch(old, target);
  const r = s.regenerate(patch);
  if (r.ok) {
    version++;
    lastCheck = null;
  }
  const response = r.ok
    ? await responseOf({
        spec: s.spec!,
        features: s.features as Feature[],
        built: s.built,
        checks: r.report!.checks,
        passed: r.report!.passed,
        analysis: r.analysis,
        attempts: r.attempts,
        ms: Math.round(performance.now() - t0),
        timber: new Uint8Array(),
        project: new Uint8Array(),
        edits: s.editCount,
      })
    : null;
  return { ok: r.ok, errors: r.errors, response, info: sessionInfo(s), orphans: r.orphans, unfit: r.unfit };
}

/** The merge patch that turns the document's settings into the settings page's (seed, size,
 *  theme, difficulty and the settings they imply). */
export function specPatch(from: MapSpec, to: MapSpec): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const k of ["seed", "size", "theme", "archetype", "designedFor", "settings"] as const) {
    if (JSON.stringify(from[k]) !== JSON.stringify(to[k])) patch[k] = to[k];
  }
  // a check that the patch gives the target (it is what the session applies)
  const merged = applyMergePatch(from, patch) as MapSpec;
  for (const k of ["seed", "size", "theme", "designedFor", "settings"] as const) {
    if (JSON.stringify(merged[k]) !== JSON.stringify(to[k])) throw new Error(`the settings patch does not reach ${k}`);
  }
  return patch;
}

// ------------------------------------------------------------------------------------ export

/** The start checks a move fixes: its ground, its door, its dry ring, what covers it. */
const START_FIXABLE = new Set(["start.flat", "start.entrance", "start.dry", "start.clear"]);

function itemOf(c: CheckResult, s: MapSession | null = session): CheckItem {
  let fix = c.fix?.length ? c.fix : undefined;
  if (!fix && s && START_FIXABLE.has(c.id)) {
    const at = startAt(s);
    const ops = at ? moveStartNear(s, at[0], at[1]) : null;
    if (ops) fix = ops.map((op, k) => ({ ...op, label: k === 0 ? "Move the start to the nearest good spot" : "" }) as FixOp);
  }
  return { id: c.id, class: c.class, message: c.message, ...(c.where ? { where: c.where } : {}), ...(fix ? { fix } : {}) };
}

/** The middle of the map's start, from its feature or its StartingLocation. */
function startAt(s: MapSession): [number, number] | null {
  const f = s.features.find((g) => g.kind === "start");
  if (f && f.kind === "start") return [f.params.position[0], f.params.position[1]];
  const e = s.built.entities.find((g) => g.template === "StartingLocation");
  return e ? startCentre(e.x, e.y, e.orientation) : null;
}

/** Whether a failing check was already failing, over the same things, when the map was opened. */
function existedBefore(c: CheckResult, before: Validation): boolean {
  const o = before.report.checks.find((x) => x.id === c.id);
  if (!o || o.ok || o.applicable === false) return false;
  const keys = (w: CheckResult["where"]) => [...(w?.entities ?? []), ...(w?.tiles ?? []).map((t) => t.join(",")), ...(w?.feature ? [w.feature] : [])];
  const now = keys(c.where);
  if (!now.length) return String(c.value) === String(o.value) && c.message === o.message;
  const had = new Set(keys(o.where));
  return now.every((k) => had.has(k));
}

/** Validate the open map for export (PLAN §19.5). */
export function exportCheck(): ExportCheck {
  const t0 = performance.now();
  const s = need();
  if (lastCheck && lastCheck.version === version) return lastCheck;
  const imported = s.mode === "import";
  const v = s.validate("export", { loadOnly: imported });
  if (imported && !original) original = s.validateOriginal();
  const out: ExportCheck = { blocking: [], warnings: [], advisory: [], existing: [], playability: !imported, checks: 0, version, ms: 0 };
  for (const c of v.report.checks) {
    if (c.applicable === false) continue;
    out.checks++;
    if (c.ok) continue;
    if (imported && original && existedBefore(c, original)) out.existing.push(itemOf(c, s));
    else if (c.advisory) out.advisory.push(itemOf(c, s));
    else if (blocks("export", c)) out.blocking.push(itemOf(c, s));
    else out.warnings.push(itemOf(c, s));
  }
  out.ms = Math.round(performance.now() - t0);
  lastCheck = out;
  return out;
}

/** Export the open map. Refused while load problems block it, or while warnings are not
 *  confirmed; confirmed warnings are noted in the map's description. */
export function exportTimber(confirmWarnings: boolean): { ok: boolean; errors: string[]; bytes: Uint8Array; fileName: string } {
  const s = need();
  const c = exportCheck();
  if (c.blocking.length) return { ok: false, errors: c.blocking.map((b) => b.message), bytes: new Uint8Array(), fileName: "" };
  if (c.warnings.length && !confirmWarnings) return { ok: false, errors: ["confirm the warnings first"], bytes: new Uint8Array(), fileName: "" };
  const { bytes, fileName } = s.exportTimber({ warnings: c.warnings.map((w) => w.message) });
  return { ok: true, errors: [], bytes, fileName };
}

/** The project file (downloads use gzip level 9; autosave a faster level). */
export function project(level = 9): { bytes: Uint8Array; fileName: string; name: string; version: number } {
  const s = need();
  return { bytes: s.project(level), fileName: documentFileName(s.document), name: s.meta.name, version };
}

// ------------------------------------------------------------------------------------ the tools

export type ToolRequest =
  | ({ tool: "river" } & RiverRequest)
  | ({ tool: "lake" } & LakeRequest)
  | ({ tool: "landform" } & LandformRequest)
  | { tool: "setPiece"; piece: SetPieceKind; request: PlanRecord };

export interface ToolPlan {
  ok: boolean;
  errors: string[];
  /** What the edit does, in plain words: every value reduced, what it clears and adds. */
  report: string[];
  label: string;
  ops: EditOp[];
  /** The tiles the planned feature covers, for the preview. */
  tiles: number[];
  featureId: string | null;
}

function toolPlan(r: PlannedEdit): ToolPlan {
  if (!r.ok) return { ok: false, errors: r.errors, report: [], label: "", ops: [], tiles: [], featureId: null };
  return { ok: true, errors: [], report: r.report, label: r.label, ops: r.ops, tiles: r.tiles, featureId: r.feature.id };
}

/** Plan a tool's edit on the open map without applying it (the preview). `id` is the new
 *  feature's id, or the id of the set piece planned again. */
export function planTool(req: ToolRequest, id: string): ToolPlan {
  const s = need();
  switch (req.tool) {
    case "river":
      return toolPlan(planRiver(req, planContextOf(s), id));
    case "lake":
      return toolPlan(planLake(req, planContextOf(s), id));
    case "landform":
      return toolPlan(planLandform(req, planContextOf(s), id));
    case "setPiece":
      return toolPlan(planPiece(s, req.piece, req.request, id));
  }
}

/** Plan and apply a tool's edit as one undo step. */
export function applyTool(req: ToolRequest, id: string): SessionUpdate & { plan: ToolPlan } {
  const t0 = performance.now();
  const s = need();
  const plan = planTool(req, id);
  if (!plan.ok) return { ...changed(s, false, plan.errors, t0), plan };
  const r = s.applyAll(plan.ops, "user", plan.label);
  return { ...changed(s, r.ok, r.errors, t0), plan };
}

/** Move a feature by (dx, dy) tiles; rivers, lakes and set pieces are planned again there. */
export function moveFeature(id: string, dx: number, dy: number): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const r = moveEdit(s, id, dx, dy);
  if (!r.ok) return changed(s, false, r.errors, t0);
  const a = s.applyAll(r.ops, "user", r.label);
  return changed(s, a.ok, a.errors, t0);
}

/** Delete a feature (an on-river fall takes its step out of its river). */
export function deleteFeature(id: string): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const r = deleteEdit(s, id);
  if (!r.ok) return changed(s, false, r.errors, t0);
  const a = s.applyAll(r.ops, "user", r.label);
  return changed(s, a.ok, a.errors, t0);
}

// ------------------------------------------------------------------------------ the dam-site layer

export interface DamSiteView {
  /** The dam line's tiles. */
  tiles: [number, number][];
  /** Crest above the channel, blocks held, tiles flooded, and the dam's length. */
  height: number;
  volume: number;
  area: number;
  length: number;
}

/** The dam-site layer (EDITOR_PLAN §4): the best straight dams across the map's clean water, the
 *  way `water.reservoir` measures them, best first; within 60 tiles of the start when it has one. */
export function damSiteLayer(): { sites: DamSiteView[]; ms: number } {
  const t0 = performance.now();
  const s = need();
  const b = s.built;
  const { W, H } = b;
  const N = W * H;
  if (s.showsStoredWater) return { sites: [], ms: 0 };
  const water = b.water;
  const clean = new Uint8Array(N);
  const surface = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    surface[i] = b.heights[i] + water[i];
    if (water[i] > 0.05 && b.contamination[i] < 0.05) clean[i] = 1;
  }
  const at = startAt(s);
  let dist: Float64Array | null = null;
  if (at) {
    const m = new Uint8Array(N);
    for (let y = at[1] - 1; y <= at[1] + 1; y++) for (let x = at[0] - 1; x <= at[0] + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1;
    dist = distanceFrom(m, W, H);
  }
  const sites = findDamSites(b.heights, clean, surface, W, H, dist).slice(0, 12);
  return {
    sites: sites.map((d) => {
      const half = Math.floor((d.length - 1) / 2);
      const tiles: [number, number][] = [];
      for (let k = -half; k <= d.length - 1 - half; k++) tiles.push([d.x + k * d.dir[1], d.y + k * d.dir[0]]);
      return { tiles, height: d.height, volume: Math.round(d.volume), area: d.area, length: d.length };
    }),
    ms: Math.round(performance.now() - t0),
  };
}
