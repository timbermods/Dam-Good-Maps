// Real places (ROADMAP "Real places", PLAN §20 D136): turn the landscape survey's library
// (investigation/landscapes/library/) into the gallery's own data, under public/real-places/.
//
//   npm run places                         (writes public/real-places/)
//   npm run places -- --check              (writes nothing; fails when the committed files differ)
//   npm run places -- --only glencoe       (builds and checks the places named, writes nothing)
//
// For every named place in the library (the three random-land controls are survey controls, not
// places, and stay out) it writes:
// - data/<id>.json.gz: the place's heights, water sources, start and planted objects, with its
//   title, landform family, scale and a plain line on how it plays (src/core/places/place.ts);
// - index.json: every place for the gallery page, with the survey's own name, and the size and
//   sha256 of its .timber.
// The card pictures (cards/<id>.webp, the 3D overview, and cards/<id>-top.webp, the map from above)
// are rendered in the 3D view by tools/places-thumbs.ts; the index keeps the sha256 of the .timber
// they show (imageFrom), so a changed map shows.
// Each .timber is built with src/core/places (build, settle, validate, write) and must pass the
// export profile and every check of the generate profile; the tool stops on any that does not.
// Everything it writes is the same bytes on every run. The site's .timber files themselves are
// built at deploy time (tools/places-build.ts, `npm run places:build`), and must match the index.
//
// The product never imports from investigation/ (tests/unit/boundaries.test.ts); this tool reads the
// library's data files at run time, as tools may.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync, strToU8 } from "fflate";
import { entityJson } from "../src/core/format/entities";
import { stringify } from "../src/core/format/json";
import {
  buildPlace,
  decodeHeights,
  encodeHeights,
  encodeTiles,
  placeEntities,
  placeFileName,
  validatePlace,
  PLACE_FORMAT,
  type PlaceData,
  type PlaceIndex,
  type PlaceIndexEntry,
} from "../src/core/places/place";
import { writeTimber } from "../src/core/format/timber";
import { validateMap } from "../src/core/validate/checks";

const LIBRARY = "investigation/landscapes/library";
const OUT = "public/real-places";

/** Each family's name on the page and how it plays: the survey's "play value" for the family
 *  (investigation/landscapes/FAMILIES.md), in plain words. A family label names the region the
 *  survey sampled, so the line says what the landform tends to give. */
const FAMILIES: Record<string, { name: string; plays: string }> = {
  archipelago: { name: "Archipelago", plays: "Islands split the land into many routes; plan how you cross." },
  badlands: { name: "Badlands", plays: "Gullies cut many small narrows and walls; flat land for farms is scarce." },
  braided: { name: "Braided river", plays: "Channels split around gravel islands, so you have several places to dam." },
  caldera: { name: "Caldera", plays: "A volcanic bowl; a dam on its outlet can hold a large lake." },
  canyon: { name: "Canyon", plays: "Narrow places to dam and high ground to claim; flat land is scarce." },
  coast: { name: "Coast", plays: "Cliffs and small basins along the shore." },
  cone: { name: "Volcano", plays: "Land falls away from a peak on every side, so you build upward." },
  confluence: { name: "River junction", plays: "Rivers meet, so dam sites and routes out compete." },
  delta: { name: "Delta", plays: "Many small channels and islands; storage is shallow and flooding is a risk." },
  escarpment: { name: "Escarpment", plays: "A steep face splits high and low ground, with a few ways through." },
  falls: { name: "Waterfall", plays: "Drops in the river give height and power; storage depends on the pools above them." },
  fan: { name: "Alluvial fan", plays: "Dry land fans out from a valley mouth; irrigation decides where you grow." },
  fjord: { name: "Fjord", plays: "Steep shores and wide water to store." },
  glacial: { name: "Glacial valley", plays: "Wide valley floors under high ground, with side valleys hanging above." },
  gorge: { name: "Gorge", plays: "Short dams and falls; room beside the water is tight." },
  karst: { name: "Karst", plays: "Steep hills around separate basins; routes between them take planning." },
  lakes: { name: "Lakes", plays: "Chains of lakes store water; their outlets decide how far each can grow." },
  meander: { name: "Winding river", plays: "A winding river; cut-off bends can keep water through a drought." },
  mesa: { name: "Mesa", plays: "Flat-topped heights that are hard to reach; the gaps between them make dam sites." },
  plateau: { name: "Plateau", plays: "Broad high ground to build on; deep water may be hard to reach." },
};

/** Titles (Kyler, 2026-09-25): the survey's name without "Near", the "(… sample)" suffix and the
 *  scale. Titles that still read awkwardly are tidied here, keyed by that shortened name.
 *  "Badwater" is a place name in Death Valley, and a hazard in Timberborn: that map has none. */
