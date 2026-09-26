// Juice on the land (PLAN §20 D205 (2)): small, quick effects where an edit lands, like Townscaper's
// and Dorfromantik's. A puff of dust where ground is lowered, rings spreading where a source starts;
// a placed object's pop and wiggle is the renderer's (`wiggle`, it moves the object itself). Each
// lasts under a second, costs a draw call or two, and never waits on anything. The renderer leaves
// them out with reduced motion, and in software rendering.

import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, Points, PointsMaterial, RingGeometry, type Object3D, type Scene } from "three";
import { JUICE, type Rgb } from "./palette";

interface Live {
  obj: Object3D;
  t0: number;
  ms: number;
  /** The effect at t (0–1 of its life). */
  step(t: number): void;
  dispose(): void;
}

/** A soft round dot, for the dust. */
function dotTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.5, "rgba(255,255,255,0.6)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

export class Effects {
  private live: Live[] = [];
  private frame = 0;
  private dot: CanvasTexture | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly render: () => void,
  ) {}

  /** A puff of dust at tile (x, y), on the ground at `z`: `size` tiles across. */
  puff(x: number, y: number, z: number, size: number, color: Rgb = JUICE.dust): void {
    this.dot ??= dotTexture();
    const n = Math.round(10 + Math.min(14, size * 2));
    const pos = new Float32Array(n * 3);
    const from = new Float32Array(n * 3);
    const to = new Float32Array(n * 3);
    // (a fixed pattern of directions: the same puff every time)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (k % 3) * 0.7;
      const r0 = 0.15 * size * ((k % 4) / 4);
      const r1 = (0.35 + 0.25 * ((k * 7) % 5) / 5) * Math.max(1.2, size);
      from.set([x + 0.5 + Math.cos(a) * r0, z + 0.1, -(y + 0.5) + Math.sin(a) * r0], k * 3);
      to.set([x + 0.5 + Math.cos(a) * r1, z + 0.5 + 0.5 * ((k * 3) % 4) / 4, -(y + 0.5) + Math.sin(a) * r1], k * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({ color: `rgb(${color.map((v) => Math.round(v * 255)).join(",")})`, size: 0.5, sizeAttenuation: true, transparent: true, depthWrite: false, ...(this.dot ? { map: this.dot, alphaMap: this.dot } : {}) });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    this.add({
      obj: pts,
      t0: performance.now(),
      ms: 650,
      step: (t) => {
        const e = 1 - (1 - t) ** 3;
        for (let k = 0; k < n * 3; k++) pos[k] = from[k] + (to[k] - from[k]) * e;
        geo.attributes.position.needsUpdate = true;
        mat.size = 0.45 + 0.8 * e;
        mat.opacity = 0.75 * (1 - t) ** 1.5;
      },
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    });
  }

  /** Rings spreading on the water at tile (x, y), at the level `z` (a source starting). */
  ripple(x: number, y: number, z: number, color: Rgb = JUICE.splash): void {
    for (const delay of [0, 180]) {
      const geo = new RingGeometry(0.86, 1, 40);
      geo.rotateX(-Math.PI / 2);
      const mat = new MeshBasicMaterial({ color: `rgb(${color.map((v) => Math.round(v * 255)).join(",")})`, transparent: true, depthWrite: false, side: DoubleSide });
      const ring = new Mesh(geo, mat);
      ring.position.set(x + 0.5, z + 0.05, -(y + 0.5));
      ring.renderOrder = 5;
      ring.visible = false;
      this.add({
        obj: ring,
        t0: performance.now() + delay,
        ms: 800,
        step: (t) => {
          ring.visible = t > 0;
          const s = 0.3 + 2.4 * (1 - (1 - Math.max(0, t)) ** 2);
          ring.scale.set(s, 1, s);
          mat.opacity = 0.8 * (1 - Math.max(0, t));
        },
        dispose: () => {
          geo.dispose();
          mat.dispose();
        },
      });
    }
  }

  private add(l: Live): void {
    this.scene.add(l.obj);
    this.live.push(l);
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    this.frame = 0;
    const now = performance.now();
    this.live = this.live.filter((l) => {
      const t = (now - l.t0) / l.ms;
      if (t >= 1) {
        this.scene.remove(l.obj);
        l.dispose();
        return false;
      }
      // (a ring that waits its turn gets a t below 0)
      l.step(t);
      return true;
    });
    this.render();
    if (this.live.length) this.frame = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const l of this.live) {
      this.scene.remove(l.obj);
      l.dispose();
    }
    this.live = [];
    this.dot?.dispose();
  }
}
