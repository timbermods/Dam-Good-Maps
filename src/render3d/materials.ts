// The 3D view's shaders (Map look, PLAN §20 D86 and D110; D45 before it), tuned to Kyler's in-game
// reference screenshots. One light for terrain, water and objects: a warm sun from the north-west
// (the 2D preview's hillshade direction) with strong soft shadows baked when the mesh is built
// (light.ts), a cool sky light (violet in the earth's shadows) dimmed by the sky each point sees,
// then a blue-grey haze over distant ground and a warm grade. Every texture is made by a shader:
// the patterns (value noise, the cracks of dry earth, the cobbles of the walls) are drawn once
// into a small tiling texture when the view starts (`drawPatterns`), so the view needs no image
// files, and reading them costs far less than computing them per pixel.
//
// - Terrain tops are coloured by soil (palette.ts): moist ground yellow-green grass whose edge
//   bleeds onto the earth in patches; dry ground cracked earth, warm grey-brown; contaminated
//   ground rusty red-brown with glowing cracks; a dark bed under water; or by height, with the
//   toggle. Soil blends between tiles of one height, never over a cliff, and every tile's middle
//   shows its own soil. Contact shadows darken the ground at the foot of higher neighbours.
// - Walls are dark charcoal-green cobbles: a groove and a change of shade between levels, so
//   levels can be counted, and a lip of the top's ground.
// - Water is teal where shallow (see-through near the shore) and navy where deep, with glints,
//   pale ripples that move, foam along shores and below falls, and white water down falls.
//   Badwater is murky red-brown with slow glowing veins, and blends into clean water where the
//   two meet.
// - A per-tile overlay (selection, previews, layers) and the hovered tile stay on top.
// Colours are display values: the renderer outputs them without conversion.

import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GROUND, HEIGHT_RAMP, LIGHT, WALL, WATER, type Rgb } from "./palette";
import { SHADOW_OFFSET, SHADOW_RES, SHADOW_SCALE } from "./light";

const az = LIGHT.sunAzimuth;
const ce = Math.cos(LIGHT.sunElevation);
/** Toward the sun, in world space (X east, Y up, Z south). */
export const SUN = new Vector3(az[0] * ce, Math.sin(LIGHT.sunElevation), -az[1] * ce).normalize();

const color = (c: Rgb) => new Color(c[0], c[1], c[2]);

/** Uniforms every material shares: one object per value, so a change reaches them all. */
export interface SceneUniforms {
  sunDir: { value: Vector3 };
  sunColor: { value: Color };
  skyColor: { value: Color };
  hazeColor: { value: Color };
  /** World distance where the haze starts and where it is full. */
  hazeRange: { value: Vector2 };
  hazeAmount: { value: number };
  time: { value: number };
  tileTex: { value: DataTexture };
  lightTex: { value: DataTexture };
  overlay: { value: DataTexture };
  mapSize: { value: Vector2 };
  /** The tiling patterns (drawPatterns). */
  patternTex: { value: Texture | null };
}

export function sceneUniforms(W: number, H: number, tile: DataTexture, light: DataTexture, overlay: DataTexture): SceneUniforms {
  return {
    sunDir: { value: SUN.clone() },
    sunColor: { value: color(LIGHT.sun) },
    skyColor: { value: color(LIGHT.sky) },
    hazeColor: { value: color(LIGHT.haze) },
    hazeRange: { value: new Vector2(200, 600) },
    hazeAmount: { value: 0.35 },
    time: { value: 0 },
    tileTex: { value: tile },
    lightTex: { value: light },
    overlay: { value: overlay },
    mapSize: { value: new Vector2(W, H) },
    patternTex: { value: null },
  };
}

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const glColor = (c: Rgb) => `vec3(${c.map((v) => f(Math.round(v * 1000) / 1000)).join(", ")})`;

/** The pattern texture: its size, and the cells of each pattern across it (each tiles). */
const PATTERN_SIZE = 512;
const NOISE_CELLS = 64;
const CRACK_CELLS = 16;
const COBBLE_CELLS: [number, number] = [16, 24];

