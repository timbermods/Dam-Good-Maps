import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const index = JSON.parse(readFileSync("library/index.json", "utf8"));
const patches = gunzipSync(readFileSync("data/patch-manifest.jsonl.gz"))
  .toString()
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
if (patches.length !== 4050 || new Set(patches.map((r) => r.key)).size !== 4050)
  throw Error("Acquisition coverage or uniqueness failed");
if (
  patches.some(
    (r) =>
      !Number.isFinite(r.min) ||
      !Number.isFinite(r.max) ||
      r.min > r.max ||
      r.min < -12000 ||
      r.max > 9000,
  )
)
  throw Error("Acquisition has a gross elevation range problem");
const rows = gunzipSync(readFileSync("data/converted.jsonl.gz"))
  .toString()
  .trim()
  .split("\n")
  .map((x) => JSON.parse(x));
const baseline = gunzipSync(readFileSync("data/generated.jsonl.gz"))
  .toString()
  .trim()
  .split("\n")
  .map((x) => JSON.parse(x));
if (rows.length !== 16200 || new Set(rows.map((r) => r.id)).size !== 16200)
  throw Error("Conversion coverage or uniqueness failed");
if (rows.some((r) => r.measurementVersion !== 2))
  throw Error("Old water measurements remain");
if (rows.some((r) => !r.settled && r.falls !== null))
  throw Error("Unsettled fall statistics must remain unavailable");
if (baseline.length !== 180 || new Set(baseline.map((r) => r.id)).size !== 180)
  throw Error("Baseline coverage or uniqueness failed");
for (const theme of [
  "riverValley",
  "canyon",
  "delta",
  "highlands",
  "islands",
  "lakeBasin",
])
  for (let seed = 1; seed <= 30; seed++)
    if (
      !baseline.some(
        (r) =>
          r.theme === theme && r.seed === seed && r.measurementVersion === 2,
      )
    )
      throw Error("Missing corrected baseline cell");
if (baseline.filter((r) => r.cliMatch === true).length !== 30)
  throw Error("Default CLI parity not established");
const locations = JSON.parse(readFileSync("data/locations.json", "utf8"));
const seen = new Set(rows.map((r) => r.id));
for (const loc of locations)
  for (const size of [96, 128, 256])
    for (const metres of [30, 60, 120])
      for (const [mode, cap] of [
        ["linear", 16],
        ["compressed", 16],
        ["normalised", 16],
        ["normalised", 22],
      ])
        if (!seen.has(`${loc.id}-${size}-${metres}-${mode}-${cap}`))
          throw Error("Missing factorial cell");
const sum = (p: string): number =>
  readdirSync(p, { withFileTypes: true }).reduce(
    (s, f) =>
      s +
      (f.isDirectory()
        ? sum(p + "/" + f.name)
        : statSync(p + "/" + f.name).size),
    0,
  );
const bytes = sum("library");
if (bytes >= 10_000_000) throw Error(`Library exceeds 10 MB: ${bytes}`);
if (index.count < 60 || index.count > 120 || index.items.length !== index.count)
  throw Error("Library must contain 60–120 fixtures");
const problems: any[] = [];
for (const item of index.items) {
  const data = readFileSync("library/" + item.fixture);
  if (createHash("sha256").update(data).digest("hex") !== item.sha256)
    throw Error("Fixture checksum mismatch");
  const f = JSON.parse(gunzipSync(data).toString());
  if (f.heights.some((h: number) => h > 16) || !f.validation.passed)
    throw Error("Invalid library member");
  const py = JSON.parse(
    readFileSync(`.work/oracle/${item.id}.python.json`, "utf8"),
  );
  if (py.fixtureSha256 !== item.sha256) throw Error("Stale Python result");
  if (!py.pythonPassed || py.verdictMismatches.length) problems.push(py);
}
const result = {
  count: index.count,
  bytes,
  typescriptFreshSettlePasses: index.count,
  python: problems.length
    ? `${problems.length} mismatches or failures`
    : `${index.count} fresh settles passed; zero verdict disagreements`,
  coverage: {
    converted: rows.length,
    patches: rows.length / 4,
    locations: locations.length,
    generated: baseline.length,
  },
  acquisitionRangeScreen: {
    patches: patches.length,
    minimumMetres: Math.min(...patches.map((r) => r.min)),
    maximumMetres: Math.max(...patches.map((r) => r.max)),
    plausibilityBoundsMetres: [-12000, 9000],
    note: "Gross-error screen, not a claim about DEM accuracy.",
  },
  problems,
};
writeFileSync(
  "data/library-verification.json",
  JSON.stringify(result, null, 2),
);
writeFileSync(
  "data/python-checks.jsonl.gz",
  Buffer.from(
    (await import("node:zlib")).gzipSync(
      index.items
        .map((r: any) =>
          readFileSync(`.work/oracle/${r.id}.python.json`, "utf8"),
        )
        .join("\n") + "\n",
    ),
  ),
);
console.log(JSON.stringify(result, null, 2));
if (problems.length) process.exitCode = 1;
