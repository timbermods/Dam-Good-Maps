import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { PNG } from "pngjs";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
process.chdir(fileURLToPath(root));
for (const d of [".cache/tiles", ".cache/patches", "data"])
  mkdirSync(d, { recursive: true });
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
async function download(url: string): Promise<Buffer> {
  for (let k = 0; k < 5; k++)
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw Error(`${r.status} ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (k === 4) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** k));
    }
  throw Error("unreachable");
}
function insideRing(x: number, y: number, ring: number[][]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if (
      ring[i][1] > y !== ring[j][1] > y &&
      x <
        ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) /
          (ring[j][1] - ring[i][1]) +
          ring[i][0]
    )
      c = !c;
  return c;
}
async function locations() {
  if (existsSync("data/locations.json"))
    return JSON.parse(readFileSync("data/locations.json", "utf8"));
  const text = readFileSync("anchors.csv", "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  const out: any[] = [];
  for (const [a, line] of text.entries()) {
    const [family, name, la, lo] = line.split(",");
    for (const [k, [dx, dy]] of [
      [0, 0],
      [6000, 0],
      [0, 6000],
      [-6000, -6000],
    ].entries()) {
      const lat = +la + dy / 111195,
        lon = +lo + dx / (111195 * Math.cos((+la * Math.PI) / 180));
      out.push({
        id: `n${String(a * 4 + k).padStart(3, "0")}`,
        region: `r${a}`,
        name: `Near ${name}${k ? ` (${["", "east", "north", "southwest"][k]} sample)` : ""}`,
        lat,
        lon,
        family,
        cohort: "named",
        anchor: { lat: +la, lon: +lo },
        offsetMetres: [dx, dy],
        classification:
          "regional sampling stratum; not a verified feature at each centre",
        map: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`,
      });
    }
  }
  const url =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";
  const raw = await download(url);
  writeFileSync(".cache/land.geojson", raw);
  const polys = JSON.parse(raw.toString()).features.flatMap((f: any) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates,
  );
  let state = 240925;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  let tries = 0;
  while (out.length < 450) {
    tries++;
    const lon = rand() * 360 - 180,
      lat =
        (Math.asin((rand() * 2 - 1) * Math.sin((80 * Math.PI) / 180)) * 180) /
        Math.PI;
    if (
      !polys.some(
        (p: number[][][]) =>
          insideRing(lon, lat, p[0]) &&
          !p.slice(1).some((r) => insideRing(lon, lat, r)),
      )
    )
      continue;
    const j = out.length - 400;
    out.push({
      id: `u${String(j).padStart(3, "0")}`,
      region: `u${j}`,
      name: `Random land ${j + 1}`,
      lat,
      lon,
      family: "random",
      cohort: "random",
    });
  }
  writeFileSync(
    "data/random-design.json",
    JSON.stringify(
      {
        seed: 240925,
        method:
          "uniform longitude and sine(latitude), rejection against Natural Earth 110m land, latitude -80..80",
        landMask: url,
        sha256: hash(raw),
        draws: tries,
        accepted: 50,
      },
      null,
      2,
    ),
  );
  writeFileSync("data/locations.json", JSON.stringify(out, null, 2));
  return out;
}
const mem = new Map<string, Promise<any>>();
async function tile(z: number, x: number, y: number) {
  x = (x + 2 ** z) % 2 ** z;
  const key = `${z}-${x}-${y}`;
  if (mem.has(key)) return mem.get(key);
  const task = (async () => {
    const path = `.cache/tiles/${key}.png`;
    let b: Buffer;
    if (existsSync(path)) b = readFileSync(path);
    else {
      b = await download(
        `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`,
      );
      const p = PNG.sync.read(b);
      if (p.width !== 256 || p.height !== 256) throw Error("Bad tile");
      writeFileSync(path, b);
      appendFileSync(
        ".cache/tile-log.jsonl",
        JSON.stringify({
          z,
          x,
          y,
          sha256: hash(b),
          bytes: b.length,
          accessed: new Date().toISOString(),
        }) + "\n",
      );
    }
    const png = PNG.sync.read(b);
    const heights = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) {
      if (png.data[i * 4 + 3] === 0) throw Error(`Missing DEM pixel ${key}`);
      heights[i] =
        png.data[i * 4] * 256 +
        png.data[i * 4 + 1] +
        png.data[i * 4 + 2] / 256 -
        32768;
    }
    return heights;
  })();
  mem.set(key, task);
  return task;
}
async function patch(loc: any, size: number, metres: number) {
  const key = `${loc.id}-${size}-${metres}`,
    path = `.cache/patches/${key}.f32.gz`;
  if (existsSync(path) && existsSync(`.cache/patches/${key}.json`)) return;
  const halo = 32,
    W = size + halo * 2;
  const z = Math.max(
    0,
    Math.min(
      14,
      Math.ceil(
        Math.log2(
          (156543.033928 * Math.cos((loc.lat * Math.PI) / 180)) / metres,
        ),
      ),
    ),
  );
  const points: { x: number; y: number }[] = [];
  const keys = new Set<string>();
  const tiles = new Map<string, Float32Array>();
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const lat = loc.lat + ((y - (W - 1) / 2) * metres) / 111195,
        lon =
          loc.lon +
          ((x - (W - 1) / 2) * metres) /
            (111195 * Math.cos((loc.lat * Math.PI) / 180));
      const px = ((lon + 180) / 360) * 2 ** z * 256 - 0.5,
        py =
          ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) *
            2 ** z *
            256 -
          0.5;
      points.push({ x: px, y: py });
      for (const xx of [Math.floor(px), Math.floor(px) + 1])
        for (const yy of [Math.floor(py), Math.floor(py) + 1])
          keys.add(`${Math.floor(xx / 256)},${Math.floor(yy / 256)}`);
    }
  await Promise.all(
    [...keys].map(async (k) => {
      const [x, y] = k.split(",").map(Number);
      tiles.set(k, await tile(z, x, y));
    }),
  );
  const pixel = (x: number, y: number) =>
    tiles.get(`${Math.floor(x / 256)},${Math.floor(y / 256)}`)![
      (((y % 256) + 256) % 256) * 256 + (((x % 256) + 256) % 256)
    ];
  const h = new Float32Array(W * W);
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < h.length; i++) {
    const p = points[i],
      x = Math.floor(p.x),
      y = Math.floor(p.y),
      a = p.x - x,
      b = p.y - y;
    h[i] =
      (pixel(x, y) * (1 - a) + pixel(x + 1, y) * a) * (1 - b) +
      (pixel(x, y + 1) * (1 - a) + pixel(x + 1, y + 1) * a) * b;
    min = Math.min(min, h[i]);
    max = Math.max(max, h[i]);
  }
  writeFileSync(path, gzipSync(new Uint8Array(h.buffer)));
  writeFileSync(
    `.cache/patches/${key}.json`,
    JSON.stringify({
      key,
      location: loc.id,
      size,
      metres,
      halo,
      z,
      sourcePixelMetres:
        (156543.033928 * Math.cos((loc.lat * Math.PI) / 180)) / 2 ** z,
      min,
      max,
      sha256: hash(new Uint8Array(h.buffer)),
      tiles: [...keys].map((k) => `${z}/${k}`),
    }),
  );
}
const locs = await locations();
const selection = process.argv.includes("--pilot")
  ? locs.filter((_: any, i: number) => i % 20 === 0)
  : locs;
