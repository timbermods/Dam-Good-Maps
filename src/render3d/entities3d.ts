// Map objects as instanced meshes (EDITOR_PLAN §8), with our own low-poly models (Map look, PLAN
// §20 D86, D110 and D114, shaped after Kyler's in-game reference screenshots; the game's assets are
// not ours to include, EDITOR_PLAN §2). One draw call per model, so tens of thousands of trees cost
// a few draw calls. Every model carries its own colours per vertex; the instance adds a slight tint
// so a grove is not one flat colour.
//
// - Trees by species: pine (tiers of dark cones), birch (a white trunk with dark marks and a light
//   crown), oak (a thick trunk and a broad crown), succulent (a rosette of fleshy leaves). Dead
//   trees are bare: a pale grey-brown trunk and bare branches at the tree's true size, far lighter
//   than the dark living crowns.
// - Berry bushes: dark green, dotted with blue flowers.
// - Ruins: rusty scaffold towers, one storey per level of the ruin's height: rusty posts and
//   rails, a grey-brown deck, beige crates and sheets; ivy where the ground is moist.
// - The start: a district center of our own, a lodge with pale walls, a dark roof and a yellow
//   banner on a pale deck, its door facing the entrance, and a lit post on the entrance tile.
// - Slopes: a stone ramp; with Markers, a level pale arrow rimmed dark floating just above it,
//   pointing uphill (it reads from any camera angle). Water sources: a stone ring round a spring;
//   badwater sources: a brown swirl in a dark pit. Mine sites: a square pit in an orange frame.
//   Geothermal fields: dark rock with glowing vents. Relics: broken stone columns on a plinth.
//   Thorns: dark brambles. Blockages and natural dams: heaps of stones.
// - Every other template: a box on each block its footprint occupies.
// With Markers on (the information layer), dead trees, the slopes' arrows and the start have a
// minimum size on screen: from afar they grow (the object shader: dead trees up to 2.5 times, the
// start 3, the arrows 6) so they stay readable in a view of the whole map. The clean view draws
// every object at its true size.
// Jitter, turn and tint come from each object's tile, so a redraw looks the same.

import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, OctahedronGeometry, type ShaderMaterial } from "three";
import { FOOTPRINTS, rotate, startEntranceTile, worldBlocks, type Orientation } from "../core/format/footprints";
import { DEAD, FLIPPED, ORIENTATION_NAMES, YOUNG, type EntityView, type SoilView } from "./model";
import { GEOTHERMAL, GEOTHERMAL_ROCK, MINE, RELIC_STONE, RUIN, SLOPE, START, THORNS } from "./palette";

type Rgb = readonly [number, number, number];

// ------------------------------------------------------------------------------ model building

/** A model under construction: flat-shaded triangles with a colour per vertex. */
class Model {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];

  /** Add a three.js geometry, transformed, in one colour (flat shaded). */
  add(g: BufferGeometry, color: Rgb, t: { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number; lift?: number } = {}): this {
    // `lift` moves the part up before it turns (a leaf or branch turning about its base)
    if (t.lift) g.translate(0, t.lift, 0);
    if (t.sx !== undefined || t.sy !== undefined || t.sz !== undefined) g.scale(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    if (t.rx) g.rotateX(t.rx);
    if (t.rz) g.rotateZ(t.rz);
    if (t.ry) g.rotateY(t.ry);
    g.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0);
    const flat = g.index ? g.toNonIndexed() : g;
    flat.computeVertexNormals();
    const p = flat.getAttribute("position");
    const n = flat.getAttribute("normal");
    for (let k = 0; k < p.count; k++) {
      this.pos.push(p.getX(k), p.getY(k), p.getZ(k));
      this.nrm.push(n.getX(k), n.getY(k), n.getZ(k));
      this.col.push(color[0], color[1], color[2]);
    }
    if (flat !== g) flat.dispose();
    g.dispose();
    return this;
  }

  /** Triangles given directly (counter-clockwise seen from outside), in one colour. */
  tris(points: number[], color: Rgb): this {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(points, 3));
    return this.add(g, color);
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("pcolor", new Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }

  get triangles(): number {
    return this.pos.length / 9;
  }
}

const cone = (r: number, h: number, sides: number) => new ConeGeometry(r, h, sides, 1, true);
const cyl = (r0: number, r1: number, h: number, sides: number) => new CylinderGeometry(r1, r0, h, sides, 1, true);
/** A cylinder with its ends closed (a trunk seen from above). */
const post = (r0: number, r1: number, h: number, sides: number) => new CylinderGeometry(r1, r0, h, sides, 1, false);
const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z);
const ico = (r: number) => new IcosahedronGeometry(r, 0);

const BARK: Rgb = [0.36, 0.25, 0.16];
/** Bare dead wood: a pale grey-brown tan, far lighter than the living crowns; a dead birch stays
 *  white, a dead oak's thick trunk darker. */
const DEAD_WOOD: Rgb = [0.78, 0.69, 0.56];
const DEAD_DARK: Rgb = [0.7, 0.62, 0.5];
const DEAD_BIRCH: Rgb = [0.9, 0.88, 0.84];
const DEAD_BARK: Rgb = [0.6, 0.54, 0.45];

