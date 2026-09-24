// Edit operations (EDITOR_PLAN §3): small, serializable commands in one envelope, `{op, params}`.
// The validation report's one-click fixes use the same envelope (report.ts `FixOp`), so a fix is
// applied like any other edit. Operations are checked against their schema and the current map
// and rejected when invalid, never clamped silently (the set-piece builders are the one place that
// reduces values, and they report it).
//
// The document keeps an ordered log of applied operations. Feature and lock operations change the
// document state and store undo data; sculpt, slope and entity operations are overlays that the
// build pipeline applies in log order (PLAN §19.8 steps 6, 8 and 13). Replaying the log on a new
// generation (regeneration) re-applies every operation whose target still exists; the others are
// kept and flagged as orphaned, never dropped (PLAN §19.4).
//
// `specPatch` (change settings and regenerate) and `regenerateRegion` are not log operations:
// they replace the generation under the log (session.ts).

import { FOOTPRINTS, ORIENTATIONS, type Orientation } from "../format/footprints";
import { hasDefaults, type PlaceEntityParams } from "../features/edits";
import { REQUIRED } from "../validate/checks";
import type { Feature, FeatureKind } from "../features/schema";
import type { Runs } from "../math/grid";
import { checkSchema, validateFeatures } from "../spec/schema";
import type { Region } from "../spec/mapspec";
import { applyMergePatch, clone } from "../spec/mergepatch";
import opsSchema from "./ops.schema.json" with { type: "json" };

export type OpOrigin = "user" | "claude" | "fix" | "stamp";
export type SculptMode = "raise" | "lower" | "flatten" | "terrace" | "smooth" | "naturalize";

/** A region protected from regeneration (EDITOR_PLAN §3). */
export interface Lock {
  id: string;
  region: Region;
}

export type { PlaceEntityParams };

export interface OpParams {
  addFeature: { feature: Feature; index?: number };
  /** A JSON Merge Patch on the feature's `params` and `locked`. */
  updateFeature: { id: string; patch: { params?: Record<string, unknown>; locked?: boolean } };
  deleteFeature: { id: string };
  reorderFeature: { id: string; index: number };
  sculpt: { mode: SculptMode; cells: Runs; amount?: number; level?: number; step?: number };
  placeEntity: PlaceEntityParams;
  moveEntity: { id: string; x: number; y: number; orientation?: Orientation };
  deleteEntities: { entities: string[] };
  /** A JSON Merge Patch on the entity's components (BlockObject excluded: use moveEntity). */
  setEntityProps: { id: string; components: Record<string, unknown> };
  pinSlope: { x: number; y: number; orientation: Orientation };
  removeSlope: { x: number; y: number };
  /** Set (or, with region null, remove) the lock with this id. */
  setLock: { id: string; region: Region | null };
  regenerateRegion: { area: Region; seedVariant: number; layers: ("terrain" | "water" | "resources")[] };
  /** A JSON Merge Patch on the MapSpec, then regenerate (PLAN §19.1). */
  specPatch: { patch: Record<string, unknown> };
}

export type OpName = keyof OpParams;
export type EditOp = { [K in OpName]: { op: K; params: OpParams[K] } }[OpName];
export type OpOf<K extends OpName> = { op: K; params: OpParams[K] };

export interface UndoData {
  /** The feature before an update or a delete. */
  before?: Feature;
  /** Where the feature was (delete, reorder) or went (add); where the lock was. */
  index?: number;
  /** The lock before a setLock (null: there was none). */
  lock?: Lock | null;
}

interface Applied {
  /** Position-independent number of the operation within its document (1, 2, …). */
  seq: number;
  origin: OpOrigin;
  /** Plain-language label (fixes, Claude's proposals). */
  label?: string;
  undo?: UndoData;
  /** Why the operation has no effect: its target no longer exists (PLAN §19.4). */
  orphaned?: string;
}

export type AppliedOp = EditOp & Applied;
export type AppliedOpOf<K extends OpName> = OpOf<K> & Applied;

