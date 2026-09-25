import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import { measureInput } from "./bench/measure";
import { crop, quantise } from "./lib/terrain";
import { writeTimber } from "../../src/core/format/timber";
for (const p of ["library", "library/previews", ".work/oracle"])
  mkdirSync(p, { recursive: true });
const rows = readdirSync(".work/rows")
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(".work/rows/" + f, "utf8")));
const qualityFlags = JSON.parse(
  readFileSync("data/quality-flags.json", "utf8"),
);
const eligible = rows.filter(
  (r) =>
    !qualityFlags[r.region]?.excludeFromLibrary &&
    r.cap === 16 &&
    r.passed &&
    r.mapping.readabilityProxy &&
    r.mapping.reliefMetres >= 5 &&
    existsSync(`.work/candidates/${r.id}.json.gz`),
);
const families = [...new Set(eligible.map((r) => r.family))].sort();
const chosen: any[] = [],
  regions = new Set<string>();
const score = (r: any) =>
  r.mapping.shapeCorrelation * 100 +
  (r.mode === "normalised" ? 20 : 0) -
  r.mapping.saturatedShare * 10 -
  r.checks.filter((c: any) => !c.ok).length * 2;
for (let round = 0; round < 5; round++)
  for (const family of families) {
    const options = eligible.filter(
      (r) => r.family === family && !regions.has(r.region),
    );
    const desired = [128, 96, 256, 128, 96][round];
    options.sort(
      (a, b) =>
        (b.size === desired ? 10 : 0) +
          score(b) -
          (a.size === desired ? 10 : 0) -
          score(a) || a.id.localeCompare(b.id),
    );
    if (options.length) {
      chosen.push(options[0]);
      regions.add(options[0].region);
    }
    if (chosen.length >= 90) break;
  }
if (!process.argv.includes("--partial") && chosen.length < 60)
  throw Error(`Only ${chosen.length} eligible independent regions`);
const index: any[] = [];
for (const r of chosen.slice(0, 90)) {
  const path = `library/${r.id}.json.gz`;
  let fixture: any;
  const raw = JSON.parse(
    gunzipSync(readFileSync(`.work/candidates/${r.id}.json.gz`)).toString(),
  );
  // Batch candidates preserve the core's JsonFloat wrappers. The public fixture stores JSON numbers.
  fixture = JSON.parse(JSON.stringify(raw), (_k, v) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).every((k) => k === "value" || k === "raw") &&
    typeof v.value === "number"
      ? v.value
      : v,
  );
  const key = `${r.location}-${r.size}-${r.metres}`,
    b = gunzipSync(readFileSync(`.cache/patches/${key}.f32.gz`)),
    dem = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  fixture.referenceHeights = Array.from(
    quantise(crop(dem, r.size + 64, r.size, 32), r.mode, 16).heights,
  );
  fixture.attribution = "../ATTRIBUTION.md";
  fixture.notice =
    "Modified Terrain Tiles for testing and optional import. Never a generator template.";
  const result = measureInput(fixture);
  if (!result.v.report.passed)
    throw Error(
      `Curated fixture failed revalidation: ${r.id}: ${result.v.report.checks.filter((c) => !c.ok && !c.advisory).map((c) => c.id)}`,
    );
  fixture.validation.checks = result.v.report.checks.map((c) => ({
    id: c.id,
    ok: c.ok,
    advisory: !!c.advisory,
    applicable: c.applicable !== false,
    value: c.value,
    limit: c.limit,
  }));
  const packed = gzipSync(JSON.stringify(fixture));
  writeFileSync(path, packed);
  writeFileSync(`.work/oracle/${r.id}.timber`, writeTimber(result.file));
  // A sidecar supplies an explicit empty feature list, so Python also checks outflow.
  writeFileSync(
    `.work/oracle/${r.id}.damgoodmaps.json`,
    JSON.stringify({ spec: null, features: [] }),
  );
  const W = fixture.W,
    png = new PNG({ width: W, height: W });
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        k = ((W - 1 - y) * W + x) * 4,
        h = fixture.heights[i],
        d = result.water.depth[i];
      const slope =
        (x ? fixture.heights[i - 1] - h : 0) +
        (y ? fixture.heights[i - W] - h : 0);
      const shade = Math.max(0.6, Math.min(1.3, 1 + slope * 0.12));
      const rgb =
        d > 0.05
          ? [38, 123 + Math.min(40, d * 10), 185]
          : [90 + h * 5, 117 + h * 3, 73 + h * 4];
      for (let c = 0; c < 3; c++)
        png.data[k + c] = Math.min(255, rgb[c] * shade);
      png.data[k + 3] = 255;
    }
  // Show terrain and water clearly. Planted resources remain in the fixture;
  // thousands of one-pixel markers would obscure the landform in a small preview.
  if (fixture.start) {
    const { x, y } = fixture.start;
    for (let dy = -1; dy <= 3; dy++)
      for (let dx = -1; dx <= 3; dx++)
        if (dx === -1 || dx === 3 || dy === -1 || dy === 3) {
          const k = ((W - 1 - y - dy) * W + x + dx) * 4;
          png.data[k] = 255;
          png.data[k + 1] = 79;
          png.data[k + 2] = 38;
        }
  }
  const preview = `library/previews/${r.id}.png`;
  writeFileSync(preview, PNG.sync.write(png));
  index.push({
    id: r.id,
    name: fixture.name,
    family: r.family,
    region: r.region,
    lat: fixture.location.lat,
    lon: fixture.location.lon,
    size: r.size,
    metres: r.metres,
    mode: r.mode,
    fixture: path.slice(8),
    preview: preview.slice(8),
    bytes: packed.length + statSync(preview).size,
    sha256: createHash("sha256").update(packed).digest("hex"),
    advisories: fixture.validation.checks
      .filter((c: any) => !c.ok && c.advisory)
      .map((c: any) => c.id),
  });
  console.log(`curated ${index.length}/${chosen.length} ${r.id}`);
}
const bytes = index.reduce((s, r) => s + r.bytes, 0);
if (bytes >= 10_000_000) throw Error(`Library exceeds 10 MB: ${bytes}`);
writeFileSync(
  "library/index.json",
  JSON.stringify(
    {
      schema: 1,
      count: index.length,
      bytes,
      attribution: "../ATTRIBUTION.md",
      items: index,
    },
    null,
    2,
  ),
);
// A later full run can replace an earlier preview selection. Remove only this
// script's obsolete fixture/preview names, after the replacement index is saved.
const keepFixtures = new Set(index.map((r) => r.fixture));
const keepPreviews = new Set(
  index.map((r) => r.preview.slice("previews/".length)),
);
for (const name of readdirSync("library"))
  if (
    /^[nu]\d{3}-\d+-(30|60|120)-(linear|compressed|normalised)-16\.json\.gz$/.test(
      name,
    ) &&
    !keepFixtures.has(name)
  )
    unlinkSync("library/" + name);
