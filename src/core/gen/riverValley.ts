// River Valley (PLAN §8): one river crosses the map along the valley floor, terraces rise to the
// highlands on both sides, the bed steps down over falls, and a basin opens behind a rock ridge
// the river cuts through. Planned by the valley planner it shares with Canyon (valley.ts).

import type { SettleCache } from "../features/build";
import type { Feature } from "../features/schema";
import type { MapSpec } from "../spec/mapspec";
import { planValley, type PlanContext } from "./valley";

export { MAX_LAYOUT_TRIES, PlanConflict, riverWidth, type PlanContext } from "./valley";

export function planRiverValley(spec: MapSpec, attempt: number, candidate = 0, settleCache?: SettleCache, context?: PlanContext): Feature[] {
  return planValley("riverValley", spec, attempt, candidate, settleCache, context);
}
