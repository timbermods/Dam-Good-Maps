// Byte-exact helpers copied unchanged from ../simspeed/suite.mjs; unused benchmarks omitted.
export const themes = ['riverValley', 'canyon', 'highlands', 'lakeBasin', 'islands', 'delta'];
export function bytes(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }
export function equal(a, b, label) {
  a = bytes(a); b = bytes(b);
  if (a.length !== b.length) throw new Error(label + ': byte length');
  const n = a.length;
  const av = new DataView(a.buffer, a.byteOffset, n), bv = new DataView(b.buffer, b.byteOffset, n);
  let i = 0;
  for (; i + 4 <= n; i += 4) if (av.getUint32(i) !== bv.getUint32(i)) throw new Error(label + ': byte ' + i);
  for (; i < n; i++) if (a[i] !== b[i]) throw new Error(label + ': byte ' + i);
}
export async function sha(a) {
  const hash = await crypto.subtle.digest('SHA-256', bytes(a));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export function compare(a, b, label) {
  for (const k of Object.keys(a)) {
    if (ArrayBuffer.isView(a[k])) equal(a[k], b[k], label + '/' + k);
    else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) throw new Error(label + '/' + k);
  }
}
export async function digest(s) {
  const result = {};
  for (const k of Object.keys(s)) result[k] = ArrayBuffer.isView(s[k]) ? await sha(s[k]) : typeof s[k]==='string' ? await sha(new TextEncoder().encode(s[k])) : s[k];
  return result;
}