/** A bare branch from the trunk at height y, outward along `angle`, tilted up by `tilt`: a spike
 *  tapering to a point. */
function branch(m: Model, y: number, angle: number, tilt: number, length: number, r: number, color: Rgb): void {
  const before = m.pos.length / 3;
  m.add(cone(r, length, 4), color, { lift: length / 2, rz: -(Math.PI / 2 - tilt) });
  rotateTail(m, m.pos.length / 3 - before, angle, y);
}

/** Turn the last `vertices` vertices of a model about the Y axis by `angle`, then lift them by y. */
function rotateTail(m: Model, vertices: number, angle: number, y: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const from = m.pos.length - vertices * 3;
  for (let k = from; k < m.pos.length; k += 3) {
    const x = m.pos[k];
    const z = m.pos[k + 2];
    m.pos[k] = c * x + s * z;
    m.pos[k + 1] += y;
    m.pos[k + 2] = -s * x + c * z;
    const nx = m.nrm[k];
    const nz = m.nrm[k + 2];
    m.nrm[k] = c * nx + s * nz;
    m.nrm[k + 2] = -s * nx + c * nz;
  }
}

const MODELS: Record<string, () => Model> = {
  Pine: () =>
    new Model()
      .add(cyl(0.07, 0.05, 0.45, 4), BARK, { y: 0.225 })
      .add(cone(0.38, 0.62, 6), [0.11, 0.28, 0.17], { y: 0.3 + 0.31 })
      .add(cone(0.3, 0.56, 6), [0.13, 0.32, 0.19], { y: 0.62 + 0.28, ry: 0.5 })
      .add(cone(0.2, 0.5, 6), [0.15, 0.36, 0.21], { y: 0.95 + 0.25, ry: 1.0 }),
  "Pine.dead": () => {
    // a tall bare pole, its top broken off askew, a few stubs of branches
    const m = new Model().add(post(0.075, 0.05, 1.25, 6), DEAD_WOOD, { y: 0.625 }).add(post(0.05, 0.03, 0.22, 5), DEAD_DARK, { x: 0.03, y: 1.33, rz: -0.35 });
    branch(m, 0.78, 1.0, 0.5, 0.13, 0.03, DEAD_DARK);
    branch(m, 1.02, 3.7, 0.55, 0.1, 0.025, DEAD_DARK);
    return m;
  },
  Birch: () =>
    new Model()
      .add(cyl(0.05, 0.04, 0.75, 4), [0.93, 0.91, 0.86], { y: 0.375 })
      .add(cyl(0.052, 0.05, 0.07, 4), [0.18, 0.16, 0.15], { y: 0.36 })
      .add(ico(0.31), [0.34, 0.52, 0.19], { y: 0.96, sy: 1.4 }),
  "Birch.dead": () => {
    // a white trunk forking into two bare arms, and a twig
    const m = new Model().add(post(0.06, 0.045, 0.5, 5), DEAD_BIRCH, { y: 0.25 });
    branch(m, 0.46, 0.3, 1.2, 0.55, 0.045, DEAD_BIRCH);
    branch(m, 0.46, 3.4, 1.15, 0.5, 0.04, DEAD_BIRCH);
    branch(m, 0.62, 1.9, 0.8, 0.2, 0.025, DEAD_WOOD);
    return m;
  },
  Oak: () =>
    new Model()
      .add(cyl(0.11, 0.08, 0.55, 4), [0.34, 0.23, 0.14], { y: 0.275 })
      .add(ico(0.44), [0.22, 0.42, 0.16], { y: 0.95, sy: 0.85 })
      .add(ico(0.28), [0.26, 0.47, 0.18], { x: 0.2, y: 0.8, z: 0.12 }),
  "Oak.dead": () => {
    // a thick bare trunk, its limbs broken off short, pale where they broke
    const m = new Model().add(post(0.15, 0.11, 0.62, 6), DEAD_BARK, { y: 0.31 }).add(new CylinderGeometry(0.1, 0.1, 0.02, 6), DEAD_WOOD, { y: 0.62 });
    for (let k = 0; k < 3; k++) branch(m, 0.56, 0.5 + (k * Math.PI * 2) / 3, 1.05, 0.26, 0.06, DEAD_WOOD);
    return m;
  },
  Succulent: () => {
    const m = new Model();
    for (let k = 0; k < 6; k++) m.add(cone(0.07, 0.42, 4), k % 2 ? [0.4, 0.6, 0.5] : [0.36, 0.55, 0.47], { lift: 0.21, rz: -0.6, ry: (k * Math.PI) / 3, y: 0.02 });
    m.add(cone(0.06, 0.5, 4), [0.44, 0.63, 0.52], { y: 0.25 });
    return m;
  },
  "Succulent.dead": () => {
    const m = new Model();
    for (let k = 0; k < 6; k++) m.add(cone(0.06, 0.36, 4), k % 2 ? [0.55, 0.48, 0.36] : [0.5, 0.43, 0.32], { lift: 0.18, rz: -1.15, ry: (k * Math.PI) / 3, y: 0.02 });
    return m;
  },
  BlueberryBush: () => {
    const m = new Model().add(ico(0.3), [0.14, 0.29, 0.14], { y: 0.2, sy: 0.72, sx: 1.1 });
    const flowers: [number, number, number][] = [[0.16, 0.3, 0.12], [-0.08, 0.36, 0.15], [0.05, 0.38, -0.15], [0.22, 0.18, -0.12]];
    for (const [x, y, z] of flowers) m.add(new OctahedronGeometry(0.065, 0), [0.46, 0.56, 1.0], { x, y, z });
    return m;
  },
  "BlueberryBush.dead": () => {
    // a pale clump of bare twigs
    const m = new Model();
    for (let k = 0; k < 5; k++) branch(m, 0.04, (k * Math.PI * 2) / 5, 0.7, 0.36, 0.04, k % 2 ? DEAD_DARK : DEAD_WOOD);
    return m;
  },
  Slope: () => {
    // a ramp over the tile, low on the north (−Z) edge and high on the south (+Z), as a Cw0
    // slope's high side is south (its arrows are "Slope.mark")
    const m = new Model();
    const h = 0.5;
    m.tris([-h, 0, -h, h, 1, h, h, 0, -h, -h, 0, -h, -h, 1, h, h, 1, h], SLOPE.ramp);
    m.tris([-h, 0, h, h, 0, h, h, 1, h, -h, 0, h, h, 1, h, -h, 1, h], SLOPE.side);
    m.tris([-h, 0, -h, -h, 0, h, -h, 1, h], SLOPE.side);
    m.tris([h, 0, -h, h, 1, h, h, 0, h], SLOPE.side);
    return m;
  },
  "Slope.mark": () => {
    // an arrow pointing uphill (+Z, the ramp's high side), flat and level so it reads from any
    // camera angle: pale, on a larger dark one (its rim); it floats just above the slope's top
    const m = new Model();
    const arrow = (tip: number, head: number, neck: number, shaft: number, tail: number, y: number, color: Rgb) => {
      const tris: [number, number][][] = [
        [[0, tip], [-head, neck], [head, neck]],
        [[-shaft, neck], [-shaft, tail], [shaft, tail]],
        [[-shaft, neck], [shaft, tail], [shaft, neck]],
      ];
      const pts: number[] = [];
      for (const [a, b, c] of tris) {
        // wound to face up
        const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
        for (const [x, z] of up ? [a, b, c] : [a, c, b]) pts.push(x, y, z);
      }
      m.tris(pts, color);
    };
    arrow(0.56, 0.44, -0.02, 0.2, -0.52, -0.02, SLOPE.rim);
    arrow(0.44, 0.33, 0.04, 0.11, -0.42, 0, SLOPE.arrow);
    return m;
  },
  WaterSource: () => new Model().add(cyl(0.38, 0.36, 0.14, 8), [0.47, 0.46, 0.44], { y: 0.07 }).add(new CylinderGeometry(0.3, 0.3, 0.16, 8), [0.32, 0.62, 0.95], { y: 0.08 }),
  BadwaterSource: () => {
    // a brown swirl in a dark pit, over its 3 × 3 footprint (centred on it)
    const m = new Model().add(cyl(1.3, 1.25, 0.12, 12), [0.2, 0.15, 0.13], { y: 0.06 }).add(new CylinderGeometry(1.15, 1.15, 0.05, 12), [0.26, 0.13, 0.1], { y: 0.03 });
    for (let k = 0; k < 4; k++) {
      // curved arms: short tilted slabs turning toward the middle
      for (let j = 0; j < 3; j++) {
        const a = (k * Math.PI) / 2 + j * 0.5;
        const r = 0.95 - j * 0.3;
        m.add(box(0.42 - j * 0.08, 0.04, 0.12), j % 2 ? [0.5, 0.3, 0.18] : [0.44, 0.24, 0.15], { x: Math.cos(a) * r, y: 0.08 + j * 0.01, z: -Math.sin(a) * r, ry: a + Math.PI / 2 + 0.5 });
      }
    }
    return m.add(cone(0.18, 0.12, 6), [0.16, 0.08, 0.06], { y: 0.12, rx: Math.PI });
  },
  UndergroundRuins: () => {
    // a mine site: a square pit in an orange frame, over its 5 × 5 footprint (centred on it)
    const m = new Model().add(box(4.3, 0.04, 4.3), [0.1, 0.1, 0.09], { y: 0.02 }).add(box(3.4, 0.03, 3.4), MINE.pit, { y: 0.045 });
    const frame: Rgb = [...MINE.frame];
    for (const [x, z, w, d] of [[0, 2.2, 4.6, 0.22], [0, -2.2, 4.6, 0.22], [2.2, 0, 0.22, 4.6], [-2.2, 0, 0.22, 4.6]] as const) m.add(box(w, 0.2, d), frame, { x, y: 0.1, z });
    for (const [x, z] of [[2.2, 2.2], [2.2, -2.2], [-2.2, 2.2], [-2.2, -2.2]] as const) m.add(box(0.3, 0.45, 0.3), [0.62, 0.3, 0.1], { x, y: 0.22, z });
    return m;
  },
  GeothermalField: () => {
    // a low mound of dark rock over its 3 × 3 footprint, cracked by vents glowing orange
    const m = new Model().add(cyl(1.45, 1.2, 0.22, 7), GEOTHERMAL_ROCK, { y: 0.11 }).add(new CylinderGeometry(1.2, 1.2, 0.02, 7), [0.22, 0.21, 0.2], { y: 0.22 });
    const rocks: [number, number, number, number][] = [[0.9, 0.5, 0.34, 0.2], [-0.8, 0.7, 0.3, 0.25], [-0.4, -0.95, 0.36, 0.2], [0.75, -0.8, 0.26, 0.2], [0.1, 0.2, 0.3, 0.35]];
    for (const [x, z, r, sy] of rocks) m.add(ico(r), [0.3, 0.29, 0.28], { x, y: 0.2, z, sy: sy / r });
    const vents: [number, number, number][] = [[-0.35, 0.2, 0.2], [0.45, -0.25, 0.16], [-0.1, -0.6, 0.13], [0.35, 0.65, 0.12]];
    for (const [x, z, r] of vents) {
      m.add(cyl(r * 1.5, r, 0.12, 6), [0.2, 0.19, 0.18], { x, y: 0.28, z });
      m.add(new CylinderGeometry(r, r, 0.02, 6), GLOW, { x, y: 0.33, z });
    }
    return m;
  },
  SmallRelic: () => relic(2, 1, [[-0.5, 0, 0.9], [0.5, 0, 0.45]], [], false),
  MediumRelic: () => relic(3, 2, [[-1, -0.5, 1.2], [0, -0.5, 0.5], [1, -0.5, 0.95], [-1, 0.5, 0.35], [1, 0.5, 1.4]], [[0.1, 0.45, 1.0]], false),
  LargeRelic: () => relic(3, 3, [[-1, -1, 1.9], [1, -1, 1.5], [-1, 1, 1.2], [1, 1, 0.7], [0, -1, 0.4]], [[0.2, 0.6, 1.3]], true),
  Thorns: () => {
    // a low, dark bramble with thorny canes sticking out
    const m = new Model().add(ico(0.34), THORNS, { y: 0.2, sy: 0.6 }).add(ico(0.24), [0.28, 0.14, 0.12], { x: 0.18, y: 0.3, z: -0.1, sy: 0.8 });
    for (let k = 0; k < 6; k++) branch(m, 0.14 + 0.06 * (k % 2), (k * Math.PI) / 3 + 0.3, 0.5 + 0.25 * (k % 3), 0.34, 0.035, k % 2 ? [0.4, 0.2, 0.16] : [0.25, 0.12, 0.1]);
    return m;
  },
};

