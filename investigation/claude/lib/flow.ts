// River courses read from the actual flow (M9 flow-relative place words, reused by M12).
//
// Every river feature is a course: its path put in flow order (source first), with its length,
// the arc position of every tile, the bank each tile lies on (left or right of the flow), where it
// starts and where its water goes. The flow order is read from the map, never from an axis:
// 1. the settled water surface along the channel (water runs from the higher surface to the lower);
// 2. where the water is too flat to tell, the bed profile (the bed never rises downstream);
// 3. only then the feature's own entry and exit.
// Every theme's river flows west to east today (PLAN §20, D67), so nothing here may assume it:
// "upstream" is always "toward the source of this course".
//
// Courses form a network: a river that ends in another river joins it at an arc position; a river
// that ends in a lake feeds the lake's outlet river. Upstream of a point is its own course above
// it plus every course that drains into that stretch; downstream is its course below it plus every
// course its water reaches.

import { pathField, type PathField } from "../../../src/core/features/geometry";
import type { LandformFeature, LakeFeature, Point, RiverFeature } from "../../../src/core/features/schema";
import { round1, type MapView } from "./view";

export type Evidence = "water" | "bed" | "feature";

export interface Course {
  id: string;
  role?: string;
  /** A plain name: "the main river", "the north tributary", "the river from the south edge". */
  name: string;
  /** The path in flow order, source first. */
  path: Point[];
  /** True when flow order is the reverse of the feature's own path order. */
  reversed: boolean;
  evidence: Evidence;
  /** Water surface near the source and near the outlet (NaN where the channel is dry). */
  surfaceTop: number;
  surfaceBottom: number;
  length: number;
  width: number;
  flow: number;
  badwater: boolean;
  /** Distance, flow-order arc position and bank (+1 left of the flow, −1 right) of every tile. */
  field: PathField;
  source: { at: Point; kind: "edge" | "spring" | "lake"; edge?: string; lake?: string };
  outlet: { at: Point; kind: "edge" | "river" | "lake"; edge?: string; river?: string; lake?: string; joinsAt?: number };
  /** The overall direction of the flow in compass words ("west to east", "north to south"). */
  heading: string;
  main: boolean;
  /** Half-width of the land that belongs to its valley. */
  valleyHalf: number;
}

export interface Network {
  courses: Course[];
  main: Course | null;
  /** For every tile, the index of the course whose valley it lies in (−1: none). */
  owner: Int16Array;
  byId: Map<string, Course>;
}

const cache = new Map<string, Network>();

/** The courses of the map, cached per built map. */
export function network(v: MapView): Network {
  const hit = cache.get(v.key);
  if (hit) return hit;
  const net = buildNetwork(v);
  if (cache.size > 16) cache.clear();
  cache.set(v.key, net);
  return net;
}

function arcLength(p: readonly Point[]): number {
  let l = 0;
  for (let i = 0; i + 1 < p.length; i++) l += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
  return l;
}

/** Mean water surface on the channel tiles near arc position s (feature path order). */
function surfaceNear(v: MapView, f: PathField, half: number, s: number, reach: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < v.W * v.H; i++) {
    if (f.d[i] >= Math.max(1, half) || Math.abs(f.s[i] - s) > reach) continue;
    if (!(v.water[i] > 0.05)) continue;
    sum += v.heights[i] + v.water[i];
    n++;
  }
  return n ? sum / n : NaN;
}

/** Compass words for a direction vector (x east, y north). */
export function headingOf(dx: number, dy: number): string {
  const ang = Math.atan2(dy, dx); // 0 = east, π/2 = north
  const names = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];
  const k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const to = names[k];
  const from = names[(k + 4) % 8];
  return `${from} to ${to}`;
}

function edgeOf(p: Point, W: number, H: number): string {
  const c: [string, number][] = [["west", p[0]], ["east", W - 1 - p[0]], ["south", p[1]], ["north", H - 1 - p[1]]];
  c.sort((a, b) => a[1] - b[1]);
  return c[0][0];
}