/** Operations kept in the document's log and replayed on every generation. */
export const LOG_OPS: readonly OpName[] = [
  "addFeature", "updateFeature", "deleteFeature", "reorderFeature", "sculpt", "placeEntity", "moveEntity",
  "deleteEntities", "setEntityProps", "pinSlope", "removeSlope", "setLock",
];
export const ENTITY_OPS: readonly OpName[] = ["placeEntity", "moveEntity", "deleteEntities", "setEntityProps"];
export const SLOPE_OPS: readonly OpName[] = ["pinSlope", "removeSlope"];

export type SculptOp = AppliedOpOf<"sculpt">;
export type SlopeOp = AppliedOpOf<"pinSlope"> | AppliedOpOf<"removeSlope">;
export type EntityOp = AppliedOpOf<"placeEntity"> | AppliedOpOf<"moveEntity"> | AppliedOpOf<"deleteEntities"> | AppliedOpOf<"setEntityProps">;

/** The document's current state: the generation's features with the log applied. */
export interface DocState {
  features: Feature[];
  locks: Lock[];
  sculpts: SculptOp[];
  slopeEdits: SlopeOp[];
  entityEdits: EntityOp[];
}

export function emptyState(features: readonly Feature[]): DocState {
  return { features: clone(features as Feature[]), locks: [], sculpts: [], slopeEdits: [], entityEdits: [] };
}

// ----------------------------------------------------------------------------------- dependencies

/** Ids of the features `f` builds on (a river it follows, a set piece its bed step belongs to). */
export function dependenciesOf(f: Feature): string[] {
  const out: string[] = [];
  switch (f.kind) {
    case "landform":
      if (f.params.along) out.push(f.params.along.river);
      break;
    case "lake":
      if (f.params.river) out.push(f.params.river);
      if ("rivers" in f.params.inflow) out.push(...f.params.inflow.rivers);
      if (f.params.outlet.target) out.push(f.params.outlet.target);
      break;
    case "setPiece": {
      const r = f.params.plan.river;
      if (typeof r === "string") out.push(r);
      break;
    }
    case "river": {
      for (const s of f.params.bedProfile.steps) if (s.setPiece) out.push(s.setPiece);
      const en = f.params.entry;
      if ("lake" in en) out.push(en.lake);
      const ex = f.params.exit;
      if ("lake" in ex) out.push(ex.lake);
      else if ("river" in ex) out.push(ex.river);
      break;
    }
    default:
      break;
  }
  return out;
}

/** Features that build on `id`. */
export function dependentsOf(features: readonly Feature[], id: string): Feature[] {
  return features.filter((f) => f.id !== id && dependenciesOf(f).includes(id));
}

// --------------------------------------------------------------------------------------- applying

function featureIndex(state: DocState, id: string): number {
  return state.features.findIndex((f) => f.id === id);
}

/** The feature after a merge patch on its params and `locked`. */
export function patchFeature(f: Feature, patch: OpParams["updateFeature"]["patch"]): Feature {
  const out = clone(f) as Feature;
  if (patch.params !== undefined) out.params = applyMergePatch(out.params, patch.params);
  if (patch.locked !== undefined) out.locked = patch.locked;
  return out;
}

/** Apply one log operation to the state. Its undo data is (re)computed; when its target no longer
 *  exists it is marked orphaned and changes nothing. */