/** A vent's glow: brighter than any lit colour, so it shines in shade too. */
const GLOW: Rgb = [GEOTHERMAL[0] * 1.3, GEOTHERMAL[1] * 1.3, GEOTHERMAL[2] * 1.3];

/** A relic over its sx × sy footprint (centred on it): a worn plinth, broken columns [x, z,
 *  height] and fallen drums [x, z, turn]; a large relic stands on a second step. */
function relic(sx: number, sy: number, columns: [number, number, number][], fallen: [number, number, number][], step: boolean): Model {
  const m = new Model().add(box(sx - 0.1, 0.16, sy - 0.1), [RELIC_STONE[0] * 0.8, RELIC_STONE[1] * 0.8, RELIC_STONE[2] * 0.8], { y: 0.08 });
  let base = 0.16;
  if (step) {
    m.add(box(sx - 0.6, 0.18, sy - 0.6), [RELIC_STONE[0] * 0.9, RELIC_STONE[1] * 0.9, RELIC_STONE[2] * 0.9], { y: base + 0.09 });
    base += 0.18;
  }
  const inset = step ? 0.65 : 0.8;
  for (const [x, z, h] of columns) {
    const px = x * inset;
    const pz = z * inset;
    m.add(cyl(0.2, 0.17, h, 6), RELIC_STONE, { x: px, y: base + h / 2, z: pz });
    // a broken top, tilted
    m.add(cyl(0.18, 0.14, 0.12, 6), [RELIC_STONE[0] * 1.08, RELIC_STONE[1] * 1.08, RELIC_STONE[2] * 1.08], { x: px + 0.02, y: base + h + 0.04, z: pz, rz: 0.35 });
  }
  for (const [x, z, turn] of fallen) m.add(cyl(0.17, 0.17, 0.7, 6), [RELIC_STONE[0] * 0.92, RELIC_STONE[1] * 0.92, RELIC_STONE[2] * 0.92], { rz: Math.PI / 2, ry: turn, x, y: base + 0.17, z });
  return m;
}

