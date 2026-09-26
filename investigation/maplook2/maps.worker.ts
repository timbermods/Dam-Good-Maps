import { generate } from '../../src/core/gen/generate';
import { makeSpec, type ThemeId } from '../../src/core/spec/mapspec';
import { buildPlace, decodePlaceFile } from '../../src/core/places/place';
import { writeTimber } from '../../src/core/format/timber';
import { openTimber, closeSession } from '../../src/worker/session';

export type MapRequest = { id: number; kind: 'generated' | 'place' | 'prototype'; theme?: ThemeId; size?: number; seed?: number; name?: string };
self.onmessage = async ({ data: r }: MessageEvent<MapRequest>) => {
  try {
    let bytes: Uint8Array;
    let label: string;
    if (r.kind === 'generated') {
      const size = r.size ?? 128;
      const result = generate(makeSpec({ seed: r.seed ?? 4242, theme: r.theme, size: { x: size, y: size } }), {
        onProgress: p => self.postMessage({ id: r.id, progress: `Generating: attempt ${p.attempt + 1}, ${p.stage}` }),
      });
      if (!result.report.passed) throw new Error('Generator rejected this seed after its normal retries. Choose another seed.');
      bytes = result.bytes;
      label = `${r.theme} · ${size}² · seed ${r.seed ?? 4242}`;
    } else {
      const path = r.kind === 'place' ? `/maps/place/${r.name}.json.gz` : `/maps/prototype/${encodeURIComponent(r.name!)}`;
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Map unavailable: ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      if (r.kind === 'place') bytes = writeTimber(buildPlace(decodePlaceFile(bytes)).file);
      label = r.name!;
    }
    // Exactly the editor's stored-water/soil path, including multi-level columns.
    const { view } = openTimber(bytes, `${label}.timber`);
    closeSession();
    self.postMessage({ id: r.id, view, label });
  } catch (error) {
    self.postMessage({ id: r.id, error: String(error) });
  }
};
