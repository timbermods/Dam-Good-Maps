// The brush on the map (live editing): a soft disc laid on the terrain under the cursor, as strong
// as the brush's falloff, with a ring at its edge; for flatten, a see-through plane at the level
// it flattens to. It follows the ground's steps, and is rebuilt as the cursor moves (a few thousand
// quads at the largest size, in buffers made once).

import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, type Scene } from "three";

export interface BrushCursorState {
  /** Middle of the brush, in tiles (x east, y north). */
  x: number;
  y: number;
  /** Radius in tiles. */
  radius: number;
  /** Tint: raise warm, lower cool, flatten pale, smooth green, naturalize brown. */
  tool: "raise" | "lower" | "flatten" | "smooth" | "naturalize";
  /** Flatten's level (its plane), or null. */
  level: number | null;
}

const TINT: Record<BrushCursorState["tool"], [number, number, number]> = {
  raise: [1.0, 0.72, 0.3],
  lower: [0.35, 0.65, 1.0],
  flatten: [0.95, 0.95, 0.9],
  smooth: [0.5, 0.95, 0.55],
  naturalize: [0.85, 0.62, 0.38],
};

/** Most quads the disc can take: a 24-tile radius, and the ring. */
const MAX_QUADS = 49 * 49 + 256;

export class BrushCursor {
  readonly mesh: Mesh;
  private readonly plane: Mesh;
  private readonly pos = new Float32Array(MAX_QUADS * 12);
  private readonly col = new Float32Array(MAX_QUADS * 16);
  private readonly geo = new BufferGeometry();
  private readonly planeGeo = new BufferGeometry();

  constructor(scene: Scene) {
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    this.geo.setAttribute("position", new BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new BufferAttribute(this.col, 4));
    this.geo.setIndex(new BufferAttribute(idx, 1));
    const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.planeGeo.setAttribute("position", new BufferAttribute(new Float32Array(12), 3));
    this.planeGeo.setIndex([0, 1, 2, 0, 2, 3]);
    this.plane = new Mesh(this.planeGeo, new MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide }));
    this.plane.frustumCulled = false;
    this.plane.renderOrder = 6;
    this.plane.visible = false;
    scene.add(this.mesh);
    scene.add(this.plane);
  }

  /** Show the brush at `s` on the terrain `heights` (W × H), or hide it (null). */
  set(s: BrushCursorState | null, heights: Uint8Array, W: number, H: number): void {
    if (!s) {
      this.mesh.visible = false;
      this.plane.visible = false;
      return;
    }
    const r = Math.max(0.5, Math.min(24, s.radius));
    const [cr, cg, cb] = TINT[s.tool];
    const pos = this.pos;
    const col = this.col;
    let q = 0;
    const quad = (x0: number, z0: number, x1: number, z1: number, y: number, a: number, c: [number, number, number] = [cr, cg, cb]) => {
      if (q >= MAX_QUADS) return;
      pos.set([x0, y, -z0, x1, y, -z0, x1, y, -z1, x0, y, -z1], q * 12);
      for (let v = 0; v < 4; v++) col.set([c[0], c[1], c[2], a], q * 16 + v * 4);
      q++;
    };
    const tx0 = Math.max(0, Math.floor(s.x - r));
    const tx1 = Math.min(W - 1, Math.floor(s.x + r));
    const ty0 = Math.max(0, Math.floor(s.y - r));
    const ty1 = Math.min(H - 1, Math.floor(s.y + r));
    const R2 = r * r;
    // the soft disc: each tile's top, as strong as the brush presses there
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) {
        const d2 = (x + 0.5 - s.x) ** 2 + (y + 0.5 - s.y) ** 2;
        if (d2 >= R2) continue;
        const f = (1 - d2 / R2) ** 2;
        const h = heights[y * W + x] + 0.03;
        quad(x, y, x + 1, y + 1, h, 0.12 + 0.3 * f);
      }
    // the ring at its edge: short dashes laid on the ground
    const n = Math.max(24, Math.min(256, Math.round(r * 12)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = s.x + Math.cos(a) * r;
      const py = s.y + Math.sin(a) * r;
      const tx = Math.floor(px);
      const ty = Math.floor(py);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const h = heights[ty * W + tx] + 0.05;
      const w = 0.09 + r * 0.004;
      quad(px - w, py - w, px + w, py + w, h, 0.95, [1, 1, 1]);
    }
    this.geo.setDrawRange(0, q * 6);
    (this.geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("color") as BufferAttribute).needsUpdate = true;
    this.mesh.visible = q > 0;
    // flatten: the level it flattens to, as a plane over the brush
    if (s.level !== null) {
      const y = s.level + 0.04;
      const p = this.planeGeo.getAttribute("position") as BufferAttribute;
      (p.array as Float32Array).set([s.x - r, y, -(s.y - r), s.x + r, y, -(s.y - r), s.x + r, y, -(s.y + r), s.x - r, y, -(s.y + r)]);
      p.needsUpdate = true;
      this.plane.visible = true;
    } else this.plane.visible = false;
  }

  dispose(): void {
    this.geo.dispose();
    this.planeGeo.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    (this.plane.material as MeshBasicMaterial).dispose();
  }
}