function buildNetwork(v: MapView): Network {
  const { W, H } = v;
  const rivers = v.features.filter((f): f is RiverFeature => f.kind === "river");
  const courses: Course[] = [];
  for (const r of rivers) {
    const p = r.params;
    const fwd = pathField(p.path, W, H);
    const L = fwd.length;
    const half = p.width / 2;
    const reach = Math.max(3, 0.06 * L);
    const top = surfaceNear(v, fwd, half, Math.min(L, Math.max(0, 0.1 * L)), reach);
    const bottom = surfaceNear(v, fwd, half, Math.min(L, 0.9 * L), reach);
    let reversed = false;
    let evidence: Evidence = "feature";
    if (Number.isFinite(top) && Number.isFinite(bottom) && Math.abs(top - bottom) >= 0.25) {
      reversed = bottom > top;
      evidence = "water";
    } else {
      const drop = p.bedProfile.steps.reduce((a, s) => a + s.drop, 0);
      if (drop > 0) evidence = "bed"; // steps are listed from the path's start and only go down
      reversed = false;
    }
    const path = reversed ? [...p.path].reverse() : p.path.slice();
    const field = reversed ? pathField(path, W, H) : fwd;
    const first = path[0];
    const last = path[path.length - 1];
    const entry = reversed ? p.exit : p.entry;
    const exit = reversed ? p.entry : p.exit;
    const source: Course["source"] =
      "edge" in entry ? { at: first, kind: "edge", edge: entry.edge } : "lake" in entry ? { at: first, kind: "lake", lake: (entry as { lake: string }).lake } : { at: first, kind: "spring" };
    const outlet: Course["outlet"] =
      "edge" in exit ? { at: last, kind: "edge", edge: exit.edge } : "river" in exit ? { at: last, kind: "river", river: (exit as { river: string }).river } : { at: last, kind: "lake", lake: (exit as { lake: string }).lake };
    const valley = v.features.find((f): f is LandformFeature => f.kind === "landform" && f.params.kind === "valley" && f.params.along?.river === r.id);
    const valleyHalf = valley?.params.along ? valley.params.along.halfWidth + 10 : Math.max(12, 2 * p.width + 8);
    courses.push({
      id: r.id,
      role: r.role,
      name: "",
      path,
      reversed,
      evidence,
      surfaceTop: reversed ? bottom : top,
      surfaceBottom: reversed ? top : bottom,
      length: L,
      width: p.width,
      flow: p.flow,
      badwater: p.badwater,
      field,
      source,
      outlet,
      heading: headingOf(last[0] - first[0], last[1] - first[1]),
      main: false,
      valleyHalf,
    });
  }
  // the main river: the generator's main (or outlet) river, else the strongest, then the longest
  const byRole = courses.find((c) => c.role === "river/main") ?? courses.find((c) => c.role === "river/outlet");
  const main = byRole ?? [...courses].sort((a, b) => b.flow - a.flow || b.length - a.length)[0] ?? null;
  if (main) {
    main.main = true;
    main.valleyHalf = Infinity;
  }
  const byId = new Map(courses.map((c) => [c.id, c]));
  // where tributaries join
  for (const c of courses) {
    if (c.outlet.kind === "river" && c.outlet.river) {
      const t = byId.get(c.outlet.river);
      if (t) {
        const [x, y] = c.outlet.at;
        const i = Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)));
        c.outlet.joinsAt = t.field.s[i];
      }
    }
  }
  // plain names
  for (const c of courses) {
    if (c.main) c.name = "the main river";
    else if (c.source.kind === "edge") c.name = `the river from the ${c.source.edge} edge`;
    else if (c.source.kind === "lake") c.name = `the river out of the lake`;
    else c.name = `the river from the spring at (${Math.round(c.source.at[0])}, ${Math.round(c.source.at[1])})`;
    if (c.role?.startsWith("river/tributary") && c.source.edge) c.name = `the ${c.source.edge} tributary`;
    else if (c.role?.startsWith("river/inflow") && c.source.edge) c.name = `the inflow from the ${c.source.edge} edge`;
    else if (c.role === "river/outlet") c.name = "the outlet river";
  }
  const seen = new Map<string, number>();
  for (const c of courses) seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
  for (const c of courses) if ((seen.get(c.name) ?? 0) > 1) c.name = `${c.name} (${c.id})`;
  // every tile belongs to the valley of the nearest course that claims it; the main river claims
  // whatever no other valley does
  const owner = new Int16Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    let best = -1;
    let bd = Infinity;
    courses.forEach((c, k) => {
      if (c.main) return;
      const d = c.field.d[i];
      if (d <= c.valleyHalf && d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best < 0 && main) best = courses.indexOf(main);
    else if (main && best >= 0 && main.field.d[i] < bd) best = courses.indexOf(main);
    owner[i] = best;
  }
  return { courses, main, owner, byId };
}

