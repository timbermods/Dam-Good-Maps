import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, it } from "vitest";
import { generate } from "../../../src/core/gen/generate";
import { makeSpec } from "../../../src/core/spec/mapspec";
import { writeTimber } from "../../../src/core/format/timber";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

it("writes the same generated map using this process's local time zone", () => {
  const generated = generate(makeSpec({ seed: 11, size: { x: 96, y: 96 } }));
  expect(generated.report.passed).toBe(true);
  generated.file.world.timestamp = "2026-03-08 02:30:00";
  const output = process.env.AUDIT_TZ_OUTPUT;
  expect(output).toBeTruthy();
  const bytes = writeTimber(generated.file);
  mkdirSync(dirname(output!), { recursive: true });
  writeFileSync(output!, bytes);
  console.log(JSON.stringify({ timeZone: process.env.TZ, timestamp: generated.file.world.timestamp, sha256: sha256(bytes) }));
});