/** A heap of stones on a block (blockages and natural dams), tinted by its template. */
function rubble(): Model {
  const m = new Model();
  const stones: [number, number, number, number, number][] = [[-0.18, 0.2, -0.15, 0.32, 1], [0.22, 0.17, 0.12, 0.28, 0.86], [-0.05, 0.14, 0.26, 0.24, 0.78], [0.16, 0.44, -0.1, 0.22, 0.94], [-0.2, 0.42, 0.14, 0.2, 0.9]];
  for (const [x, y, z, r, shade] of stones) m.add(ico(r), [shade, shade, shade], { x, y, z, sy: 0.8 });
  return m;
}
const RUBBLE = new Set(["Blockage", "NaturalDam"]);

/** The light look's models, for browsers that render in software (a few triangles each; D110). */
const LITE_MODELS: Record<string, () => Model> = {
  Pine: () => new Model().add(cone(0.36, 1.25, 4), [0.13, 0.32, 0.19], { y: 0.2 + 0.625 }),
  Birch: () => new Model().add(cone(0.06, 0.8, 3), [0.93, 0.91, 0.86], { y: 0.4 }).add(new OctahedronGeometry(0.32, 0), [0.34, 0.52, 0.19], { y: 0.95, sy: 1.3 }),
  Oak: () => new Model().add(cone(0.11, 0.7, 3), [0.34, 0.23, 0.14], { y: 0.35 }).add(new OctahedronGeometry(0.44, 0), [0.24, 0.45, 0.17], { y: 0.92, sy: 0.85 }),
  // dead trees: a pale trunk and two bare branches (a few triangles each)
  "Pine.dead": () => liteDead(0.08, 1.35, 0.12, DEAD_WOOD),
  "Birch.dead": () => liteDead(0.07, 0.95, 0.4, DEAD_BIRCH),
  "Oak.dead": () => liteDead(0.14, 0.7, 0.26, DEAD_BARK),
  Succulent: () => new Model().add(cone(0.2, 0.5, 4), [0.4, 0.6, 0.5], { y: 0.25 }),
  BlueberryBush: () => new Model().add(new OctahedronGeometry(0.28, 0), [0.14, 0.29, 0.14], { y: 0.2, sy: 0.75 }),
};
const LITE_RUIN = () => new Model().add(box(0.8, 1, 0.8), RUIN.body, { y: 0.5 });

