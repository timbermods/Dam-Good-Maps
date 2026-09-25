// The mesher's benchmark page: loads a map's voxels and water (?map=name, from ./maps/name.bin),
// builds every chunk, the sky-light texture and the water, renders the first frame, and exposes
// window.bench: the build's timings, an orbit measurement like the product's benchOrbit, and a
// cutaway (a level slice with a cap) for measuring and for pictures.
//
// .bin layout (little-endian): u32 magic 0x33443344, W, H, L, wet count; W·H·L voxel bytes (index
// z·W·H + y·W + x); then per wet column f32 x, y, surface, roofed (0/1).

import {
  BufferAttribute, BufferGeometry, Color, Data3DTexture, DoubleSide, GLSL3, LinearFilter, Mesh, MeshBasicMaterial, PerspectiveCamera,
  RawShaderMaterial, RedFormat, Scene, UnsignedByteType, WebGLRenderer, type Material,
} from "three";
import { VoxelTerrain, meshChunk, capMesh, skyLight, CHUNK, type Mesh as MeshData } from "../mesher";

declare global {
  interface Window {
    bench: {
      ready: boolean;
      error?: string;
      build?: Record<string, number>;
      orbit?: (ms: number, turnMs?: number) => Promise<Record<string, number | null>>;
      setCut?: (level: number | null) => number;
      pose?: (yawDeg: number, pitchDeg: number, dist: number, cut: number | null, target?: [number, number, number]) => void;
      info?: () => { triangles: number; calls: number };
    };
  }
}
window.bench = { ready: false };
const hud = document.getElementById("hud")!;

const VERT = /* glsl */ `
  precision highp float;
  in vec3 position; in vec3 normal;
  uniform mat4 modelViewMatrix, projectionMatrix;
  out vec3 vWorld; out vec3 vNormal;
  void main() { vWorld = position; vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
  precision highp float; precision highp sampler3D;
  in vec3 vWorld; in vec3 vNormal;
  uniform sampler3D uLight; uniform vec3 uSize; uniform float uCut; uniform vec3 uSun;
  out vec4 outColor;
  void main() {
    if (vWorld.y > uCut + 0.001) discard;
    vec3 n = normalize(vNormal);
    // the air cell in front of the face, in voxel texture coordinates (x, y = -Z, z = height)
    vec3 p = vWorld + n * 0.5;
    vec3 t = vec3(p.x / uSize.x, -p.z / uSize.y, p.y / uSize.z);
    float sky = texture(uLight, t).r;
    float h = vWorld.y;
    vec3 top = mix(vec3(0.42, 0.52, 0.27), vec3(0.62, 0.60, 0.50), clamp(h / 22.0, 0.0, 1.0));
    float band = fract(h) < 0.08 ? 0.82 : 1.0;
    vec3 wall = mix(vec3(0.46, 0.38, 0.30), vec3(0.58, 0.54, 0.48), clamp(h / 22.0, 0.0, 1.0)) * band;
    vec3 under = vec3(0.30, 0.26, 0.23);
    vec3 base = n.y > 0.5 ? top : (n.y < -0.5 ? under : wall);
    float lambert = max(dot(n, normalize(uSun)), 0.0);
    float light = 0.28 + 0.72 * sky * (0.45 + 0.55 * lambert);
    outColor = vec4(base * light, 1.0);
  }`;
const WFRAG = /* glsl */ `
  precision highp float;
  in vec3 vWorld; in vec3 vNormal;
  uniform float uCut;
  out vec4 outColor;
  void main() { if (vWorld.y > uCut + 0.001) discard; outColor = vec4(0.20, 0.45, 0.62, 0.78); }`;

function geometry(m: MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(m.positions, 3));
  g.setAttribute("normal", new BufferAttribute(m.normals, 3, true));
  g.setIndex(new BufferAttribute(m.indices, 1));
  return g;
}

