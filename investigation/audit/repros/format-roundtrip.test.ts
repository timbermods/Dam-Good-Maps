import { strToU8, zipSync } from "fflate";
import { expect, it } from "vitest";
import { decodeProject } from "../../../src/core/doc/document";
import { MapSession } from "../../../src/core/doc/session";
import { readTimber, writeTimber } from "../../../src/core/format/timber";
import { normalizeImport } from "../../../src/core/format/normalize";
import { generate } from "../../../src/core/gen/generate";
import { makeSpec } from "../../../src/core/spec/mapspec";

function oldTimber(version: string, legacyHeights: boolean): Uint8Array {
  const X = 6, Y = 5, plane = X * Y, layers = legacyHeights ? 23 : 25;
  const terrain = legacyHeights
    ? { Heights: { Array: Array.from({ length: plane }, () => "4").join(" ") } }
    : { Voxels: { Array: Array.from({ length: plane * layers }, (_, i) => Math.floor(i / plane) < 4 ? "1" : "0").join(" ") } };
  const world = {
    GameVersion: version,
    Timestamp: "2024-05-01 10:00:00",
    Singletons: { MapSize: { Size: { X, Y } }, TerrainMap: terrain },
    Entities: [],
  };
  return zipSync({
    "map_metadata.json": strToU8(JSON.stringify({ Width: X, Height: Y, MapDescription: "old" })),
    "version.txt": strToU8(`${version}\r\n`),
    "world.json": strToU8(JSON.stringify(world)),
  });
}

it("normalizes synthetic 0.6 and 0.7 imports once, then writes byte-stable 1.1 files", () => {
  for (const [version, legacy] of [["0.6.0", true], ["0.7.10.2-5762fd5-sw", false]] as const) {
    const file = readTimber(oldTimber(version, legacy));
    const first = normalizeImport(file);
    expect(first.sourceVersion).toBe(version);
    expect(first.changes.map((c) => c.id)).toContain("file.version");
    expect(first.changes.map((c) => c.id)).toContain(legacy ? "terrain.heights" : "terrain.layers");
    expect(file.world.legacy).toBe(false);
    const normalized = writeTimber(file);

    const again = readTimber(normalized);
    expect(normalizeImport(again).changes).toEqual([]);
    expect(Buffer.compare(writeTimber(again), normalized)).toBe(0);
  }
});

it("round-trips one generated .timber through import/export and a project reopen", () => {
  const generated = generate(makeSpec({ seed: 11, size: { x: 96, y: 96 } }));
  expect(generated.report.passed).toBe(true);
  expect(Buffer.compare(writeTimber(readTimber(generated.bytes)), generated.bytes)).toBe(0);

  const imported = MapSession.importMap(generated.bytes, "seed-11.timber");
  expect(Buffer.compare(imported.exportTimber().bytes, generated.bytes)).toBe(0);

  const live = MapSession.fromGenerated(generated);
  const reopened = MapSession.open(decodeProject(live.project()));
  expect(Buffer.compare(reopened.exportTimber().bytes, generated.bytes)).toBe(0);
});
