// Seeded random numbers (PLAN §2.1): sfc32 seeded through splitmix32. Streams are derived by
// hashing their name, so each pipeline stage and each feature draws from its own sequence.

import { hash32, type HashPart } from "./hash";
import { expDet } from "./detmath";

export function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** Uniform 32-bit unsigned integer (sfc32). */
  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Integer in [lo, hiExclusive). */
  int(lo: number, hiExclusive: number): number {
    return lo + Math.floor(this.float() * (hiExclusive - lo));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  /** Index drawn with probability proportional to weights. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Approximately standard normal (Irwin-Hall with 12 uniforms): basic operations only. */
  normal(): number {
    let s = 0;
    for (let i = 0; i < 12; i++) s += this.float();
    return s - 6;
  }

  /** Log-normal with the given median and log-space sigma, without Math.exp. */
  logNormal(median: number, sigma: number): number {
    return median * expDet(sigma * this.normal());
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const t = items[i];
      items[i] = items[j];
      items[j] = t;
    }
    return items;
  }
}

/** A generator for one named stream: `stream(seed, "layout", candidate, attempt)` or
 *  `stream(seed, featureId, "place")` (PLAN §19.7). */
export function stream(...parts: HashPart[]): Rng {
  return new Rng(hash32(...parts));
}
