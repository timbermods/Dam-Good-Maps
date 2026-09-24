export default function encode(
  imgData: { data: Uint8Array | Uint8ClampedArray; width: number; height: number },
  quality?: number,
): { data: Uint8Array; width: number; height: number };
