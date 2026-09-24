// Map objects as instanced meshes (EDITOR_PLAN §8): one draw call per part of each kind, so tens of
// thousands of trees cost a few draw calls. Trees, bushes, ruins, slopes, sources and the start
// have simple low-poly models; every other template is drawn as boxes on the blocks its footprint
// occupies, so imported maps show all their objects. The look is our own (EDITOR_PLAN §2): the
// game's assets are not ours to include. Jitter and turn come from each object's tile, so a
// redraw looks the same.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type ShaderMaterial,
  Float32BufferAttribute,
} from "three";
import { FOOTPRINTS, rotate, startEntranceTile, worldBlocks, type Orientation } from "../core/format/footprints";
import { DEAD, FLIPPED, ORIENTATION_NAMES, YOUNG, type EntityView } from "./model";

interface Part {
  geo: BufferGeometry;
  color: number;
  dead?: number;
}

function translated(g: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  g.translate(x, y, z);
  return g;
}

/** A ramp whose high side is south (+Z), as a Cw0 slope's is. */
function wedge(): BufferGeometry {
  // tile [0,1] × [0,1] in x and depth (z from −1 to 0), rising from the north edge (z = −1, low)
  // to the south edge (z = 0, high)
  const A = [0, 0, -1];
  const B = [1, 0, -1];
  const C = [1, 1, 0];
  const D = [0, 1, 0];
  const E = [0, 0, 0];
  const F = [1, 0, 0];
  const p = [
    ...A, ...C, ...B, ...A, ...D, ...C, // the ramp, facing up and north
    ...E, ...F, ...C, ...E, ...C, ...D, // the high (south) face
    ...A, ...E, ...D, // west
    ...B, ...C, ...F, // east
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

const G = {
  pineCrown: () => translated(new ConeGeometry(0.34, 1.05, 6, 1, true), 0, 0.78, 0),
  trunk: () => translated(new CylinderGeometry(0.06, 0.08, 0.5, 5, 1, true), 0, 0.25, 0),
  birchTrunk: () => translated(new CylinderGeometry(0.05, 0.06, 0.8, 5, 1, true), 0, 0.4, 0),
  birchCrown: () => translated(new IcosahedronGeometry(0.28, 0), 0, 0.85, 0),
  oakCrown: () => translated(new IcosahedronGeometry(0.44, 0), 0, 0.9, 0),
  oakTrunk: () => translated(new CylinderGeometry(0.09, 0.12, 0.6, 5, 1, true), 0, 0.3, 0),
  succulent: () => translated(new ConeGeometry(0.2, 0.55, 5, 1, true), 0, 0.27, 0),
  bush: () => translated(new IcosahedronGeometry(0.27, 0), 0, 0.22, 0),
  column: () => translated(new BoxGeometry(0.78, 1, 0.78), 0, 0.5, 0),
  source: () => translated(new CylinderGeometry(0.34, 0.34, 0.12, 8), 0, 0.06, 0),
  block: () => translated(new BoxGeometry(0.92, 0.92, 0.92), 0, 0.46, 0),
  slope: wedge,
  platform: () => translated(new BoxGeometry(3, 0.25, 3), 0, 0.125, 0),
  tower: () => translated(new BoxGeometry(1.2, 1.7, 1.2), 0, 1.1, 0),
  door: () => translated(new BoxGeometry(0.5, 0.5, 0.5), 0, 0.25, 0),
};

/** The parts of each modelled template (fresh geometries per build: a build disposes its own). */
const MODELS: Record<string, () => Part[]> = {
  Pine: () => [
    { geo: G.trunk(), color: 0x5b4330, dead: 0x6a5a48 },
    { geo: G.pineCrown(), color: 0x2f6a3a, dead: 0x7d7160 },
  ],
  Birch: () => [
    { geo: G.birchTrunk(), color: 0xe8e2d4, dead: 0xb8b0a0 },
    { geo: G.birchCrown(), color: 0x7cb04e, dead: 0x8e8574 },
  ],
  Oak: () => [
    { geo: G.oakTrunk(), color: 0x5a4028, dead: 0x6a5a48 },
    { geo: G.oakCrown(), color: 0x3f7f2c, dead: 0x7a705c },
  ],
  Succulent: () => [{ geo: G.succulent(), color: 0x9bb35e, dead: 0x9a9278 }],
  BlueberryBush: () => [{ geo: G.bush(), color: 0x4b6e3c }],
  WaterSource: () => [{ geo: G.source(), color: 0x2f64d8 }],
  BadwaterSource: () => [{ geo: G.source(), color: 0x7a4f22 }],
  Slope: () => [{ geo: G.slope(), color: 0x9a8a68 }],
};

const GENERIC_COLORS: [RegExp, number][] = [
  [/^RuinColumn/, 0x8a7e72],
  [/Relic/, 0xc9a54a],
  [/UndergroundRuins/, 0x7d6a5c],
  [/Blockage/, 0x7d7d78],
  [/NaturalDam/, 0x8a6a44],
  [/Thorns/, 0x7a2e2e],
  [/Geothermal/, 0xd07a2a],
  [/Overhang/, 0x9a8a70],
  [/UnstableCore/, 0xb04ac0],
  [/Badtide|Badwater/, 0x6a4a2a],
  [/Aquifer|Seep/, 0x3a6ab0],
  [/Reserve/, 0xa07a4a],
];

function genericColor(template: string): number {
  for (const [re, c] of GENERIC_COLORS) if (re.test(template)) return c;
  return 0x8f8f8f;
}

/** A per-tile hash in [0, 1): jitter that stays the same between redraws. */
function jitter(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Batch {
  part: Part;
  matrices: number[];
  colors: number[];
}

const TREES = new Set(["Pine", "Birch", "Oak", "Succulent", "BlueberryBush"]);

/** Build the objects of a map view as a group of instanced meshes. */
export function buildEntities(v: EntityView, material: ShaderMaterial): { group: Group; instances: number } {
  const batches = new Map<string, Batch[]>();
  const generic = new Map<string, Batch>();
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const up = new Vector3(0, 1, 0);
  const col = new Color();
  const push = (b: Batch, color: number) => {
    b.matrices.push(...m.elements);
    col.setHex(color);
    b.colors.push(col.r, col.g, col.b);
  };
  const batchesOf = (template: string, parts: () => Part[]): Batch[] => {
    let list = batches.get(template);
    if (!list) {
      list = parts().map((part) => ({ part, matrices: [], colors: [] }));
      batches.set(template, list);
    }
    return list;
  };
  const block = (color: number, x: number, y: number, z: number, kind: "block" | "ruin", sy = 1) => {
    let b = generic.get(kind);
    if (!b) {
      b = { part: { geo: kind === "block" ? G.block() : G.column(), color: 0xffffff }, matrices: [], colors: [] };
      generic.set(kind, b);
    }
    p.set(x + 0.5, z, -(y + 0.5));
    q.identity();
    s.set(1, sy, 1);
    m.compose(p, q, s);
    push(b, color);
  };
  let instances = 0;
  for (let k = 0; k < v.count; k++) {
    const template = v.templates[v.template[k]];
    const x = v.x[k];
    const y = v.y[k];
    const z = v.z[k];
    const o = ORIENTATION_NAMES[v.orientation[k]] as Orientation;
    const flags = v.flags[k];
    const model = MODELS[template];
    if (model) {
      const list = batchesOf(template, model);
      if (TREES.has(template)) {
        const sc = (flags & YOUNG ? 0.5 : 0.85 + 0.3 * jitter(x, y, 1)) * (flags & DEAD ? 0.9 : 1);
        p.set(x + 0.5 + (jitter(x, y, 2) - 0.5) * 0.3, z, -(y + 0.5) + (jitter(x, y, 3) - 0.5) * 0.3);
        q.setFromAxisAngle(up, jitter(x, y, 4) * Math.PI * 2);
        s.set(sc, sc, sc);
      } else if (template === "Slope") {
        // the wedge's tile spans x…x+1 and z −1…0: shift it so it rotates about the tile centre
        p.set(x + 0.5, z, -(y + 0.5));
        q.setFromAxisAngle(up, (-Math.PI / 2) * v.orientation[k]);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        m.multiply(new Matrix4().makeTranslation(-0.5, 0, 0.5));
        for (const b of list) push(b, flags & DEAD && b.part.dead ? b.part.dead : b.part.color);
        instances++;
        continue;
      } else {
        p.set(x + 0.5, z, -(y + 0.5));
        q.identity();
        s.set(1, 1, 1);
      }
      m.compose(p, q, s);
      for (const b of list) push(b, flags & DEAD && b.part.dead ? b.part.dead : b.part.color);
      instances++;
      continue;
    }
    const ruin = /^RuinColumnH(\d)$/.exec(template);
    if (ruin) {
      block(genericColor(template), x, y, z, "ruin", Number(ruin[1]));
      instances++;
      continue;
    }
    if (template === "StartingLocation") {
      const list = batchesOf(template, () => [
        { geo: G.platform(), color: 0x8a5a36 },
        { geo: G.tower(), color: 0xc08a4e },
      ]);
      // the 3×3 footprint's centre: Coordinates plus the rotated local (1, 1)
      const [dx, dy] = rotate(o, 1, 1);
      p.set(x + dx + 0.5, z, -(y + dy + 0.5));
      q.identity();
      s.set(1, 1, 1);
      m.compose(p, q, s);
      for (const b of list) push(b, b.part.color);
      const door = batchesOf("StartingLocation.door", () => [{ geo: G.door(), color: 0xf2d27a }]);
      const [ex, ey] = startEntranceTile(x, y, o);
      p.set(ex + 0.5, z, -(ey + 0.5));
      m.compose(p, q, s);
      push(door[0], door[0].part.color);
      instances++;
      continue;
    }
    // anything else: a box on every block its footprint occupies
    const fp = FOOTPRINTS[template];
    const color = genericColor(template);
    if (fp) {
      for (const bl of worldBlocks(fp, { template, x, y, z, orientation: o, flipped: !!(flags & FLIPPED) })) block(color, bl.x, bl.y, bl.z, "block");
    } else block(color, x, y, z, "block");
    instances++;
  }
  const group = new Group();
  const add = (b: Batch) => {
    const n = b.colors.length / 3;
    if (!n) return;
    const mesh = new InstancedMesh(b.part.geo, material, n);
    mesh.instanceMatrix.array.set(b.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < n; i++) mesh.setColorAt(i, col.setRGB(b.colors[i * 3], b.colors[i * 3 + 1], b.colors[i * 3 + 2]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };
  for (const list of batches.values()) for (const b of list) add(b);
  for (const b of generic.values()) add(b);
  return { group, instances };
}

export function disposeGroup(g: Group): void {
  for (const c of g.children) {
    const mesh = c as InstancedMesh;
    mesh.geometry.dispose();
    mesh.dispose();
  }
  g.clear();
}