let index = 0,
  done = 0;
const failures: any[] = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (;;) {
      const loc = selection[index++];
      if (!loc) return;
      try {
        for (const metres of [30, 60, 120])
          for (const size of [96, 128, 256]) await patch(loc, size, metres);
        done++;
        console.log(`sample ${done}/${selection.length} ${loc.id} ${loc.name}`);
      } catch (e) {
        failures.push({ id: loc.id, error: String(e) });
        console.error(loc.id, String(e));
      }
      if (mem.size > 300) mem.clear();
    }
  }),
);
writeFileSync(
  "data/acquisition.json",
  JSON.stringify(
    {
      requested: selection.length,
      completed: done,
      failures,
      patchesPerLocation: 9,
      source: "s3://elevation-tiles-prod/terrarium",
      retrieved: new Date().toISOString(),
    },
    null,
    2,
  ),
);
if (!existsSync("ATTRIBUTION.md")) {
  const b = await download(
    "https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md",
  );
  writeFileSync(
    "ATTRIBUTION.md",
    "# Survey attribution\n\nTerrain Tiles accessed 2026-09-25 from https://registry.opendata.aws/terrain-tiles/.\nData: `s3://elevation-tiles-prod/terrarium`. Provider notices below apply to every derived fixture and preview. The source is a regional mosaic; exact provider identity is not available in each PNG.\n\nChanges: bilinear resampling, cropped patches, vertical compression and integer quantisation; inferred sources; local edge sealing; simulated water and planted game resources. These are modified data, not endorsed by the providers.\n\nRandom land mask: Natural Earth, public domain, https://www.naturalearthdata.com/about/terms-of-use/.\n\nThe following upstream notice is preserved from https://github.com/tilezen/joerd/blob/master/docs/attribution.md (SHA-256 " +
      hash(b) +
      ").\n\n" +
      b.toString(),
  );
}
if (failures.length) process.exitCode = 1;
writeFileSync(
  "data/patch-manifest.jsonl.gz",
  gzipSync(
    readdirSync(".cache/patches")
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => readFileSync(".cache/patches/" + f, "utf8"))
      .join("\n") + "\n",
  ),
);
writeFileSync(
  "data/tile-manifest.jsonl.gz",
  gzipSync(readFileSync(".cache/tile-log.jsonl")),
);
