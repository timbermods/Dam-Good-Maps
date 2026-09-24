// Validation modules (PLAN §11, §19.5). Every check has an id (matching prototype/validate.py), a
// class and a severity; profiles decide what a class does. M1 has the load class (§11.1–11.2: what
// the game would crash on, silently drop, or break at start) and the design class
// (terrain.max_height, terrain.single_floor). The playability class arrives in M2.

import { FOOTPRINTS, OCC, ORIENTATIONS, slopeHighSide, startEntranceTile, worldBlocks, type Orientation, type Placement } from "../format/footprints";
import { isObject, num, type JsonObject } from "../format/json";
import { EDITOR_MAX_HEIGHT, floorsOf, GAME_VERSION, MAX_OBJECT_Z, surfaceOf } from "../format/world";
import type { TimberFile } from "../format/timber";

export type CheckClass = "load" | "playability" | "design";
export type Severity = "error" | "warning" | "info";

export interface CheckResult {
  id: string;
  class: CheckClass;
  severity: Severity;
  ok: boolean;
  value?: number | string;
  limit?: number | string;
  message: string;
  /** Tiles, a feature or an entity involved. */
  where?: { tiles?: [number, number][]; feature?: string; entity?: string };
  advisory?: boolean;
}

export type Profile = "generate" | "export" | "import";

export interface ValidationReport {
  profile: Profile;
  checks: CheckResult[];
  passed: boolean;
}

/** Templates in the Common collections: they load for both factions and in the map editor
 *  (FORMAT.md §4.4). Faction-only plants fail. */
const COMMON = new Set([
  "Pine", "Birch", "Oak", "Succulent", "BlueberryBush",
  "Blockage", "GeothermalField", "LargeRelic", "MediumRelic", "SmallRelic", "NaturalDam",
  "NaturalOverhang2x1", "NaturalOverhang3x1", "NaturalOverhang4x1", "ReservePile", "ReserveTank", "ReserveWarehouse",
  "Slope", "Thorns", "UnstableCore", "RuinColumnH1", "RuinColumnH2", "RuinColumnH3", "RuinColumnH4", "RuinColumnH5",
  "RuinColumnH6", "RuinColumnH7", "RuinColumnH8", "UndergroundRuins", "StartingLocation", "AncientAquiferDrill", "Aquifer",
  "BadtideDrain", "BadwaterSeep", "BadwaterSource", "WaterSeep", "WaterSource",
]);
const REQUIRED: Record<string, string[]> = {
  WaterSource: ["WaterSource"], BadwaterSource: ["WaterSource"], Aquifer: ["WaterSource"], BadtideDrain: ["WaterSource"],
  WaterSeep: ["WaterSource", "WaterDepthStrengthModifier"], BadwaterSeep: ["WaterSource", "WaterDepthStrengthModifier"],
  UnstableCore: ["UnstableCore"], ReservePile: ["FixedStockpile"], ReserveTank: ["FixedStockpile"], ReserveWarehouse: ["FixedStockpile"],
};
for (let k = 1; k <= 8; k++) REQUIRED[`RuinColumnH${k}`] = ["RuinModels", "Yielder:Ruin"];
/** Ground blocks of these must stand on the first (lowest) terrain column. */
const CONTINUOUS = new Set(["WaterSource", "BadwaterSource", "WaterSeep", "BadwaterSeep", "Aquifer", "BadtideDrain", "GeothermalField", "UndergroundRuins"]);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function placementOf(e: JsonObject): Placement | null {
  const comps = e.Components;
  if (!isObject(comps)) return null;
  const bo = comps.BlockObject;
  if (!isObject(bo) || !isObject(bo.Coordinates)) return null;
  let o = bo.Orientation ?? "Cw0";
  if (isObject(o)) o = (o.Value as string) ?? "Cw0"; // 0.6 maps: {"Value": "Cw90"}
  let fl = bo.Flipped ?? false;
  if (isObject(fl)) fl = (fl.Value as boolean) ?? false;
  return {
    template: String(e.Template),
    x: num(bo.Coordinates.X),
    y: num(bo.Coordinates.Y),
    z: num(bo.Coordinates.Z),
    orientation: o as Orientation,
    flipped: fl === true,
  };
}

