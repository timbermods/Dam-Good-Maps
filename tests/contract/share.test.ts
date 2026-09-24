// ROADMAP M6: share links reproduce byte-identical files (PLAN §14.5; D7: a link carries the spec
// only). A spec written into a link and read back generates the same .timber, byte for byte, for
// every theme and for settings away from the presets. tests/e2e/share.spec.ts checks the same
// through the page in Chromium.

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generate } from "../../src/core/gen/generate";
import { decodeSpecFragment, encodeSpecFragment, shareLink } from "../../src/core/spec/mapspec";
import { shareCases } from "../shareCases";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

describe("share links (PLAN §14.5)", () => {
  it.each(shareCases().map((s) => [encodeSpecFragment(s), s] as const))("%s reproduces its file byte for byte", (_, spec) => {
    const link = shareLink("https://timbermods.github.io/dam-good-maps/", spec);
    const d = decodeSpecFragment(new URL(link).hash)!;
    expect(d.problems).toEqual([]);
    expect(d.spec).toEqual(spec);
    const a = generate(spec);
    const b = generate(d.spec);
    expect(a.report.passed).toBe(true);
    expect(sha(b.bytes)).toBe(sha(a.bytes));
  });
});