// ------------------------------------------------------------------------------ relations

/** Courses whose water reaches `c` at or above arc position `s` (recursively), with the stretch
 *  of each that counts: [course, from, to]. */
export function upstreamStretches(net: Network, c: Course, s: number): [Course, number, number][] {
  const out: [Course, number, number][] = [[c, 0, s]];
  const lakesFeeding = (id: string) => net.courses.filter((k) => k.outlet.kind === "lake" && k.outlet.lake === id);
  for (const k of net.courses) {
    if (k === c) continue;
    if (k.outlet.kind === "river" && k.outlet.river === c.id && (k.outlet.joinsAt ?? Infinity) <= s) out.push(...upstreamStretches(net, k, k.length));
  }
  if (c.source.kind === "lake" && c.source.lake) for (const k of lakesFeeding(c.source.lake)) out.push(...upstreamStretches(net, k, k.length));
  return out;
}

/** Where the water at arc position `s` of `c` goes next: the rest of `c`, then what it drains
 *  into (another river below the junction, or a lake's outlet river). */
export function downstreamStretches(net: Network, c: Course, s: number, depth = 0): [Course, number, number][] {
  const out: [Course, number, number][] = [[c, s, c.length]];
  if (depth > 8) return out;
  if (c.outlet.kind === "river" && c.outlet.river) {
    const t = net.byId.get(c.outlet.river);
    if (t) out.push(...downstreamStretches(net, t, c.outlet.joinsAt ?? 0, depth + 1));
  } else if (c.outlet.kind === "lake" && c.outlet.lake) {
    for (const k of net.courses) if (k.source.kind === "lake" && k.source.lake === c.outlet.lake) out.push(...downstreamStretches(net, k, 0, depth + 1));
  }
  return out;
}

/** The course a point belongs to (its valley), and its arc position and bank on it. */
export function locate(net: Network, W: number, x: number, y: number, course?: Course | null): { course: Course; s: number; frac: number; side: number; d: number } | null {
  const i = Math.round(y) * W + Math.round(x);
  const c = course ?? (net.owner[i] >= 0 ? net.courses[net.owner[i]] : net.main);
  if (!c) return null;
  const s = c.field.s[i];
  return { course: c, s, frac: c.length ? s / c.length : 0, side: c.field.side[i], d: c.field.d[i] };
}

/** A short description of a course, for summaries. */
export function describeCourse(c: Course, W: number, H: number): Record<string, unknown> {
  const src = c.source.kind === "edge" ? `${c.source.edge} edge` : c.source.kind === "lake" ? "a lake" : "a spring";
  const out =
    c.outlet.kind === "edge" ? `${c.outlet.edge} edge` : c.outlet.kind === "river" ? `joins ${c.outlet.river} at ${round1(c.outlet.joinsAt ?? 0)} tiles along it` : `a lake (${c.outlet.lake})`;
  return {
    id: c.id,
    name: c.name,
    flows: c.heading,
    from: src,
    to: out,
    source: c.path[0].map((n) => Math.round(n)),
    mouth: c.path[c.path.length - 1].map((n) => Math.round(n)),
    length: Math.round(c.length),
    width: c.width,
    flow: c.flow,
    ...(c.badwater ? { badwater: true } : {}),
    flowReadFrom: c.evidence,
    ...(c.main ? { main: true } : {}),
    sourceSide: edgeOf(c.path[0], W, H),
  };
}

/** Lakes that are water bodies of their own (not planned reservoir sites). */
export function openLakes(v: MapView): LakeFeature[] {
  return v.features.filter((f): f is LakeFeature => f.kind === "lake" && !f.params.planned);
}