class Collector {
  readonly checks: CheckResult[] = [];
  add(r: Omit<CheckResult, "severity"> & { severity?: Severity }): void {
    this.checks.push({ severity: r.severity ?? (r.ok ? "info" : "error"), ...r } as CheckResult);
  }
}

// ------------------------------------------------------------------------------------------------ file

function checkFile(file: TimberFile, c: Collector, external: boolean): void {
  const w = file.world;
  const X = w.sizeX;
  const Y = w.sizeY;
  c.add({ id: "file.size", class: "load", ok: X >= 4 && X <= 256 && Y >= 4 && Y <= 256, value: `${X}x${Y}`, limit: "4..256", message: `map is ${X}×${Y} (the game allows 4–256 per side)` });
  c.add({ id: "file.layers", class: "load", ok: w.layers === 23, value: w.layers, limit: 23, message: `${w.layers} voxel layers (exactly 23)` });
  const ver = w.gameVersion;
  const txt = file.versionTxt.split(/\r?\n/)[0].trim();
  const verOk = external ? ver.startsWith("1.1.") && txt === ver : ver === GAME_VERSION && txt === GAME_VERSION;
  c.add({ id: "file.version", class: "load", ok: verOk, value: ver, limit: external ? "1.1.x" : GAME_VERSION, message: `version ${ver}, version.txt ${txt}` });
  const s = w.singletons;
  const need = ["MapSize", "TerrainMap", "WaterMapNew", "SoilMoistureSimulator", "SoilContaminationSimulator", "WaterEvaporationMap"];
  const missing = need.filter((k) => !(k in s));
  const mig = s.WaterSimulationMigrator;
  const migOk = isObject(mig) && mig.IsMigrated === true;
  c.add({
    id: "file.singletons",
    class: "load",
    ok: missing.length === 0 && migOk,
    message: missing.length ? `missing ${missing.join(", ")}` : migOk ? "all present, WaterSimulationMigrator.IsMigrated true" : "WaterSimulationMigrator.IsMigrated missing or false: every source would run at half strength",
  });
  if (!missing.length) {
    const wm = s.WaterMapNew as JsonObject;
    const levels = num(wm.Levels);
    const n = levels * X * Y;
    const len = (o: unknown, key: string) => (isObject(o as JsonObject) && isObject((o as JsonObject)[key]) ? String(((o as JsonObject)[key] as JsonObject).Array).split(" ").length : -1);
    const lens: Record<string, number> = {
      WaterColumns: len(wm, "WaterColumns"),
      ColumnOutflows: len(wm, "ColumnOutflows"),
      MoistureLevels: len(s.SoilMoistureSimulator, "MoistureLevels"),
      ContaminationLevels: len(s.SoilContaminationSimulator, "ContaminationLevels"),
      ContaminationCandidates: len(s.SoilContaminationSimulator, "ContaminationCandidates"),
      EvaporationModifiers: len(s.WaterEvaporationMap, "EvaporationModifiers"),
    };
    const bad = Object.entries(lens).filter(([, v]) => v !== n);
    const need2 = Math.max(1, Math.max(...floorsOf(w)));
    c.add({
      id: "file.arrays",
      class: "load",
      ok: bad.length === 0 && levels >= need2,
      value: levels,
      limit: need2,
      message: bad.length ? `wrong lengths: ${bad.map(([k, v]) => `${k} ${v}`).join(", ")} (expected ${n})` : levels < need2 ? `water Levels ${levels} below the terrain's ${need2} floors` : "every packed array has W·H·Levels tokens",
    });
  }
  const md = file.metadata;
  const mdKeys = ["Width", "Height", "MapNameLocKey", "MapDescriptionLocKey", "MapDescription", "IsRecommended", "IsUnconventional", "IsDev"];
  const mdOk = !!md && mdKeys.every((k) => k in md) && md.Width === X && md.Height === Y;
  c.add({ id: "file.metadata", class: "load", ok: mdOk, message: md ? `metadata ${String(md.Width)}×${String(md.Height)}` : "map_metadata.json missing" });
  const thumbOk = !!file.thumbnail && jpegSize(file.thumbnail)?.join("x") === "960x540";
  c.add({ id: "file.thumbnail", class: "load", ok: thumbOk, message: thumbOk ? "960×540 JPEG" : "thumbnail missing or not 960×540" });
}

/** Width and height from a JPEG's SOF marker. */
export function jpegSize(b: Uint8Array): [number, number] | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    }
    i += 2 + len;
  }
  return null;
}

