// Map entities in the shape official 1.1 maps store them (FORMAT.md §5), component order
// included. Every builder takes its Id from the caller: ids are hashed from the owning feature
// (PLAN §19.4), never random.

import { F, type JsonObject } from "./json";
import type { Orientation } from "./footprints";

export interface EntitySpec {
  id: string;
  template: string;
  x: number;
  y: number;
  z: number;
  orientation: Orientation;
  flipped: boolean;
  /** Components other than BlockObject, in file order. `before` ones precede BlockObject. */
  components: JsonObject;
  before?: JsonObject;
  /** The feature that placed it (kept in the document, never written to the .timber). */
  owner: string;
}

export function entityJson(e: EntitySpec): JsonObject {
  const bo: JsonObject = { Coordinates: { X: e.x, Y: e.y, Z: e.z } };
  if (e.orientation !== "Cw0") bo.Orientation = e.orientation;
  if (e.flipped) bo.Flipped = true;
  const comps: JsonObject = { ...(e.before ?? {}), BlockObject: bo, ...e.components };
  return { Id: e.id, Template: e.template, Components: comps };
}

const yieldOf = (good: string, amount: number): JsonObject => ({ Yield: { Good: good, Amount: amount } });

export const TREE_LOGS: Record<string, number> = { Pine: 2, Birch: 1, Oak: 8 };
export const MAP_TREES = ["Pine", "Birch", "Oak", "Succulent"] as const;
export type TreeSpecies = (typeof MAP_TREES)[number];

interface Base {
  id: string;
  owner: string;
  x: number;
  y: number;
  z: number;
}

/** A wild tree. `growth` < 1 stores a sapling; `dead` stores LivingNaturalResource.IsDead (dead
 *  trees keep their logs, which is how official maps store trees on dry soil). */
export function tree(b: Base & { species: TreeSpecies; dead?: boolean; growth?: number }): EntitySpec {
  const c: JsonObject = { CoordinatesOffsetter: { Random: true } };
  if (b.dead) c.LivingNaturalResource = { IsDead: true };
  if (b.growth !== undefined && b.growth < 1) c.Growable = { GrowthProgress: F(b.growth) };
  if (b.species === "Succulent") {
    c["Yielder:Cuttable"] = yieldOf("Water", 2);
    c.DeadCuttableYieldRemover = { IsBlocked: false };
  } else {
    c["Yielder:Cuttable"] = yieldOf("Log", TREE_LOGS[b.species]);
    if (b.species === "Pine") c["Yielder:Gatherable"] = yieldOf("PineResin", 0);
  }
  return { ...pos(b), template: b.species, components: c };
}

/** A blueberry bush: ripe (3 berries ready) or regrowing its yield. */
export function bush(b: Base & { ripe: boolean; regrowth?: number }): EntitySpec {
  const c: JsonObject = { CoordinatesOffsetter: { Random: true } };
  if (b.ripe) {
    c["Yielder:Gatherable"] = yieldOf("Berries", 3);
    c.GatherableYieldGrower = { GrowthProgress: F(1) };
  } else {
    c["Yielder:Gatherable"] = yieldOf("Berries", 0);
    c.GatherableYieldGrower = { GrowthProgress: F(b.regrowth ?? 0.5) };
  }
  return { ...pos(b), template: "BlueberryBush", components: c };
}

export const RUIN_SCRAP_PER_LEVEL = 15;
export const RUIN_VARIANTS = ["A", "B", "C", "D", "E"] as const;

export function ruin(b: Base & { height: number; variant: string; orientation: Orientation }): EntitySpec {
  return {
    ...pos(b),
    orientation: b.orientation,
    template: `RuinColumnH${b.height}`,
    components: {
      "Yielder:Ruin": yieldOf("ScrapMetal", RUIN_SCRAP_PER_LEVEL * b.height),
      RuinModels: { VariantId: b.variant },
    },
  };
}

export function timeActivated(): JsonObject {
  return { IsEnabled: false, CyclesUntilCountdownActivation: 5, DaysUntilActivation: F(10), DaysPassed: F(0) };
}

/** WaterSource (1×1) or BadwaterSource (3×3). The WaterSource component precedes BlockObject,
 *  as in official maps. */
export function waterSource(b: Base & { strength: number; bad?: boolean }): EntitySpec {
  return {
    ...pos(b),
    template: b.bad ? "BadwaterSource" : "WaterSource",
    before: { WaterSource: { SpecifiedStrength: F(b.strength), CurrentStrength: F(b.strength) } },
    components: { TimeActivatedComponent: timeActivated() },
  };
}

export function slope(b: Base & { orientation: Orientation }): EntitySpec {
  return { ...pos(b), orientation: b.orientation, template: "Slope", components: {} };
}

export function startingLocation(b: Base & { orientation: Orientation; player?: number }): EntitySpec {
  // player is reserved for Timber Together maps (PLAN §20, D5); vanilla maps never write it
  return { ...pos(b), orientation: b.orientation, template: "StartingLocation", components: {} };
}

function pos(b: Base): Omit<EntitySpec, "template" | "components"> {
  return { id: b.id, owner: b.owner, x: b.x, y: b.y, z: b.z, orientation: "Cw0", flipped: false };
}
