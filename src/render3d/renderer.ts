// The one 3D renderer (PLAN §3, EDITOR_PLAN §8), used by the generator's 3D preview and by the
// editor. It draws a map view: terrain in 32×32 chunks (only dirty chunks are remeshed after an
// edit), a voxel mesher for columns with caves or overhangs, translucent water surfaces, and
// instanced objects. It has an orbit camera and a top-down view (north up), picks tiles against
// the heightfield, and renders when something changed, and while water moves.
//
// Map look (D86): the ground is coloured by soil (or by height, `setGroundMode`); the light is
// baked when the mesh is built (light.ts: sky visibility, soft sun shadows) into two textures the
// shaders read with the per-tile overlay; the default camera looks as the game's does, 30° east of
// north and 70° down. The water's surface moves (at 30 frames a second at most) unless the viewer
// prefers reduced motion, the browser renders in software, or the view is hidden. A browser that
// renders in software gets a lighter look: no multisampling, no patterns or shadows, soil without
// blending.
//
// Controls: left drag orbits (pans in the top-down view), right drag pans, the wheel zooms. On the
// focused canvas: W A S D or the arrows pan, Q and E turn, R and F (or + and −) zoom.

import {
  BufferGeometry,
  BufferAttribute,
  Color,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type DataTexture,
  type Group,
  type ShaderMaterial,
  type WebGLRenderTarget,
  LinearSRGBColorSpace,
  ColorManagement,
} from "three";
import { buildEntities, disposeGroup } from "./entities3d";
import { objectCasters, shadowMap, skyVisibility, tileData } from "./light";
import { drawPatterns, lightTexture, overlayTexture, objectMaterial, sceneUniforms, terrainMaterial, tileTexture, waterMaterial, type SceneUniforms } from "./materials";
import { changedRect, chunkCount, dirtyChunks, meshChunk, CHUNK, type TerrainSource } from "./mesh";
import { columnMap, surfaceWater, type EntityView, type MapView, type SoilView, type SurfaceWater, type WaterView } from "./model";
import type { GroundMode } from "./palette";
import { pickHeightfield, pickPlane, type Ray, type TileHit } from "./pick";
import { changedWaterChunks, lowerByTile, meshWaterChunk } from "./waterMesh";

ColorManagement.enabled = false;

export type ViewMode = "orbit" | "top";

export interface ViewState {
  mode: ViewMode;
  /** Turn around the target: 0 looks north. */
  yaw: number;
  /** Angle above the horizon. */
  pitch: number;
  distance: number;
  target: [number, number, number];
}

export interface BuildStats {
  /** Meshing and upload, to the first frame drawn. */
  ms: number;
  meshMs: number;
  chunks: number;
  terrainQuads: number;
  waterQuads: number;
  instances: number;
}

export interface FrameStats {
  frames: number;
  seconds: number;
  fps: number;
  /** Time between frames (ms): median, 95th and 99th percentile, worst. */
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames that took longer than 1/60 s. */
  over60: number;
  /** CPU time of one render call (ms), median and 95th percentile. */
  cpuP50: number;
  cpuP95: number;
  /** GPU time per frame (ms) from timer queries, when the browser offers them. */
  gpuP50: number | null;
  gpuP95: number | null;
}

/** A tool that takes left-button drags over the map (the editor's handles and drawing tools). */
export interface PointerTool {
  /** Return true to take this drag. */
  down(hit: TileHit | null, ev: PointerEvent): boolean;
  move(hit: TileHit | null, ev: PointerEvent): void;
  up(hit: TileHit | null, ev: PointerEvent): void;
}

interface MapState {
  W: number;
  H: number;
  heights: Uint8Array;
  source: TerrainSource;
  water: WaterView;
  surface: SurfaceWater;
  entities: EntityView;
  soil: SoilView | null;
  /** Baked: sky visibility per tile, and the terrain shader's tile data. */
  sky: Uint8Array;
  tiles: Uint8Array;
}