// ------------------------------------------------------------------------------------------- terrain

function checkTerrain(file: TimberFile, c: Collector, surface: Uint8Array, stackTops: Set<number>): void {
  const w = file.world;
  let maxH = 0;
  for (const v of surface) if (v > maxH) maxH = v;
  c.add({ id: "terrain.max_height", class: "design", ok: maxH <= EDITOR_MAX_HEIGHT, value: maxH, limit: EDITOR_MAX_HEIGHT, message: `highest column ${maxH} (the in-game editor's limit is 16)` });
  const plane = w.sizeX * w.sizeY;
  let top = 0;
  if (w.layers >= 23) for (let i = 0; i < plane; i++) top += w.voxels[22 * plane + i];
  c.add({ id: "terrain.top_layer_free", class: "load", ok: top === 0, value: top, limit: 0, message: top ? `${top} solid voxels in layer 22` : "layer 22 is empty" });
  const floors = floorsOf(w);
  let multi = 0;
  for (const v of floors) if (v > 1) multi++;
  c.add({ id: "terrain.single_floor", class: "design", ok: multi === 0, value: multi, limit: 0, message: multi ? `${multi} columns with caves or overhangs (outside the water model's scope)` : "one floor per tile" });
  const unsupported = multi === 0 ? 0 : unsupportedVoxels(file, stackTops);
  c.add({ id: "terrain.supported", class: "load", ok: unsupported === 0, value: unsupported, limit: 0, message: unsupported ? `${unsupported} voxels float more than 3 tiles from support` : "all terrain is supported" });
}

/** Solid voxels not reachable from z = 0 going up, or by at most 3 sideways steps since the last
 *  upward step; the top of a stackable object also supports the voxel above it. */
function unsupportedVoxels(file: TimberFile, stackTops: Set<number>): number {
  const { sizeX: X, sizeY: Y, layers: Z, voxels } = file.world;
  const plane = X * Y;
  const best = new Int8Array(Z * plane).fill(99);
  const queue: number[] = [];
  for (let i = 0; i < plane; i++) if (voxels[i]) {
    best[i] = 0;
    queue.push(i);
  }
  for (const k of stackTops) {
    const up = k + plane;
    if (up < Z * plane && voxels[up]) {
      best[up] = 0;
      queue.push(up);
    }
  }
  for (let h = 0; h < queue.length; h++) {
    const v = queue[h];
    const s = best[v];
    const z = Math.floor(v / plane);
    const i = v - z * plane;
    const x = i % X;
    const y = (i - x) / X;
    const up = v + plane;
    if (z + 1 < Z && voxels[up] && best[up] > 0) {
      best[up] = 0;
      queue.push(up);
    }
    if (s < 3) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= X || yy < 0 || yy >= Y) continue;
        const n = z * plane + yy * X + xx;
        if (voxels[n] && best[n] > s + 1) {
          best[n] = s + 1;
          queue.push(n);
        }
      }
    }
  }
  let count = 0;
  for (let v = 0; v < Z * plane; v++) if (voxels[v] && best[v] === 99) count++;
  return count;
}

// ------------------------------------------------------------------------------------------ entities

interface EntityScan {
  occupied: Map<number, number>;
  stackTops: Set<number>;
  startCells: number[];
  placements: Placement[];
}

/** Emulates the game's load-time BlockValidator (notes/blocks_and_placement.md §6): everything
 *  reported here is an object the game would delete, or a load that would fail. */
