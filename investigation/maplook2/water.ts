import type { ShaderMaterial } from 'three';

/** Our procedural water. Keep the baseline vertex layout, shared finish and map meanings. */
export function highWater(material: ShaderMaterial): ShaderMaterial {
  const marker = '      /** The slope of the ripples';
  const i = material.fragmentShader.indexOf(marker);
  if (i < 0) throw new Error('Water shader bridge needs updating');
  material.fragmentShader = material.fragmentShader.slice(0, i) + /* glsl */ `
vec3 rippleNormal(vec2 p, float t) {
  vec2 slope = vec2(0.0);
  slope += cos(dot(p, vec2(1.1, 0.4)) + t * 1.05) * vec2(1.1, 0.4) * 0.065;
  slope += cos(dot(p, vec2(-0.5, 1.7)) - t * 0.82) * vec2(-0.5, 1.7) * 0.038;
  slope += cos(dot(p, vec2(3.2, 2.1)) + t * 1.4) * vec2(3.2, 2.1) * 0.012;
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
  vec3 clean = mix(vec3(0.13, 0.58, 0.60), vec3(0.045, 0.36, 0.48), absorb);
  clean = mix(clean, vec3(0.025, 0.16, 0.30), 1.0-exp(-max(d-2.0, 0.0)*0.32));
  vec3 murky = mix(vec3(0.19, 0.064, 0.034), vec3(0.060, 0.022, 0.018), absorb);
  vec3 c = mix(clean, murky, bad);
  // Let the bed show at the banks, without letting its dark colour muddy the whole river.
  float bank = smoothstep(0.03, 0.65, shore);
  float cleanAlpha = mix(0.13 + 0.35 * absorb, 0.62 + 0.34 * absorb, bank);
  cleanAlpha *= smoothstep(0.0, 0.12, vData.x);
  float alpha = mix(cleanAlpha, 0.91 + 0.07 * absorb, bad);
  vec3 N = n.y > 0.5 ? rippleNormal(g, t) : n;
  vec3 V = normalize(cameraPosition - vWorld);
  float lit = sunLit(g, vWorld.y);
  c *= skyColor * 1.05 + sunColor * 0.42 * max(dot(N, sunDir), 0.0) * lit;
  float foam = 0.0;
  if (n.y > 0.5) {
    // A broadened Fresnel lobe over our own sky; readable at normal orbit angles too.
    vec3 R = reflect(-V, N);
    float fresnel = 0.035 + 0.965 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float cloud = smoothstep(0.48, 0.78, vnoise(R.xz * 5.0 / max(0.25, abs(R.y))));
    vec3 sky = mix(vec3(0.74, 0.86, 0.94), vec3(0.32, 0.58, 0.79), clamp(R.y, 0.0, 1.0));
    sky = mix(sky, vec3(0.91, 0.95, 0.96), cloud * 0.32);
    c = mix(c, sky, fresnel * mix(0.90, 0.20, bad));
    alpha = max(alpha, fresnel * 0.88);
    // Fine glints only where a wave reflects the sun. No random white flecks.
    float aa = 1.0 - smoothstep(0.05, 0.22, max(fwidth(g.x), fwidth(g.y)));
    float spec = pow(max(dot(reflect(-sunDir, N), V), 0.0), 95.0);
    c += sunColor * spec * 0.40 * aa * lit * (1.0 - bad * 0.92);
    // Long moving crest highlights, broken by low-frequency noise, not random white flecks.
    float wave = sin(dot(g, vec2(1.7, 3.1)) - t * 1.8 + vnoise(g * 0.65) * 5.0);
    float width = max(fwidth(wave) * 0.8, 0.09);
    float crest = smoothstep(0.80-width*0.5, 0.98+width*0.5, wave);
    float broken = smoothstep(0.30, 0.68, vnoise(g * 1.1 + vec2(t*0.13, -t*0.09)));
    float crossing = sin(dot(g, vec2(-2.4, 4.8)) + t * 1.15 + vnoise(g*0.9+7.0)*4.0);
    crest = crest * broken + 0.22 * smoothstep(0.84-width, 1.0+width, crossing) * (1.0-broken);
    float near = 1.0 - smoothstep(0.20, 0.90, max(fwidth(g.x), fwidth(g.y)));
    float catchLight = 0.60 + 0.40 * max(dot(N, sunDir), 0.0) * lit;
    c = mix(c, vec3(0.36, 0.76, 0.85) * catchLight, crest * near * 0.65 * (1.0-bad));
    c += vec3(0.028, 0.050, 0.060) * smoothstep(-0.04, 0.08, N.x + N.z) * (1.0-bad);
    // Slow broken brown ribbons keep murky water visibly liquid even from above.
    float ribbon = smoothstep(0.48, 0.72, vnoise(vec2(g.x*0.8+g.y*0.25, g.y*4.3-g.x*0.6-t*0.35)));
    c += vec3(0.080, 0.043, 0.025) * ribbon * bad;
    float noise = vnoise(g * 4.0 + vec2(t*0.1, -t*0.2));
    foam = (1.0-smoothstep(0.015, 0.16, shore)) * (0.26 + noise * 0.38);
    float churn = vnoise(g*6.0 + vec2(t*0.7, -t*1.4));
    foam += (1.0-smoothstep(0.12, 0.95, fall)) * (0.72+0.45*churn);
  } else {
    bool edge = vFlags > 254.5;
    float drop = edge ? 0.0 : vFlags / 30.0;
    float along = abs(n.x) > 0.5 ? g.y : g.x;
    float streak = vnoise(vec2(along*7.0, vWorld.y*1.4+t*3.6));
    float strands = smoothstep(0.30, 0.72, streak);
    foam = edge ? 0.0 : smoothstep(0.12, 0.6, drop) * (0.42+strands*0.60);
    alpha = edge ? mix(0.78, 0.96, bad) : (0.32+0.53*strands)*smoothstep(0.06, 0.25, drop);
    if (alpha < 0.01) discard;
  }
  foam *= 1.0 - bad * 0.55;
  foam = clamp(foam, 0.0, 1.0);
  c = mix(c, mix(vec3(0.90, 0.96, 0.98), vec3(0.31, 0.17, 0.085), bad) * (0.85+0.15*lit), foam);
  alpha = mix(alpha, 0.97, foam);
  gl_FragColor = vec4(finish(c, vWorld), alpha);
}
`;
  return material;
}