const TIDY: Record<string, string> = {
  "Thousand Islands Saint Lawrence": "Thousand Islands",
  "Lena delta": "Lena Delta",
  "Death Valley Badwater fan": "Death Valley",
  "English Lake District": "Lake District",
  "Aso caldera": "Aso Caldera",
  "Danube delta": "Danube Delta",
  "Western Ghats Mahabaleshwar": "Mahabaleshwar, Western Ghats",
  "Roaring River fan": "Roaring River Fan",
  "Chilean Aysen fjord": "Aysen Fjord",
  "Finnish Saimaa": "Lake Saimaa",
  "Ennedi plateau": "Ennedi Plateau",
  "Grand Canyon Colorado": "Grand Canyon",
  "Na Pali coast": "Na Pali Coast",
  "Godavari delta": "Godavari Delta",
  "Niagara escarpment Hamilton": "Niagara Escarpment",
  "Taklimakan Kunlun fan": "Kunlun Alluvial Fan",
  "Dinaric karst Plitvice": "Plitvice Lakes",
  "Lower Mississippi oxbows": "Mississippi Oxbows",
  "Skeidara outwash": "Skeidara Outwash",
  "Blue Mountains Jamison": "Blue Mountains",
  "Atacama fan": "Atacama Fan",
  "Kenai Aialik Bay": "Aialik Bay",
  "Aoraki Hooker Valley": "Hooker Valley",
  "Li River Yangshuo": "Li River",
  "Goosenecks San Juan": "Goosenecks of the San Juan",
  "Brahmaputra near Majuli": "Majuli, Brahmaputra",
  "Ilulissat icefjord": "Ilulissat Icefjord",
  "Tsingy Bemaraha": "Tsingy de Bemaraha",
};

/** How a title reads in the description's sentence, "Inspired by the land near …": the titles that
 *  take "the", and two that need more words. The rest read as they are. */
const THE = new Set([
  "Thousand Islands", "Toklat River", "Colca Canyon", "Twelve Apostles", "Rhine and Moselle", "Lena Delta", "Drakensberg Amphitheatre",
  "Geirangerfjord", "Lake District", "Uvac River", "Ethiopian Highlands", "Tagliamento River", "Blyde River Canyon", "Cliffs of Moher",
  "Alaknanda and Bhagirathi", "Danube Delta", "Roaring River Fan", "Aysen Fjord", "Verdon Gorge", "Chocolate Hills", "Kinabatangan River",
  "Ennedi Plateau", "Deccan Plateau", "Bardenas Reales", "Waimakariri River", "Grand Canyon", "Na Pali Coast", "Godavari Delta",
  "Niagara Escarpment", "Kunlun Alluvial Fan", "Plitvice Lakes", "Mississippi Oxbows", "Bungle Bungle", "Tibetan Plateau",
  "Painted Desert", "Skeidara Outwash",
  "Fish River Canyon", "Blue Mountains", "Atacama Fan", "Hooker Valley", "Todgha Gorge", "Li River", "Goosenecks of the San Juan",
  "Colorado Plateau", "Ilulissat Icefjord", "Tara Gorge", "Tsingy de Bemaraha", "Mamore River", "Altiplano",
]);
const NEAR: Record<string, string> = {
  "Mahabaleshwar, Western Ghats": "Mahabaleshwar, in the Western Ghats",
  "Majuli, Brahmaputra": "Majuli, on the Brahmaputra",
};

/** A survey name, "Near Grand Canyon Colorado (southwest sample), 60 m per tile": the map's title,
 *  the place in a sentence, and the part of the place sampled. */
function title(surveyName: string): { name: string; place: string; sample?: string } {
  const m = /^Near (.+?)(?: \((north|south|east|west|northeast|northwest|southeast|southwest) sample\))?, \d+ m per tile$/.exec(surveyName);
  if (!m) throw new Error(`unexpected survey name ${surveyName}`);
  const name = TIDY[m[1]] ?? m[1];
  return { name, place: NEAR[name] ?? (THE.has(name) ? `the ${name}` : name), ...(m[2] ? { sample: m[2] } : {}) };
}