function checkEntities(file: TimberFile, c: Collector, surface: Uint8Array): EntityScan {
  const w = file.world;
  const { sizeX: X, sizeY: Y, layers: Z, voxels } = w;
  const plane = X * Y;
  const solid = (x: number, y: number, z: number) => z < 0 || (z < Z && voxels[z * plane + y * X + x] === 1);
  // first terrain column top: height of the contiguous solid run from z = 0
  const firstTop = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    let z = 0;
    while (z < Z && voxels[z * plane + i]) z++;
    firstTop[i] = z;
  }
  const ids = new Set<string>();
  let badIds = 0;
  const unknown = new Set<string>();
  const badEnum: string[] = [];
  const missingComp = new Set<string>();
  const placements: Placement[] = [];
  for (const e of w.entities) {
    const id = String(e.Id);
    if (ids.has(id) || !GUID.test(id)) badIds++;
    ids.add(id);
    const t = String(e.Template);
    if (!COMMON.has(t) || !FOOTPRINTS[t]) {
      unknown.add(t);
      continue;
    }
    const p = placementOf(e);
    if (!p || !(ORIENTATIONS as readonly string[]).includes(p.orientation)) {
      badEnum.push(t);
      continue;
    }
    const comps = e.Components as JsonObject;
    for (const r of REQUIRED[t] ?? []) if (!(r in comps)) missingComp.add(`${t}.${r}`);
    placements.push(p);
  }
  c.add({ id: "entities.templates", class: "load", ok: unknown.size === 0, message: unknown.size ? `unknown or faction-only templates: ${[...unknown].join(", ")}` : "every template is in the common collections" });
  c.add({ id: "entities.enums", class: "load", ok: badEnum.length === 0, message: badEnum.length ? `bad orientation on ${badEnum.slice(0, 5).join(", ")}` : "every orientation is a valid enum name" });
  c.add({ id: "entities.components", class: "load", ok: missingComp.size === 0, message: missingComp.size ? `missing ${[...missingComp].slice(0, 6).join(", ")}` : "required components present" });
  c.add({ id: "entities.ids", class: "load", ok: badIds === 0, value: badIds, limit: 0, message: `${badIds} duplicate or malformed ids` });

  // load order: z ascending (ties keep file order, like the game's batch loader)
  const order = placements.map((p, k) => [p, k] as const).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]);
  const occupied = new Map<number, number>(); // cell key -> occupation flags
  const baseCells = new Set<number>();
  const stackTops = new Set<number>();
  const startCells: number[] = [];
  const problems: string[] = [];
  const key = (x: number, y: number, z: number) => z * plane + y * X + x;
  for (const [p] of order) {
    const fp = FOOTPRINTS[p.template];
    const cells = worldBlocks(fp, p);
    let why = "";
    for (const b of cells) {
      if (b.x < 0 || b.x >= X || b.y < 0 || b.y >= Y || b.z >= MAX_OBJECT_Z) { why = "outside the map"; break; }
      if (solid(b.x, b.y, b.z)) { why = `inside terrain at (${b.x},${b.y},${b.z})`; break; }
      if ((occupied.get(key(b.x, b.y, b.z)) ?? 0) & b.flags) { why = `overlaps another object at (${b.x},${b.y},${b.z})`; break; }
      if (b.below === "ground" && !solid(b.x, b.y, b.z - 1)) { why = `floating at (${b.x},${b.y},${b.z})`; break; }
      if (b.below === "groundOrStackable" && !solid(b.x, b.y, b.z - 1) && !stackTops.has(key(b.x, b.y, b.z - 1))) { why = `floating at (${b.x},${b.y},${b.z})`; break; }
      if (b.below === "air" && solid(b.x, b.y, b.z)) { why = `slope top not in air at (${b.x},${b.y},${b.z})`; break; }
      if (b.occupyAllBelow) {
        let under = false;
        for (let zz = 0; zz < b.z; zz++) if (baseCells.has(key(b.x, b.y, zz))) under = true;
        if (under) { why = `object below an OccupyAllBelow block at (${b.x},${b.y})`; break; }
      }
      if (CONTINUOUS.has(p.template) && b.below === "ground" && b.z !== firstTop[b.y * X + b.x]) { why = `not on the first terrain column at (${b.x},${b.y})`; break; }
    }
    if (why) {
      problems.push(`${p.template} at (${p.x},${p.y},${p.z}): ${why}`);
      continue;
    }
    for (const b of cells) {
      const k = key(b.x, b.y, b.z);
      if (p.template === "StartingLocation") {
        startCells.push(k);
        continue;
      }
      occupied.set(k, (occupied.get(k) ?? 0) | b.flags);
      baseCells.add(k);
      if (b.stackable) stackTops.add(k);
    }
  }
  c.add({
    id: "entities.placement",
    class: "load",
    ok: problems.length === 0,
    value: problems.length,
    limit: 0,
    message: problems.length ? problems.slice(0, 6).join("; ") + (problems.length > 6 ? ` (+${problems.length - 6} more)` : "") : "every object would load",
  });
  const overlap = startCells.filter((k) => occupied.has(k)).length;
  c.add({ id: "start.clear", class: "load", ok: overlap === 0, value: overlap, limit: 0, message: overlap ? `${overlap} start cells covered by objects (the start would be deleted)` : "nothing overlaps the start" });
  return { occupied, stackTops, startCells, placements };
}

