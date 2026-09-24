// Base64 for the project file (typed arrays and the thumbnail inside JSON). Plain code, no atob or
// Buffer, so it runs the same in the worker, the page and Node.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (out.length >= 65536) {
      parts.push(out);
      out = "";
    }
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[n >> 18] + B64[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  parts.push(out);
  return parts.join("");
}

export function fromBase64(text: string): Uint8Array {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61) end--;
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let o = 0;
  const at = (k: number) => {
    const v = k < end ? LOOKUP[text.charCodeAt(k) & 127] : 0;
    if (v < 0) throw new Error(`bad base64 character at ${k}`);
    return v;
  };
  for (let i = 0; i < end; i += 4) {
    const n = (at(i) << 18) | (at(i + 1) << 12) | (at(i + 2) << 6) | at(i + 3);
    out[o++] = n >> 16;
    if (i + 2 < end) out[o++] = (n >> 8) & 255;
    if (i + 3 < end) out[o++] = n & 255;
  }
  return out;
}
