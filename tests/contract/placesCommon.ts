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

/** A mine site on every map (Kyler, 2026-09-25): the places as converted for real-places-done have
 *  none, which `resources.mine_site` flags (a playability check: it warns in the export profile the
 *  places are built in, so the gallery keeps working). Real places 2 places them with the resource
 *  baseline (src/core/resources/plan.ts) and turns this to false. */
export const PLACES_LACK_MINE_SITES = true;

/** The failing checks of a place, the missing mine site apart, and whether that one fails. */
export function placeFailures(checks: readonly CheckResult[]): { other: string[]; mineSite: boolean } {
  const all = failing(checks);
  const other = all.filter((f) => !f.startsWith("resources.mine_site:"));
  return { other, mineSite: other.length !== all.length };
}

/** Every place in shard `k` of `n`: its .timber, built as the page builds it (build, settle,
 *  validate, write), passes the export profile and every check of the generate profile but the mine
 *  site, which flags it as long as the places have none (`PLACES_LACK_MINE_SITES`), and is the same
 *  bytes as the index records. */
export function checkShard(k: number, n: number): void {
  const places = INDEX.places.filter((_, i) => i % n === k);
  describe(`real places ${k + 1} of ${n}: every map validates and is the same file`, () => {
    it.each(places.map((p) => [p.name, p] as const))("%s", (_name, entry) => {
      const r = placeTimber(placeData(entry));
      expect(r.validation.report.profile).toBe("export");
      expect(r.validation.report.passed).toBe(true);
      expect(r.fileName).toBe(`${entry.name}.timber`);
      // the written file, read back: every check of the strictest profile, on its own settle
      const file = readTimber(r.bytes);
      const v = validateMap(file, { profile: "generate", designedFor: "normal", features: [], water: { model: r.validation.model!, settled: r.validation.water! } });
      const f = placeFailures(v.report.checks);
      expect(f.other).toEqual([]);
      expect(f.mineSite).toBe(PLACES_LACK_MINE_SITES);
      expect(v.report.passed).toBe(!PLACES_LACK_MINE_SITES);
      // the export profile only warns: the gallery's download works
      expect(r.validation.report.checks.find((c) => c.id === "resources.mine_site")!.severity).toBe(PLACES_LACK_MINE_SITES ? "warning" : "info");
      expect(sha256(r.bytes)).toBe(entry.sha256);
      expect(r.bytes.length).toBe(entry.bytes);
    });
  });
}