// ---------------------------------------------------------------------------------- slopes and start

function checkSlopes(file: TimberFile, c: Collector, surface: Uint8Array, scan: EntityScan): void {
  const { sizeX: X, sizeY: Y } = file.world;
  const slopes = scan.placements.filter((p) => p.template === "Slope");
  const at = new Map<number, Placement>();
  for (const s of slopes) at.set(s.y * X + s.x, s);
  const bad: string[] = [];
  for (const s of slopes) {
    const [dx, dy] = slopeHighSide(s.orientation);
    const hx = s.x + dx;
    const hy = s.y + dy;
    const lx = s.x - dx;
    const ly = s.y - dy;
    const inb = (x: number, y: number) => x >= 0 && x < X && y >= 0 && y < Y;
    const highOk = inb(hx, hy) && surface[hy * X + hx] === s.z + 1;
    const chained = at.get(ly * X + lx);
    const lowOk = inb(lx, ly) && (surface[ly * X + lx] === s.z || (!!chained && chained.z === s.z - 1));
    if (!highOk || !lowOk) bad.push(`(${s.x},${s.y},${s.z}) ${s.orientation}`);
  }
  c.add({
    id: "slopes.connect",
    class: "load",
    ok: bad.length === 0,
    value: bad.length,
    limit: 0,
    message: bad.length ? `slopes that do not join a 1-level step: ${bad.slice(0, 5).join(", ")}` : `${slopes.length} slopes join level z to z+1`,
  });
}

function checkStart(file: TimberFile, c: Collector, surface: Uint8Array, scan: EntityScan): void {
  const { sizeX: X, sizeY: Y } = file.world;
  const starts = scan.placements.filter((p) => p.template === "StartingLocation");
  c.add({ id: "start.count", class: "load", ok: starts.length === 1, value: starts.length, limit: 1, message: `${starts.length} StartingLocation(s) (a vanilla map needs exactly one)` });
  if (starts.length !== 1) return;
  const p = starts[0];
  const cells = worldBlocks(FOOTPRINTS.StartingLocation, p).filter((b) => b.localZ === 0);
  const flat = cells.every((b) => b.x >= 0 && b.x < X && b.y >= 0 && b.y < Y && surface[b.y * X + b.x] === p.z);
  c.add({ id: "start.flat", class: "load", ok: flat, message: flat ? "the district center's 3×3 is flat ground at the start level" : "the start's 3×3 footprint is not flat" });
  const [ex, ey] = startEntranceTile(p.x, p.y, p.orientation);
  const plane = X * Y;
  const free = ex >= 0 && ex < X && ey >= 0 && ey < Y && surface[ey * X + ex] === p.z && !scan.occupied.has(p.z * plane + ey * X + ex) && !scan.occupied.has((p.z + 1) * plane + ey * X + ex);
  c.add({ id: "start.entrance", class: "load", ok: free, where: { tiles: [[ex, ey]] }, message: free ? `entrance tile (${ex},${ey}) is free ground at level ${p.z}` : `entrance tile (${ex},${ey}) must be free ground at level ${p.z}, or no beavers spawn` });
}

// ---------------------------------------------------------------------------------------- profiles

/** What each class does in each profile (PLAN §19.5). */
export function blocks(profile: Profile, r: CheckResult): boolean {
  if (r.ok || r.advisory || r.severity === "warning" || r.severity === "info") return false;
  if (profile === "generate") return true;
  if (profile === "export") return r.class === "load";
  return false;
}

export interface ValidateOptions {
  profile: Profile;
  /** External files (imports) accept any 1.1.x version. */
  external?: boolean;
}

export function validateFile(file: TimberFile, opts: ValidateOptions): ValidationReport {
  const c = new Collector();
  checkFile(file, c, opts.external ?? opts.profile === "import");
  const surface = surfaceOf(file.world);
  const scan = checkEntities(file, c, surface);
  checkTerrain(file, c, surface, scan.stackTops);
  checkSlopes(file, c, surface, scan);
  checkStart(file, c, surface, scan);
  const checks = c.checks;
  return { profile: opts.profile, checks, passed: !checks.some((r) => blocks(opts.profile, r)) };
}

export { OCC };
