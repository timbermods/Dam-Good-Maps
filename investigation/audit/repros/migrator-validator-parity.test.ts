import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generate } from "../../../src/core/gen/generate";
import { makeSpec } from "../../../src/core/spec/mapspec";
import { validateMap } from "../../../src/core/validate/checks";
import { writeTimber } from "../../../src/core/format/timber";
import type { JsonObject } from "../../../src/core/format/json";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const output = join(repo, "investigation", "audit", "repros", ".tmp", "migrator-false.timber");

it("reproduces Python validator accepting a false water migration marker", () => {
  const generated = generate(makeSpec({ seed: 11, size: { x: 96, y: 96 } }));
  expect(generated.report.passed).toBe(true);

  const migrator = generated.file.world.singletons.WaterSimulationMigrator as JsonObject;
  migrator.IsMigrated = false;
  mkdirSync(join(repo, "investigation", "audit", "repros", ".tmp"), { recursive: true });
  writeFileSync(output, writeTimber(generated.file));

  const check = validateMap(generated.file, { profile: "import", loadOnly: true }).report.checks.find((c) => c.id === "file.singletons");
  expect(check?.ok).toBe(false);
  expect(check?.message).toContain("IsMigrated missing or false");
  console.log(`Python reproduction input: ${output}`);
});