const PITCH_MIN = 0.18;
const PITCH_MAX = 1.5;
/** The game's default camera: turned 30° east of north, 70° down (Map look, D86). */
export const DEFAULT_YAW = -Math.PI / 6;
export const DEFAULT_PITCH = (70 * Math.PI) / 180;
/** Frames a second of the water's movement when nothing else asks for a frame. */
const WATER_FPS = 30;

/** Whether the browser draws WebGL in software (no GPU, or one it won't use): asked of a throwaway
 *  context before the view's own is made, so the view can be made lighter for it. */
export function softwareRendering(): boolean {
  try {
    const c = document.createElement("canvas");
    const g = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!g) return false;
    const e = g.getExtension("WEBGL_debug_renderer_info");
    const name = String(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    g.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|Software|Basic Render/i.test(name);
  } catch {
    return false;
  }
}

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderer;
  private scene = new Scene();
  private persp = new PerspectiveCamera(40, 1, 0.5, 4000);
  private ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  private raycaster = new Raycaster();
  private view: ViewState = { mode: "orbit", yaw: 0, pitch: 0.9, distance: 200, target: [0, 0, 0] };
  private map: MapState | null = null;
  private terrain = new Map<string, Mesh>();
  private water = new Map<string, Mesh>();
  private objects: Group | null = null;
  private overlay: DataTexture | null = null;
  private tileTex: DataTexture | null = null;
  private lightTex: DataTexture | null = null;
  private uniforms: SceneUniforms;
  private patterns: WebGLRenderTarget;
  private terrainMat: ShaderMaterial;
  private waterMat: ShaderMaterial;
  private objectMat: ShaderMaterial;
  private ground: GroundMode = "moisture";
  /** A fixed moment of the water's movement (captures, tests), or null: it moves. */
  private clock: number | null = null;
  private readonly t0 = performance.now();
  private animTimer = 0;
  private software = false;
  private reducedMotion = false;
  private inView = true;
  private seen: IntersectionObserver | null = null;
  private lastViewKey = "";
  private frame = 0;
  private resize: ResizeObserver;
  private disposed = false;
  private drag: { kind: "orbit" | "pan" | "tool"; x: number; y: number; id: number; moved: number; button: number } | null = null;
  private listeners: [string, EventListener, AddEventListenerOptions?][] = [];
  private cpuTimes: number[] = [];
  private timer: { ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }; pending: { q: WebGLQuery }[]; times: number[] } | null = null;
  private recording = false;
  tool: PointerTool | null = null;
  onView: ((v: ViewState) => void) | null = null;
  onHover: ((hit: TileHit | null) => void) | null = null;
  /** A left click (a press and release without dragging) on the map. */
  onClick: ((hit: TileHit | null, ev: PointerEvent) => void) | null = null;
  lastBuild: BuildStats | null = null;

  constructor(canvas: HTMLCanvasElement, background = 0xe9dfc8) {
    this.canvas = canvas;
    // a browser that draws in software gets the light look, without multisampling (D110)
    this.software = softwareRendering();
    this.gl = new WebGLRenderer({ canvas, antialias: !this.software, powerPreference: "high-performance" });
    this.gl.outputColorSpace = LinearSRGBColorSpace;
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.setClearColor(new Color(background));
    this.scene.background = null;
    // placeholder textures until a map arrives; every material shares these uniforms
    const one = () => tileTexture(1, 1, new Uint8Array(4));
    this.uniforms = sceneUniforms(1, 1, one(), lightTexture(1, 1, new Uint8Array(16)), one());
    this.patterns = drawPatterns(this.gl);
    this.uniforms.patternTex.value = this.patterns.texture;
    this.terrainMat = terrainMaterial(this.uniforms, 0, 1, this.software);
    this.waterMat = waterMaterial(this.uniforms, this.software);
    this.objectMat = objectMaterial(this.uniforms, this.software);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reducedMotion = !!motion?.matches;
    motion?.addEventListener?.("change", () => {
      this.reducedMotion = motion.matches;
      this.requestRender();
    });
    if (typeof IntersectionObserver !== "undefined") {
      this.seen = new IntersectionObserver((entries) => {
        this.inView = entries.some((e) => e.isIntersecting);
        this.requestRender();
      });
      this.seen.observe(canvas);
    }
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();
    this.bindInput();
  }

  /** WebGL context info: the GPU the browser uses (for the benchmark report). */
  gpu(): { renderer: string; vendor: string } {
    const ctx = this.gl.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)),
      vendor: String(ext ? ctx.getParameter(ext.UNMASKED_VENDOR_WEBGL) : ctx.getParameter(ctx.VENDOR)),
    };
  }

  setBackground(color: number): void {
    this.gl.setClearColor(new Color(color));
    this.requestRender();
  }

  /** What colours the ground's tops: soil (as in the game) or height. */
  setGroundMode(mode: GroundMode): void {
    this.ground = mode;
    (this.terrainMat.uniforms.groundMode as { value: number }).value = mode === "height" ? 1 : 0;
    this.requestRender();
  }

  get groundMode(): GroundMode {
    return this.ground;
  }

  /** Hold the water's movement at a moment (seconds), or let it move again (null). */
  setClock(t: number | null): void {
    this.clock = t;
    this.requestRender();
  }

  /** Whether the water moves on screen now. */
  get animated(): boolean {
    const m = this.map;
    return !!m && m.water.count > 0 && this.clock === null && !this.recording && !this.reducedMotion && !this.software && this.inView && !document.hidden;
  }

  // ------------------------------------------------------------------------------ map building

  /** Build everything for a new map and draw the first frame. */
  setMap(v: MapView, keepView = false): BuildStats {
    const t0 = performance.now();
    this.clearMap();
    const { W, H, heights } = v;
    const source: TerrainSource = { W, H, heights, columns: columnMap(v.columns) };
    const surface = surfaceWater(W, H, v.water);
    const sky = skyVisibility(W, H, heights);
    const soil = v.soil ?? null;
    const tiles = tileData(W, H, heights, sky, soil, surface);
    this.map = { W, H, heights, source, water: v.water, surface, entities: v.entities, soil, sky, tiles };
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] < lo) lo = heights[i];
      if (heights[i] > hi) hi = heights[i];
    }
    this.overlay = overlayTexture(W, H);
    this.tileTex = tileTexture(W, H, tiles);
    this.lightTex = lightTexture(W, H, shadowMap(W, H, heights, objectCasters(W, H, v.entities)));
    const u = this.uniforms;
    u.overlay.value = this.overlay;
    u.tileTex.value = this.tileTex;
    u.lightTex.value = this.lightTex;
    u.mapSize.value.set(W, H);
    (this.terrainMat.uniforms.heightRange.value as Vector2).set(lo, hi);
    const { nx, ny } = chunkCount(W, H);
    let terrainQuads = 0;
    for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) terrainQuads += this.meshTerrain(cx, cy);
    const waterQuads = this.meshAllWater();
    const instances = this.setEntitiesInner(v.entities);
    const meshMs = performance.now() - t0;
    if (!keepView) this.resetView();
    this.renderNow();
    // wait for the GPU to finish the first frame
    const ctx = this.gl.getContext();
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(4));
    const ms = performance.now() - t0;
    this.lastBuild = { ms, meshMs, chunks: nx * ny, terrainQuads, waterQuads, instances };
    return this.lastBuild;
  }

  private clearMap(): void {
    for (const m of this.terrain.values()) this.dropMesh(m);
    for (const m of this.water.values()) this.dropMesh(m);
    this.terrain.clear();
    this.water.clear();
    if (this.objects) {
      this.scene.remove(this.objects);
      disposeGroup(this.objects);
      this.objects = null;
    }
    this.overlay?.dispose();
    this.tileTex?.dispose();
    this.lightTex?.dispose();
    this.overlay = this.tileTex = this.lightTex = null;
    this.map = null;
  }

  private dropMesh(m: Mesh): void {
    this.scene.remove(m);
    m.geometry.dispose();
  }

  private meshTerrain(cx: number, cy: number): number {
    const key = `${cx},${cy}`;
    const old = this.terrain.get(key);
    if (old) this.dropMesh(old);
    this.terrain.delete(key);
    const d = meshChunk(this.map!.source, cx, cy);
    if (!d.quads) return 0;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(d.positions, 3));
    g.setAttribute("normal", new BufferAttribute(d.normals, 3, true));
    g.setIndex(new BufferAttribute(d.indices, 1));
    g.computeBoundingSphere();
    const mesh = new Mesh(g, this.terrainMat);
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    this.terrain.set(key, mesh);
    return d.quads;
  }

  private meshWater(cx: number, cy: number, lower: Map<number, number[]> | null): number {
    const key = `${cx},${cy}`;
    const old = this.water.get(key);
    if (old) this.dropMesh(old);
    this.water.delete(key);
    const m = this.map!;
    const d = meshWaterChunk(m.W, m.H, m.heights, m.surface, m.water, lower, cx, cy);
    if (!d.quads) return 0;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(d.positions, 3));
    g.setAttribute("normal", new BufferAttribute(d.normals, 3, true));
    g.setAttribute("wdata", new BufferAttribute(d.data, 2));
    g.setAttribute("wflags", new BufferAttribute(d.flags, 1));
    g.setIndex(new BufferAttribute(d.indices, 1));
    g.computeBoundingSphere();
    const mesh = new Mesh(g, this.waterMat);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.water.set(key, mesh);
    return d.quads;
  }

  private meshAllWater(): number {
    const m = this.map!;
    const lower = lowerByTile(m.surface, m.water);
    const { nx, ny } = chunkCount(m.W, m.H);
    let quads = 0;
    for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) quads += this.meshWater(cx, cy, lower);
    return quads;
  }

  /** Bake the sun's shadows again (the ground or the objects that cast them changed). */
  private bakeShadows(): void {
    const m = this.map;
    if (!m || !this.lightTex) return;
    const data = shadowMap(m.W, m.H, m.heights, objectCasters(m.W, m.H, m.entities));
    (this.lightTex.image.data as Uint8Array).set(data);
    this.lightTex.needsUpdate = true;
  }

  /** The terrain shader's tile data again (heights, soil, sky, water). */
  private bakeTiles(): void {
    const m = this.map;
    if (!m || !this.tileTex) return;
    tileData(m.W, m.H, m.heights, m.sky, m.soil, m.surface, m.tiles);
    this.tileTex.needsUpdate = true;
  }

  private setEntitiesInner(e: EntityView): number {
    if (this.objects) {
      this.scene.remove(this.objects);
      disposeGroup(this.objects);
    }
    const { group, instances } = buildEntities(e, this.objectMat, this.map?.soil ?? null, this.map?.W ?? 0);
    group.renderOrder = 1;
    this.objects = group;
    this.scene.add(group);
    this.map!.entities = e;
    return instances;
  }

  /** New terrain heights: remesh the chunks the change touches. Returns how many were remeshed. */
  updateTerrain(heights: Uint8Array): number {
    const m = this.map;
    if (!m) return 0;
    const rect = changedRect(m.W, m.H, m.heights, heights);
    m.heights = heights;
    m.source = { ...m.source, heights };
    if (!rect) return 0;
    const chunks = dirtyChunks(m.W, m.H, rect);
    for (const [cx, cy] of chunks) this.meshTerrain(cx, cy);
    // the light: the sky each tile sees, the tile data, the shadows; and the water's shores there
    m.sky = skyVisibility(m.W, m.H, heights);
    this.bakeTiles();
    this.bakeShadows();
    if (m.water.count) {
      const lower = lowerByTile(m.surface, m.water);
      for (const [cx, cy] of chunks) this.meshWater(cx, cy, lower);
    }
    this.requestRender();
    return chunks.length;
  }

  /** New water: remesh the chunks whose water changed. */
  updateWater(water: WaterView): number {
    const m = this.map;
    if (!m) return 0;
    const surface = surfaceWater(m.W, m.H, water);
    const changed = changedWaterChunks(m.W, m.H, m.surface, surface, m.surface.lower.length, surface.lower.length);
    m.water = water;
    m.surface = surface;
    const lower = lowerByTile(surface, water);
    for (const key of changed) {
      const [cx, cy] = key.split(",").map(Number);
      this.meshWater(cx, cy, lower);
    }
    this.bakeTiles();
    this.requestRender();
    return changed.size;
  }

  /** New soil (moisture and contamination follow the water): the ground's colours. */
  updateSoil(soil: SoilView): void {
    const m = this.map;
    if (!m) return;
    m.soil = soil;
    this.bakeTiles();
    this.requestRender();
  }

  updateEntities(e: EntityView): void {
    if (!this.map) return;
    this.setEntitiesInner(e);
    this.bakeShadows();
    this.requestRender();
  }

  /** Remesh every terrain chunk the renderer would touch for the tiles in rect (tests). */
  remeshRect(rect: { x0: number; y0: number; x1: number; y1: number }): number {
    const m = this.map;
    if (!m) return 0;
    const chunks = dirtyChunks(m.W, m.H, rect);
    for (const [cx, cy] of chunks) this.meshTerrain(cx, cy);
    this.requestRender();
    return chunks.length;
  }

  // --------------------------------------------------------------------------------- overlays

  /** The overlay's RGBA bytes (tile (x, y) at (y·W + x)·4): write, then `commitOverlay`. */
  overlayData(): Uint8Array | null {
    return (this.overlay?.image.data as Uint8Array | undefined) ?? null;
  }

  commitOverlay(): void {
    if (!this.overlay) return;
    this.overlay.needsUpdate = true;
    this.requestRender();
  }

  setHoverTile(x: number | null, y = 0): void {
    const u = this.terrainMat.uniforms.hover;
    const v = u.value as Vector3;
    if (x === null) {
      if (v.z === 0) return;
      v.set(0, 0, 0);
    } else {
      if (v.z === 1 && v.x === x && v.y === y) return;
      v.set(x, y, 1);
    }
    this.requestRender();
  }

  // ---------------------------------------------------------------------------------- camera

  getView(): ViewState {
    return { ...this.view, target: [...this.view.target] as [number, number, number] };
  }

  setView(v: Partial<ViewState>): void {
    this.view = { ...this.view, ...v };
    this.view.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.view.pitch));
    this.requestRender();
  }

  setMode(mode: ViewMode): void {
    this.setView({ mode });
  }

  resetView(): void {
    const m = this.map;
    if (!m) return;
    let sum = 0;
    for (let i = 0; i < m.heights.length; i++) sum += m.heights[i];
    const mean = sum / m.heights.length;
    const span = Math.max(m.W, m.H);
    this.view = { ...this.view, yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, distance: span * 1.6, target: [m.W / 2, mean, -m.H / 2] };
    this.requestRender();
  }

  private camera(): PerspectiveCamera | OrthographicCamera {
    return this.view.mode === "top" ? this.ortho : this.persp;
  }

  private placeCamera(): void {
    const v = this.view;
    const [tx, ty, tz] = v.target;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const aspect = w / h;
    if (v.mode === "top") {
      const half = v.distance * 0.42;
      this.ortho.left = -half * aspect;
      this.ortho.right = half * aspect;
      this.ortho.top = half;
      this.ortho.bottom = -half;
      this.ortho.position.set(tx, 200, tz);
      this.ortho.up.set(0, 0, -1);
      this.ortho.lookAt(tx, 0, tz);
      this.ortho.updateProjectionMatrix();
    } else {
      const cp = Math.cos(v.pitch);
      this.persp.aspect = aspect;
      this.persp.position.set(tx + Math.sin(v.yaw) * cp * v.distance, ty + Math.sin(v.pitch) * v.distance, tz + Math.cos(v.yaw) * cp * v.distance);
      this.persp.up.set(0, 1, 0);
      this.persp.lookAt(tx, ty, tz);
      this.persp.far = v.distance * 4 + 1000;
      this.persp.updateProjectionMatrix();
    }
    // a light haze beyond the point looked at, none from straight above
    const u = this.uniforms;
    u.hazeAmount.value = v.mode === "top" ? 0 : 0.32;
    u.hazeRange.value.set(v.distance * 0.85, v.distance * 2.6);
  }

  // --------------------------------------------------------------------------------- rendering

  requestRender(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderNow();
    });
  }

  renderNow(): void {
    if (this.disposed) return;
    this.placeCamera();
    this.uniforms.time.value = this.clock ?? (performance.now() - this.t0) / 1000;
    const t0 = performance.now();
    const q = this.beginGpuTimer();
    this.gl.render(this.scene, this.camera());
    this.endGpuTimer(q);
    if (this.recording) this.cpuTimes.push(performance.now() - t0);
    // tell the page only when the view moved (the water's frames do not)
    const v = this.view;
    const key = `${v.mode} ${v.yaw} ${v.pitch} ${v.distance} ${v.target.join(" ")} ${this.canvas.clientWidth}x${this.canvas.clientHeight}`;
    if (key !== this.lastViewKey) {
      this.lastViewKey = key;
      this.onView?.(this.getView());
    }
    if (this.animated && !this.animTimer) {
      this.animTimer = window.setTimeout(() => {
        this.animTimer = 0;
        this.requestRender();
      }, 1000 / WATER_FPS);
    }
  }

  private fit(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.gl.setSize(w, h, false);
    this.requestRender();
  }

  // -------------------------------------------------------------------------------- picking

  rayAt(clientX: number, clientY: number): Ray {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.placeCamera();
    this.raycaster.setFromCamera(ndc, this.camera());
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    return { origin: [o.x, o.y, o.z], direction: [d.x, d.y, d.z] };
  }

  /** The tile under a point on the screen. */
  pick(clientX: number, clientY: number): TileHit | null {
    const m = this.map;
    if (!m) return null;
    return pickHeightfield(this.rayAt(clientX, clientY), m.W, m.H, m.heights);
  }

  /** The tile under a point on the screen, on a level plane (steady while dragging). */
  pickAtLevel(clientX: number, clientY: number, level: number): { x: number; y: number } | null {
    return pickPlane(this.rayAt(clientX, clientY), level);
  }

  /** Screen position (CSS px, relative to the canvas) of a world point, and whether it is in view. */
  project(X: number, Y: number, Z: number): { x: number; y: number; visible: boolean } {
    this.placeCamera();
    const v = new Vector3(X, Y, Z).project(this.camera());
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
  }

  /** Client coordinates of a tile's top centre (tests drive the pointer with it). */
  tileToClient(x: number, y: number): { x: number; y: number; visible: boolean } {
    const m = this.map;
    const h = m ? m.heights[y * m.W + x] : 0;
    const p = this.project(x + 0.5, h, -(y + 0.5));
    const r = this.canvas.getBoundingClientRect();
    return { x: p.x + r.left, y: p.y + r.top, visible: p.visible };
  }

  heightAt(x: number, y: number): number {
    const m = this.map;
    return m && x >= 0 && y >= 0 && x < m.W && y < m.H ? m.heights[y * m.W + x] : 0;
  }

  get size(): { W: number; H: number } | null {
    return this.map ? { W: this.map.W, H: this.map.H } : null;
  }

  // ---------------------------------------------------------------------------------- input

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.listeners.push([type, fn, opts]);
  }

  private bindInput(): void {
    const c = this.canvas;
    c.tabIndex = 0;
    this.on(c, "contextmenu", (e) => e.preventDefault());
    this.on(c, "pointerdown", (e) => {
      const ev = e as PointerEvent;
      c.focus({ preventScroll: true });
      if (ev.button === 0 && this.tool) {
        const hit = this.pick(ev.clientX, ev.clientY);
        if (this.tool.down(hit, ev)) {
          this.drag = { kind: "tool", x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: 0, button: 0 };
          c.setPointerCapture(ev.pointerId);
          return;
        }
      }
      const kind = ev.button === 2 || ev.button === 1 || ev.shiftKey || this.view.mode === "top" ? "pan" : "orbit";
      this.drag = { kind: ev.button === 1 && this.view.mode === "orbit" ? "orbit" : kind, x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: 0, button: ev.button };
      c.setPointerCapture(ev.pointerId);
    });
    this.on(c, "pointermove", (e) => {
      const ev = e as PointerEvent;
      const d = this.drag;
      if (d && d.id === ev.pointerId) {
        const dx = ev.clientX - d.x;
        const dy = ev.clientY - d.y;
        d.x = ev.clientX;
        d.y = ev.clientY;
        d.moved += Math.abs(dx) + Math.abs(dy);
        if (d.kind !== "tool" && d.moved < 4) return;
        if (d.kind === "tool") this.tool?.move(this.pick(ev.clientX, ev.clientY), ev);
        else if (d.kind === "orbit") this.setView({ yaw: this.view.yaw - dx * 0.006, pitch: this.view.pitch + dy * 0.005 });
        else this.panPixels(dx, dy);
        return;
      }
      const hit = this.pick(ev.clientX, ev.clientY);
      this.setHoverTile(hit ? hit.x : null, hit?.y ?? 0);
      this.onHover?.(hit);
    });
    const end = (e: Event) => {
      const ev = e as PointerEvent;
      const d = this.drag;
      if (!d || d.id !== ev.pointerId) return;
      this.drag = null;
      if (c.hasPointerCapture(ev.pointerId)) c.releasePointerCapture(ev.pointerId);
      if (d.kind === "tool") this.tool?.up(this.pick(ev.clientX, ev.clientY), ev);
      else if (d.button === 0 && d.moved < 4 && ev.type === "pointerup") this.onClick?.(this.pick(ev.clientX, ev.clientY), ev);
    };
    this.on(c, "pointerup", end);
    this.on(c, "pointercancel", end);
    this.on(c, "pointerleave", () => {
      if (this.drag) return;
      this.setHoverTile(null);
      this.onHover?.(null);
    });
    this.on(
      c,
      "wheel",
      (e) => {
        const ev = e as WheelEvent;
        ev.preventDefault();
        this.zoom(Math.exp(ev.deltaY * 0.0012));
      },
      { passive: false },
    );
    this.on(c, "keydown", (e) => {
      const ev = e as KeyboardEvent;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      const step = 24;
      let used = true;
      if (k === "w" || k === "arrowup") this.panPixels(0, step);
      else if (k === "s" || k === "arrowdown") this.panPixels(0, -step);
      else if (k === "a" || k === "arrowleft") this.panPixels(step, 0);
      else if (k === "d" || k === "arrowright") this.panPixels(-step, 0);
      else if (k === "q" && this.view.mode === "orbit") this.setView({ yaw: this.view.yaw + 0.12 });
      else if (k === "e" && this.view.mode === "orbit") this.setView({ yaw: this.view.yaw - 0.12 });
      else if (k === "r" || k === "+" || k === "=") this.zoom(1 / 1.15);
      else if (k === "f" || k === "-") this.zoom(1.15);
      else used = false;
      if (used) ev.preventDefault();
    });
  }

  zoom(factor: number): void {
    const m = this.map;
    const span = m ? Math.max(m.W, m.H) : 256;
    this.setView({ distance: Math.min(span * 3, Math.max(6, this.view.distance * factor)) });
  }

  /** Move the view as if the map were dragged by (dx, dy) pixels. */
  panPixels(dx: number, dy: number): void {
    const v = this.view;
    const h = this.canvas.clientHeight || 1;
    const perPixel = v.mode === "top" ? (v.distance * 0.84) / h : (v.distance * 0.75) / h;
    const yaw = v.mode === "top" ? 0 : v.yaw;
    // screen right and screen up, on the ground
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const [tx, ty, tz] = v.target;
    const m = this.map;
    let nx = tx - rx * dx * perPixel + fx * dy * perPixel;
    let nz = tz - rz * dx * perPixel + fz * dy * perPixel;
    if (m) {
      nx = Math.min(m.W, Math.max(0, nx));
      nz = Math.min(0, Math.max(-m.H, nz));
    }
    this.setView({ target: [nx, ty, nz] });
  }

  // ------------------------------------------------------------------------------ measuring

  private beginGpuTimer(): WebGLQuery | null {
    if (!this.recording || !this.timer) return null;
    const ctx = this.gl.getContext() as WebGL2RenderingContext;
    const q = ctx.createQuery();
    if (!q) return null;
    ctx.beginQuery(this.timer.ext.TIME_ELAPSED_EXT, q);
    return q;
  }

  private endGpuTimer(q: WebGLQuery | null): void {
    if (!q || !this.timer) return;
    const ctx = this.gl.getContext() as WebGL2RenderingContext;
    ctx.endQuery(this.timer.ext.TIME_ELAPSED_EXT);
    this.timer.pending.push({ q });
    this.collectGpu();
  }

  private collectGpu(): void {
    const t = this.timer;
    if (!t) return;
    const ctx = this.gl.getContext() as WebGL2RenderingContext;
    const disjoint = ctx.getParameter(t.ext.GPU_DISJOINT_EXT);
    while (t.pending.length) {
      const { q } = t.pending[0];
      if (!ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE)) break;
      const ns = ctx.getQueryParameter(q, ctx.QUERY_RESULT) as number;
      if (!disjoint) t.times.push(ns / 1e6);
      ctx.deleteQuery(q);
      t.pending.shift();
    }
  }

  /** Orbit the camera once around the map for `ms` and measure every frame (the fps benchmark). */
  benchOrbit(ms: number, turnMs = 8000): Promise<FrameStats> {
    const ctx = this.gl.getContext() as WebGL2RenderingContext;
    const ext = ctx.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    this.timer = ext ? { ext, pending: [], times: [] } : null;
    this.cpuTimes = [];
    this.recording = true;
    const deltas: number[] = [];
    const yaw0 = this.view.yaw;
    return new Promise((resolve) => {
      let start = 0;
      let last = 0;
      const step = (now: number) => {
        if (!start) {
          start = now;
          last = now;
        } else {
          deltas.push(now - last);
          last = now;
        }
        this.view.yaw = yaw0 + ((now - start) / turnMs) * Math.PI * 2;
        this.renderNow();
        if (now - start < ms) requestAnimationFrame(step);
        else {
          this.recording = false;
          const settle = () => {
            this.collectGpu();
            const pct = (a: number[], p: number) => {
              if (!a.length) return 0;
              const s = [...a].sort((x, y) => x - y);
              return s[Math.min(s.length - 1, Math.floor(p * s.length))];
            };
            const gpu = this.timer?.times ?? [];
            const seconds = (last - start) / 1000;
            resolve({
              frames: deltas.length,
              seconds,
              fps: deltas.length / seconds,
              p50: pct(deltas, 0.5),
              p95: pct(deltas, 0.95),
              p99: pct(deltas, 0.99),
              max: Math.max(...deltas),
              over60: deltas.filter((d) => d > 1000 / 60 + 1).length,
              cpuP50: pct(this.cpuTimes, 0.5),
              cpuP95: pct(this.cpuTimes, 0.95),
              gpuP50: gpu.length ? pct(gpu, 0.5) : null,
              gpuP95: gpu.length ? pct(gpu, 0.95) : null,
            });
            this.timer = null;
          };
          setTimeout(settle, 200);
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** Triangles and draw calls of the last frame. */
  info(): { triangles: number; calls: number; chunks: number; waterChunks: number } {
    return { triangles: this.gl.info.render.triangles, calls: this.gl.info.render.calls, chunks: this.terrain.size, waterChunks: this.water.size };
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    clearTimeout(this.animTimer);
    this.resize.disconnect();
    this.seen?.disconnect();
    for (const [type, fn, opts] of this.listeners) this.canvas.removeEventListener(type, fn, opts);
    this.clearMap();
    this.terrainMat.dispose();
    this.waterMat.dispose();
    this.objectMat.dispose();
    this.patterns.dispose();
    this.gl.dispose();
    // free the context now: browsers keep only a few, and the editor opens a view per map
    this.gl.forceContextLoss();
  }
}

export { CHUNK };
export type { TileHit };