/** The light look's dead tree: a trunk and two bare branches. */
function liteDead(r: number, h: number, length: number, color: Rgb): Model {
  const m = new Model().add(cone(r, h, 3), color, { y: h / 2 });
  branch(m, h * 0.55, 0.6, 0.9, length, r * 0.6, DEAD_DARK);
  branch(m, h * 0.7, 3.5, 0.9, length * 0.8, r * 0.5, color);
  return m;
}

/** Templates whose model stands in the middle of a footprint: the local point it is centred on. */
const CENTRED: Record<string, [number, number]> = { BadwaterSource: [1, 1], UndergroundRuins: [2, 2], GeothermalField: [1, 1], SmallRelic: [0.5, 0], MediumRelic: [1, 0.5], LargeRelic: [1, 1] };

/** The district center, its door toward +Z (south, a Cw0 start's entrance side), centred on its
 *  3 × 3 footprint: pale walls under a dark roof on a pale deck, so it stands out on any ground. */
function districtCenter(): Model {
  const m = new Model();
  const wood: Rgb = [...START.walls];
  const roof: Rgb = [...START.roof];
  m.add(box(2.9, 0.2, 2.9), START.deck, { y: 0.1 });
  m.add(box(3.0, 0.06, 3.0), [0.22, 0.15, 0.1], { y: 0.03 });
  m.add(box(1.7, 0.9, 1.3), wood, { y: 0.65 });
  // log courses: darker bands on the walls
  for (const y of [0.42, 0.68, 0.94]) m.add(box(1.74, 0.05, 1.34), [0.66, 0.55, 0.4], { y });
  // an A-frame roof along x, overhanging the walls
  const x = 1.02;
  const z = 0.82;
  const y0 = 1.1;
  const y1 = 1.92;
  m.tris([-x, y0, z, x, y0, z, x, y1, 0, -x, y0, z, x, y1, 0, -x, y1, 0], roof);
  m.tris([x, y0, -z, -x, y0, -z, -x, y1, 0, x, y0, -z, -x, y1, 0, x, y1, 0], [roof[0] * 0.85, roof[1] * 0.85, roof[2] * 0.85]);
  m.tris([x, y0, z, x, y0, -z, x, y1, 0], wood);
  m.tris([-x, y0, -z, -x, y0, z, -x, y1, 0], wood);
  m.tris([-x, y0, z, -x, y0, -z, x, y0, -z, -x, y0, z, x, y0, -z, x, y0, z], [0.3, 0.2, 0.13]);
  m.add(box(0.22, 0.55, 0.22), [0.52, 0.51, 0.49], { x: 0.5, y: 1.75, z: -0.3 });
  // the door and its awning, facing the entrance
  m.add(box(0.38, 0.56, 0.06), [0.22, 0.14, 0.08], { y: 0.48, z: 0.66 });
  m.add(box(0.64, 0.06, 0.32), roof, { y: 0.84, z: 0.8, rx: 0.25 });
  // a tall banner at the back corner, seen from afar
  m.add(cyl(0.05, 0.04, 2.7, 5), [0.22, 0.16, 0.11], { x: -1.15, y: 0.2 + 1.35, z: -1.1 });
  m.add(box(0.8, 0.5, 0.05), START.banner, { x: -0.73, y: 2.55, z: -1.1 });
  m.add(box(0.8, 0.1, 0.055), [0.2, 0.08, 0.05], { x: -0.73, y: 2.33, z: -1.1 });
  return m;
}

