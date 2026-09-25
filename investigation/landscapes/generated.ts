import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { generate } from "../../src/core/gen/generate";
import { AVAILABLE_THEMES, makeSpec } from "../../src/core/spec/mapspec";
import { measureFile } from "../workshop/lib/measures";
import { featureVector } from "../workshop/lib/variety";
import { terrainMetrics } from "./lib/metrics";
import { checkCache } from "./lib/provenance";
await checkCache();
mkdirSync(".work/generated", { recursive: true });
for (const theme of AVAILABLE_THEMES)
  for (let seed = 1; seed <= 30; seed++) {
    const id = `${theme}-128-${seed}`,
      path = `.work/generated/${id}.json`;
    if (
      existsSync(path) &&
      JSON.parse(readFileSync(path, "utf8")).measurementVersion === 2
    )
      continue;
    const r = generate(
      makeSpec({
        theme,
        seed,
        size: { x: 128, y: 128 },
        designedFor: "normal",
      }),
    );
    const { m, v } = measureFile(r.file, {
      spec: r.spec,
      features: r.features,
      water: { model: r.built.waterModel, settled: r.built.settle },
    });
    const shape = terrainMetrics(
      r.built.heights,
      128,
      128,
      v.water,
      r.built.waterModel.floor,
    );
    let cliMatch: null | boolean = null;
    if (theme === "riverValley") {
      const cli = `.work/default-cli/128/River Valley (${seed}).timber`;
      if (existsSync(cli)) {
        cliMatch =
          createHash("sha256").update(readFileSync(cli)).digest("hex") ===
          createHash("sha256").update(r.bytes).digest("hex");
        if (!cliMatch) throw Error(`tools/gen.ts differs for seed ${seed}`);
      }
    }
    const row = {
      measurementVersion: 2,
      waterFloorRaisedCells: r.built.waterModel.floor.reduce(
        (n, h, i) => n + (h !== r.built.heights[i] ? 1 : 0),
        0,
      ),
      id,
      theme,
      seed,
      size: 128,
      passed: r.report.passed,
      attempts: r.attempts,
      cliMatch,
      checks: r.report.checks.map((c) => ({
        id: c.id,
        ok: c.ok,
        advisory: !!c.advisory,
        applicable: c.applicable !== false,
        value: c.value,
        limit: c.limit,
      })),
      ...shape,
      natural: m.natural,
      convertedNatural: m.natural,
      water: m.water,
      dams: m.dams,
      coreMetrics: m.metrics,
      features: featureVector(m),
      layout: m.layout,
    };
    writeFileSync(path, JSON.stringify(row));
    console.log(`generated ${id} ${row.passed ? "pass" : "FAIL"}`);
  }