export function applyOp(state: DocState, op: AppliedOp): void {
  delete op.undo;
  delete op.orphaned;
  switch (op.op) {
    case "addFeature": {
      const f = op.params.feature;
      if (featureIndex(state, f.id) >= 0) {
        op.orphaned = `a feature with the id ${f.id} already exists`;
        return;
      }
      const missing = dependenciesOf(f).filter((d) => featureIndex(state, d) < 0);
      if (missing.length) {
        op.orphaned = `it builds on ${missing.join(", ")}, which no longer exists`;
        return;
      }
      const index = Math.min(op.params.index ?? state.features.length, state.features.length);
      state.features.splice(index, 0, clone(f));
      op.undo = { index };
      return;
    }
    case "updateFeature": {
      const k = featureIndex(state, op.params.id);
      if (k < 0) {
        op.orphaned = `feature ${op.params.id} no longer exists`;
        return;
      }
      const before = state.features[k];
      const after = patchFeature(before, op.params.patch);
      const errors = validateFeatures([after]);
      if (errors.length) {
        op.orphaned = `the change no longer fits feature ${op.params.id}: ${errors[0].path} ${errors[0].message}`;
        return;
      }
      state.features[k] = after;
      op.undo = { before };
      return;
    }
    case "deleteFeature": {
      const k = featureIndex(state, op.params.id);
      if (k < 0) {
        op.orphaned = `feature ${op.params.id} no longer exists`;
        return;
      }
      const deps = dependentsOf(state.features, op.params.id);
      if (deps.length) {
        op.orphaned = `${deps.map((d) => d.id).join(", ")} now build on feature ${op.params.id}`;
        return;
      }
      const [before] = state.features.splice(k, 1);
      op.undo = { before, index: k };
      return;
    }
    case "reorderFeature": {
      const k = featureIndex(state, op.params.id);
      if (k < 0) {
        op.orphaned = `feature ${op.params.id} no longer exists`;
        return;
      }
      const [f] = state.features.splice(k, 1);
      state.features.splice(Math.min(op.params.index, state.features.length), 0, f);
      op.undo = { index: k };
      return;
    }
    case "sculpt":
      state.sculpts.push(op);
      return;
    case "pinSlope":
    case "removeSlope":
      state.slopeEdits.push(op);
      return;
    case "placeEntity":
    case "moveEntity":
    case "deleteEntities":
    case "setEntityProps":
      state.entityEdits.push(op);
      return;
    case "setLock": {
      const k = state.locks.findIndex((l) => l.id === op.params.id);
      const before = k >= 0 ? state.locks[k] : null;
      if (op.params.region === null) {
        if (k < 0) {
          op.orphaned = `lock ${op.params.id} no longer exists`;
          return;
        }
        state.locks.splice(k, 1);
      } else if (k >= 0) state.locks[k] = { id: op.params.id, region: clone(op.params.region) };
      else state.locks.push({ id: op.params.id, region: clone(op.params.region) });
      op.undo = { lock: before, index: k };
      return;
    }
    default:
      throw new Error(`${op.op} is not a log operation`);
  }
}

function removeFromList<T extends { seq: number }>(list: T[], seq: number): void {
  const k = list.findIndex((o) => o.seq === seq);
  if (k < 0) throw new Error(`operation ${seq} is not applied`);
  list.splice(k, 1);
}

/** Undo one applied log operation (the last one applied, in normal use). */
export function invertOp(state: DocState, op: AppliedOp): void {
  if (op.orphaned) return;
  switch (op.op) {
    case "addFeature":
      state.features.splice(featureIndex(state, op.params.feature.id), 1);
      return;
    case "updateFeature":
      state.features[featureIndex(state, op.params.id)] = op.undo!.before!;
      return;
    case "deleteFeature":
      state.features.splice(op.undo!.index!, 0, op.undo!.before!);
      return;
    case "reorderFeature": {
      const [f] = state.features.splice(featureIndex(state, op.params.id), 1);
      state.features.splice(op.undo!.index!, 0, f);
      return;
    }
    case "sculpt":
      removeFromList(state.sculpts, op.seq);
      return;
    case "pinSlope":
    case "removeSlope":
      removeFromList(state.slopeEdits, op.seq);
      return;
    case "placeEntity":
    case "moveEntity":
    case "deleteEntities":
    case "setEntityProps":
      removeFromList(state.entityEdits, op.seq);
      return;
    case "setLock": {
      const u = op.undo!;
      const k = state.locks.findIndex((l) => l.id === op.params.id);
      if (u.lock === null || u.lock === undefined) state.locks.splice(k, 1);
      else if (op.params.region === null) state.locks.splice(u.index!, 0, u.lock);
      else state.locks[k] = u.lock;
      return;
    }
    default:
      throw new Error(`${op.op} is not a log operation`);
  }
}