/** The entrance tile's marker: a flat stone and a lit post. */
function entrance(): Model {
  return new Model()
    .add(box(0.62, 0.06, 0.62), [0.84, 0.78, 0.64], { y: 0.03 })
    .add(cyl(0.03, 0.03, 0.55, 4), [0.3, 0.22, 0.15], { x: 0.24, y: 0.3, z: 0.18 })
    .add(box(0.12, 0.12, 0.12), [1.0, 0.85, 0.42], { x: 0.24, y: 0.6, z: 0.18 });
}

/** Ruins: storeys of an old scaffold tower, one level high each, a ruin stacks one per level:
 *  weathered posts, rusty rails and braces, a grey-brown deck on some storeys and beige crates and
 *  sheets. Ivy grows on them where the ground is moist. */
const IVY: Rgb = [0.2, 0.38, 0.15];
function storey(variant: number, ivy: boolean): Model {
  const m = new Model();
  const e = 0.36;
  const frame = RUIN.frame;
  // weathered corner posts
  for (const [x, z] of [[e, e], [e, -e], [-e, e], [-e, -e]] as const) m.add(cyl(0.045, 0.04, 1.0, 4), frame, { x, y: 0.5, z, ry: Math.PI / 4 });
  // rusty rails round the top of the storey
  const sides: [number, number, number][] = [[0, e, 0], [e, 0, Math.PI / 2], [0, -e, Math.PI], [-e, 0, -Math.PI / 2]];
  for (const [x, z, ry] of sides) m.add(box(0.78, 0.05, 0.05), RUIN.rust, { x, y: 0.97, z, ry });
  // a cross brace on two sides
  const [a, b, c] = [sides[variant % 4], sides[(variant + 1) % 4], sides[(variant + 2) % 4]];
  m.add(box(1.0, 0.045, 0.045), frame, { x: a[0], y: 0.5, z: a[1], ry: a[2], rz: 0.9 });
  m.add(box(1.0, 0.045, 0.045), RUIN.rust, { x: c[0], y: 0.5, z: c[1], ry: c[2], rz: -0.9 });
  // a plank deck, a sheet hanging on one side, crates stacked on the floor
  if (variant !== 1) m.add(box(0.76, 0.05, 0.76), RUIN.body, { y: 0.93 });
  m.add(box(0.5, 0.38, 0.03), RUIN.panel, { x: b[0] * 1.02, y: 0.62, z: b[1] * 1.02, ry: b[2] });
  m.add(box(0.3, 0.26, 0.3), RUIN.panel, { x: 0.12, y: 0.13, z: -0.1, ry: 0.3 * variant });
  if (variant === 2) m.add(box(0.22, 0.2, 0.22), [RUIN.panel[0] * 0.85, RUIN.panel[1] * 0.85, RUIN.panel[2] * 0.85], { x: -0.12, y: 0.1, z: 0.14, ry: 0.5 });
  if (ivy) {
    m.add(ico(0.2), IVY, { x: a[0] * 1.05, y: 0.25, z: a[1] * 1.05, sy: 1.3 });
    m.add(ico(0.16), [0.24, 0.44, 0.17], { x: -e, y: 0.55 + 0.1 * (variant % 2), z: e, sy: 1.6 });
  }
  return m;
}
const STOREYS = 3;

// ------------------------------------------------------------------------------ selection

/** The model an object is drawn with: its species and whether it is dead (tests read this). */
export function modelKeyOf(template: string, flags: number): string {
  if (/^RuinColumnH\d$/.test(template)) return "ruin";
  if (template === "StartingLocation") return "start";
  if (!(template in MODELS)) return "block";
  const dead = !!(flags & DEAD) && `${template}.dead` in MODELS;
  return dead ? `${template}.dead` : template;
}

/** Triangles of a model (tests and the benchmark's budget). */
export function modelTriangles(key: string): number {
  if (key === "start") return districtCenter().triangles;
  if (key === "ruin") return storey(1, true).triangles;
  return MODELS[key] ? MODELS[key]().triangles : 12;
}

const PLANTS = new Set(["Pine", "Birch", "Oak", "Succulent", "BlueberryBush"]);

const GENERIC_COLORS: [RegExp, Rgb][] = [
  [/Relic/, [0.79, 0.65, 0.29]],
  [/Blockage/, [0.52, 0.51, 0.49]],
  [/NaturalDam/, [0.54, 0.42, 0.27]],
  [/Thorns/, [0.48, 0.18, 0.18]],
  [/Geothermal/, [...GEOTHERMAL]],
  [/Overhang/, [0.62, 0.53, 0.42]],
  [/UnstableCore/, [0.69, 0.29, 0.75]],
  [/Badtide|Badwater/, [0.42, 0.29, 0.16]],
  [/Aquifer|Seep/, [0.23, 0.42, 0.69]],
  [/Reserve/, [0.63, 0.48, 0.29]],
];

