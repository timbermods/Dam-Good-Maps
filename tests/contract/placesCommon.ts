// Shared by the Real places contract tests (ROADMAP "Real places", PLAN §20 D136): the gallery's
// index and data (public/real-places/, written by tools/real-places.ts), and the check every place
// must pass. Every place is checked nightly and on a pull request into main (the release check),
// split over three files so they run side by side; a sample of every size on every push
// (places.test.ts).

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

/** Each place: its .timber, built as the deploy builds it (build, settle, validate, write), passes
 *  the export profile and every check of the generate profile, and is the same bytes as the index
 *  records. */
export function checkPlaces(title: string, places: readonly PlaceIndexEntry[], build: (e: PlaceIndexEntry) => ReturnType<typeof placeTimber> = (e) => placeTimber(placeData(e))): void {
  describe(title, () => {
    it.each(places.map((p) => [p.name, p] as const))("%s", (_name, entry) => {
      const r = build(entry);
      expect(r.validation.report.profile).toBe("export");
      expect(r.validation.report.passed).toBe(true);
      expect(r.fileName).toBe(`${entry.name}.timber`);
      // the written file, read back: every check of the strictest profile, on its own settle
      const file = readTimber(r.bytes);
      const v = validateMap(file, { profile: "generate", designedFor: "normal", features: [], water: { model: r.validation.model!, settled: r.validation.water! } });
      expect(failing(v.report.checks)).toEqual([]);
      expect(v.report.passed).toBe(true);
      expect(sha256(r.bytes)).toBe(entry.sha256);
      expect(r.bytes.length).toBe(entry.bytes);
    });
  });
}

/** Every place in shard `k` of `n` (nightly, and the release check). */
export function checkShard(k: number, n: number): void {
  checkPlaces(
    `real places ${k + 1} of ${n}: every map validates and is the same file`,
    INDEX.places.filter((_, i) => i % n === k),
  );
}
