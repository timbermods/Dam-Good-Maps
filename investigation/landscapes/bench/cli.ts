import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { measureInput, compare } from "./measure";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const path = arg("input", "");
if (!path)
  throw Error(
    "Usage: npm run bench -- --input map.json[.gz] [--metres 60] [--family all] [--cohort named] [--mode normalised] [--cap 16]",
  );
const b = readFileSync(path),
  input = JSON.parse((path.endsWith(".gz") ? gunzipSync(b) : b).toString());
const { row, v, water } = measureInput(input);
const targets = JSON.parse(
  readFileSync(
    arg(
      "targets",
      fileURLToPath(new URL("../data/targets.json", import.meta.url)),
    ),
    "utf8",
  ),
);
const key = [
  arg("cohort", "named"),
  input.W ?? input.width,
  arg("metres", String(input.metres ?? 60)),
  arg("mode", input.mapping?.mode ?? "normalised"),
  arg("cap", String(input.mapping?.cap ?? 16)),
  arg("family", "all"),
].join("/");
const target = targets.strata[key];
if (!target) throw Error("No matching target stratum: " + key);
console.log(
  JSON.stringify(
    {
      schema: 1,
      target: key,
      settled: water.settled,
      settleTicks: water.ticks,
      validation: {
        profile: "generate",
        passed: v.report.passed,
        failures: v.report.checks
          .filter((c) => !c.ok)
          .map((c) => ({
            id: c.id,
            advisory: !!c.advisory,
            value: c.value,
            limit: c.limit,
          })),
      },
      comparison: compare(row, target),
      measurements: row,
    },
    null,
    2,
  ),
);
