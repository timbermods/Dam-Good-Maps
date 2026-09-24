// Transcendental functions built from + − × ÷ and floor only (PLAN §2.1). Math.sin, cos, exp
// and log are implementation-defined in precision, so output paths use these instead.

const TWO_PI = 6.283185307179586;
const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
const LN2 = 0.6931471805599453;

/** sin(x) with |error| < 1e-12 on any argument a map uses. Range-reduced to [-π/2, π/2], then an
 *  odd polynomial through x^17 (the Taylor tail there is below 1e-13). */
export function sinDet(x: number): number {
  let r = x - TWO_PI * Math.floor(x / TWO_PI); // [0, 2π)
  if (r > PI) r -= TWO_PI; // (-π, π]
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const r2 = r * r;
  // Horner form of r − r³/3! + r⁵/5! − … − r¹⁷/17!
  let p = -2.8114572543455206e-15;
  p = p * r2 + 7.647163731819816e-13;
  p = p * r2 - 1.6059043836821613e-10;
  p = p * r2 + 2.505210838544172e-8;
  p = p * r2 - 2.7557319223985893e-6;
  p = p * r2 + 1.984126984126984e-4;
  p = p * r2 - 8.333333333333333e-3;
  p = p * r2 + 1.6666666666666666e-1;
  return r - r * r2 * p;
}

export function cosDet(x: number): number {
  return sinDet(x + HALF_PI);
}

/** e^x for |x| < 700 with relative error below 1e-14. */
export function expDet(x: number): number {
  const k = Math.round(x / LN2);
  const r = x - k * LN2; // |r| <= ln2/2
  let term = 1;
  let sum = 1;
  for (let i = 1; i <= 20; i++) {
    term = (term * r) / i;
    sum += term;
  }
  // 2^k by repeated squaring on exact powers of two
  let scale = 1;
  let base = k >= 0 ? 2 : 0.5;
  let n = Math.abs(k);
  while (n > 0) {
    if (n & 1) scale *= base;
    base *= base;
    n >>= 1;
  }
  return sum * scale;
}

export { PI, TWO_PI };
