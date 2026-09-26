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
import { decodeProject, documentFileName, type MapDocument } from "../core/doc/document";
import { MapSession, type DocOrphan, type HistoryItem, type SessionMode } from "../core/doc/session";
import type { AppliedOp, EditOp, OpOrigin } from "../core/doc/ops";
import {
  deleteEdit,
  kindName,
  landformTop,
  objectsOnNewGround,
  moveEdit,
  moveStartNear,
  planContextOf,
  planLake,
  planLandform,
  planPiece,
  planRiver,
  type RiverEnd,
  replacePatch,
  withObjectsOnNewGround,
  cornerFor,
  startCentre,
  type LakeRequest,
  type LandformRequest,
  type PlannedEdit,
  type RiverRequest,
} from "../core/doc/tools";
import type { PlanRecord } from "../core/features/setpieces";
import { footprintCheck as checkFootprint, lakeAt, moveObject, planArea, planEntity, planObject, planRiverBadwater, type AreaPreview, type AreaRequest, type EntityRequest, type ObjectRequest, type PlannedOps } from "../core/doc/placing";
import type { SetPieceKind } from "../core/features/schema";
import { distanceFrom } from "../core/math/grid";
import { hash32 } from "../core/math/hash";
import { toTimberFile } from "../core/gen/pack";
import { thumbnailJpeg } from "../core/render/shade";
import type { EntitySpec } from "../core/format/entities";
import { JsonFloat } from "../core/format/json";
import type { Orientation } from "../core/format/footprints";
import { entityTiles } from "../core/features/edits";
import { placementOf } from "../core/format/entities";
import type { ImportReport } from "../core/format/normalize";
import type { Feature } from "../core/features/schema";
import type { BuildResult } from "../core/features/build";
import { OFFICIAL_FLOW } from "../core/gen/calibrated";
import { badtideContamination, hazardDays, type Hazard } from "../core/sim/weather";
import { moisture } from "../core/sim/moisture";
import { soilContamination } from "../core/sim/contamination";
import { polygonMask } from "../core/features/geometry";
import { patchFeature } from "../core/doc/ops";
import type { Difficulty, MapSpec } from "../core/spec/mapspec";
import { applyMergePatch } from "../core/spec/mergepatch";
import { validateMap, type Validation } from "../core/validate/checks";
import { canonicalRun, canonicalSettle, type CanonicalWater } from "../core/sim/prefill";
import { PreviewJob, TICKS_PER_DAY, type WarmState } from "../core/sim/preview";
import type { TerrainState } from "../core/features/raster/strokePreview";
import { droughtStorage } from "../core/sim/drought";
import { rulesFor } from "../core/validate/playability";
import { mapObjects, waterModel } from "../core/sim/model";
import { WaterSim, type WaterModel } from "../core/sim/water";
import { surfaceOf } from "../core/format/world";
import { blocks, type CheckClass, type CheckResult, type FixOp } from "../core/validate/report";
import { changedRect } from "../render3d/mesh";
import { emptyColumns, entityView, LAYERS, soilView, waterFromDepth, type EntityView, type MapView, type SoilView, type WaterView } from "../render3d/model";
import { lastGenerated, lifeOf, responseOf, type GenerateResponse } from "./api";

export interface SessionInfo {
  kind: "generated" | "import";
  mode: SessionMode;
  name: string;
  premise: string;
  spec: MapSpec | null;
  /** The difficulty the map is designed for (an import's comes from its document, default Normal). */
  designedFor: Difficulty;
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
  /** Changes only when the features do (the page keeps its copy, and its index, meanwhile). */
  featuresKey: string;
}

/** The parts of the map view that changed. */
export interface ViewUpdate {
  heights?: Uint8Array;
  /** What the build's last terrain steps start from, when it changed (the page paints strokes on
   *  its own copy, exactly as the build applies them). */
  terrain?: TerrainState;
  terrainRect?: { x0: number; y0: number; x1: number; y1: number } | null;
  water?: WaterView;
  entities?: EntityView;
  /** The soil the ground's colours show; it follows the water (Map look, D86). */
  soil?: SoilView;
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
  /** The terrain the page paints strokes on (see ViewUpdate.terrain). */
  terrain: TerrainState;
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
  /** Water and colony checks ran (true since M8, imported maps too). */
  playability: boolean;
  /** Why the water and start checks are only approximate on this map, or null (PLAN §11, D98). */
  approximate: string | null;
  checks: number;
  version: number;
  ms: number;
}

let session: MapSession | null = null;
let version = 0;
/** What the page last received, to send only what changed. */
let sent: { heights: Uint8Array; water: unknown; stored: boolean; entities: unknown; soil: unknown; terrain: unknown } | null = null;
/** The imported map as it was opened, with every check (the problems it had already, D43). */
let originalFull: Validation | null = null;
let lastCheck: ExportCheck | null = null;

function need(): MapSession {
  if (!session) throw new Error("no map is open in the editor");
  return session;
}

