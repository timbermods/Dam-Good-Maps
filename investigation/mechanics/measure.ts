import { measure } from '../../src/core/analysis/metrics';
import { walkDistance } from '../../src/core/analysis/walk';
import { walkRegions } from '../../src/core/analysis/regions';
import { footprintTiles, slopeHighSide } from '../../src/core/format/footprints';
import { num } from '../../src/core/format/json';
import { droughtStorage } from '../../src/core/sim/drought';
import { moisture } from '../../src/core/sim/moisture';
import { moistureBarrier } from '../../src/core/sim/model';
import { WALK_BLOCKERS, rulesFor } from '../../src/core/validate/playability';
import type { GenerateResult } from '../../src/core/gen/generate';

export function measureOpening(r: GenerateResult) {
  const b = r.built;
  const { W, H, heights: h, water: D, contamination: C, start } = b;
  if (!start || !r.analysis) throw new Error('Cannot measure a missing start');
  const N = W * H;
  const blocked = new Uint8Array(N);
  const occupied = new Uint8Array(N);
  const links: [number, number][] = [];
  const inside = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  const n4 = (i: number) => [i % W > 0 ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1].filter(x => x >= 0);
  for (const e of b.entities) {
    for (const [x, y] of footprintTiles(e.template, e)) {
      if (!inside(x, y)) continue;
      occupied[y * W + x] = 1;
      if (WALK_BLOCKERS.has(e.template)) blocked[y * W + x] = 1;
    }
    if (e.template === 'Slope') {
      const [dx, dy] = slopeHighSide(e.orientation);
      if (inside(e.x + dx, e.y + dy)) links.push([e.y * W + e.x, (e.y + dy) * W + e.x + dx]);
    }
  }
  const walk = walkDistance(h, W, H, blocked, links, start, 128);
  const flat = walkDistance(h, W, H, blocked, [], start, 128);
  const safeBlocked = blocked.slice();
  for (let i = 0; i < N; i++) if (D[i] > 0.05 && C[i] >= 0.05) safeBlocked[i] = 1;
  const safe = walkDistance(h, W, H, safeBlocked, links, start, 128);
  const kept = droughtStorage(b.waterModel, D, 9);
  const afterMoisture = moisture(h, kept, C, W, H, moistureBarrier(W, H, b.entities));
  const dryClean = (i: number) => D[i] <= 0.05 && b.soilContamination[i] === 0 && !blocked[i];
  let cleanRetained40 = 0, flatDry40 = 0, linkedDry40 = 0, fertile20 = 0, fertileEmpty20 = 0, fertileKept20 = 0;
  let pumpShore2 = 0, pumpShore6 = 0, peakCleanFlux64 = 0, safeLost40 = 0;
  const frontierBlocked = new Uint8Array(N).fill(1);
  const directions = Array.from({ length: 8 }, () => ({ land: 0, fertile: 0, scrap: 0, science: 0, geothermal: 0, mines: 0 }));
  const sector = (x: number, y: number) => (Math.round(Math.atan2(y - start.y, x - start.x) / (Math.PI / 4)) + 8) % 8;
  for (let i = 0; i < N; i++) {
    if (r.analysis.startDistance![i] <= 40 && C[i] < 0.05) cleanRetained40 += kept[i];
    if (dryClean(i) && walk[i] <= 40) {
      linkedDry40++;
      if (safe[i] > 40) safeLost40++;
      if (flat[i] <= 40) flatDry40++;
    }
    if (dryClean(i) && safe[i] <= 20 && b.moisture[i] > 0) {
      fertile20++;
      if (!occupied[i]) fertileEmpty20++;
      if (afterMoisture[i] > 0) fertileKept20++;
    }
    if (dryClean(i) && safe[i] > 20 && safe[i] <= 64) {
      frontierBlocked[i] = 0;
      const s = directions[sector(i % W, Math.floor(i / W))];
      s.land++;
      if (b.moisture[i] > 0) s.fertile++;
    }
    if (dryClean(i) && safe[i] <= 40) {
      const drops = n4(i).filter(n => D[n] >= 0.3 && C[n] < 0.05)
        .map(n => h[i] - (h[n] + D[n])).filter(drop => drop >= -0.01);
      if (drops.some(drop => drop <= 2)) pumpShore2++;
      if (drops.some(drop => drop <= 6)) pumpShore6++;
    }
    if (D[i] >= 0.1 && C[i] < 0.05 && b.settle.out && n4(i).some(n => dryClean(n) && safe[n] <= 64)) {
      let flux = 0;
      for (let k = 0; k < 4; k++) flux += b.settle.out[4 * i + k];
      peakCleanFlux64 = Math.max(peakCleanFlux64, flux);
    }
  }
  // Remove the opening's inner 20-walk area; count remaining connected dry regions >=64 tiles.
  const frontierLabels = walkRegions(h, W, H, frontierBlocked, links);
  const frontierSizes = new Map<number, number>();
  for (const label of frontierLabels) if (label >= 0) frontierSizes.set(label, (frontierSizes.get(label) ?? 0) + 1);
  const access = (e: typeof b.entities[number]) => {
    let best = Infinity;
    for (const [x, y] of footprintTiles(e.template, e)) {
      if (!inside(x, y)) continue;
      for (const n of n4(y * W + x)) if (h[n] === e.z) best = Math.min(best, safe[n] + 1);
    }
    return best;
  };
  let logs20 = 0, deadLogs20 = 0, readyBerries20 = 0, scrap40 = 0, science64 = 0, geothermal64 = 0, mines64 = 0;
  let nearestRelic = Infinity, nearestGeothermal = Infinity, nearestMine = Infinity;
  const counts: Record<string, number> = {};
  for (const e of b.entities) {
    counts[e.template] = (counts[e.template] ?? 0) + 1;
    const i = e.y * W + e.x;
    const alive = !(e.components.LivingNaturalResource as any)?.IsDead;
    const grown = num((e.components.Growable as any)?.GrowthProgress ?? 1) >= 1;
    if (['Pine', 'Birch', 'Oak'].includes(e.template) && grown && safe[i] <= 20) {
      const logs = (e.components['Yielder:Cuttable'] as any)?.Yield?.Amount ?? ({ Pine: 2, Birch: 1, Oak: 8 } as any)[e.template];
      logs20 += logs;
      if (!alive) deadLogs20 += logs;
    }
    if (e.template === 'BlueberryBush' && alive && grown && safe[i] <= 20 && num((e.components.GatherableYieldGrower as any)?.GrowthProgress ?? 0) >= 1) {
      readyBerries20 += (e.components['Yielder:Gatherable'] as any)?.Yield?.Amount ?? 3;
    }
    const d = access(e);
    const s = directions[sector(e.x, e.y)];
    if (e.template.startsWith('RuinColumnH')) {
      const scrap = (e.components['Yielder:Ruin'] as any)?.Yield?.Amount ?? 15 * Number(e.template.slice(11));
      if (d <= 40) scrap40 += scrap;
      if (d > 20 && d <= 64) s.scrap += scrap;
    }
    const reward = ({ SmallRelic: 200, MediumRelic: 800, LargeRelic: 3000 } as any)[e.template];
    if (reward) {
      nearestRelic = Math.min(nearestRelic, d);
      if (d <= 64) science64 += reward;
      if (d > 20 && d <= 64) s.science += reward;
    }
    if (e.template === 'GeothermalField') {
      nearestGeothermal = Math.min(nearestGeothermal, d);
      if (d <= 64) geothermal64++;
      if (d > 20 && d <= 64) s.geothermal++;
    }
    if (e.template === 'UndergroundRuins') {
      nearestMine = Math.min(nearestMine, d);
      if (d <= 64) mines64++;
      if (d > 20 && d <= 64) s.mines++;
    }
  }
  const eligibleDams = r.analysis.damSites.filter(s => r.analysis!.startDistance![s.y * W + s.x] <= 40 && s.volume >= rulesFor(r.spec).reservoirNeed);
  const m = measure(r);
  return {
    measurementVersion: 2,
    ...m,
    cleanRetained40, storageRatio: cleanRetained40 / (50 * 0.424 * 9.5),
    shortestAdequateDam: eligibleDams.length ? Math.min(...eligibleDams.map(s => s.length)) : null,
    peakCleanFlux64, flatDry40, linkedDry40,
    flatAccessShare: linkedDry40 ? flatDry40 / linkedDry40 : null,
    fertile20, fertileEmpty20, fertileKept20,
    fertilityPersistence: fertile20 ? fertileKept20 / fertile20 : null,
    safeLost40, logs20, deadLogs20, readyBerries20, scrap40,
    frontierComponents: [...frontierSizes.values()].filter(s => s >= 64).length,
    frontierSectors: directions.filter(s => s.land >= 64 || s.science > 0 || s.geothermal > 0 || s.mines > 0 || s.scrap >= 300).length,
    science64, geothermal64, mines64, nearestRelic, nearestGeothermal, nearestMine,
    pumpShore2, pumpShore6, deepPumpExtraShore: pumpShore6 - pumpShore2,
    directions, counts
  };
}
