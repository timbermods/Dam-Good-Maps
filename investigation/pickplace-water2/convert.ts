// Adapted from investigation/landscapes/lib/convert.ts; see adapt.mjs and METHODS.md.
import { naturalSlopes, pumpShore, currentRules, stableId } from "./rules";
import { canonicalSettle } from "../../src/core/sim/prefill";
import { waterModel, mapObjects } from "../../src/core/sim/model";
import { moisture } from "../../src/core/sim/moisture";
import {
  walkDistance,
  reachAt,
  shoreDistance,
} from "../../src/core/analysis/walk";
import { density } from "../../src/core/gen/calibrated";
import {
  tree,
  bush,
  ruin,
  startingLocation,
  waterSource,
  entityJson,
  slope,
} from "../../src/core/format/entities";
import {
  GAME_VERSION,
  voxelsFromHeights,
  settledSimulationSingletons,
} from "../../src/core/format/world";
import { mapMetadata } from "../../src/core/format/timber";
import { thumbnailJpeg } from "../../src/core/render/shade";
import { validateMap } from "../../src/core/validate/checks";
import { neighbours } from "../landscapes/lib/terrain";
let thumb: Uint8Array;
export function makeFile(
  h: Uint8Array,
  W: number,
  H: number,
  entities: any[],
  water: any,
  M: Float64Array,
  actualThumbnail = false,
) {
  // A common valid JPEG keeps the batch about geometry and simulation. Curated files redraw it.
  thumb ??= thumbnailJpeg(new Uint8Array(16).fill(4), 4, 4);
  return {
    metadata: mapMetadata(
      W,
      H,
      "Real landscape survey; modified Terrain Tiles. See investigation/landscapes/ATTRIBUTION.md.",
    ),
    versionTxt: GAME_VERSION + "\r\n",
    thumbnail: actualThumbnail ? thumbnailJpeg(h, W, H, water.depth) : thumb,
    extraFiles: [],
    world: {
      gameVersion: GAME_VERSION,
      timestamp: "2026-01-01 00:00:00",
      sizeX: W,
      sizeY: H,
      layers: 23,
      voxels: voxelsFromHeights(h, W, H),
      singletons: settledSimulationSingletons(W, H, {
        floor: h,
        depth: water.depth,
        contamination: water.contamination,
        moisture: M,
        soilContamination: new Float64Array(W * H),
        sat: water.sat,
      }),
      entities,
    },
  };
}
function bestStart(
  h: Uint8Array,
  D: Float64Array,
  M: Float64Array,
  W: number,
  occupied: Set<number>,
  links: [number, number][],
  signature?:Uint8Array,
) {
  const N = W * W,
    integral = new Int32Array((W + 1) * (W + 1));
  // Candidate screening also starts at the signature shore. Otherwise the old
  // moist-land shortlist can discard every lake-side pad in favour of a small pond.
  const shoreWalk=new Int32Array(N).fill(-1),queue:number[]=[],adj=new Map<number,number[]>();
  for(const [a,b] of links){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a)!.push(b);adj.get(b)!.push(a);}
  if(signature)for(let i=0;i<N;i++)if(signature[i]&&D[i]>=.3)for(const j of neighbours(i,W,W,false))if(D[j]<.05&&h[j]>=h[i]+D[i]-.01&&h[j]-h[i]-D[i]<=2&&shoreWalk[j]<0){shoreWalk[j]=0;queue.push(j);}
  for(let k=0;k<queue.length;k++){const i=queue[k];if(shoreWalk[i]>=24)continue;for(const j of [...neighbours(i,W,W,false).filter(j=>h[j]===h[i]),...(adj.get(i)??[])])if(D[j]<=.05&&shoreWalk[j]<0){shoreWalk[j]=shoreWalk[i]+1;queue.push(j);}}
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        k = (y + 1) * (W + 1) + x + 1;
      integral[k] =
        integral[k - 1] +
        integral[k - W - 1] -
        integral[k - W - 2] +
        (M[i] > 0 && D[i] === 0 ? 1 : 0);
    }
  const count = (x: number, y: number, r: number) => {
    const l = Math.max(0, x - r),
      b = Math.max(0, y - r),
      rr = Math.min(W, x + r + 1),
      t = Math.min(W, y + r + 1);
    return (
      integral[t * (W + 1) + rr] -
      integral[t * (W + 1) + l] -
      integral[b * (W + 1) + rr] +
      integral[b * (W + 1) + l]
    );
  };
  const blocks = new Map<number, any>();
  let total = 0;
  for (let y = 3; y < W - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x,
        z = h[i];
      if (!z || D[i] > 0) continue;
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = (y + dy) * W + x + dx;
          if (
            D[j] > 0.05 ||
            (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && h[j] !== z) ||
            occupied.has(j)
          ) {
            ok = false;
            break;
          }
        }
      if (!ok || h[(y - 2) * W + x] !== z) continue;
      total++;
      const score = count(x, y, 16)+(signature&&shoreWalk[i]>=0&&shoreWalk[i]<=22?100000:0),
        key = Math.floor(y / 8) * 100 + Math.floor(x / 8),
        old = blocks.get(key);
      if (!old || score > old.score) blocks.set(key, { x, y, z, score });
    }
  const candidates = [...blocks.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 48);
  let best: any = null;
  for (const c of candidates) {
    const blocked = Uint8Array.from(D, d => d > .05 ? 1 : 0);
    const dist = walkDistance(h, W, W, blocked, links, c, 24),
      mask = new Uint8Array(N);
    let moist = 0,
      reach = 0;
    for (let i = 0; i < N; i++) {
      const surface = h[i] + D[i];
      if (D[i] >= 0.3 && surface >= c.z - 2 && surface <= c.z + 0.01)
        mask[i] = 1;
      if (dist[i] <= 20) reach++;
      if (
        reachAt(dist, W, W, i) <= 20 &&
        M[i] > 0 &&
        D[i] === 0 &&
        !occupied.has(i) &&
        Math.max(Math.abs((i % W) - c.x), Math.abs(Math.floor(i / W) - c.y)) > 3
      )
        moist++;
    }
    const shore = pumpShore(dist, h, signature?Float64Array.from(D,(d,i)=>signature[i]?d:0):D, new Float64Array(N), W),
      score =
        (shore.distance <= 20 ? 1e6 : 0) +
        Math.min(moist, 100) * 1000 +
        Math.min(reach, 1000) -
        Math.min(shore.distance, 999);
    if (!best || score > best.score)
      best = { ...c, score, dist, waterDistance: shore.distance, moist, reach };
  }
  return { best, candidateCount: total, evaluated: candidates.length };
}
export function convert(
  original: Uint8Array,
  size: number,
  cap: number,
  hydro: any,
  key: string,
) {
  const W = size,
    N = W * W,
    h = original.slice();
  const edgeChanges = 0; // D151/D152: every terrain cell is preserved.
  const entities: any[] = [],
    occupied = new Set<number>();
  let serial = 0;
  const base = (i: number) => {
    const hex = stableId(`${key}:${serial++}`);
    return {
      id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
      owner: "survey",
      x: i % W,
      y: Math.floor(i / W),
      z: h[i],
    };
  };
  const add = (e: any) => {
    entities.push(entityJson(e));
    occupied.add(e.y * W + e.x);
  };
  const sum = hydro.sources.reduce(
      (s: number, v: any) => s + Math.sqrt(v.area),
      0,
    ),
    flow = (2 * density("water_strength_per_10k", N) * N) / 1e4;
  const sources: any[] = [];
  for (const s of hydro.sources) {
    if (occupied.has(s.i)) continue;
    const strength = s.strength ?? Math.min(8, (flow * Math.sqrt(s.area)) / (sum || 1));
    add(waterSource({ ...base(s.i), strength }));
    sources.push({ ...s, x: s.i % W, y: Math.floor(s.i / W), strength });
  }
  const temporary = { entities };
  const model = waterModel(W, W, h, mapObjects(temporary as any)),
    water = canonicalSettle(model),
    M = moisture(h, water.depth, water.contamination, W, W);
  const ramps = naturalSlopes(h, water.depth, W, occupied);
  for (const r of ramps.slopes) add(slope({ ...base(r.i), orientation: r.orientation }));
  // Use the actual connected lake/river, including its simulated shoreline, not
  // only the reference pixels: shore movement must not sever feature identity.
  let signatureWet:Uint8Array|undefined;
  if(hydro.target){signatureWet=new Uint8Array(N);const q:number[]=[];for(let i=0;i<N;i++)if(hydro.target[i]&&water.depth[i]>.05){signatureWet[i]=1;q.push(i);}for(let k=0;k<q.length;k++)for(const j of neighbours(q[k],W,W,false))if(water.depth[j]>.05&&!signatureWet[j]){signatureWet[j]=1;q.push(j);}}
  const selection = bestStart(h, water.depth, M, W, occupied, ramps.links,signatureWet),
    start = selection.best;
  if (start) {
    add(
      startingLocation({
        ...base((start.y - 1) * W + start.x - 1),
        orientation: "Cw0",
      }),
    );
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++)
        occupied.add((start.y + dy) * W + start.x + dx);
  }
  const moist: number[] = [],
    dry: number[] = [];
  for (let i = 0; i < N; i++)
    if (h[i] > 0 && !occupied.has(i) && water.depth[i] === 0) {
      if (M[i] > 0) moist.push(i);
      else dry.push(i);
    }
  const order = (i: number) =>
    (Math.imul(i + 12345, 1103515245) >>> 0) % 1000003;
  moist.sort((a, b) => order(a) - order(b));
  dry.sort((a, b) => order(a) - order(b));
  const near = start
    ? moist.filter((i) => reachAt(start.dist, W, W, i) <= 20)
    : [];
  let trees = 0,
    bushes = 0;
  for (const i of near.slice(0, 48)) {
    add(bush({ ...base(i), ripe: true }));
    bushes++;
  }
  for (const i of near.slice(48, 108)) {
    add(tree({ ...base(i), species: "Pine" }));
    trees++;
  }
  const treeGoal = Math.ceil((density("trees_per_10k", N) * N) / 1e4),
    bushGoal = Math.max(
      48,
      Math.ceil((density("bushes_per_10k", N) * N) / 1e4),
    );
  for (const i of moist)
    if (!occupied.has(i)) {
      if (bushes < bushGoal) {
        add(bush({ ...base(i), ripe: true }));
        bushes++;
      } else if (trees < treeGoal * 0.4) {
        add(
          tree({
            ...base(i),
            species:
              trees % 3 === 0 ? "Oak" : trees % 3 === 1 ? "Birch" : "Pine",
          }),
        );
        trees++;
      }
    }
  // Find clumped ruins on existing dry, level ground. No pads are cut.
  const scrapGoal = (density("scrap_per_1k_tiles", N) * N) / 1e3;
  let scrap = 0;
  for (const i of dry) {
    if (scrap >= scrapGoal) break;
    const x = i % W,
      y = Math.floor(i / W);
    if (
      x < 3 ||
      y < 3 ||
      x > W - 4 ||
      y > W - 4 ||
      (start && Math.hypot(x - start.x, y - start.y) < 23)
    )
      continue;
    const cells: number[] = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const j = (y + dy) * W + x + dx;
        if (
          !occupied.has(j) &&
          h[j] === h[i] &&
          water.depth[j] === 0 &&
          M[j] === 0
        )
          cells.push(j);
      }
    if (cells.length < 20) continue;
    for (const j of cells) {
      add(ruin({ ...base(j), height: 2, variant: "A", orientation: "Cw0" }));
      scrap += 30;
    }
  }
  for (const i of dry)
    if (!occupied.has(i) && trees < treeGoal) {
      add(tree({ ...base(i), species: "Pine", dead: true }));
      trees++;
    }
  const file = makeFile(h, W, W, entities, water, M),
    v = validateMap(file, {
      profile: "generate",
      designedFor: "normal",
      features: [],
      water: { model, settled: water },
    });
  const current = currentRules(file, v, h, water, ramps.links, start, sources);
  if(hydro.target&&(!start||start.waterDistance>20)){current.passed=false;current.failures.push({id:'start.signature',message:'No walking path from the start to the signature water within 20 tiles.'});}
  const fixture = {
    schema: 1,
    W,
    H: W,
    heights: Array.from(h),
    waterSources: sources.map((s) => ({
      x: s.x,
      y: s.y,
      strength: s.strength,
    })),
    start: start
      ? { x: start.x - 1, y: start.y - 1, z: start.z, orientation: "Cw0" }
      : null,
    entities,
    attribution: "../ATTRIBUTION.md",
    modifications: {
      edgeCellsRaised: edgeChanges,
      noInteriorTerrainEdits: true,
    },
  };
  return {
    file,
    start,
    v,
    water,
    heights: h,
    fixture,
    current,
    selection: {
      candidateCount: selection.candidateCount,
      evaluated: selection.evaluated,
      moistWithin20: start?.moist ?? 0,
    },
    sources,
    edgeChanges,
  };
}