/** A key for the features as they are (the page keeps its own copy while it stays the same). */
let featuresMemo: { json: string; key: string } | null = null;
function featuresKeyOf(features: readonly Feature[]): string {
  const json = JSON.stringify(features);
  if (featuresMemo?.json === json) return featuresMemo.key;
  featuresMemo = { json, key: `${json.length}:${hash32(json)}` };
  return featuresMemo.key;
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
    designedFor: s.spec?.designedFor ?? s.meta.designedFor ?? "normal",
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
    featuresKey: featuresKeyOf(s.features),
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

function waterOf(s: MapSession, live?: { depth: ArrayLike<number>; contamination: ArrayLike<number> }, ground: Uint8Array = s.built.heights): WaterView {
  const b = live ? { ...s.built, heights: ground, water: live.depth, contamination: live.contamination } : s.built;
  const roofed = s.roofedTiles;
  if (!s.showsStoredWater && !roofed.size) return waterFromDepth(b.heights, b.water, b.contamination);
  const w = s.storedWater();
  const floor = Float32Array.from(w.floor, (f, k) => (f < 0 ? b.heights[w.tile[k]] : f));
  if (s.showsStoredWater) return { count: w.tile.length, tile: w.tile.slice(), floor, depth: w.depth.slice(), contamination: w.contamination.slice() };
  // an edited import with caves: the settled water off the roofs, the file's own under them
  // (EDITOR_PLAN §6: the preview is approximate there, and the export keeps the file's water)
  const settled = waterFromDepth(b.heights, b.water, b.contamination);
  const keep: number[] = [];
  for (let k = 0; k < settled.count; k++) if (!roofed.has(settled.tile[k])) keep.push(k);
  const under: number[] = [];
  for (let k = 0; k < w.tile.length; k++) if (roofed.has(w.tile[k])) under.push(k);
  const n = keep.length + under.length;
  const out: WaterView = { count: n, tile: new Int32Array(n), floor: new Float32Array(n), depth: new Float32Array(n), contamination: new Float32Array(n) };
  let q = 0;
  for (const k of keep) {
    out.tile[q] = settled.tile[k];
    out.floor[q] = settled.floor[k];
    out.depth[q] = settled.depth[k];
    out.contamination[q] = settled.contamination[k];
    q++;
  }
  for (const k of under) {
    out.tile[q] = w.tile[k];
    out.floor[q] = floor[k];
    out.depth[q] = w.depth[k];
    out.contamination[q] = w.contamination[k];
    q++;
  }
  return out;
}

/** The soil the view shows: the map's settled soil, or the file's own where the view shows the
 *  file's water (an unedited import everywhere, an edited one under its roofs). */
function soilOf(s: MapSession): SoilView {
  const b = s.built;
  const roofed = s.roofedTiles;
  if (!s.showsStoredWater && !roofed.size) return soilView(b.moisture, b.soilContamination);
  const file = s.storedSoil();
  if (s.showsStoredWater) return soilView(file.moisture, file.contamination);
  const moisture = Float32Array.from(b.moisture);
  const contamination = Float32Array.from(b.soilContamination);
  for (const i of roofed) {
    moisture[i] = file.moisture[i];
    contamination[i] = file.contamination[i];
  }
  return soilView(moisture, contamination);
}

/** What the sent soil depends on: the settled soil arrays, or the file's. */
function soilKey(s: MapSession): unknown {
  return s.showsStoredWater ? "stored" : s.built.moisture;
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

/** The objects the page has (to send only what changed). */
let sentEntities: EntityView | null = null;

/** A copy that stays here (the view itself is handed over to the page, its arrays with it). */
function copyEntityView(v: EntityView): EntityView {
  return { ...v, templates: [...v.templates], owners: [...v.owners], template: v.template.slice(), x: v.x.slice(), y: v.y.slice(), z: v.z.slice(), orientation: v.orientation.slice(), flags: v.flags.slice(), owner: v.owner.slice() };
}

function sameEntityView(a: EntityView, b: EntityView | null): boolean {
  if (!b || a.count !== b.count || a.templates.join() !== b.templates.join() || a.owners.join() !== b.owners.join()) return false;
  const eq = (p: ArrayLike<number>, q: ArrayLike<number>) => {
    for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
    return true;
  };
  return eq(a.template, b.template) && eq(a.x, b.x) && eq(a.y, b.y) && eq(a.z, b.z) && eq(a.orientation, b.orientation) && eq(a.flags, b.flags) && eq(a.owner, b.owner);
}

function markSent(s: MapSession): void {
  const b = s.built;
  sent = { heights: b.heights, water: s.showsStoredWater ? "stored" : b.water, stored: s.showsStoredWater, entities: b.entities, soil: soilKey(s), terrain: b.cache.terrain };
}

/** The map's heights and the terrain the page paints on, as they stand (the page takes them
 *  again when the worker refused a stroke it had shown). */
export function terrainNow(): { heights: Uint8Array; terrain: TerrainState } {
  const s = need();
  return { heights: s.built.heights.slice(), terrain: s.terrainState() };
}

/** The whole map view (opening a map, or after a regeneration). */
export function sessionView(): SessionOpen {
  const t0 = performance.now();
  const s = need();
  const b = s.built;
  const view: MapView = { W: b.W, H: b.H, heights: b.heights.slice(), columns: columnsOf(s), water: waterOf(s), entities: entityView(entityInputs(b.entities)), soil: soilOf(s) };
  sentEntities = copyEntityView(view.entities);
  markSent(s);
  return { info: sessionInfo(s), view, terrain: s.terrainState(), ms: Math.round(performance.now() - t0) };
}

function viewUpdate(s: MapSession): ViewUpdate {
  const b = s.built;
  const out: ViewUpdate = {};
  const prev = sent;
  if (!prev || prev.heights.length !== b.heights.length) {
    const all: ViewUpdate = { heights: b.heights.slice(), terrainRect: null, water: waterOf(s), entities: entityView(entityInputs(b.entities)), soil: soilOf(s), terrain: s.terrainState() };
    sentEntities = copyEntityView(all.entities!);
    markSent(s);
    return all;
  }
  if (prev.terrain !== b.cache.terrain) out.terrain = s.terrainState();
  if (prev.heights !== b.heights) {
    const rect = changedRect(b.W, b.H, prev.heights, b.heights);
    if (rect) {
      out.heights = b.heights.slice();
      out.terrainRect = rect;
    }
  }
  const water = s.showsStoredWater ? "stored" : b.water;
  if (water !== prev.water) out.water = waterOf(s);
  if (water !== prev.water || soilKey(s) !== prev.soil) out.soil = soilOf(s);
  // (a rebuild that placed the same objects again sends none: the page keeps its own)
  if (b.entities !== prev.entities) {
    const v = entityView(entityInputs(b.entities));
    if (!sameEntityView(v, sentEntities)) out.entities = v;
    sentEntities = copyEntityView(v);
  }
  markSent(s);
  return out;
}

function changed(s: MapSession, ok: boolean, errors: string[], t0: number): SessionUpdate {
  if (ok) {
    version++;
    lastCheck = null;
  }
  const view = ok ? viewUpdate(s) : {};
  // with a checks worker the instant checks come as an event a moment later, off this worker
  const instant = ok && !checks ? instantCheck(s) : null;
  if (ok) {
    kickWater();
    syncChecks();
  }
  return { ok, errors, info: sessionInfo(s), view, ms: Math.round(performance.now() - t0), instant };
}

// ------------------------------------------------------------------------------ the checks worker

/** The page's checks run in a worker of their own on a replica of the open map (live editing:
 *  the editor's worker never waits on a check). It follows this worker's map: the document when
 *  the generation changes, otherwise the log. Without one (Node tests) they run here. */
export interface ChecksWorker {
  follow(p: FollowPayload): Promise<InstantCheck | null>;
  check(version: number, onProgress?: (p: CheckProgress) => void): Promise<ReplicaCheck | null>;
}

/** What the replica needs to follow the open map. */
export interface FollowPayload {
  version: number;
  /** The whole document, when the generation changed (or the replica has none yet). */
  doc?: MapDocument;
  /** Otherwise: keep the first `keep` operations of the replica's log and apply `add`. */
  keep: number;
  add: AppliedOp[];
}

/** The replica's check, with the canonical water it settled (for this worker to put in place). */
export interface ReplicaCheck {
  check: ExportCheck;
  water: { model: WaterModel; water: CanonicalWater } | null;
  /** An unedited import's water layers (its build keeps the file's water): the check's settle. */
  layers?: { depth: Float64Array; contamination: Float64Array; moist: Float64Array; soil: Float64Array; model: WaterModel };
}

let checks: ChecksWorker | null = null;
/** What the replica has: the generation it follows and the seqs of its log. */
let followed: { gen: object; seqs: number[] } | null = null;

export function useChecksWorker(c: ChecksWorker | null): void {
  checks = c;
  followed = null;
  syncChecks();
}

/** Tell the checks worker what changed; its instant checks come back as an event. */
function syncChecks(): void {
  const s = session;
  const c = checks;
  if (!s || !c) return;
  const log = s.logOps;
  const seqs = log.map((o) => o.seq);
  let p: FollowPayload;
  if (!followed || followed.gen !== s.generationKey) {
    p = { version, doc: s.document, keep: 0, add: [] };
  } else {
    let keep = 0;
    while (keep < seqs.length && keep < followed.seqs.length && seqs[keep] === followed.seqs[keep]) keep++;
    p = { version, keep, add: log.slice(keep) as AppliedOp[] };
  }
  followed = { gen: s.generationKey, seqs };
  const v = version;
  void c.follow(p).then(
    (instant) => {
      if (instant && v === version && session === s) listener?.({ kind: "instant", version: v, instant });
    },
    () => {
      // the replica lost track: send the whole document next time
      followed = null;
    },
  );
}

// the replica's side (the checks worker)

/** Follow the editor's map (the checks worker's replica), and run the instant checks on it. */
export function follow(p: FollowPayload): InstantCheck | null {
  if (p.doc) {
    const s = MapSession.open(p.doc);
    s.setWaterMode("defer");
    session = s;
    sent = null;
    originalFull = null;
  } else {
    const s = need();
    const all = [...s.logOps.slice(0, p.keep), ...p.add];
    s.followLog(all, all.reduce((m, o) => Math.max(m, o.seq + 1), 0));
  }
  version = p.version;
  lastCheck = null;
  return instantCheck(need());
}

/** The background check on the replica, with the canonical water it settled. */
export async function replicaCheck(v: number, onProgress?: (p: CheckProgress) => void): Promise<ReplicaCheck | null> {
  if (v !== version) return null;
  const r = await backgroundCheck(onProgress);
  if (!r) return null;
  const s = need();
  const water = !s.waterPending && !s.showsStoredWater && !s.built.waterFromFile ? { model: s.built.waterModel, water: s.built.settle } : null;
  const lw = lastWater && lastWater.version === version ? lastWater : null;
  return { check: r.check, water, ...(lw ? { layers: { depth: lw.depth, contamination: lw.contamination, moist: lw.moist, soil: lw.soil, model: lw.model } } : {}) };
}

// ------------------------------------------------------------------------------ the live water

/** What the worker tells the page by itself, between its answers (`listen`). */
export type EditorEvent =
  /** The water as it flows after an edit (D133's live water): the whole view, a frame every few
   *  ticks of the game (close together at first, where the water moves most), for the page to play
   *  at a pace the eye can follow. `done` is how far the settle has come (0–1); `draft`: a water
   *  tool's draft (shown at once, not part of the journey). */
  | { kind: "water"; version: number; water: WaterView; done: number; ticks: number; draft?: boolean }
  /** A weather run (a drought, then the water coming back): its frames, the day, and the end (the
   *  map's own water, exactly). */
  | { kind: "weather"; version: number; water: WaterView; phase: "drought" | "badtide" | "return" | "end"; day: number; days: number; soil?: SoilView }
  /** The water has settled after an edit: the water, the soil and the plants on it. */
  | { kind: "settled"; version: number; view: ViewUpdate; info: SessionInfo }
  /** The instant checks of an edit (with a checks worker, they come a moment after the edit). */
  | { kind: "instant"; version: number; instant: InstantCheck };

let listener: ((e: EditorEvent) => void) | null = null;

/** Where the worker sends its events (the page's editor, through the worker's entry). */
export function listen(fn: ((e: EditorEvent) => void) | null): void {
  listener = fn;
}

/** How the open map's edits treat the water: "defer" in the page (edits never wait on it), or
 *  "preview" (each edit re-settles before it answers; tests of the older flow). */
let waterMode: "defer" | "preview" = "defer";
export function setEditorWaterMode(mode: "defer" | "preview"): void {
  waterMode = mode;
  session?.setWaterMode(mode);
}

/** Whether the worker settles the water by itself after each edit (the page's worker). Node tests
 *  run `settleWater()` themselves. */
let autoWater = false;
export function setAutoWater(on: boolean): void {
  autoWater = on;
}

/** The water settling in the background, and a token that a newer edit changes. A water tool's
 *  draft (a river being drawn) has water of its own, flowing on the draft's ground (`draft`): it is
 *  shown, never put in place; placing the draft carries it on, cancelling it drops it. */
let waterJob: { token: number; job: PreviewJob; version: number; session: MapSession; draft?: BuildResult } | null = null;
let waterToken = 0;
/** A draft's water once it has settled (the next edit carries it on). */
let draftState: WarmState | null = null;
/** The page holds the water while the player paints, when it asks to (a very large map). */
let waterHeld = false;
/** Ticks per slice, and how often the page gets the water as it flows. */
const WATER_SLICE_MS = 10;
const WATER_FRAME_MS = 150;

export function holdWater(on: boolean): void {
  waterHeld = on;
}

function stopWater(): void {
  waterToken++;
  waterJob = null;
  draftState = null;
}

/** Start settling the open map's water again, from the water in flight when there is one (so it
 *  keeps flowing: a placed draft's water flows on), else from the last settled water. */
function kickWater(): void {
  const s = session;
  if (!s || !s.waterStale) {
    stopWater();
    return;
  }
  const inflight = waterJob && waterJob.session === s ? waterJob.job.state() : draftState;
  draftState = null;
  const from: WarmState | null = inflight ?? s.lastSettled();
  if (!from) return;
  const token = ++waterToken;
  waterJob = { token, job: new PreviewJob(from, s.built.waterModel), version, session: s };
  if (autoWater) setTimeout(() => void runWater(token), 0);
}

/** The background settle: a slice at a time, the water to the page as it flows, then the settled
 *  water in place (the plants follow it). Stops when a newer edit takes over. */
/** Ticks between the frames of the water's journey: close together at first, where the water moves
 *  most (a new channel filling), wider apart as it settles. */
function frameGap(ticks: number): number {
  return ticks < 240 ? 4 : ticks < 960 ? 12 : 48;
}

async function runWater(token: number): Promise<void> {
  let lastTicks = -Infinity;
  for (;;) {
    const j = waterJob;
    if (!j || j.token !== token || session !== j.session) return;
    if (waterHeld) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    const t0 = performance.now();
    let r: CanonicalWater | null = null;
    let lastDraftFrame = 0;
    while (!r && performance.now() - t0 < WATER_SLICE_MS) {
      r = j.job.advance(4);
      if (r || !listener) continue;
      const ticks = j.job.ticks;
      // a draft's water is shown as it comes (a few times a second); an edit's journey a frame
      // every few ticks
      const due = j.draft ? performance.now() - lastDraftFrame > WATER_FRAME_MS : ticks - lastTicks >= frameGap(ticks);
      if (!due) continue;
      lastTicks = ticks;
      lastDraftFrame = performance.now();
      const done = Math.min(0.99, ticks / TICKS_PER_DAY);
      listener({ kind: "water", version, water: waterOf(j.session, { depth: j.job.sim.D, contamination: j.job.sim.C }, j.draft?.heights), done, ticks, ...(j.draft ? { draft: true } : {}) });
    }
    if (r && j.draft) {
      // a draft's water has settled on its ground: shown as it is, kept for the next edit
      listener?.({ kind: "water", version, water: waterOf(j.session, { depth: r.depth, contamination: r.contamination }, j.draft.heights), done: 1, ticks: j.job.ticks, draft: true });
      draftState = j.job.state();
      waterJob = null;
      return;
    }
    if (r) {
      finishWater(j, r);
      return;
    }
    await breathe();
  }
}

function finishWater(j: NonNullable<typeof waterJob>, water: CanonicalWater): void {
  waterJob = null;
  const s = j.session;
  if (session !== s || !s.adoptWater(j.job.model, water)) return;
  const view = viewUpdate(s);
  listener?.({ kind: "settled", version, view, info: sessionInfo(s) });
}

/** Water for a water tool's draft: it flows on the draft's ground from the water in flight (or
 *  the last settled water), a slice at a time, as for an edit. */
function draftWater(s: MapSession, b: BuildResult): void {
  const inflight = waterJob && waterJob.session === s ? waterJob.job.state() : draftState;
  draftState = null;
  const from: WarmState | null = inflight ?? s.lastSettled();
  if (!from) return;
  const token = ++waterToken;
  waterJob = { token, job: new PreviewJob(from, b.waterModel), version, session: s, draft: b };
  if (autoWater) setTimeout(() => void runWater(token), 0);
}

/** A draft ended without being placed: its water goes, the map's own flows again (from the last
 *  settled water). The water to show now. */
export function cancelShape(): ViewUpdate {
  const s = session;
  if (!s || (!waterJob?.draft && !draftState)) return {};
  stopWater();
  kickWater();
  return { water: waterOf(s) };
}

// ------------------------------------------------------------------------------------ weather

/** A hazard to watch (D180 (8), D181 (3)), the map's own length by its difficulty
 *  (core/sim/weather.ts). A drought: every source stops, the rivers drain, the pools evaporate. A
 *  badtide: the clean sources give badwater along the game's curve, and it spreads through the
 *  water and poisons the ground. Then the sources run as before and the water comes back. A frame
 *  every 12 ticks the first day, every 96 after; the soil each day; the end is the map's own water
 *  and soil, exactly. The map never changes. */
let weatherToken = 0;
export function startWeather(hazard: Hazard): void {
  const s = need();
  const token = ++weatherToken;
  const days = hazardDays(s.meta.designedFor ?? "normal", hazard);
  const base = s.built.waterModel;
  // the sources' own copies: a badtide changes what the clean ones give
  const model: WaterModel = { ...base, emitters: base.emitters.map((e) => ({ ...e })) };
  const clean = model.emitters.filter((e) => e.contamination === 0);
  const sim = new WaterSim(model, { depth: Float64Array.from(s.built.water), contamination: Float64Array.from(s.built.contamination) });
  const v = version;
  const { x: W, y: H } = s.size;
  const total = days * TICKS_PER_DAY;
  const send = (phase: "drought" | "badtide" | "return" | "end", water: WaterView, day: number, soil?: SoilView) => listener?.({ kind: "weather", version: v, water, phase, day, days, ...(soil ? { soil } : {}) });
  const soilNow = (depth: Float64Array, contamination: Float64Array) => soilView(moisture(s.built.heights, depth, contamination, W, H, null), soilContamination(s.built.heights, depth, contamination, W, H, null));
  void (async () => {
    let nextSoil = TICKS_PER_DAY;
    for (let t = 0; t < total; ) {
      if (token !== weatherToken || session !== s) return;
      const t0 = performance.now();
      while (t < total && performance.now() - t0 < WATER_SLICE_MS) {
        // closer frames the first day, while the rivers drain or the badwater surges
        const gap = t < TICKS_PER_DAY ? 12 : 96;
        if (hazard === "badtide") for (const e of clean) e.contamination = badtideContamination(t / TICKS_PER_DAY, days);
        sim.run(gap, hazard === "drought" ? 0 : 1);
        t += gap;
        const soil = t >= nextSoil ? soilNow(sim.D, sim.C) : undefined;
        if (soil) nextSoil += TICKS_PER_DAY;
        send(hazard, waterOf(s, { depth: sim.D, contamination: sim.C }), Math.min(days, t / TICKS_PER_DAY), soil);
      }
      await breathe();
    }
    // then the sources run as the map has them, and the water comes back to the settled water
    const back = new PreviewJob({ model: base, water: { settled: false, ticks: 0, depth: sim.D.slice(), contamination: sim.C.slice(), sat: new Uint8Array(sim.N), out: sim.out.slice(), preview: true } }, base);
    let last = 0;
    for (;;) {
      if (token !== weatherToken || session !== s) return;
      const t0 = performance.now();
      let r: CanonicalWater | null = null;
      while (!r && performance.now() - t0 < WATER_SLICE_MS) {
        r = back.advance(4);
        if (!r && back.ticks - last >= frameGap(back.ticks)) {
          last = back.ticks;
          send("return", waterOf(s, { depth: back.sim.D, contamination: back.sim.C }), days);
        }
      }
      if (r) break;
      await breathe();
    }
    if (token === weatherToken && session === s) send("end", waterOf(s), days, soilOf(s));
  })();
}

/** Stop a weather run: the map's own water. */
export function stopWeather(): ViewUpdate {
  weatherToken++;
  const s = session;
  return s ? { water: waterOf(s) } : {};
}

/** Settle the open map's water now (Node tests, and anything that must not wait for the
 *  background): the same settle the background runs, in one go. */
export function settleWater(): ViewUpdate {
  const j = waterJob;
  if (!j || session !== j.session) return {};
  let r = j.job.advance(Infinity);
  while (!r) r = j.job.advance(Infinity);
  waterJob = null;
  if (!j.session.adoptWater(j.job.model, r)) return {};
  return viewUpdate(j.session);
}

/** Whether the water is still settling after an edit. */
export function waterSettling(): boolean {
  return !!waterJob && waterJob.session === session;
}

/** Resolves once the water has settled after the latest edit (at once when it has): tests and
 *  benchmarks time the live water with it. */
export function whenWaterSettles(): Promise<void> {
  return new Promise((resolve) => {
    const poll = () => (waterSettling() ? setTimeout(poll, 20) : resolve());
    poll();
  });
}

// ---------------------------------------------------------------------------------- instant checks

/** The load and design checks of the map as it now stands (about 25 ms at 256²), without the
 *  water settle or the thumbnail; `here` marks the problems in the region the edit changed. */
export function instantCheck(s: MapSession = need()): InstantCheck {
  const t0 = performance.now();
  const d = s.built.dirty;
  // what the edit touched: the features it changed, old and new, and the ground that changed
  const parts = d ? [d.region, d.terrain].filter((r): r is NonNullable<typeof r> => !!r) : [];
  const region = parts.length ? { x0: Math.min(...parts.map((r) => r.x0)), y0: Math.min(...parts.map((r) => r.y0)), x1: Math.max(...parts.map((r) => r.x1)), y1: Math.max(...parts.map((r) => r.y1)) } : null;
  const file = s.mode === "live" ? toTimberFile(s.spec!, s.built, { thumbnail: blankThumbnail() }) : s.exportFile(s.built, { thumbnail: false });
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
  // an edit never waits on the water (live editing): it shows the last settled water on the new
  // ground at once, the water settles again in the background and flows into the new shape
  // (`kickWater`), and the canonical settle follows, always before an export (EDITOR_PLAN §6)
  s.setWaterMode(waterMode);
  stopWater();
  session = s;
  sent = null;
  originalFull = null;
  lastCheck = null;
  version++;
  followed = null;
  syncChecks();
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
  stopWater();
  session = null;
  sent = null;
  originalFull = null;
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

/** The last change a control made step by step (a strength slider moved with the arrow keys):
 *  its key, when, and how long the history was after it. */
let lastStep: { key: string; at: number; length: number; session: MapSession } | null = null;
const STEP_JOIN_MS = 1500;

/** Apply a change a control makes in steps (a slider): shown at once, and steps a moment apart
 *  with the same `key` are one undo step (the latest replaces the one before). */
export function applyStep(op: EditOp, label: string, key: string): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const n = s.history().filter((h) => h.applied).length;
  const joins = lastStep && lastStep.session === s && lastStep.key === key && lastStep.length === n && performance.now() - lastStep.at < STEP_JOIN_MS;
  if (joins) s.undo();
  const r = s.apply(op, "user", label);
  if (!r.ok && joins) s.redo();
  lastStep = r.ok ? { key, at: performance.now(), length: s.history().filter((h) => h.applied).length, session: s } : null;
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
  // the canonical water from the checks worker, when it has it, spares settling it here
  if (checks && s.waterPending) await backgroundCheck().catch(() => null);
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
export async function regenerate(target: MapSpec): Promise<{ ok: boolean; errors: string[]; response: GenerateResponse | null; info: SessionInfo; orphans: DocOrphan[]; unfit: { id: string; reason: string }[]; editProblems: { id: string; message: string }[] }> {
  const t0 = performance.now();
  const s = need();
  const old = s.spec;
  if (!old) throw new Error("an imported map has no settings to change");
  const patch = specPatch(old, target);
  const r = s.regenerate(patch);
  if (r.ok) {
    version++;
    lastCheck = null;
    stopWater();
    syncChecks();
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
  return { ok: r.ok, errors: r.errors, response, info: sessionInfo(s), orphans: r.orphans, unfit: r.unfit, editProblems: r.editProblems };
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
  // entities are named by id; the page finds them by their tiles
  let where = c.where;
  if (s && where?.entities?.length && !where.tiles?.length) {
    const want = new Set(where.entities.slice(0, 50));
    const tiles: [number, number][] = [];
    for (const e of s.built.entities) if (want.has(e.id)) tiles.push([e.x, e.y]);
    if (tiles.length) where = { ...where, tiles };
  }
  return { id: c.id, class: c.class, message: c.message, ...(where ? { where } : {}), ...(fix ? { fix } : {}) };
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

/** Validate the open map for export (PLAN §19.5), in one go: the water settles canonically here
 *  when the preview's water is showing (the background check does the same in slices). */
export function exportCheck(): ExportCheck {
  const t0 = performance.now();
  const s = need();
  if (lastCheck && lastCheck.version === version) return lastCheck;
  const imported = s.mode === "import";
  const v = imported ? s.validate("export", { water: settleNow(importModel(s)) }) : s.validate("export");
  if (imported && !originalFull) originalFull = s.validateOriginal(settleNow(importModel(s, true)));
  return grouped(s, v, t0);
}

/** A validation grouped as the export dialog shows it (PLAN §19.5, D43). */
function grouped(s: MapSession, v: Validation, t0: number): ExportCheck {
  const imported = s.mode === "import";
  const before = imported ? originalFull : null;
  const out: ExportCheck = {
    blocking: [],
    warnings: [],
    advisory: [],
    existing: [],
    playability: true,
    approximate: v.report.checks.find((c) => c.approximate)?.approximate ?? null,
    checks: 0,
    version,
    ms: 0,
  };
  for (const c of v.report.checks) {
    if (c.applicable === false) continue;
    out.checks++;
    if (c.ok) continue;
    if (before && existedBefore(c, before)) out.existing.push(itemOf(c, s));
    else if (c.advisory) out.advisory.push(itemOf(c, s));
    else if (blocks("export", c)) out.blocking.push(itemOf(c, s));
    else out.warnings.push(itemOf(c, s));
  }
  out.ms = Math.round(performance.now() - t0);
  lastCheck = out;
  return out;
}

/** The water model an imported map settles on: its export file's, or (`opened`) the map's as it
 *  was opened. */
function importModel(s: MapSession, opened = false): WaterModel {
  const w = (opened ? s.openedFile() : s.exportFile(s.built, { thumbnail: false })).world;
  return waterModel(w.sizeX, w.sizeY, surfaceOf(w), mapObjects(w));
}

function settleNow(model: WaterModel): { model: WaterModel; settled: CanonicalWater } {
  return { model, settled: canonicalSettle(model) };
}

// ---------------------------------------------------------------------------- background checks

/** A slice of the canonical settle between answers to the page (about 30 ms on a 256² map). */
const SLICE_TICKS = 16;

/** Progress of a background check or an export, for the page. */
export interface CheckProgress {
  stage: "water" | "checks";
  /** 0–1 (the settle's share of its longest possible run). */
  done: number;
}

export interface BackgroundResult {
  check: ExportCheck;
  /** The view after the canonical water replaced the preview's (water, and the plants on it). */
  view: ViewUpdate;
  info: SessionInfo;
}

let bgToken = 0;

/** Let the page's messages in (edits, hover checks) between slices of work: a message to itself,
 *  queued behind any the page sent, without the few milliseconds a timer waits. */
const yieldChannel = typeof MessageChannel !== "undefined" ? new MessageChannel() : null;
const yielding: (() => void)[] = [];
if (yieldChannel) {
  yieldChannel.port1.onmessage = () => yielding.shift()?.();
  // (in Node the port must not keep the process alive)
  (yieldChannel.port1 as unknown as { unref?: () => void }).unref?.();
  (yieldChannel.port2 as unknown as { unref?: () => void }).unref?.();
}
function breathe(): Promise<void> {
  return new Promise((r) => {
    if (!yieldChannel) return void setTimeout(r, 0);
    yielding.push(r);
    yieldChannel.port2.postMessage(0);
  });
}

/** Run a canonical settle a slice at a time; null when `current` turns false (a newer edit). */
async function settleInSlices(model: WaterModel, current: () => boolean, onProgress?: (p: CheckProgress) => void): Promise<CanonicalWater | null> {
  const run = canonicalRun(model);
  for (;;) {
    const w = run.advance(SLICE_TICKS);
    if (w) return w;
    onProgress?.({ stage: "water", done: Math.min(0.99, run.ticks / run.maxTicks) });
    await breathe();
    if (!current()) return null;
  }
}

/** The full validation in the background (EDITOR_PLAN §6), debounced by the page and dropped when
 *  a newer edit arrives. The canonical settle runs in slices and replaces the preview's water; then
 *  every check runs, water and colony checks included, imported maps too (their own problems, D43,
 *  compare with the map as it was opened, checked the same way). Null when a newer edit made it
 *  stale. */
export async function backgroundCheck(onProgress?: (p: CheckProgress) => void): Promise<BackgroundResult | null> {
  if (checks) return remoteCheck(checks, onProgress);
  const s = need();
  const v0 = version;
  const token = ++bgToken;
  const current = () => session === s && version === v0 && token === bgToken;
  if (lastCheck && lastCheck.version === version && !s.waterPending) return { check: lastCheck, view: {}, info: sessionInfo(s) };
  const t0 = performance.now();
  let view: ViewUpdate = {};
  if (s.waterPending) {
    const run = s.canonicalRun();
    const w = await settleInSlices(run.model, current, onProgress);
    if (!w) return null;
    s.adoptWater(run.model, w);
    // the canonical water replaces the preview's: the background preview has nothing left to do
    stopWater();
    view = viewUpdate(s);
  }
  onProgress?.({ stage: "checks", done: 1 });
  let v: Validation;
  if (s.mode === "import") {
    const model = importModel(s);
    const w = await settleInSlices(model, current, onProgress);
    if (!w) return null;
    // unedited, the map is the map as it was opened: one settle and one validation serve both
    if (!originalFull && s.editCount === 0 && !s.waterPending) {
      originalFull = s.validateOriginal({ model, settled: w });
      lastWaterOf(originalFull, v0, w, model);
      return { check: grouped(s, originalFull, t0), view, info: sessionInfo(s) };
    }
    if (!originalFull) {
      const om = importModel(s, true);
      const ow = await settleInSlices(om, () => session === s, onProgress);
      if (!ow) return null;
      originalFull = s.validateOriginal({ model: om, settled: ow });
      if (!current()) return null;
    }
    v = s.validate("export", { water: { model, settled: w } });
    lastWaterOf(v, v0, w, model);
  } else {
    await breathe();
    if (!current()) return null;
    v = s.validate("export");
  }
  return { check: grouped(s, v, t0), view, info: sessionInfo(s) };
}

/** The background check in the checks worker: its canonical water goes in place here (the view
 *  and the export need it), with an unedited import's water layers. */
async function remoteCheck(c: ChecksWorker, onProgress?: (p: CheckProgress) => void): Promise<BackgroundResult | null> {
  const s = need();
  const v0 = version;
  if (lastCheck && lastCheck.version === version && !s.waterPending) return { check: lastCheck, view: {}, info: sessionInfo(s) };
  const r = await c.check(v0, onProgress);
  if (!r || version !== v0 || session !== s) return null;
  let view: ViewUpdate = {};
  if (r.water && s.waterPending && s.adoptWater(r.water.model, r.water.water)) {
    stopWater();
    view = viewUpdate(s);
  }
  if (r.layers) lastWater = { version: v0, ...r.layers };
  lastCheck = r.check;
  return { check: r.check, view, info: sessionInfo(s) };
}

/** Export the open map. Refused while load problems block it, or while warnings are not
 *  confirmed; confirmed warnings are noted in the map's description. The water settles
 *  canonically first, in slices with progress (PLAN §19.7: a file never gets the preview's water). */
export async function exportTimber(confirmWarnings: boolean, onProgress?: (p: CheckProgress) => void): Promise<{ ok: boolean; errors: string[]; bytes: Uint8Array; fileName: string }> {
  const s = need();
  const bg = await backgroundCheck(onProgress);
  if (!bg) return { ok: false, errors: ["the map changed while it was checked: export again"], bytes: new Uint8Array(), fileName: "" };
  const c = bg.check;
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
  | { tool: "setPiece"; piece: SetPieceKind; request: PlanRecord }
  | ({ tool: "object" } & ObjectRequest)
  | ({ tool: "area" } & AreaRequest)
  | ({ tool: "entity" } & EntityRequest)
  | { tool: "spillway"; at: [number, number]; width?: number }
  | { tool: "riverBadwater"; river: string; on: boolean };

export interface ToolPlan {
  ok: boolean;
  errors: string[];
  /** What the edit does, in plain words: every value reduced, what it clears and adds. */
  report: string[];
  label: string;
  ops: EditOp[];
  /** The tiles the planned feature covers, for the preview. */
  tiles: number[];
  /** A resource area's preview: where plants live, where they would stand dead, what stays bare. */
  area?: AreaPreview;
  featureId: string | null;
}

function toolPlan(r: PlannedEdit | PlannedOps, area?: AreaPreview): ToolPlan {
  if (!r.ok) return { ok: false, errors: r.errors, report: [], label: "", ops: [], tiles: [], featureId: null };
  return { ok: true, errors: [], report: r.report, label: r.label, ops: r.ops, tiles: r.tiles, ...(area ? { area } : {}), featureId: "feature" in r ? r.feature.id : null };
}

/** Plan a tool's edit on the open map without applying it (the preview). `id` is the new
 *  feature's id, or the id of the set piece planned again. */
export function planTool(req: ToolRequest, id: string): ToolPlan {
  const s = need();
  if (req.tool === "setPiece") return toolPlan(planPiece(s, req.piece, req.request, id));
  if (req.tool === "object") {
    const { tool: _t, ...r } = req;
    return toolPlan(planObject(s, r, id));
  }
  if (req.tool === "area") {
    const { tool: _t, ...r } = req;
    const p = planArea(s, r, id);
    return toolPlan(p, p.ok ? p.preview : undefined);
  }
  if (req.tool === "entity") {
    const { tool: _t, ...r } = req;
    return toolPlan(planEntity(s, r, id));
  }
  if (req.tool === "riverBadwater") return toolPlan(planRiverBadwater(s, req.river, req.on));
  if (req.tool === "spillway") {
    const lake = lakeAt(s, req.at[0], req.at[1]);
    if (!lake) return toolPlan({ ok: false, errors: ["click a lake's shore: a spillway drains a lake"] });
    return toolPlan(planPiece(s, "plugSpillway", { lake, at: req.at, width: req.width ?? 3 }, id));
  }
  // a feature on the map is planned again on the map without it, and changed in place
  const existing = s.features.find((f) => f.id === id) ?? null;
  const ctx = planContextOf(s, existing ? id : null);
  // a river drawn in the editor reads the water: it may start from it (a branch)
  if (req.tool === "river" && req.drawn) ctx.water = s.built.water;
  const origin = existing?.origin ?? "user";
  const r = req.tool === "river" ? planRiver(req, ctx, id, origin) : req.tool === "lake" ? planLake(req, ctx, id, origin) : planLandform(req, ctx, id, origin);
  if (!r.ok) return toolPlan(r);
  // the objects on the ground it reshapes move with it, or are cleared (EDITOR_PLAN §3, D87)
  if (!existing) return toolPlan(withObjectsOnNewGround(s, r, id));
  const patch = { params: replacePatch(existing.params, r.feature.params) as Record<string, unknown> };
  return toolPlan(withObjectsOnNewGround(s, { ...r, ops: [{ op: "updateFeature", params: { id, patch } }, ...r.ops.slice(1)], label: `Change ${r.label.replace(/^Add /, "")}` }, id));
}

// ------------------------------------------------------------------------------ live shape tools

/** A shape tool's result while it is dragged (live editing), or a feature changed by a handle:
 *  the terrain it builds, round what changes, with what it says ("reaches level 10 here, not 16").
 *  The same planners and build steps as placing it, so what shows is what is placed. */
export interface ShapePreview {
  ok: boolean;
  errors: string[];
  report: string[];
  label: string;
  /** The tiles whose heights can change, and their heights (row by row), or null. */
  rect: { x0: number; y0: number; x1: number; y1: number } | null;
  heights: Uint8Array | null;
  /** A resource area's preview: where plants live, where they would stand dead, what stays bare. */
  area?: AreaPreview;
  /** The tiles the feature covers (its outline shown on the map). */
  tiles: number[];
  /** A limit still to be met before it can be placed (a river whose water has nowhere to go yet):
   *  the first line of the report says it. */
  warn?: boolean;
  /** The words beside the pointer, when the tool has its own (a river: "3 wide, 1 deep · joins
   *  the river · cutting 6 levels deep here"). */
  cursor?: string;
}

/** What a river being drawn says beside the pointer: its size, where its water goes, how deep it
 *  cuts where the pointer is, and a strength beyond the official maps'. */
function riverWords(p: { width: number; bedDepth: number; flow: number }, end: RiverEnd): string {
  const words = [`${r1(p.width)} wide, ${p.bedDepth} deep`];
  if (end.start === "branch") words.push("a branch of the water it leaves");
  if (end.kind === "edge") words.push("flows off the map");
  else if (end.kind === "river") words.push("joins the river");
  else if (end.kind === "lake") words.push("flows into the lake");
  else if (end.kind === "hollow") words.push(`fills a lake here up to level ${end.level}`);
  else if (end.kind === "downhill") words.push("runs on downhill from here");
  if (end.cut >= 2) words.push(`cutting ${end.cut} levels deep here`);
  if (p.flow > OFFICIAL_FLOW) words.push(`${p.flow} water/s: stronger than any official map`);
  return words.join(" · ");
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export type ShapeRequest =
  /** A new feature from a tool (a landform, a lake, a resource area). */
  | { kind: "new"; req: ToolRequest; id: string }
  /** A feature on the map changed by a handle: moved, resized or raised. */
  | { kind: "change"; id: string; patch: { params: Record<string, unknown> } };

const noShape = (errors: string[]): ShapePreview => ({ ok: false, errors, report: [], label: "", rect: null, heights: null, tiles: [] });

/** The terrain and words of a shape request (see ShapePreview). */
export function previewShape(p: ShapeRequest): ShapePreview {
  const s = need();
  const { x: W } = s.size;
  let features: Feature[];
  let report: string[] = [];
  let label = "";
  let tiles: number[] = [];
  let area: AreaPreview | undefined;
  let warn = false;
  let cursor: string | undefined;
  if (p.kind === "new") {
    // (planned as it will be placed, without clearing the objects under it: that waits for the
    // release, and never changes the terrain)
    const ctx = planContextOf(s);
    const req = p.req;
    if (req.tool === "river" && req.drawn) ctx.water = s.built.water;
    let r: PlannedEdit | PlannedOps;
    if (req.tool === "landform") r = planLandform(req, ctx, p.id, "user");
    else if (req.tool === "lake") r = planLake(req, ctx, p.id, "user");
    else if (req.tool === "river") r = planRiver(req, ctx, p.id, "user");
    else if (req.tool === "area") {
      const { tool: _t, ...a } = req;
      const plan = planArea(s, a, p.id);
      if (!plan.ok) return noShape(plan.errors);
      return { ok: true, errors: [], report: plan.report, label: plan.label, rect: null, heights: null, tiles: plan.tiles, ...(plan.preview ? { area: plan.preview } : {}) };
    } else return noShape(["this tool has no live preview"]);
    if (!r.ok) return noShape(r.errors);
    if ("open" in r && r.open) warn = true;
    // a river being drawn: its size, and what it does where the pointer is (D180, D183)
    if ("end" in r && r.end && r.feature.kind === "river") cursor = riverWords(r.feature.params, r.end);
    features = s.features.map((f) => f as Feature);
    for (const op of r.ops) {
      if (op.op === "addFeature") features.push(op.params.feature);
      else if (op.op === "updateFeature") features = features.map((f) => (f.id === op.params.id ? patchFeature(f, op.params.patch) : f));
    }
    report = r.report;
    label = r.label;
    tiles = r.tiles;
  } else {
    const f = s.features.find((g) => g.id === p.id);
    if (!f) return noShape(["that feature is gone"]);
    const after = patchFeature(f as Feature, p.patch);
    const errors = s.check({ op: "updateFeature", params: { id: p.id, patch: p.patch } });
    if (errors.length) return noShape(errors);
    features = s.features.map((g) => (g.id === p.id ? after : (g as Feature)));
    if (after.kind === "landform" && after.params.outline && after.params.height !== undefined) {
      const mask = polygonMask(after.params.outline, W, s.size.y);
      const top = landformTop(after.params, mask, W, s.size.y);
      report = [top !== after.params.height ? `reaches level ${top} here, not ${after.params.height}` : `level ${after.params.height}`];
      for (let i = 0; i < mask.length; i++) if (mask[i]) tiles.push(i);
    }
    label = `Change ${kindName(f as Feature)}`;
  }
  // a river being drawn: the whole map with it (its springs too), and its water flowing as it is
  // drawn; the other shapes: their terrain
  let t: { heights: Uint8Array; rect: { x0: number; y0: number; x1: number; y1: number } | null };
  if (p.kind === "new" && p.req.tool === "river") {
    const b = s.previewBuild(features);
    draftWater(s, b);
    t = { heights: b.heights, rect: diffRect(s.built.heights, b.heights, W) };
  } else t = s.previewFeatures(features);
  // the level a landform really reaches on this map (other features may keep their own ground:
  // a river, a basin), so what it says is what shows
  const shaped = features.find((f) => f.id === (p.kind === "new" ? p.id : p.id));
  if (shaped?.kind === "landform" && shaped.params.height !== undefined && tiles.length) {
    const mask = new Uint8Array(t.heights.length);
    for (const i of tiles) mask[i] = 1;
    const top = landformTop(shaped.params, mask, W, s.size.y, t.heights);
    const want = shaped.params.height;
    const said = report[0] ?? "";
    if (top !== want && !said.startsWith(`reaches level ${top} here`)) {
      // (the steps' own limit keeps its reason: draw it wider)
      const why = said.startsWith("reaches level") && said.includes(": ") ? said.slice(said.indexOf(": ")) : "";
      report = [`reaches level ${top} here, not ${want}${why}`, ...report.slice(said.startsWith("reaches level") || said.startsWith("level ") ? 1 : 0)];
    }
  }
  const more = { ...(area ? { area } : {}), ...(warn ? { warn } : {}), ...(cursor ? { cursor } : {}) };
  if (!t.rect) return { ok: true, errors: [], report, label, rect: null, heights: null, tiles, ...more };
  const r = t.rect;
  const w = r.x1 - r.x0 + 1;
  const out = new Uint8Array(w * (r.y1 - r.y0 + 1));
  for (let y = r.y0; y <= r.y1; y++) out.set(t.heights.subarray(y * W + r.x0, y * W + r.x1 + 1), (y - r.y0) * w);
  return { ok: true, errors: [], report, label, rect: r, heights: out, tiles, ...more };
}

/** The tiles where two heightfields differ, as a rectangle (null: none). */
function diffRect(a: Uint8Array, b: Uint8Array, W: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = W;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Change a feature by a handle (moved, resized, raised) as one undo step; the objects on the
 *  ground it reshapes move with it or are cleared, as for any edit. */
export function changeFeature(id: string, patch: { params: Record<string, unknown> }, label: string): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const ops: EditOp[] = [{ op: "updateFeature", params: { id, patch } }];
  const extra = objectsOnNewGround(s, ops, new Set([id]));
  const r = s.applyAll([...ops, ...extra.ops], "user", label);
  return changed(s, r.ok, r.errors, t0);
}

/** Plan and apply a tool's edit as one undo step. */
export function applyTool(req: ToolRequest, id: string): SessionUpdate & { plan: ToolPlan } {
  const t0 = performance.now();
  const s = need();
  const plan = planTool(req, id);
  // (a refused draft's water goes, and the map's own shows again)
  if (!plan.ok) return { ...changed(s, false, plan.errors, t0), view: cancelShape(), plan };
  const r = s.applyAll(plan.ops, "user", plan.label);
  if (!r.ok) return { ...changed(s, false, r.errors, t0), view: cancelShape(), plan };
  return { ...changed(s, r.ok, r.errors, t0), plan };
}

/** Move a feature by (dx, dy) tiles; rivers, lakes and set pieces are planned again there. */
export function moveFeature(id: string, dx: number, dy: number): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const r = s.features.find((f) => f.id === id)?.kind === "mapObject" ? moveObject(s, id, dx, dy) : moveEdit(s, id, dx, dy);
  if (!r.ok) return changed(s, false, r.errors, t0);
  const a = s.applyAll(r.ops, "user", r.label);
  return changed(s, a.ok, a.errors, t0);
}

/** Move the map's start so its middle is at (x, y): the start feature of a generated map, or an
 *  imported map's own StartingLocation. */
export function moveStartTo(x: number, y: number): SessionUpdate {
  const t0 = performance.now();
  const s = need();
  const f = s.features.find((g) => g.kind === "start");
  if (f) {
    const at = startAt(s)!;
    return moveFeature(f.id, x - at[0], y - at[1]);
  }
  const e = s.built.entities.find((g) => g.template === "StartingLocation");
  if (!e) return changed(s, false, ["this map has no start to move"], t0);
  const [cx, cy] = cornerFor(x, y, e.orientation);
  const r = s.apply({ op: "moveEntity", params: { id: e.id, x: cx, y: cy } }, "user", "Move start");
  return changed(s, r.ok, r.errors, t0);
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

// ------------------------------------------------------------------------------ entities (advanced)

export interface EntityInfo {
  id: string;
  template: string;
  x: number;
  y: number;
  z: number;
  orientation: Orientation;
  flipped: boolean;
  /** What placed it: a feature's plain name, "placed by hand", "slopes" or "the imported map". */
  from: string;
  /** Its components other than BlockObject, as plain JSON. */
  components: Record<string, unknown>;
}

function plainJson(v: unknown): unknown {
  if (v instanceof JsonFloat) return v.value;
  if (Array.isArray(v)) return v.map(plainJson);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = plainJson((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** The entities whose footprint covers tile (x, y), topmost last (advanced mode's inspector). */
export function entitiesAt(x: number, y: number): EntityInfo[] {
  const s = need();
  const names = new Map(s.features.map((f) => [f.id, kindName(f)]));
  const out: EntityInfo[] = [];
  for (const e of s.built.entities) {
    if (e.raw && !placementOf(e.raw)) continue;
    if (!entityTiles(e).some(([tx, ty]) => tx === x && ty === y)) continue;
    const comps = (e.raw ? e.raw.Components : { ...(e.before ?? {}), ...e.components }) as Record<string, unknown>;
    const { BlockObject: _bo, ...rest } = comps;
    const from = names.get(e.owner) ?? (e.owner === "placed" ? "placed by hand" : e.owner.startsWith("derived:") || e.owner.startsWith("pinned:") ? "slopes" : "the imported map");
    out.push({ id: e.id, template: e.template, x: e.x, y: e.y, z: e.z, orientation: e.orientation, flipped: e.flipped, from, components: plainJson(rest) as Record<string, unknown> });
  }
  return out;
}

/** The hover preview of a single object or an entity: its tiles, and why it can't stand there. */
export function footprintCheck(req: ToolRequest): { tiles: number[]; problem: string | null } {
  const s = need();
  if (req.tool !== "object" && req.tool !== "entity") return { tiles: [], problem: null };
  return checkFootprint(s, req);
}

// ------------------------------------------------------------------------------ the water layers

/** The editor's water layers (EDITOR_PLAN §4 overlays, §6): soil moisture, badwater and the soil
 *  it spoils, the analytic drought view, and the tiles under roofs where the preview is
 *  approximate. Per-tile codes, for the page's overlay texture. */
export interface WaterLayers {
  W: number;
  H: number;
  /** Soil moisture bands: 0 dry, 1 moist (under 5), 2 wetter (5–9), 3 wettest (10 and up). */
  moisture: Uint8Array;
  /** 1 badwater, 2 soil its contamination spoils. */
  badwater: Uint8Array;
  /** The drought view: 1 water kept through the map's drought, 2 water that dries up. */
  drought: Uint8Array;
  droughtDays: number;
  /** Water kept through the drought (blocks), and water there now. */
  droughtKept: number;
  droughtNow: number;
  /** Tiles under roofs of an imported map: the preview keeps the file's water there. */
  roofed: Int32Array;
  /** Why the water checks are approximate on this map (null: they are not). */
  approximate: string | null;
  /** The water these layers show is the preview's (the canonical settle is still running). */
  preview: boolean;
  version: number;
}

/** The water layers of the map as it now stands. An unedited import keeps the file's water and
 *  has no settle: its moisture and drought come from the background check's canonical settle,
 *  once it has run (until then they are empty). */
export function waterLayers(): WaterLayers {
  const s = need();
  const b = s.built;
  const { W, H } = b;
  const N = W * H;
  const days = rulesFor(s.spec, s.meta.designedFor).droughtDays;
  let depth: ArrayLike<number> = b.water;
  let contamination: ArrayLike<number> = b.contamination;
  let moist: ArrayLike<number> = b.moisture;
  let soil: ArrayLike<number> = b.soilContamination;
  let model = b.waterModel;
  const fromCheck = b.waterFromFile && lastWater && lastWater.version === version ? lastWater : null;
  if (fromCheck) ({ depth, contamination, moist, soil, model } = fromCheck);
  const moisture = new Uint8Array(N);
  const badwater = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const m = moist[i];
    moisture[i] = !(m > 0) ? 0 : m < 5 ? 1 : m < 10 ? 2 : 3;
    if (depth[i] > 0.05 && contamination[i] >= 0.05) badwater[i] = 1;
    else if (soil[i] > 0) badwater[i] = 2;
  }
  const drought = new Uint8Array(N);
  let kept = 0;
  let now = 0;
  if (!b.waterFromFile || fromCheck) {
    const left = droughtStorage(model, depth, days);
    for (let i = 0; i < N; i++) {
      if (!(depth[i] > 0.05)) continue;
      now += depth[i];
      kept += left[i];
      drought[i] = left[i] > 0.05 ? 1 : 2;
    }
  }
  const roofed = Int32Array.from([...s.roofedTiles].sort((a, c) => a - c));
  return {
    W,
    H,
    moisture,
    badwater,
    drought,
    droughtDays: days,
    droughtKept: Math.round(kept),
    droughtNow: Math.round(now),
    roofed,
    approximate: lastCheck && lastCheck.version === version ? lastCheck.approximate : null,
    preview: s.waterPending,
    version,
  };
}

function lastWaterOf(v: Validation, at: number, w: CanonicalWater, model: WaterModel): void {
  if (v.analysis) lastWater = { version: at, depth: w.depth, contamination: w.contamination, moist: v.analysis.moisture, soil: v.analysis.soilContamination, model };
}

/** The canonical water and soil of the last background check of an imported map (the layers of an
 *  unedited import, whose build keeps the file's water). */
let lastWater: { version: number; depth: Float64Array; contamination: Float64Array; moist: Float64Array; soil: Float64Array; model: WaterModel } | null = null;

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