/** Replay a log on a generation's features. Each operation's undo data and orphan flag are
 *  recomputed for the new state (the operations are copied, the input is not changed). `fits`
 *  orphans the operations that no longer fit the map (a regeneration may change its size). */
export function replay(
  baseFeatures: readonly Feature[],
  log: readonly AppliedOp[],
  fits?: (op: AppliedOp) => string | null,
): { state: DocState; log: AppliedOp[] } {
  const state = emptyState(baseFeatures);
  const out: AppliedOp[] = [];
  for (const op of log) {
    const copy = clone(op) as AppliedOp;
    const misfit = fits?.(copy) ?? null;
    if (misfit) {
      delete copy.undo;
      copy.orphaned = misfit;
    } else applyOp(state, copy);
    out.push(copy);
  }
  return { state, log: out };
}

/** Why an operation's tiles no longer lie on a W × H map (null when they do). */
export function opFitsMap(op: EditOp, W: number, H: number): string | null {
  const inMap = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  switch (op.op) {
    case "addFeature": {
      const errors = featureGeometryProblems(op.params.feature, W, H);
      return errors.length ? `it no longer fits the map: ${errors[0]}` : null;
    }
    case "sculpt":
      return runsProblems(op.params.cells, W, H, "its cells").length ? "its cells are outside the map" : null;
    case "placeEntity":
    case "moveEntity":
    case "pinSlope":
    case "removeSlope":
      return inMap(op.params.x, op.params.y) ? null : `(${op.params.x}, ${op.params.y}) is outside the map`;
    case "setLock":
      return op.params.region && runsProblems(op.params.region.runs, W, H, "its region").length ? "its region is outside the map" : null;
    default:
      return null;
  }
}

// -------------------------------------------------------------------------------------- validation

export interface OpContext {
  state: DocState;
  W: number;
  H: number;
  /** True for generated maps (the ones with a spec). */
  generated: boolean;
  /** Ids of the entities in the current build. */
  entityIds: ReadonlySet<string>;
  /** Tiles with a slope in the current build. */
  slopeTiles: ReadonlySet<number>;
  /** Columns the sculpt tools leave alone: imported caves and overhangs (EDITOR_PLAN §3). */
  lockedColumns: ReadonlySet<number> | null;
  /** Feature kinds this version builds when a player adds them. */
  buildableKinds?: readonly FeatureKind[];
}

/** Kinds a player can add in this version. Set pieces arrive with their builders (M5), map objects
 *  with M7 (ROADMAP). */
export const ADDABLE_KINDS: readonly FeatureKind[] = ["river", "lake", "landform", "forest", "berryPatch", "ruinField", "start"];

/** Templates a player may place by hand: the common set, minus the start (it is a feature). */
export const PLACEABLE = new Set([
  "Pine", "Birch", "Oak", "Succulent", "BlueberryBush", "Blockage", "GeothermalField", "LargeRelic", "MediumRelic", "SmallRelic",
  "NaturalDam", "NaturalOverhang2x1", "NaturalOverhang3x1", "NaturalOverhang4x1", "Slope", "Thorns", "UnstableCore",
  "RuinColumnH1", "RuinColumnH2", "RuinColumnH3", "RuinColumnH4", "RuinColumnH5", "RuinColumnH6", "RuinColumnH7", "RuinColumnH8",
  "UndergroundRuins", "BadwaterSource", "WaterSource", "WaterSeep", "BadwaterSeep",
]);

/** Largest number of tiles one operation may touch. */
export const MAX_OP_TILES = 256 * 256;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPS_SCHEMA = opsSchema as Record<string, unknown>;