for (const name of readdirSync("library/previews"))
  if (
    /^[nu]\d{3}-\d+-(30|60|120)-(linear|compressed|normalised)-16\.png$/.test(
      name,
    ) &&
    !keepPreviews.has(name)
  )
    unlinkSync("library/previews/" + name);
writeFileSync(
  "library/README.md",
  "# Landscape fixtures\n\n" +
    index.length +
    " converted patches from distinct sampling regions. Every fixture passed the unchanged TypeScript generate-profile checks after a fresh settle. Advisory failures remain in each file.\n\nOpen [gallery.html](gallery.html) for previews. Red marks the start; blue is simulated water. North is up.\n\nEach gzip JSON stores row-major heights (y increases north), sources, start anchor, game entities, location, mapping, attribution and checks. `referenceHeights` keeps the same quantised patch before edge sealing, for fair terrain measurements. `heights` is the playable conversion. Sources and resources are simulated or placed for the game.\n\nUse these for regression tests, tuning and an optional M11 import. Never load these into the generator as templates. See [attribution](../ATTRIBUTION.md).\n",
);
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync(
  "library/gallery.html",
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Real landscape fixtures</title><style>body{font:16px system-ui;background:#f0ede3;color:#263529;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}article{background:white;padding:15px}img{width:100%;image-rendering:pixelated}h1{font-size:28px}h2{font-size:18px}p{line-height:1.5}a{color:#225d62}</style><h1>Real landscape fixtures</h1><p>' +
    index.length +
    ' test fixtures. Blue is simulated water. Red marks the start. North is up. These are tuning references, never generator templates. <a href="../ATTRIBUTION.md">Terrain Tiles attribution</a>.</p><main>' +
    index
      .map(
        (r) =>
          `<article><img src="${r.preview}" alt="Quantised height and simulated water for ${escape(r.name)}"><h2>${escape(r.name)}</h2><p>${r.family} · ${r.size}² · ${r.mode}<br>${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</p><p>${r.advisories.length ? "Advisories: " + r.advisories.join(", ") : "No advisories"}</p><a href="${r.fixture}">Fixture JSON.gz</a></article>`,
      )
      .join("") +
    "</main>",
);
writeFileSync(
  "data/library-verification.json",
  JSON.stringify(
    {
      count: index.length,
      bytes,
      typescriptFreshSettlePasses: index.length,
      python: "pending",
    },
    null,
    2,
  ),
);
