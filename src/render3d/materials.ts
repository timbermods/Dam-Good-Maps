// The 3D view's shaders: one simple look for terrain, water and objects, lit by the same sun from
// the north-west (the 2D preview's hillshade direction). Terrain is coloured by height with a tile
// grid on tops and level lines on walls, plus a per-tile overlay texture (selection, previews) and
// the hovered tile. Colours are display values: the renderer outputs them without conversion.

import { Color, DataTexture, DoubleSide, NearestFilter, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2, Vector3 } from "three";

export const SUN = new Vector3(-0.45, 0.8, -0.4).normalize();

const LIGHT = /* glsl */ `
  uniform vec3 sunDir;
  float lightOf(vec3 n) {
    float d = max(dot(n, sunDir), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    return 0.42 + 0.18 * sky + 0.55 * d;
  }
`;

export interface TerrainUniforms {
  overlay: { value: DataTexture };
  mapSize: { value: Vector2 };
  heightRange: { value: Vector2 };
  sunDir: { value: Vector3 };
  hover: { value: Vector3 };
  lowColor: { value: Color };
  highColor: { value: Color };
  rockColor: { value: Color };
}

export function overlayTexture(W: number, H: number): DataTexture {
  const t = new DataTexture(new Uint8Array(W * H * 4), W, H, RGBAFormat, UnsignedByteType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function terrainMaterial(W: number, H: number, lo: number, hi: number, overlay: DataTexture): ShaderMaterial {
  const uniforms: TerrainUniforms = {
    overlay: { value: overlay },
    mapSize: { value: new Vector2(W, H) },
    heightRange: { value: new Vector2(lo, hi) },
    sunDir: { value: SUN.clone() },
    hover: { value: new Vector3(0, 0, 0) },
    lowColor: { value: new Color(0x7a9654) },
    highColor: { value: new Color(0xc4b28c) },
    rockColor: { value: new Color(0x8c7a5e) },
  };
  return new ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, { value: unknown }>,
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
      uniform sampler2D overlay;
      uniform vec2 mapSize;
      uniform vec2 heightRange;
      uniform vec3 hover;
      uniform vec3 lowColor;
      uniform vec3 highColor;
      uniform vec3 rockColor;
      varying vec3 vWorld;
      varying vec3 vNormal;
      ${LIGHT}
      float lineAt(float v, float width) {
        float f = fract(v);
        float d = min(f, 1.0 - f);
        float w = fwidth(v);
        float fade = 1.0 - smoothstep(0.05, 0.14, w);
        return (1.0 - smoothstep(width, width + w * 1.5, d)) * fade;
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 p = vWorld - n * 0.01;
        vec2 tile = vec2(floor(p.x), floor(-p.z));
        float t = clamp((vWorld.y - heightRange.x) / max(1.0, heightRange.y - heightRange.x), 0.0, 1.0);
        vec3 c;
        if (n.y > 0.5) {
          c = mix(lowColor, highColor, t);
          float g = max(lineAt(vWorld.x, 0.02), lineAt(vWorld.z, 0.02));
          c *= 1.0 - 0.13 * g;
        } else if (n.y < -0.5) {
          c = rockColor * 0.55;
        } else {
          c = mix(rockColor * 0.9, rockColor * 1.12, t);
          c *= 1.0 - 0.22 * lineAt(vWorld.y, 0.03);
        }
        vec4 o = texture2D(overlay, (tile + 0.5) / mapSize);
        c = mix(c, o.rgb, o.a);
        c *= lightOf(n);
        if (hover.z > 0.5 && tile == hover.xy) {
          vec2 f = fract(vec2(p.x, -p.z));
          float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          c = mix(c * 1.18, vec3(1.0), (1.0 - smoothstep(0.04, 0.09, edge)) * (n.y > 0.5 ? 0.85 : 0.0));
        }
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

export function waterMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { sunDir: { value: SUN.clone() } },
    vertexShader: /* glsl */ `
      attribute vec2 wdata;
      varying vec2 vData;
      varying vec3 vNormal;
      void main() {
        vData = wdata;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vData;
      varying vec3 vNormal;
      ${LIGHT}
      void main() {
        vec3 n = normalize(vNormal);
        float depth = vData.x;
        float bad = smoothstep(0.02, 0.4, vData.y);
        vec3 clean = mix(vec3(0.36, 0.62, 0.86), vec3(0.16, 0.36, 0.68), clamp(depth / 2.0, 0.0, 1.0));
        vec3 dirty = vec3(0.47, 0.32, 0.16);
        vec3 c = mix(clean, dirty, bad);
        float a = 0.5 + 0.35 * clamp(depth / 1.5, 0.0, 1.0);
        if (n.y < 0.5) {
          c = mix(c, vec3(0.9, 0.95, 1.0), 0.35);
          a = 0.8;
        }
        gl_FragColor = vec4(c * (0.75 + 0.35 * lightOf(n)), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Instanced objects: the part colour times the instance colour, lit like the terrain. */
export function objectMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { sunDir: { value: SUN.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vNormal = normalize(mat3(m) * normal);
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vNormal;
      ${LIGHT}
      void main() {
        gl_FragColor = vec4(vColor * lightOf(normalize(vNormal)), 1.0);
      }
    `,
  });
}