interface LibraryItem {
  id: string;
  name: string;
  family: string;
  lat: number;
  lon: number;
  size: number;
  metres: number;
  fixture: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function slug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

type Fixture = {
  W: number;
  H: number;
  heights: number[];
  waterSources: { x: number; y: number; strength: number }[];
  start: { x: number; y: number; z: number; orientation: string } | null;
  entities: Record<string, unknown>[];
  metres: number;
};

/** A library fixture as place data. Every object is checked against what the place's builders
 *  write, so the map is the survey's, object for object. */
function toPlace(item: LibraryItem, fx: Fixture): PlaceData {
  const W = fx.W;
  const H = fx.H;
  if (W !== H || W !== item.size) throw new Error(`${item.id}: size ${W}×${H}, index says ${item.size}`);
  if (!fx.start) throw new Error(`${item.id}: no start`);
  const heights = Uint8Array.from(fx.heights);
  const { name, place: near } = title(item.name);
  // plain titles: the game's handling of other characters is not yet checked
  if (!/^[A-Za-z][A-Za-z ,'-]*[a-z]$/.test(name) || /\bNear\b|sample/.test(name)) throw new Error(`${item.id}: unexpected title ${name}`);
  const fam = FAMILIES[item.family];
  if (!fam) throw new Error(`${item.id}: no family text for ${item.family}`);
  const kinds: Record<"bushes" | "pines" | "birches" | "oaks" | "deadPines" | "ruins", number[]> = { bushes: [], pines: [], birches: [], oaks: [], deadPines: [], ruins: [] };
  let starts = 0;
  let sources = 0;
  for (const e of fx.entities) {
    const comps = e.Components as Record<string, Record<string, unknown>>;
    const c = comps.BlockObject.Coordinates as { X: number; Y: number; Z: number };
    const i = c.Y * W + c.X;
    if (c.Z !== heights[i]) throw new Error(`${item.id}: ${String(e.Template)} at ${c.X},${c.Y} stands at ${c.Z}, ground ${heights[i]}`);
    switch (e.Template) {
      case "WaterSource":
        sources++;
        break;
      case "StartingLocation":
        starts++;
        if (c.X !== fx.start.x || c.Y !== fx.start.y) throw new Error(`${item.id}: start entity and start differ`);
        break;
      case "BlueberryBush":
        kinds.bushes.push(i);
        break;
      case "Pine":
        (comps.LivingNaturalResource ? kinds.deadPines : kinds.pines).push(i);
        break;
      case "Birch":
        kinds.birches.push(i);
        break;
      case "Oak":
        kinds.oaks.push(i);
        break;
      case "RuinColumnH2":
        kinds.ruins.push(i);
        break;
      default:
        throw new Error(`${item.id}: unexpected object ${String(e.Template)}`);
    }
  }
  if (starts !== 1) throw new Error(`${item.id}: ${starts} starts`);
  if (sources !== fx.waterSources.length) throw new Error(`${item.id}: ${sources} source objects, ${fx.waterSources.length} sources`);
  const place: PlaceData = {
    format: PLACE_FORMAT,
    id: slug(name),
    name,
    place: near,
    family: item.family,
    familyName: fam.name,
    plays: fam.plays,
    metres: item.metres,
    lat: item.lat,
    lon: item.lon,
    W,
    H,
    heights: encodeHeights(heights),
    sources: fx.waterSources.map((s) => [s.x, s.y, s.strength]),
    start: [fx.start.x, fx.start.y],
    bushes: encodeTiles(kinds.bushes),
    pines: encodeTiles(kinds.pines),
    birches: encodeTiles(kinds.birches),
    oaks: encodeTiles(kinds.oaks),
    deadPines: encodeTiles(kinds.deadPines),
    ruins: encodeTiles(kinds.ruins),
  };
  // the builders write exactly the survey's objects (ids aside)
  const plain = (o: unknown) => JSON.parse(JSON.stringify(o));
  const key = (e: Record<string, unknown>) => {
    const { Id: _id, ...rest } = e;
    return JSON.stringify(rest);
  };
  const ours = new Set(placeEntities(place, decodeHeights(place.heights)).map((s) => key(JSON.parse(stringify(entityJson(s))))));
  for (const e of fx.entities) {
    if (!ours.has(key(plain(e)))) throw new Error(`${item.id}: ${String(e.Template)} ${JSON.stringify(e.Components)} is not what the place writes`);
  }
  if (ours.size !== fx.entities.length) throw new Error(`${item.id}: ${ours.size} objects written, ${fx.entities.length} in the survey`);
  return place;
}

// ------------------------------------------------------------------------------------------ run

const check = process.argv.includes("--check");
const only = arg("only")?.split(",") ?? null;
const library = JSON.parse(readFileSync(join(LIBRARY, "index.json"), "utf8")) as { items: LibraryItem[] };
const items = library.items.filter((it) => it.family !== "random");
const skipped = library.items.filter((it) => it.family === "random");

const files = new Map<string, Uint8Array>();
const entries: PlaceIndexEntry[] = [];
/** The card pictures rendered so far: which map each shows (tools/places-thumbs.ts). */
const shown = new Map((existsSync(join(OUT, "index.json")) ? (JSON.parse(readFileSync(join(OUT, "index.json"), "utf8")) as PlaceIndex).places : []).map((p) => [p.id, p.imageFrom]));
let failures = 0;
const t0 = performance.now();
for (const item of items) {
  const fx = JSON.parse(new TextDecoder().decode(gunzipSync(new Uint8Array(readFileSync(join(LIBRARY, item.fixture)))))) as Fixture;
  const place = toPlace(item, fx);
  if (only && !only.includes(place.id)) continue;
  if (entries.some((e) => e.id === place.id)) throw new Error(`two places are called ${place.name}`);
  const t = performance.now();
  const built = buildPlace(place);
  const v = validatePlace(built);
  const strict = validateMap(built.file, { profile: "generate", designedFor: "normal", features: [], water: { model: built.model, settled: built.settle } });
  const bytes = writeTimber(built.file);
  const ms = Math.round(performance.now() - t);
  const blocking = v.report.checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false && !c.approximate);
  if (!v.report.passed || !strict.report.passed) failures++;
  const strictFails = strict.report.checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false && !c.approximate).map((c) => c.id);
  console.log(
    `${v.report.passed ? "ok  " : "FAIL"} ${place.W}² ${String(ms).padStart(6)} ms  ticks ${String(built.settle.ticks).padStart(5)}${built.settle.settled ? "" : " (not settled)"}  ${place.name}` +
      (blocking.length ? `  export: ${blocking.map((c) => c.id).join(", ")}` : "") +
      (strictFails.length ? `  generate profile: ${strictFails.join(", ")}` : ""),
  );
  const data = gzipSync(strToU8(JSON.stringify(place)), { level: 9, mtime: 0 });
  files.set(`data/${place.id}.json.gz`, data);
  const { sample } = title(item.name);
  entries.push({
    id: place.id,
    name: place.name,
    surveyName: item.name,
    ...(sample ? { sample } : {}),
    family: place.family,
    familyName: place.familyName,
    plays: place.plays,
    size: place.W,
    metres: place.metres,
    data: `data/${place.id}.json.gz`,
    image: `cards/${place.id}.webp`,
    topImage: `cards/${place.id}-top.webp`,
    ...(shown.get(place.id) ? { imageFrom: shown.get(place.id) } : {}),
    file: `maps/${place.id}.timber`,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
  if (placeFileName(place) !== `${place.name}.timber`) throw new Error("file name");
}
if (failures) {
  console.error(`${failures} place(s) failed a check: nothing written`);
  process.exit(1);
}

// the gallery keeps the library's order: rounds of one place per family, so neighbours differ
const families = [...new Set(entries.map((e) => e.family))].map((id) => ({ id, name: FAMILIES[id].name })).sort((a, b) => a.name.localeCompare(b.name));
const index: PlaceIndex = { format: 1, count: entries.length, families, sizes: [...new Set(entries.map((e) => e.size))].sort((a, b) => a - b), places: entries };
files.set("index.json", strToU8(JSON.stringify(index, null, 1) + "\n"));

const total = [...files.values()].reduce((s, b) => s + b.length, 0);
const dataBytes = [...files].filter(([k]) => k.startsWith("data/")).reduce((s, [, b]) => s + b.length, 0);
console.log(
  `${entries.length} places in ${Math.round((performance.now() - t0) / 1000)} s; left out ${skipped.length} random-land controls (${skipped.map((s) => s.id).join(", ")}). ` +
    `Data ${(dataBytes / 1024).toFixed(0)} KB, total ${(total / 1024).toFixed(0)} KB.`,
);
const stale = entries.filter((e) => e.imageFrom !== e.sha256).length;
if (stale) console.log(`${stale} card picture(s) do not show the current map: run npm run places:thumbs`);

if (only) {
  console.log("--only: nothing written");
  process.exit(0);
}
if (check) {
  const differ: string[] = [];
  for (const [k, b] of files) {
    const p = join(OUT, k);
    if (!existsSync(p) || sha256(new Uint8Array(readFileSync(p))) !== sha256(b)) differ.push(k);
  }
  if (existsSync(join(OUT, "data"))) for (const f of readdirSync(join(OUT, "data"))) if (!files.has(`data/${f}`)) differ.push(`data/${f} (not made any more)`);
  if (differ.length) {
    console.error(`public/real-places differs from a fresh run: ${differ.join(", ")}. Run npm run places.`);
    process.exit(1);
  }
  console.log("public/real-places matches a fresh run");
  process.exit(0);
}
// the card pictures stay (tools/places-thumbs.ts renders them); pictures of places gone are removed
rmSync(join(OUT, "data"), { recursive: true, force: true });
if (existsSync(join(OUT, "cards"))) for (const f of readdirSync(join(OUT, "cards"))) if (!entries.some((e) => e.image === `cards/${f}` || e.topImage === `cards/${f}`)) rmSync(join(OUT, "cards", f));
for (const [k, b] of files) {
  const p = join(OUT, k);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, b);
}
console.log(`wrote ${files.size} files to ${OUT}`);