function runsProblems(runs: Runs, W: number, H: number, what: string): string[] {
  let n = 0;
  for (const [y, x0, x1] of runs) {
    if (y < 0 || y >= H || x0 < 0 || x1 >= W || x0 > x1) return [`${what}: the run [${y}, ${x0}, ${x1}] is outside the ${W}×${H} map`];
    n += x1 - x0 + 1;
  }
  if (n === 0) return [`${what} is empty`];
  if (n > MAX_OP_TILES) return [`${what} covers ${n} tiles, more than one operation may change`];
  return [];
}

function featureGeometryProblems(f: Feature, W: number, H: number): string[] {
  const inMap = (p: readonly number[]) => p[0] >= 0 && p[0] <= W - 1 && p[1] >= 0 && p[1] <= H - 1;
  const p = f.params as unknown as Record<string, unknown>;
  switch (f.kind) {
    case "forest":
    case "berryPatch":
    case "ruinField":
      return runsProblems(f.params.area, W, H, `${f.kind} area`);
    case "start":
      return inMap(f.params.position) ? [] : [`the start at (${f.params.position.join(", ")}) is outside the map`];
    case "landform":
      if (f.params.outline && !f.params.outline.every(inMap)) return ["the landform's outline leaves the map"];
      if (!f.params.along && (!f.params.outline || f.params.height === undefined)) return ["a landform needs an outline and a height"];
      return [];
    case "lake":
      return f.params.outline.every(inMap) ? [] : ["the lake's outline leaves the map"];
    case "river":
      return f.params.path.every((q) => q[0] >= -1 && q[0] <= W && q[1] >= -1 && q[1] <= H) ? [] : ["the river's path leaves the map"];
    default:
      return p ? [] : ["no params"];
  }
}

