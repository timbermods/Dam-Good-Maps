// Deterministic hashing for seeds, streams and ids (PLAN §2.1, §19.4).
// Only 32-bit integer operations (Math.imul, shifts, xor), which every JS engine runs identically.

const encoder = new TextEncoder();

/** MurmurHash3 x86_32 of a byte array. */
export function murmur3(bytes: Uint8Array, seed: number): number {
  let h = seed >>> 0;
  const n = bytes.length;
  const blocks = n & ~3;
  for (let i = 0; i < blocks; i += 4) {
    let k = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  const tail = n & 3;
  if (tail) {
    let k = 0;
    if (tail === 3) k ^= bytes[blocks + 2] << 16;
    if (tail >= 2) k ^= bytes[blocks + 1] << 8;
    k ^= bytes[blocks];
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
  }
  h ^= n;
  return fmix32(h);
}

export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export type HashPart = string | number;

function encodeParts(parts: readonly HashPart[]): Uint8Array {
  // Numbers are written in decimal so 3 and "3" hash alike; parts are separated by a unit separator.
  return encoder.encode(parts.map((p) => (typeof p === "number" ? String(p) : p)).join("\u001f"));
}

/** 32-bit hash of an ordered list of parts. */
export function hash32(...parts: HashPart[]): number {
  return murmur3(encodeParts(parts), 0x5eed_da11);
}

/** 128 bits (four independent 32-bit lanes) of an ordered list of parts. */
export function hash128(...parts: HashPart[]): [number, number, number, number] {
  const bytes = encodeParts(parts);
  return [murmur3(bytes, 0x9e3779b9), murmur3(bytes, 0x85ebca6b), murmur3(bytes, 0xc2b2ae35), murmur3(bytes, 0x27d4eb2f)];
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** 64 bits of the parts as 13 lowercase base-32 characters. */
export function hash64Base32(...parts: HashPart[]): string {
  const [a, b] = hash128(...parts);
  let out = "";
  // 64 bits = 12 groups of 5 bits + 4 bits; read from the high lane down.
  let hi = a >>> 0;
  let lo = b >>> 0;
  for (let i = 0; i < 13; i++) {
    const v = hi >>> 27;
    out += BASE32[v];
    hi = ((hi << 5) | (lo >>> 27)) >>> 0;
    lo = (lo << 5) >>> 0;
  }
  return out;
}

/** A lowercase RFC 4122 version-4-shaped GUID from 128 hashed bits. */
export function guidFrom(...parts: HashPart[]): string {
  const lanes = hash128(...parts);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    bytes[i * 4] = lanes[i] >>> 24;
    bytes[i * 4 + 1] = (lanes[i] >>> 16) & 0xff;
    bytes[i * 4 + 2] = (lanes[i] >>> 8) & 0xff;
    bytes[i * 4 + 3] = lanes[i] & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Hash two integers and a seed to a float in [0, 1): per-tile decisions that stay stable
 *  when neighbouring tiles change. */
export function tileHash01(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x27d4eb2f, 0x9e3779b1);
  h = fmix32((h ^ Math.imul(a | 0, 0x85ebca6b)) >>> 0);
  h = fmix32((h ^ Math.imul(b | 0, 0xc2b2ae35)) >>> 0);
  return h / 4294967296;
}
