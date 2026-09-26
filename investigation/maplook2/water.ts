import type { ShaderMaterial } from 'three';

/** Our procedural water. Keep the baseline vertex layout, shared finish and map meanings. */
export function highWater(material: ShaderMaterial): ShaderMaterial {
  const marker = '      /** The slope of the ripples';
  const i = material.fragmentShader.indexOf(marker);
  if (i < 0) throw new Error('Water shader bridge needs updating');
  material.fragmentShader = material.fragmentShader.slice(0, i) + /* glsl */ `
vec3 rippleNormal(vec2 p, float t) {
  vec2 slope = vec2(0.0);
  slope += cos(dot(p, vec2(1.1, 0.4)) + t * 0.8) * vec2(1.1, 0.4) * 0.035;
  slope += cos(dot(p, vec2(-0.5, 1.7)) - t * 0.62) * vec2(-0.5, 1.7) * 0.021;
  slope += cos(dot(p, vec2(3.2, 2.1)) + t * 1.1) * vec2(3.2, 2.1) * 0.007;
  float detail = 1.0 - smoothstep(0.1, 0.5, max(fwidth(p.x), fwidth(p.y)));
  return normalize(vec3(slope.x * detail, 1.0, -slope.y * detail));
}
void main() {
  vec3 n = normalize(vNormal);
  vec2 g = vec2(vWorld.x, -vWorld.z);
  vec2 fr = fract(g);
  float cont = clamp(vData.y, 0.0, 1.0);
  float t = time * mix(1.0, 0.55, cont);
  // Mixed water remains streaked with its actual contamination share.
  float stream = vnoise(vec2(g.x * 1.4 + sin(g.y * 0.8), g.y * 3.8 - t * 0.16));
  float bad = cont >= 0.95 ? 1.0 : (cont <= 0.05 ? cont :
    mix(cont * 0.55, 1.0, smoothstep(1.0 - cont - 0.20, 1.0 - cont + 0.20, stream)));
  float shore = 1.0;
  float fall = 1.0;
  if (n.y > 0.5) {
    if (bitOf(vFlags, 1.0) > 0.5) shore = min(shore, 1.0-fr.x);
    if (bitOf(vFlags, 2.0) > 0.5) shore = min(shore, fr.x);
    if (bitOf(vFlags, 4.0) > 0.5) shore = min(shore, 1.0-fr.y);
    if (bitOf(vFlags, 8.0) > 0.5) shore = min(shore, fr.y);
    if (bitOf(vFlags, 16.0) > 0.5) fall = min(fall, 1.0-fr.x);
    if (bitOf(vFlags, 32.0) > 0.5) fall = min(fall, fr.x);
    if (bitOf(vFlags, 64.0) > 0.5) fall = min(fall, 1.0-fr.y);
    if (bitOf(vFlags, 128.0) > 0.5) fall = min(fall, fr.y);
  }
  float d = max(0.0, vData.x) * mix(0.10, 1.0, smoothstep(0.0, 0.55, shore));
  float absorb = 1.0 - exp(-d * 0.65);
  vec3 clean = mix(vec3(0.10, 0.36, 0.34), vec3(0.022, 0.16, 0.20), absorb);
  clean = mix(clean, vec3(0.014, 0.045, 0.10), 1.0-exp(-max(d-1.4, 0.0)*0.42));
  vec3 murky = mix(vec3(0.19, 0.064, 0.034), vec3(0.060, 0.022, 0.018), absorb);
  vec3 c = mix(clean, murky, bad);
  float alpha = mix(0.17 + 0.80 * absorb, 0.91 + 0.07 * absorb, bad);
  vec3 N = n.y > 0.5 ? rippleNormal(g, t) : n;
  vec3 V = normalize(cameraPosition - vWorld);
  float lit = sunLit(g, vWorld.y);
  c *= skyColor * 1.05 + sunColor * 0.42 * max(dot(N, sunDir), 0.0) * lit;
  float foam = 0.0;
  if (n.y > 0.5) {
    // Schlick Fresnel over our own procedural sky; no copied texture/cubemap.
    vec3 R = reflect(-V, N);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float cloud = smoothstep(0.48, 0.78, vnoise(R.xz * 5.0 / max(0.25, abs(R.y))));
    vec3 sky = mix(vec3(0.49, 0.62, 0.68), vec3(0.22, 0.39, 0.55), clamp(R.y, 0.0, 1.0));
    sky = mix(sky, vec3(0.74, 0.76, 0.71), cloud * 0.25);
    c = mix(c, sky, fresnel * mix(0.70, 0.30, bad));
    alpha = max(alpha, fresnel * 0.7);
    // Fine glints only where a wave reflects the sun. No random white flecks.
    float aa = 1.0 - smoothstep(0.05, 0.22, max(fwidth(g.x), fwidth(g.y)));
    float spec = pow(max(dot(reflect(-sunDir, N), V), 0.0), 180.0);
    c += sunColor * spec * 0.20 * aa * lit * (1.0 - bad * 0.85);
    // Broad low-contrast ripple light: visible water without sparkling noise.
    c += vec3(0.040, 0.065, 0.067) * smoothstep(-0.015, 0.065, N.x + N.z) * (1.0-bad*0.6);
    // Slow broken brown ribbons keep murky water visibly liquid even from above.
    float ribbon = smoothstep(0.48, 0.72, vnoise(vec2(g.x*0.8+g.y*0.25, g.y*4.3-g.x*0.6-t*0.35)));
    c += vec3(0.080, 0.043, 0.025) * ribbon * bad;
    float noise = vnoise(g * 4.0 + vec2(t*0.1, -t*0.2));
    foam = (1.0-smoothstep(0.015, 0.18, shore)) * (0.20 + noise * 0.35);
    foam += (1.0-smoothstep(0.0, 0.65, fall)) * (0.23+0.45*noise);
  } else {
    bool edge = vFlags > 254.5;
    float drop = edge ? 0.0 : vFlags / 30.0;
    float along = abs(n.x) > 0.5 ? g.y : g.x;
    float streak = vnoise(vec2(along*7.0, vWorld.y*1.4+t*2.2));
    foam = edge ? 0.0 : smoothstep(0.12, 0.6, drop) * (0.18+streak*0.52);
    alpha = edge ? mix(0.78, 0.96, bad) : (0.19+0.42*streak)*smoothstep(0.06, 0.25, drop);
    if (alpha < 0.01) discard;
  }
  foam *= 1.0 - bad * 0.55;
  c = mix(c, mix(vec3(0.62, 0.76, 0.72), vec3(0.31, 0.17, 0.085), bad) * (0.75+0.25*lit), clamp(foam,0.0,1.0));
  alpha = mix(alpha, 0.94, foam);
  gl_FragColor = vec4(finish(c, vWorld), alpha);
}
`;
  return material;
}