/** Draw the patterns the shaders read into a tiling texture, once (the same shader always draws
 *  the same texture):
 *  - R: value noise, a hash on a 64-cell lattice that wraps, smoothly interpolated;
 *  - G: cracks, the edges between the plates of a warped Voronoi pattern, 16 plates across;
 *  - B: cobbles, stones in a stretched Voronoi pattern (16 × 24 across) with dark mortar between
 *    them: 0 on the mortar, 0.5–1 on a stone by its shade;
 *  - A: each crack plate's own shade. */
export function drawPatterns(gl: WebGLRenderer): WebGLRenderTarget {
  const rt = new WebGLRenderTarget(PATTERN_SIZE, PATTERN_SIZE, { wrapS: RepeatWrapping, wrapT: RepeatWrapping, magFilter: LinearFilter, minFilter: LinearMipmapLinearFilter, generateMipmaps: true, depthBuffer: false });
  const mat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      float hash12(vec2 p, vec2 period) {
        p = mod(p, period);
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      vec2 hash22(vec2 p, vec2 period) {
        p = mod(p, period);
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }
      float valueNoise(vec2 c, vec2 period) {
        vec2 i = floor(c);
        vec2 u = fract(c);
        u = u * u * (3.0 - 2.0 * u);
        return mix(mix(hash12(i, period), hash12(i + vec2(1.0, 0.0), period), u.x), mix(hash12(i + vec2(0.0, 1.0), period), hash12(i + vec2(1.0, 1.0), period), u.x), u.y);
      }
      /** Distances to the nearest and second-nearest feature points (in a stretched metric), and
       *  the nearest cell's own random value. */
      vec3 voronoi(vec2 x, vec2 period, vec2 stretch, float jitter) {
        vec2 n = floor(x);
        vec2 fr = fract(x);
        float f1 = 9.0;
        float f2 = 9.0;
        float id = 0.0;
        for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = 0.5 + (hash22(n + g, period) - 0.5) * jitter;
            vec2 r = (g + o - fr) * stretch;
            float d = dot(r, r);
            if (d < f1) {
              f2 = f1;
              f1 = d;
              id = hash12(n + g + 17.0, period);
            } else if (d < f2) f2 = d;
          }
        return vec3(sqrt(f1), sqrt(f2), id);
      }
      void main() {
        // value noise, half a texel in so its lattice lies on texel centres
        vec2 np = vec2(${f(NOISE_CELLS)});
        float noise = valueNoise(vUv * np - 0.5 * np / ${f(PATTERN_SIZE)}, np);
        // cracks: a warped Voronoi's edges, thinner and fainter here and there
        vec2 cp = vec2(${f(CRACK_CELLS)});
        vec2 c = vUv * cp;
        vec2 warp = vec2(valueNoise(c * 0.5, cp * 0.5), valueNoise(c * 0.5 + 19.0, cp * 0.5)) - 0.5;
        vec3 v = voronoi(c + warp * 0.7, cp, vec2(1.0), 0.9);
        float width = 0.04 + 0.05 * valueNoise(c * 2.0 + 7.0, cp * 2.0);
        float crack = 1.0 - smoothstep(width * 0.4, width, v.y - v.x);
        // cobbles: wider than tall, mortar between them
        vec2 kp = vec2(${f(COBBLE_CELLS[0])}, ${f(COBBLE_CELLS[1])});
        vec3 k = voronoi(vUv * kp, kp, vec2(1.0, 1.5), 0.75);
        float mortar = smoothstep(0.05, 0.16, k.y - k.x);
        float stone = mortar * (0.5 + 0.5 * k.z) * (0.9 + 0.2 * valueNoise(vUv * kp * 3.0, kp * 3.0));
        gl_FragColor = vec4(noise, crack, clamp(stone, 0.0, 1.0), v.z);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  const scene = new Scene();
  scene.add(quad);
  const before = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.render(scene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
  gl.setRenderTarget(before);
  quad.geometry.dispose();
  mat.dispose();
  return rt;
}

export function overlayTexture(W: number, H: number): DataTexture {
  const t = new DataTexture(new Uint8Array(W * H * 4), W, H, RGBAFormat, UnsignedByteType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** The terrain shader's per-tile data (light.ts `tileData`): nearest, one texel per tile. */
export function tileTexture(W: number, H: number, data: Uint8Array): DataTexture {
  const t = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** The shadow map (light.ts `shadowMap`): filtered, SHADOW_RES texels per tile. */
export function lightTexture(W: number, H: number, data: Uint8Array): DataTexture {
  const t = new DataTexture(data, W * SHADOW_RES, H * SHADOW_RES, RGBAFormat, UnsignedByteType);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Shared GLSL: the scene's uniforms, the patterns, the baked shadow, the light and the finish. */
const COMMON = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 skyColor;
  uniform vec3 hazeColor;
  uniform vec2 hazeRange;
  uniform float hazeAmount;
  uniform float time;
  uniform sampler2D tileTex;
  uniform sampler2D lightTex;
  uniform sampler2D overlay;
  uniform vec2 mapSize;
  uniform sampler2D patternTex;

  /** Value noise, one cell per unit of p. */
  float vnoise(vec2 p) {
    return texture2D(patternTex, p * ${f(1 / NOISE_CELLS)}).r;
  }
  /** Cracks (g: 1 on a crack) and the plate's shade (a), one plate per unit of p. */
  vec2 cracks(vec2 p) {
    return texture2D(patternTex, p * ${f(1 / CRACK_CELLS)}).ga;
  }
  /** Cobbles: 0 on the mortar, 0.5–1 on a stone; p in stones along and courses up. */
  float cobble(vec2 p) {
    return texture2D(patternTex, p / vec2(${f(COBBLE_CELLS[0])}, ${f(COBBLE_CELLS[1])})).b;
  }
  /** How lit a point at height z above tile position g is (the baked sun shadow, soft). */
  float sunLit(vec2 g, float z) {
    #if LITE
      return 1.0;
    #endif
    vec4 s = texture2D(lightTex, g / mapSize);
    float hi = s.r * ${f(255 / SHADOW_SCALE)} - ${f(SHADOW_OFFSET)};
    float lo = s.g * ${f(255 / SHADOW_SCALE)} - ${f(SHADOW_OFFSET)};
    return clamp((z - hi) / max(0.05, lo - hi), 0.0, 1.0);
  }
  /** Sky light and sun light on a surface: shadows keep about half the light. */
  vec3 lightOf(vec3 n, float sky, float ao, float lit) {
    float ndl = max(dot(n, sunDir), 0.0);
    return skyColor * 0.82 * (0.7 + 0.3 * n.y) * ao * sky + sunColor * 0.72 * ndl * lit * mix(1.0, ao, 0.35);
  }
  /** The blue-grey haze over distant ground, and the warm grade. */
  vec3 finish(vec3 c, vec3 world) {
    float d = distance(world, cameraPosition);
    c = mix(c, hazeColor, hazeAmount * smoothstep(hazeRange.x, hazeRange.y, d));
    c *= vec3(1.04, 1.0, 0.94);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 1.06);
    return clamp(c, 0.0, 1.0);
  }
`;

export interface TerrainUniforms {
  heightRange: { value: Vector2 };
  hover: { value: Vector3 };
  /** 0: ground coloured by soil (moisture), 1: by height. */
  groundMode: { value: number };
}

/** `lite`: a lighter look for browsers that render in software: no patterns, shadows or soil
 *  blending. */
export function terrainMaterial(scene: SceneUniforms, lo: number, hi: number, lite = false): ShaderMaterial {
  const own: TerrainUniforms = {
    heightRange: { value: new Vector2(lo, hi) },
    hover: { value: new Vector3(0, 0, 0) },
    groundMode: { value: 0 },
  };
  return new ShaderMaterial({
    defines: { LITE: lite ? 1 : 0 },
    uniforms: { ...scene, ...own } as unknown as Record<string, { value: unknown }>,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 heightRange;
      uniform vec3 hover;
      uniform float groundMode;
      varying vec3 vWorld;
      varying vec3 vNormal;
      ${COMMON}
      vec4 tileAt(vec2 t) {
        t = clamp(t, vec2(0.0), mapSize - 1.0);
        return texture2D(tileTex, (t + 0.5) / mapSize);
      }
      float heightOf(vec4 d) { return floor(d.r * 255.0 + 0.5); }
      /** moisture level (0–15), contamination (0–15), under water (0/1), sky (0–1) */
      vec4 soilOf(vec4 d) {
        float g = floor(d.g * 255.0 + 0.5);
        float m = floor(g / 16.0);
        return vec4(m, g - m * 16.0, d.a > 0.002 ? 1.0 : 0.0, d.b);
      }
      float lineAt(float v, float width) {
        float fr = fract(v);
        float d = min(fr, 1.0 - fr);
        float w = fwidth(v);
        float fade = 1.0 - smoothstep(0.05, 0.14, w);
        return (1.0 - smoothstep(width, width + w * 1.5, d)) * fade;
      }
      vec3 heightColor(float z) {
        float t = clamp((z - heightRange.x) / max(1.0, heightRange.y - heightRange.x), 0.0, 1.0);
        return mix(${glColor(HEIGHT_RAMP.low)}, ${glColor(HEIGHT_RAMP.high)}, t);
      }
      /** The ground's colour from its soil (moist, moisture level, contaminated, under water),
       *  and in glow the light of contaminated ground's cracks. Noise shapes the edges between soils
       *  (grass bleeds onto the earth in patches) and their grain. */
      vec3 groundColor(vec4 s, vec2 g, float detail, out float glow) {
        #if LITE
          glow = 0.0;
          vec3 lc = s.x > 0.5 ? mix(${glColor(GROUND.moistLow)}, ${glColor(GROUND.moistHigh)}, clamp((s.y - 1.0) / 9.0, 0.0, 1.0)) : ${glColor(GROUND.dry)};
          if (s.z > 0.5) lc = ${glColor(GROUND.contaminated)};
          return s.w > 0.5 ? ${glColor(GROUND.underwater)} : lc;
        #endif
        float n1 = vnoise(g * 1.3);
        float n2 = vnoise(g * 4.1 + 17.0);
        float n3 = vnoise(g * 19.0 + 5.0) - 0.5;
        vec2 dry = cracks(g * 1.35);
        vec2 rust = cracks(g * 1.2 + 11.3);
        float edge = (n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.45;
        float moist = smoothstep(0.4, 0.6, s.x + edge);
        float bad = smoothstep(0.4, 0.6, s.z + edge * 0.6);
        float wet = smoothstep(0.4, 0.6, s.w + (n1 - 0.5) * 0.2);
        // dry: cracked earth, warm grey-brown in greyer patches, each plate its own shade
        // the crack network is broken here and there, as real cracks are
        float open = smoothstep(0.2, 0.55, vnoise(g * 0.8 + 3.7));
        vec3 c = mix(${glColor(GROUND.dryCool)}, ${glColor(GROUND.dry)}, smoothstep(0.25, 0.75, n1 * 0.6 + n2 * 0.4)) * (0.96 + 0.05 * (dry.y - 0.5) + detail * 0.07 * n3);
        c = mix(c, ${glColor(GROUND.crack)}, dry.x * open * 0.7);
        // moist: grass, a little darker by the water, with blades up close
        vec3 grass = mix(${glColor(GROUND.moistLow)}, ${glColor(GROUND.moistHigh)}, clamp((s.y - 1.0) / 9.0, 0.0, 1.0));
        c = mix(c, grass * (0.9 + 0.2 * (n1 - 0.5) + 0.16 * (n2 - 0.5) + detail * 0.24 * n3), moist);
        // contaminated: rusty cracked earth; its cracks glow (added after the light)
        c = mix(c, ${glColor(GROUND.contaminated)} * (0.94 + 0.08 * (rust.y - 0.5) + detail * 0.08 * n3), bad);
        glow = bad * rust.x * (1.0 - wet) * (0.35 + 0.65 * open);
        c = mix(c, ${glColor(GROUND.contaminated)} * 0.7, glow);
        return mix(c, ${glColor(GROUND.underwater)} * (0.9 + 0.15 * n2), wet);
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 p = vWorld - n * 0.01;
        vec2 g = vec2(p.x, -p.z);
        vec2 tile = floor(g);
        vec4 d0 = tileAt(tile);
        float h0 = heightOf(d0);
        float detail = 1.0 - smoothstep(0.04, 0.16, fwidth(g.x));
        float glow = 0.0;
        vec3 c;
        vec3 light;
        if (n.y > 0.5) {
          // the tile and its three neighbours toward this point (the light look: the tile alone)
          vec2 fr = g - tile;
          vec2 sd = vec2(fr.x < 0.5 ? -1.0 : 1.0, fr.y < 0.5 ? -1.0 : 1.0);
          #if LITE
            vec4 dx = d0;
            vec4 dy = d0;
            vec4 dd = d0;
          #else
            vec4 dx = tileAt(tile + vec2(sd.x, 0.0));
            vec4 dy = tileAt(tile + vec2(0.0, sd.y));
            vec4 dd = tileAt(tile + sd);
          #endif
          float hx = heightOf(dx);
          float hy = heightOf(dy);
          float hd = heightOf(dd);
          vec2 w = abs(fr - 0.5);
          // soil blends toward neighbours of the same height only (never over a cliff)
          float sx = hx == h0 ? 1.0 : 0.0;
          float sy = hy == h0 ? 1.0 : 0.0;
          float sg = hd == h0 ? sx * sy : 0.0;
          float w10 = w.x * (1.0 - w.y) * sx;
          float w01 = (1.0 - w.x) * w.y * sy;
          float w11 = w.x * w.y * sg;
          float w00 = 1.0 - w10 - w01 - w11;
          vec4 s0 = soilOf(d0);
          vec4 s1 = soilOf(dx);
          vec4 s2 = soilOf(dy);
          vec4 s3 = soilOf(dd);
          vec4 flags0 = vec4(step(0.5, s0.x), s0.x, step(0.5, s0.y), s0.z);
          vec4 flags1 = vec4(step(0.5, s1.x), s1.x, step(0.5, s1.y), s1.z);
          vec4 flags2 = vec4(step(0.5, s2.x), s2.x, step(0.5, s2.y), s2.z);
          vec4 flags3 = vec4(step(0.5, s3.x), s3.x, step(0.5, s3.y), s3.z);
          vec4 soil = flags0 * w00 + flags1 * w10 + flags2 * w01 + flags3 * w11;
          float sky = s0.w * w00 + s1.w * w10 + s2.w * w01 + s3.w * w11;
          vec3 ground = groundColor(soil, g, detail, glow);
          if (groundMode > 0.5) {
            c = heightColor(h0) * (0.96 + 0.08 * (vnoise(g * 9.0) - 0.5) * detail);
            glow = 0.0;
          } else c = ground;
          // contact shadow at the foot of higher neighbours, fading within half a tile
          float rx = 1.0 - smoothstep(0.0, 0.5, 0.5 - w.x);
          float ry = 1.0 - smoothstep(0.0, 0.5, 0.5 - w.y);
          float ox = min(max(hx - h0, 0.0), 2.0) * 0.5 * rx;
          float oy = min(max(hy - h0, 0.0), 2.0) * 0.5 * ry;
          float od = min(max(hd - h0, 0.0), 2.0) * 0.5 * rx * ry * (1.0 - max(step(0.5, hx - h0), step(0.5, hy - h0)));
          float ao = 1.0 - 0.5 * clamp(ox + oy + od - ox * oy, 0.0, 1.0);
          light = lightOf(n, mix(0.45, 1.0, sky), ao, sunLit(g, h0));
        } else if (n.y < -0.5) {
          c = ${glColor(WALL.mortar)};
          light = lightOf(n, 0.5, 0.6, 0.0);
        } else {
          // a wall: cobbles of dark stone, each level its own course with a groove between, and a
          // lip of the top's ground
          vec2 out2 = vec2(n.x, -n.z);
          vec2 air = floor(g + out2 * 0.5);
          float base = heightOf(tileAt(air));
          float y = vWorld.y;
          float level = floor(y + 0.001);
          float along = abs(n.x) > 0.5 ? g.y : g.x;
          #if LITE
            float k = 0.75;
          #else
            float k = cobble(vec2(along * 2.0, y * 2.0));
          #endif
          float shade = mix(${f(WALL.low)}, ${f(WALL.high)}, clamp(level / 16.0, 0.0, 1.0)) * (mod(level, 2.0) > 0.5 ? ${f(WALL.alternate)} : 1.0);
          vec3 wc = mix(${glColor(WALL.mortar)}, ${glColor(WALL.stone)} * shade * (0.7 + 0.6 * (k - 0.5)), smoothstep(0.1, 0.4, k));
          wc *= 1.0 - 0.55 * lineAt(y, 0.035);
          float lip = 1.0 - smoothstep(0.07, 0.13, h0 - y);
          vec4 s0 = soilOf(d0);
          vec3 top = groundMode > 0.5 ? heightColor(h0) : (s0.y > 0.5 ? ${glColor(GROUND.contaminated)} : s0.x > 0.5 ? ${glColor(GROUND.moistHigh)} : ${glColor(GROUND.dry)} * 0.85);
          c = mix(wc, top, lip * 0.9);
          float ao = mix(0.5, 1.0, smoothstep(0.0, 1.1, y - base));
          light = lightOf(n, 1.0, ao, sunLit(g + out2 * 0.26, y));
        }
        c *= light;
        // the glowing cracks of contaminated ground shine in shadow too
        c += ${glColor(GROUND.contaminatedGlow)} * glow * 0.42;
        vec4 o = texture2D(overlay, (tile + 0.5) / mapSize);
        c = mix(c, o.rgb * (0.8 + 0.2 * min(light.g, 1.0)), o.a);
        if (hover.z > 0.5 && tile == hover.xy) {
          vec2 fr = fract(vec2(p.x, -p.z));
          float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
          c = mix(c * 1.18, vec3(1.0), (1.0 - smoothstep(0.04, 0.09, edge)) * (n.y > 0.5 ? 0.85 : 0.0));
        }
        gl_FragColor = vec4(finish(c, vWorld), 1.0);
      }
    `,
  });
}

export function waterMaterial(scene: SceneUniforms, lite = false): ShaderMaterial {
  return new ShaderMaterial({
    defines: { LITE: lite ? 1 : 0 },
    uniforms: scene as unknown as Record<string, { value: unknown }>,
    vertexShader: /* glsl */ `
      attribute vec2 wdata;
      attribute float wflags;
      varying vec2 vData;
      varying float vFlags;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vData = wdata;
        vFlags = wflags;
        vNormal = normal;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vData;
      varying float vFlags;
      varying vec3 vNormal;
      varying vec3 vWorld;
      ${COMMON}
      float bit(float flags, float b) { return mod(floor(flags / b + 0.001), 2.0); }
      /** The slope of the ripples (gentle, moving) at q. */
      vec2 ripple(vec2 q, float t) {
        float a1 = q.x * 1.3 + q.y * 0.35 + t * 1.1;
        float a2 = q.y * 1.7 - q.x * 0.4 - t * 0.9;
        float a3 = (q.x - q.y) * 2.9 + t * 1.7;
        return cos(a1) * vec2(1.3, 0.35) * 0.5 + cos(a2) * vec2(-0.4, 1.7) * 0.35 + cos(a3) * vec2(2.9, -2.9) * 0.12;
      }
      void main() {
        vec3 n = normalize(vNormal);
        float depth = vData.x;
        float bad = smoothstep(0.05, 0.5, vData.y);
        vec2 g = vec2(vWorld.x, -vWorld.z);
        vec3 V = normalize(cameraPosition - vWorld);
        float absorb = 1.0 - exp(-depth * 1.4);
        vec3 clean = mix(${glColor(WATER.shallow)}, ${glColor(WATER.deep)}, absorb);
        vec3 murky = mix(${glColor(WATER.bad)}, ${glColor(WATER.badDeep)}, absorb);
        float alpha = mix(mix(0.45, 0.94, absorb), mix(0.85, 0.97, absorb), bad);
        float foam = 0.0;
        float glints = 0.0;
        float pale = 0.0;
        float vein = 0.0;
        float t = time;
        vec3 N = n;
        if (n.y > 0.5) {
          #if !LITE
            float slow = mix(1.0, 0.35, bad);
            vec2 q = g * 1.6 + vec2(sin(g.y * 0.5), sin(g.x * 0.43)) * 1.5;
            vec2 sl = ripple(q, t * slow) + 0.6 * ripple(q * 1.9 + 7.0, t * 1.3 * slow);
            N = normalize(vec3(sl.x * 0.07, 1.0, -sl.y * 0.07));
          #endif
          // foam where the water meets the shore, and below falls
          vec2 fr = fract(g);
          float shore = 1.0;
          if (bit(vFlags, 1.0) > 0.5) shore = min(shore, 1.0 - fr.x);
          if (bit(vFlags, 2.0) > 0.5) shore = min(shore, fr.x);
          if (bit(vFlags, 4.0) > 0.5) shore = min(shore, 1.0 - fr.y);
          if (bit(vFlags, 8.0) > 0.5) shore = min(shore, fr.y);
          float fall = 1.0;
          if (bit(vFlags, 16.0) > 0.5) fall = min(fall, 1.0 - fr.x);
          if (bit(vFlags, 32.0) > 0.5) fall = min(fall, fr.x);
          if (bit(vFlags, 64.0) > 0.5) fall = min(fall, 1.0 - fr.y);
          if (bit(vFlags, 128.0) > 0.5) fall = min(fall, fr.y);
          // a thin line along the shore, and broken foam just off it
          foam += (1.0 - smoothstep(0.03, 0.08, shore)) * 0.7;
          #if LITE
            foam += (1.0 - smoothstep(0.0, 0.95, fall)) * 0.6;
          #else
            float fn = vnoise(g * 4.0 + vec2(t * 0.3, -t * 0.2));
            foam += (1.0 - smoothstep(0.06, 0.24 + 0.1 * fn, shore)) * smoothstep(0.4, 0.72, fn + 0.12) * 0.5;
            // white water where a fall comes down
            float churn = vnoise(g * 3.2 + vec2(0.0, t * 1.4)) * 0.6 + vnoise(g * 7.0 - vec2(t * 0.9, 0.0)) * 0.4;
            foam += (1.0 - smoothstep(0.0, 0.95, fall)) * (0.3 + 0.7 * smoothstep(0.3, 0.62, churn));
            // glints of light, and pale ripples drifting where it flows
            // (small and sparse, and gone where a pixel covers more than a few of them)
            float fine = 1.0 - smoothstep(0.03, 0.09, fwidth(g.x));
            glints = fine * smoothstep(0.8, 0.9, vnoise(g * 17.0 + vec2(t * 0.6, -t * 0.4)) * vnoise(g * 13.0 - vec2(t * 0.3, t * 0.7)) * 1.45);
            pale = smoothstep(0.6, 0.82, vnoise(vec2(g.x * 0.9 + g.y * 0.3, (g.y - g.x * 0.2) * 5.0) + vec2(t * 0.15, t * 0.5)));
            // the slow glowing veins of badwater
            float vn = vnoise(g * 1.6 + vec2(t * 0.05, -t * 0.03));
            vein = smoothstep(0.84, 0.97, 1.0 - abs(vn * 2.0 - 1.0));
          #endif
        } else {
          // a fall: white water streaming down, more the taller it is (none at the map's edge)
          float along = abs(n.x) > 0.5 ? g.y : g.x;
          #if LITE
            float s = 0.6;
          #else
            float s = vnoise(vec2(along * 6.0, vWorld.y * 1.3 + t * 2.4)) * 0.6 + vnoise(vec2(along * 13.0, vWorld.y * 2.7 + t * 3.3)) * 0.4;
          #endif
          bool edge = vFlags > 254.5;
          float drop = edge ? 0.0 : vFlags / 30.0;
          foam = (0.45 + 0.55 * smoothstep(0.25, 0.6, s)) * smoothstep(0.12, 0.5, drop);
          // a small step between two waters is barely there; the map's edge shows the water's side
          alpha = edge ? mix(0.85, 0.95, bad) : mix(mix(0.8, 0.95, bad), 0.95, foam) * smoothstep(0.08, 0.25, drop);
          if (alpha < 0.01) discard;
        }
        foam = clamp(foam, 0.0, 1.0);
        vec3 c = mix(clean, murky, bad);
        float lit = sunLit(g, vWorld.y);
        vec3 light = skyColor * 0.85 + sunColor * 0.65 * max(dot(N, sunDir), 0.0) * lit;
        c *= light;
        // the sky's reflection, stronger at low angles; pale ripples; the sun's glint and glints
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        c = mix(c, ${glColor(WATER.sky)}, fres * 0.35 * (1.0 - bad * 0.4));
        c = mix(c, ${glColor(WATER.sky)} * 0.85, pale * 0.2 * (1.0 - bad));
        float spec = pow(max(dot(reflect(-sunDir, N), V), 0.0), 90.0) * lit;
        c += sunColor * (spec * mix(0.55, 0.3, bad) + glints * 0.6 * (1.0 - bad) * (0.3 + 0.7 * lit));
        c += ${glColor(WATER.badVein)} * vein * bad * 0.22;
        c = mix(c, mix(${glColor(WATER.foam)}, ${glColor(WATER.badFoam)}, bad) * (0.75 + 0.25 * lit), foam);
        alpha = mix(alpha, 0.95, max(foam, glints * 0.6));
        if (n.y > 0.5) {
          vec4 o = texture2D(overlay, (floor(g) + 0.5) / mapSize);
          c = mix(c, o.rgb, o.a * 0.85);
          alpha = mix(alpha, 1.0, o.a * 0.6);
        }
        gl_FragColor = vec4(finish(c, vWorld), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Instanced objects: each vertex's own colour times the instance's tint, lit like the terrain,
 *  darker toward the model's foot, and in the terrain's shadow where it stands in one. */
export function objectMaterial(scene: SceneUniforms, lite = false): ShaderMaterial {
  return new ShaderMaterial({
    defines: { LITE: lite ? 1 : 0 },
    uniforms: scene as unknown as Record<string, { value: unknown }>,
    vertexShader: /* glsl */ `
      attribute vec3 pcolor;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vFoot;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vNormal = normalize(mat3(m) * normal);
        vColor = pcolor;
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
        vFoot = position.y;
        vec4 w = m * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying float vFoot;
      ${COMMON}
      void main() {
        vec3 n = normalize(vNormal);
        float ao = mix(0.55, 1.0, smoothstep(0.0, 0.45, vFoot));
        float lit = sunLit(vec2(vWorld.x, -vWorld.z), vWorld.y);
        // soft (wrapped) sun light, kinder to leaves
        float ndl = clamp(dot(n, sunDir) * 0.75 + 0.25, 0.0, 1.0);
        vec3 light = skyColor * 0.82 * (0.7 + 0.3 * n.y) * ao + sunColor * 0.72 * ndl * lit;
        gl_FragColor = vec4(finish(vColor * light, vWorld), 1.0);
      }
    `,
  });
}