async function main() {
  const name = new URLSearchParams(location.search).get("map") ?? "";
  const res = await fetch(`./maps/${name}.bin`);
  if (!res.ok) throw new Error(`no map ${name}`);
  const buf = await res.arrayBuffer();
  const head = new Uint32Array(buf, 0, 5);
  const [magic, W, H, L, wetCount] = head;
  if (magic !== 0x33443344) throw new Error("bad map file");
  const vox = new Uint8Array(buf, 20, W * H * L);
  const wetOff = 20 + W * H * L;
  const wet = new Float32Array(buf.slice(wetOff, wetOff + wetCount * 16));

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new Scene();
  scene.background = new Color(0x1d1a17);
  const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 4000);

  // ------------------------------------------------------------------ the build, timed
  const t0 = performance.now();
  const terrain = new VoxelTerrain(W, H, L, vox);
  let quads = 0;
  const meshes: MeshData[] = [];
  for (let cy = 0; cy < Math.ceil(H / CHUNK); cy++) for (let cx = 0; cx < Math.ceil(W / CHUNK); cx++) {
    const m = meshChunk(terrain, cx, cy);
    meshes.push(m);
    quads += m.quads;
  }
  const t1 = performance.now();
  const light = skyLight(terrain);
  const t2 = performance.now();
  const tex = new Data3DTexture(light, W, H, L + 1);
  tex.format = RedFormat;
  tex.type = UnsignedByteType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  const uniforms = { uLight: { value: tex }, uSize: { value: [W, H, L + 1] }, uCut: { value: 99 }, uSun: { value: [0.45, 0.8, 0.35] } };
  const mat = new RawShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, glslVersion: GLSL3 });
  for (const m of meshes) if (m.quads) scene.add(new Mesh(geometry(m), mat));
  // water: one quad per wet column at its surface
  const wq = new Float32Array(wetCount * 12);
  const wn = new Int8Array(wetCount * 12);
  for (let k = 0; k < wetCount; k++) {
    const x = wet[4 * k], y = wet[4 * k + 1], s = wet[4 * k + 2];
    const o = k * 12;
    wq.set([x, s, -y, x + 1, s, -y, x + 1, s, -(y + 1), x, s, -(y + 1)], o);
    for (let j = 0; j < 4; j++) wn[o + 3 * j + 1] = 127;
  }
  const widx = new Uint32Array(wetCount * 6);
  for (let k = 0; k < wetCount; k++) widx.set([4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3], 6 * k);
  const wmat = new RawShaderMaterial({ vertexShader: VERT, fragmentShader: WFRAG, uniforms: { uCut: uniforms.uCut }, transparent: true, depthWrite: false, side: DoubleSide, glslVersion: GLSL3 });
  if (wetCount) {
    const wm = new Mesh(geometry({ positions: wq, normals: wn, indices: widx, quads: wetCount }), wmat);
    wm.renderOrder = 2;
    scene.add(wm);
  }
  const t3 = performance.now();

  // camera: the game's default look, 30° east of north and 55° down, framing the map
  const view = { yaw: (30 * Math.PI) / 180, pitch: (55 * Math.PI) / 180, dist: Math.max(W, H) * 1.25, target: [W / 2, 6, -H / 2] as [number, number, number] };
  const aim = () => {
    const [cx, cy, cz] = view.target;
    camera.position.set(cx + Math.sin(view.yaw) * Math.cos(view.pitch) * view.dist, cy + Math.sin(view.pitch) * view.dist, cz + Math.cos(view.yaw) * Math.cos(view.pitch) * view.dist);
    camera.lookAt(cx, cy, cz);
  };
  aim();
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // wait for the GPU
  const t4 = performance.now();
  window.bench.build = { ms: Math.round(t4 - t0), meshMs: Math.round(t1 - t0), lightMs: Math.round(t2 - t1), uploadMs: Math.round(t3 - t2), firstFrameMs: Math.round(t4 - t3), terrainQuads: quads, waterQuads: wetCount, chunks: meshes.length };
  hud.textContent = `${name}: ${W}×${H}, ${quads.toLocaleString()} terrain quads, build ${Math.round(t4 - t0)} ms`;

  // cutaway: a level slice with its cap
  let cap: Mesh | null = null;
  const capMat = new MeshBasicMaterial({ color: 0x8a6f55 });
  window.bench.setCut = (level: number | null) => {
    const c0 = performance.now();
    if (cap) { scene.remove(cap); cap.geometry.dispose(); cap = null; }
    uniforms.uCut.value = level ?? 99;
    if (level !== null) {
      cap = new Mesh(geometry(capMesh(terrain, level)), capMat as Material);
      scene.add(cap);
    }
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return Math.round(performance.now() - c0);
  };
  window.bench.pose = (yawDeg, pitchDeg, dist, cut, target) => {
    // target in tile terms (x, y, height); the view's world is X = x, Y = height, Z = −y
    view.target = target ? [target[0], target[2], -target[1]] : [W / 2, 6, -H / 2];
    view.yaw = (yawDeg * Math.PI) / 180;
    view.pitch = (pitchDeg * Math.PI) / 180;
    view.dist = dist;
    aim();
    window.bench.setCut!(cut);
  };
  window.bench.info = () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
  window.bench.orbit = (ms: number, turnMs = 8000) =>
    new Promise((resolve) => {
      const deltas: number[] = [];
      const yaw0 = view.yaw;
      let start = 0, last = 0;
      const step = (now: number) => {
        if (!start) { start = now; last = now; } else { deltas.push(now - last); last = now; }
        view.yaw = yaw0 + ((now - start) / turnMs) * Math.PI * 2;
        aim();
        renderer.render(scene, camera);
        if (now - start < ms) requestAnimationFrame(step);
        else {
          const sorted = [...deltas].sort((a, b) => a - b);
          const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
          const seconds = (last - start) / 1000;
          resolve({ frames: deltas.length, fps: deltas.length / seconds, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: sorted[sorted.length - 1], over60: deltas.filter((d) => d > 1000 / 60 + 1).length });
        }
      };
      requestAnimationFrame(step);
    });
  window.bench.ready = true;
}

main().catch((e) => {
  window.bench.error = String(e);
  hud.textContent = String(e);
});
