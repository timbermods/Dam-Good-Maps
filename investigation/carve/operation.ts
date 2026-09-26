import type { CarveMap, Settings } from './engine';
import type { EntitySpec } from '../../src/core/format/entities';
import type { CanonicalWater } from '../../src/core/sim/prefill';

/** JSON-safe exact values. Replay never calls erosion or water simulation. */
export interface CarveOperation {
  op: 'carveResult'; version: 1;
  params: { W: number; H: number; settings: Settings; steps: number; reason: string;
    terrain: [tile: number, before: number, after: number][];
    entitiesBefore: EntitySpec[]; entitiesAfter: EntitySpec[];
    waterBefore: { depth: number[]; contamination: number[] };
    waterAfter: { depth: number[]; contamination: number[] };
    settled: boolean; settleTicks: number;
  };
}
export function operation(before: CarveMap, after: CarveMap, settings: Settings, steps: number, reason: string, water: CanonicalWater): CarveOperation {
  const terrain: [number, number, number][] = [];
  for (let i = 0; i < before.heights.length; i++) if (before.heights[i] !== after.heights[i]) terrain.push([i, before.heights[i], after.heights[i]]);
  return { op: 'carveResult', version: 1, params: { W: before.W, H: before.H, settings: { ...settings }, steps, reason, terrain,
    entitiesBefore: structuredClone(before.entities), entitiesAfter: structuredClone(after.entities),
    waterBefore: { depth: Array.from(before.water.depth), contamination: Array.from(before.water.contamination) },
    waterAfter: { depth: Array.from(water.depth), contamination: Array.from(water.contamination) },
    settled: water.settled, settleTicks: water.ticks } };
}
export function applyOperation(map: CarveMap, op: CarveOperation, undo = false): CarveMap {
  const p = op.params;
  if (op.op !== 'carveResult' || op.version !== 1 || p.W !== map.W || p.H !== map.H) throw new Error('Operation does not fit this map');
  const h = map.heights.slice(), expected = undo ? 2 : 1, desired = undo ? 1 : 2;
  for (const row of p.terrain) {
    const i = row[0];
    if (!Number.isInteger(i) || i < 0 || i >= h.length || h[i] !== row[expected] || !Number.isInteger(row[desired]) || row[desired] < 0 || row[desired] > map.maxHeight) throw new Error('Stale or invalid terrain operation');
    h[i] = row[desired];
  }
  const w = undo ? p.waterBefore : p.waterAfter;
  if (w.depth.length !== h.length || w.contamination.length !== h.length) throw new Error('Invalid water snapshot');
  return { ...map, heights: h, entities: structuredClone(undo ? p.entitiesBefore : p.entitiesAfter),
    water: { depth: Float64Array.from(w.depth), contamination: Float64Array.from(w.contamination) } };
}