/** Why an operation cannot be applied now (empty when it can). */
export function validateOp(op: EditOp, ctx: OpContext): string[] {
  const schemaErrors = checkSchema(OPS_SCHEMA, op);
  if (schemaErrors.length) return schemaErrors.map((e) => `${op.op ?? "operation"}${e.path}: ${e.message}`);
  const { state, W, H } = ctx;
  const inMap = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  const featureById = (id: string) => state.features.find((f) => f.id === id);
  switch (op.op) {
    case "addFeature": {
      const f = op.params.feature;
      const errors = validateFeatures([f]).map((e) => `feature${e.path.replace(/^\/0/, "")}: ${e.message}`);
      if (errors.length) return errors;
      if (f.origin === "generated") return ["only the generator makes generated features"];
      if (featureById(f.id)) return [`a feature with the id ${f.id} already exists`];
      if (!(ctx.buildableKinds ?? ADDABLE_KINDS).includes(f.kind)) {
        return [f.kind === "setPiece" ? "set pieces arrive with their builders (roadmap M5)" : `${f.kind} features arrive in a later version (roadmap M7)`];
      }
      if (f.kind === "start" && state.features.some((g) => g.kind === "start")) return ["the map already has its start: move it instead (vanilla maps have exactly one)"];
      const missing = dependenciesOf(f).filter((d) => !featureById(d));
      if (missing.length) return [`it builds on ${missing.join(", ")}, which does not exist`];
      if (op.params.index !== undefined && op.params.index > state.features.length) return [`index ${op.params.index} is past the end of the feature list`];
      return featureGeometryProblems(f, W, H);
    }
    case "updateFeature": {
      const f = featureById(op.params.id);
      if (!f) return [`feature ${op.params.id} does not exist`];
      const after = patchFeature(f, op.params.patch);
      const errors = validateFeatures([after]).map((e) => `feature${e.path.replace(/^\/0/, "")}: ${e.message}`);
      if (errors.length) return errors;
      const missing = dependenciesOf(after).filter((d) => !featureById(d));
      if (missing.length) return [`it would build on ${missing.join(", ")}, which does not exist`];
      if (f.kind === "setPiece" || f.kind === "mapObject") return [`${f.kind} features are edited through their builders (roadmap M5, M7)`];
      return featureGeometryProblems(after, W, H);
    }
    case "deleteFeature": {
      if (!featureById(op.params.id)) return [`feature ${op.params.id} does not exist`];
      const deps = dependentsOf(state.features, op.params.id);
      return deps.length ? [`${deps.map((d) => `${d.kind} ${d.id}`).join(", ")} build on it: delete or change them first`] : [];
    }
    case "reorderFeature":
      if (!featureById(op.params.id)) return [`feature ${op.params.id} does not exist`];
      return op.params.index >= state.features.length ? [`index ${op.params.index} is past the end of the feature list`] : [];
    case "sculpt": {
      const p = op.params;
      if (p.mode === "naturalize") return ["the naturalize brush arrives in roadmap M10"];
      const errors = runsProblems(p.cells, W, H, "sculpt cells");
      if (errors.length) return errors;
      if ((p.mode === "raise" || p.mode === "lower") && p.amount === undefined) return [`${p.mode} needs an amount`];
      if (p.mode === "flatten" && p.level === undefined) return ["flatten needs a level"];
      if (p.mode === "terrace" && p.step === undefined) return ["terrace needs a step"];
      if (ctx.lockedColumns?.size) {
        for (const [y, x0, x1] of p.cells) for (let x = x0; x <= x1; x++) {
          if (ctx.lockedColumns.has(y * W + x)) return [`(${x}, ${y}) has a cave or overhang, which the sculpt tools leave as it is`];
        }
      }
      return [];
    }
    case "placeEntity": {
      const p = op.params;
      if (!GUID.test(p.id)) return [`${p.id} is not a lowercase GUID`];
      if (ctx.entityIds.has(p.id) || state.entityEdits.some((e) => e.op === "placeEntity" && e.params.id === p.id)) return [`an entity with the Id ${p.id} already exists`];
      if (!PLACEABLE.has(p.template) || !FOOTPRINTS[p.template]) return [`${p.template} cannot be placed by hand`];
      if (!inMap(p.x, p.y)) return [`(${p.x}, ${p.y}) is outside the map`];
      if (!ORIENTATIONS.includes(p.orientation)) return [`bad orientation ${String(p.orientation)}`];
      if (!p.components) return hasDefaults(p.template) ? [] : [`${p.template} needs its components`];
      const missing = (REQUIRED[p.template] ?? []).filter((c) => !(c in p.components!));
      if (missing.length) return [`${p.template} needs the components ${missing.join(", ")}`];
      return "BlockObject" in p.components ? ["BlockObject comes from the operation's position"] : [];
    }
    case "moveEntity": {
      if (!ctx.entityIds.has(op.params.id)) return [`entity ${op.params.id} does not exist`];
      return inMap(op.params.x, op.params.y) ? [] : [`(${op.params.x}, ${op.params.y}) is outside the map`];
    }
    case "deleteEntities": {
      const missing = op.params.entities.filter((id) => !ctx.entityIds.has(id));
      return missing.length ? [`${missing.length} of the entities do not exist (${missing.slice(0, 3).join(", ")})`] : [];
    }
    case "setEntityProps":
      if (!ctx.entityIds.has(op.params.id)) return [`entity ${op.params.id} does not exist`];
      return "BlockObject" in op.params.components ? ["BlockObject changes through moveEntity"] : [];
    case "pinSlope":
      return inMap(op.params.x, op.params.y) ? [] : [`(${op.params.x}, ${op.params.y}) is outside the map`];
    case "removeSlope":
      return ctx.slopeTiles.has(op.params.y * W + op.params.x) ? [] : [`there is no slope at (${op.params.x}, ${op.params.y})`];
    case "setLock": {
      if (op.params.region === null) return state.locks.some((l) => l.id === op.params.id) ? [] : [`lock ${op.params.id} does not exist`];
      return runsProblems(op.params.region.runs, W, H, "the locked region");
    }
    case "regenerateRegion":
      return ["regenerating an area arrives in roadmap M11"];
    case "specPatch":
      return ctx.generated ? [] : ["an imported map has no settings to change"];
  }
}