function genericColor(template: string): Rgb {
  for (const [re, c] of GENERIC_COLORS) if (re.test(template)) return c;
  return [0.56, 0.56, 0.56];
}

/** Where a plant stands in its tile and its size (the captures' listing reads it): the offset
 *  from the tile's middle (x east, y north) and the scale. */
export function plantPlacement(x: number, y: number, flags: number): { dx: number; dy: number; scale: number } {
  const dead = !!(flags & DEAD);
  return { dx: (jitter(x, y, 2) - 0.5) * 0.3, dy: -(jitter(x, y, 3) - 0.5) * 0.3, scale: (flags & YOUNG ? 0.5 : 0.85 + 0.3 * jitter(x, y, 1)) * (dead ? 0.95 : 1) };
}

/** A per-tile hash in [0, 1): jitter that stays the same between redraws. */
function jitter(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Batch {
  model: () => Model;
  matrices: number[];
  tints: number[];
  /** Per instance: the object it draws, when it stands on its tile's ground and follows it as the
   *  ground is painted (plants and ruins), or -1. */
  follows: number[];
  /** Per instance: its minimum size (pixels a unit of the model takes at least, 0 for none), how
   *  far it rises for each time it grows, and the most it grows (the object shader's `grow`). */
  grows: number[];
}

type Grow = readonly [number, number, number];
/** Minimum sizes on screen: pixels per unit of the model, the rise per growth, the most growth. */
const NO_GROW: Grow = [0, 0, 1];
const GROW_DEAD: Grow = [14, 0, 2.5];
const GROW_SLOPE_MARK: Grow = [25, 0.7, 6];
/** How high a slope's arrow floats over the slope's foot: just above its top. */
export const SLOPE_ARROW_HEIGHT = 1.06;
const GROW_START: Grow = [14, 0, 3];
const TREES = new Set(["Pine", "Birch", "Oak"]);

/** Build the objects of a map view as a group of instanced meshes; with the soil (and the map's
 *  width), ruins on moist ground are overgrown. `lite`: the light look's models (software
 *  rendering). */
export function buildEntities(v: EntityView, material: ShaderMaterial, soil: SoilView | null = null, W = 0, lite = false): { group: Group; instances: number } {
  const batches = new Map<string, Batch>();
  const batch = (key: string, model: () => Model): Batch => {
    let b = batches.get(key);
    if (!b) {
      b = { model, matrices: [], tints: [], grows: [], follows: [] };
      batches.set(key, b);
    }
    return b;
  };
  /** The object whose instances follow its ground (see Batch.follows), or -1. */
  let follow = -1;
  /** An instance: turned by `angle` about the vertical, scaled by s, at (px, py, pz). */
  const put = (b: Batch, px: number, py: number, pz: number, angle: number, s: number, tint: Rgb | number = 1, sy = s, grow: Grow = NO_GROW) => {
    b.follows.push(follow);
    const c = Math.cos(angle);
    const n = Math.sin(angle);
    b.matrices.push(c * s, 0, -n * s, 0, 0, sy, 0, 0, n * s, 0, c * s, 0, px, py, pz, 1);
    if (typeof tint === "number") b.tints.push(tint, tint, tint);
    else b.tints.push(tint[0], tint[1], tint[2]);
    b.grows.push(grow[0], grow[1], grow[2]);
  };
  let instances = 0;
  for (let k = 0; k < v.count; k++) {
    const template = v.templates[v.template[k]];
    const x = v.x[k];
    const y = v.y[k];
    const z = v.z[k];
    const turn = (-Math.PI / 2) * v.orientation[k];
    const flags = v.flags[k];
    const key = modelKeyOf(template, flags);
    instances++;
    follow = key === "ruin" || PLANTS.has(template) ? k : -1;
    if (key === "ruin" && lite) {
      put(batch("ruin.lite", LITE_RUIN), x + 0.5, z, -(y + 0.5), 0, 1, 1, Number(template.slice(-1)));
      continue;
    }
    if (key === "ruin") {
      const n = Number(template.slice(-1));
      const ivy = !!soil && W > 0 && x >= 0 && y >= 0 && y * W + x < soil.moisture.length && soil.moisture[y * W + x] > 0;
      for (let lv = 0; lv < n; lv++) {
        const variant = Math.floor(jitter(x, y, 10 + lv) * STOREYS);
        const green = ivy && lv < 3;
        const b = batch(`scaffold${variant}${green ? ".ivy" : ""}`, () => storey(variant, green));
        const t = 0.9 + 0.18 * jitter(x, y, 20 + lv);
        put(b, x + 0.5, z + lv, -(y + 0.5), Math.floor(jitter(x, y, 30 + lv) * 4) * (Math.PI / 2), 1, t);
      }
      continue;
    }
    if (key === "start") {
      const o = ORIENTATION_NAMES[v.orientation[k]] as Orientation;
      // the 3×3 footprint's centre: Coordinates plus the rotated local (1, 1)
      const [dx, dy] = rotate(o, 1, 1);
      put(batch("start", districtCenter), x + dx + 0.5, z, -(y + dy + 0.5), turn, 1, 1, 1, GROW_START);
      const [ex, ey] = startEntranceTile(x, y, o);
      put(batch("start.entrance", entrance), ex + 0.5, z, -(ey + 0.5), turn, 1);
      continue;
    }
    if (key === "block") {
      const fp = FOOTPRINTS[template];
      const color = genericColor(template);
      const b = RUBBLE.has(template) ? batch("block.rubble", rubble) : batch("block", () => new Model().add(box(0.92, 0.92, 0.92), [1, 1, 1], { y: 0.46 }));
      const o = ORIENTATION_NAMES[v.orientation[k]] as Orientation;
      if (fp) for (const bl of worldBlocks(fp, { template, x, y, z, orientation: o, flipped: !!(flags & FLIPPED) })) put(b, bl.x + 0.5, bl.z, -(bl.y + 0.5), 0, 1, color);
      else put(b, x + 0.5, z, -(y + 0.5), 0, 1, color);
      continue;
    }
    const b = lite && LITE_MODELS[key] ? batch(`${key}.lite`, LITE_MODELS[key]) : batch(key, MODELS[key]);
    const centre = CENTRED[template];
    if (centre) {
      const o = ORIENTATION_NAMES[v.orientation[k]] as Orientation;
      const [dx, dy] = rotate(o, centre[0], centre[1]);
      put(b, x + dx + 0.5, z, -(y + dy + 0.5), turn, 1);
      continue;
    }
    if (PLANTS.has(template)) {
      const dead = !!(flags & DEAD);
      const s = (flags & YOUNG ? 0.5 : 0.85 + 0.3 * jitter(x, y, 1)) * (dead ? 0.95 : 1);
      const tint = dead ? 0.94 + 0.08 * jitter(x, y, 5) : 0.9 + 0.2 * jitter(x, y, 5);
      put(b, x + 0.5 + (jitter(x, y, 2) - 0.5) * 0.3, z, -(y + 0.5) + (jitter(x, y, 3) - 0.5) * 0.3, jitter(x, y, 4) * Math.PI * 2, s, tint, s, dead && TREES.has(template) ? GROW_DEAD : NO_GROW);
    } else put(b, x + 0.5, z, -(y + 0.5), turn, 1);
    // a slope's arrow, level, just above the slope's top
    if (template === "Slope") put(batch("Slope.mark", MODELS["Slope.mark"]), x + 0.5, z + SLOPE_ARROW_HEIGHT, -(y + 0.5), turn, 1, 1, 1, GROW_SLOPE_MARK);
  }
  const group = new Group();
  for (const [key, b] of batches) {
    const n = b.tints.length / 3;
    if (!n) continue;
    // the light look bakes every instance into one mesh drawn once: software rendering pays for
    // each instance it draws, not for each triangle
    const mesh = lite ? new InstancedMesh(baked(b.model(), b.matrices, b.tints), material, 1) : new InstancedMesh(b.model().geometry(), material, n);
    mesh.name = key;
    if (lite) {
      mesh.instanceMatrix.array.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3);
      mesh.geometry.setAttribute("grow", new InstancedBufferAttribute(new Float32Array([0, 0, 1]), 3));
    } else {
      mesh.instanceMatrix.array.set(b.matrices);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(b.tints), 3);
      mesh.geometry.setAttribute("grow", new InstancedBufferAttribute(new Float32Array(b.grows), 3));
      // what follows the ground as it is painted: each instance's object, and its height as built
      if (b.follows.some((k) => k >= 0)) {
        mesh.userData.follows = Int32Array.from(b.follows);
        mesh.userData.ty0 = Float32Array.from({ length: n }, (_, i) => b.matrices[i * 16 + 13]);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return { group, instances };
}

/** Every instance of a model in one geometry: positions and normals through each instance's
 *  matrix, colours times its tint (the light look). */
function baked(model: Model, matrices: number[], tints: number[]): BufferGeometry {
  const n = tints.length / 3;
  const V = model.pos.length / 3;
  const pos = new Float32Array(n * V * 3);
  const nrm = new Float32Array(n * V * 3);
  const col = new Float32Array(n * V * 3);
  for (let k = 0; k < n; k++) {
    const e = matrices.slice(k * 16, k * 16 + 16);
    for (let v = 0; v < V; v++) {
      const x = model.pos[v * 3];
      const y = model.pos[v * 3 + 1];
      const z = model.pos[v * 3 + 2];
      const o = (k * V + v) * 3;
      pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = model.nrm[v * 3];
      const ny = model.nrm[v * 3 + 1];
      const nz = model.nrm[v * 3 + 2];
      nrm[o] = e[0] * nx + e[4] * ny + e[8] * nz;
      nrm[o + 1] = e[1] * nx + e[5] * ny + e[9] * nz;
      nrm[o + 2] = e[2] * nx + e[6] * ny + e[10] * nz;
      for (let c = 0; c < 3; c++) col[o + c] = model.col[v * 3 + c] * tints[k * 3 + c];
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  g.setAttribute("pcolor", new Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

export function disposeGroup(g: Group): void {
  for (const c of g.children) {
    const mesh = c as InstancedMesh;
    mesh.geometry.dispose();
    mesh.dispose();
  }
  g.clear();
}
