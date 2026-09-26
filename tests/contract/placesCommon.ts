// Shared by the Real places contract tests (ROADMAP "Real places", PLAN §20 D136): the gallery's
// index and data (public/real-places/, written by tools/real-places.ts), and the check every place
// must pass. The builds are split over a few test files so they run side by side.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readTimber } from "../../src/core/format/timber";
import { decodePlaceFile, placeTimber, type PlaceData, type PlaceIndex, type PlaceIndexEntry } from "../../src/core/places/place";
import { validateMap } from "../../src/core/validate/checks";
import type { CheckResult } from "../../src/core/validate/report";

export const PLACES_DIR = "public/real-places";
export const INDEX = JSON.parse(readFileSync(`${PLACES_DIR}/index.json`, "utf8")) as PlaceIndex;

export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export function placeData(entry: PlaceIndexEntry): PlaceData {
  return decodePlaceFile(new Uint8Array(readFileSync(`${PLACES_DIR}/${entry.data}`)));
}

/** Checks that fail and count: not advisory, applicable, not approximate. */
export const failing = (checks: readonly CheckResult[]) => checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false && !c.approximate).map((c) => `${c.id}: ${c.message}`);

/** No edge walls (Kyler, 2026-09-25, D151): every place as converted for real-places-done stands in
 *  a full-height wall round the whole map, which `terrain.edge_wall` flags, a principle that blocks
 *  the export profile the places are built in. placeTimber refuses only what would not load, so the
 *  gallery keeps serving them until Real places 2 converts them without it and turns this to
 *  false. */
export const PLACES_HAVE_EDGE_WALLS = true;

/** The failing checks of a place, the edge wall apart, and whether the edge wall fails. */
export function placeFailures(checks: readonly CheckResult[]): { other: string[]; edgeWall: boolean } {
  const all = failing(checks);
  return { other: all.filter((f) => !f.startsWith("terrain.edge_wall:")), edgeWall: all.length !== all.filter((f) => !f.startsWith("terrain.edge_wall:")).length };
}

/** Every place in shard `k` of `n`: its .timber, built as the page builds it (build, settle,
 *  validate, write), passes the export profile and every check of the generate profile but the edge
 *  wall, which flags it as long as the places stand in one (`PLACES_HAVE_EDGE_WALLS`), and is the
 *  same bytes as the index records. */
export function checkShard(k: number, n: number): void {
  const places = INDEX.places.filter((_, i) => i % n === k);
  describe(`real places ${k + 1} of ${n}: every map validates and is the same file`, () => {
    it.each(places.map((p) => [p.name, p] as const))("%s", (_name, entry) => {
      const r = placeTimber(placeData(entry));
      expect(r.validation.report.profile).toBe("export");
      // the export profile passes but for the edge wall, a principle it blocks (D151); the gallery
      // still gets the file, as placeTimber refuses only what would not load
      expect(r.validation.report.passed).toBe(!PLACES_HAVE_EDGE_WALLS);
      expect(r.fileName).toBe(`${entry.name}.timber`);
      // the written file, read back: every check of the strictest profile, on its own settle
      const file = readTimber(r.bytes);
      const v = validateMap(file, { profile: "generate", designedFor: "normal", features: [], water: { model: r.validation.model!, settled: r.validation.water! } });
      const f = placeFailures(v.report.checks);
      expect(f.other).toEqual([]);
      expect(f.edgeWall).toBe(PLACES_HAVE_EDGE_WALLS);
      expect(v.report.passed).toBe(!PLACES_HAVE_EDGE_WALLS);
      expect(r.validation.report.checks.find((c) => c.id === "terrain.edge_wall")!.severity).toBe(PLACES_HAVE_EDGE_WALLS ? "error" : "info");
      expect(sha256(r.bytes)).toBe(entry.sha256);
      expect(r.bytes.length).toBe(entry.bytes);
    });
  });
}
