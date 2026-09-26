// Real places (ROADMAP "Real places", PLAN §20 D136): the gallery's data, its titles, the credits and
// the in-game description, a sample of every size built, validated and compared byte for byte with
// the index (every place: places-build-*.test.ts, nightly and in the release check), both
// validators on the sample, the editor's import of a place, and the rule that real places never
// feed the generator and are never built in the browser.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { MapSession } from "../../src/core/doc/session";
import { readTimber } from "../../src/core/format/timber";
import { CREDITS_URL, fileNotices, PROVIDERS } from "../../src/core/places/attribution";
import { placeDescription, placeSample, placeTimber } from "../../src/core/places/place";
import { validateMap } from "../../src/core/validate/checks";
import type { CheckResult } from "../../src/core/validate/report";
import { checkPlaces, INDEX, PLACES_DIR, placeData, sha256 } from "./placesCommon";

/** A WebP's width and height (its VP8, VP8L or VP8X header), or null. */
function webpSize(b: Uint8Array): [number, number] | null {
  const text = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP") return null;
  const u16 = (o: number) => b[o] | (b[o + 1] << 8);
  const u24 = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const chunk = text(12, 4);
  if (chunk === "VP8 ") return [u16(26) & 0x3fff, u16(28) & 0x3fff];
  if (chunk === "VP8X") return [u24(24) + 1, u24(27) + 1];
  if (chunk === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

describe("the gallery's data", () => {
  it("holds the survey's real places: no random-land controls, one entry and three files each", () => {
    expect(INDEX.format).toBe(1);
    expect(INDEX.count).toBe(INDEX.places.length);
    expect(INDEX.count).toBe(85);
    expect(INDEX.places.filter((p) => p.family === "random" || /random/i.test(p.name))).toEqual([]);
    expect(new Set(INDEX.places.map((p) => p.id)).size).toBe(INDEX.count);
    expect(new Set(INDEX.places.map((p) => p.name)).size).toBe(INDEX.count);
    expect(INDEX.sizes).toEqual([96, 128, 256]);
    expect(INDEX.families.map((f) => f.id).sort()).toEqual([...new Set(INDEX.places.map((p) => p.family))].sort());
    for (const p of INDEX.places) {
      expect(p.id, p.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.file, p.id).toBe(`maps/${p.id}.timber`);
      expect(p.plays.length, p.id).toBeLessThan(100);
      expect(existsSync(join(PLACES_DIR, p.data)), p.data).toBe(true);
      // the card's two pictures (Kyler, 2026-09-25), WebP, showing the map as it is now
      // (tools/places-thumbs.ts): the 3D view's angled overview, twice the card's 240 px; and the map
      // from above, a whole number of pixels a tile (about 512 px), so every tile edge is sharp
      expect(p.image, p.id).toBe(`cards/${p.id}.webp`);
      expect(p.topImage, p.id).toBe(`cards/${p.id}-top.webp`);
      const card = new Uint8Array(readFileSync(join(PLACES_DIR, p.image)));
      expect(webpSize(card), p.image).toEqual([480, 480]);
      expect(card.length, p.image).toBeLessThan(80_000);
      const top = new Uint8Array(readFileSync(join(PLACES_DIR, p.topImage)));
      const side = Math.round(512 / p.size) * p.size;
      expect(webpSize(top), p.topImage).toEqual([side, side]);
      expect(side % p.size).toBe(0);
      expect(top.length, p.topImage).toBeLessThan(80_000);
      expect(p.imageFrom, `${p.id}: its pictures show an older map; run npm run places:thumbs`).toBe(p.sha256);
    }
    // nothing else is published
    const listed = new Set(INDEX.places.flatMap((p) => [p.data, p.image, p.topImage]));
    for (const dir of ["data", "cards"]) for (const f of readdirSync(join(PLACES_DIR, dir))) expect(listed.has(`${dir}/${f}`), `${dir}/${f}`).toBe(true);
  });

  it("each place's data matches its entry", () => {
    for (const entry of INDEX.places) {
      const p = placeData(entry);
      expect([p.id, p.name, p.family, p.familyName, p.plays, p.W, p.H, p.metres], entry.id).toEqual([entry.id, entry.name, entry.family, entry.familyName, entry.plays, entry.size, entry.size, entry.metres]);
      expect(p.heights.length).toBe(p.W * p.H);
    }
  });

  it("stays light: the page loads the index, and the pictures as their cards come into view", () => {
    const size = (p: string) => statSync(join(PLACES_DIR, p)).size;
    const data = INDEX.places.reduce((s, p) => s + size(p.data), 0);
    const cards = INDEX.places.reduce((s, p) => s + size(p.image), 0);
    console.log(`real places: index ${size("index.json")} B, data ${data} B (largest ${Math.max(...INDEX.places.map((p) => size(p.data)))} B), cards ${cards} B`);
    expect(size("index.json")).toBeLessThan(64_000);
    expect(Math.max(...INDEX.places.map((p) => size(p.data)))).toBeLessThan(64_000);
    // the pictures load lazily, as the cards come into view
    // (the cards' pictures are the shared components in src/ui/Pictures.tsx)
    expect(readFileSync("src/places/Gallery.tsx", "utf8")).not.toMatch(/<img /);
    const imgs = readFileSync("src/ui/Pictures.tsx", "utf8").match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBe(1);
    for (const img of imgs) expect(img).toContain('loading="lazy"');
  });
});

describe("titles (Kyler, 2026-09-25)", () => {
  it("are plain and unique, without \"Near\" or the sample, and the index keeps the survey's name", () => {
    for (const p of INDEX.places) {
      // plain: the game's handling of other characters is not yet checked (a future probe batch)
      expect(p.name, p.id).toMatch(/^[A-Za-z][A-Za-z ,'-]*[a-z]$/);
      expect(p.name, p.id).not.toMatch(/\bnear\b|sample|m per tile|badwater/i);
      expect(p.id).toBe(p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      // the survey's own name, verbatim, and the part of the place it sampled
      const m = /^Near (.+?)(?: \((\w+) sample\))?, (\d+) m per tile$/.exec(p.surveyName);
      expect(m, p.surveyName).not.toBeNull();
      expect(p.sample, p.id).toBe(m![2]);
      expect(Number(m![3]), p.id).toBe(p.metres);
      // the sentence's place: the title, with "the" or a few words where it needs them
      const place = placeData(p).place;
      expect([p.name, `the ${p.name}`].includes(place) || place.startsWith(`${p.name.split(",")[0]}, `), `${p.id}: ${place}`).toBe(true);
    }
    expect(new Set(INDEX.places.map((p) => p.name.toLowerCase())).size).toBe(INDEX.count);
    // the renames that tidy an awkward title
    const title = (survey: string) => INDEX.places.find((p) => p.surveyName.startsWith(`Near ${survey} (`) || p.surveyName.startsWith(`Near ${survey},`))?.name;
    expect(title("Grand Canyon Colorado")).toBe("Grand Canyon");
    expect(title("Brahmaputra near Majuli")).toBe("Majuli, Brahmaputra");
    expect(title("Death Valley Badwater fan")).toBe("Death Valley");
    // Kyler's choices (2026-09-25)
    expect(title("Lower Mississippi oxbows")).toBe("Mississippi Oxbows");
    expect(title("Taklimakan Kunlun fan")).toBe("Kunlun Alluvial Fan");
    expect(title("Dinaric karst Plitvice")).toBe("Plitvice Lakes");
    expect(title("Yosemite Valley")).toBe("Yosemite Valley");
    expect(INDEX.places.filter((p) => p.sample).length).toBeGreaterThan(40);
  });
});

describe("credits and the in-game description (docs/real-places-credits.md)", () => {
  it("every map's description: its title, that it is not a replica, and the credits page", () => {
    expect(CREDITS_URL).toBe("https://timbermods.github.io/dam-good-maps/real-places/credits/");
    const carried: Record<string, string[]> = {};
    for (const entry of INDEX.places) {
      const p = placeData(entry);
      const d = placeDescription(p);
      const notices = fileNotices(p.lat, p.lon);
      expect(d.split("\n\n")).toEqual([
        p.name,
        `Inspired by the land near ${p.place}, at Timberborn's scale; not a replica.`,
        `Credits: ${CREDITS_URL}`,
        ...(notices.length ? [`Elevation data: ${notices.join("; ")}.`] : []),
      ]);
      for (const n of notices) (carried[n] ??= []).push(p.name);
      // plain text: the game's handling of other characters is not yet checked (a future probe batch)
      expect(d, entry.id).toMatch(/^[\x20-\x7e\n]+$/);
    }
    // the notices whose terms need them in the file (docs/real-places-credits.md): Kartverket's in
    // the maps in Norway, and LINZ's, with its licence, in those in New Zealand
    const text = (start: string) => PROVIDERS.find((p) => p.notice.startsWith(start))!.inFile!.text;
    expect(PROVIDERS.filter((p) => p.inFile).length).toBe(2);
    expect(carried).toEqual({
      [text("Norway")]: ["Geirangerfjord", "Lofoten"],
      [text("New Zealand")]: ["Waimakariri River", "Milford Sound", "Hooker Valley", "Mount Taranaki"],
    });
    expect(text("Norway")).toContain("Kartverket");
    expect(text("New Zealand")).toContain("https://creativecommons.org/licenses/by/3.0/nz/");
  });

  it("every provider has its notice, licence and verdict; the credits page is a page of the site", () => {
    expect(PROVIDERS.length).toBe(11);
    for (const p of PROVIDERS) {
      expect(p.notice.length, p.notice).toBeGreaterThan(10);
      expect(p.licence.length, p.notice).toBeGreaterThan(3);
      expect(p.licenceUrl, p.notice).toMatch(/^https:\/\//);
    }
    // a region's box holds its places, and no place elsewhere
    expect(fileNotices(62.1, 7.1)).toHaveLength(1); // Geirangerfjord
    expect(fileNotices(61.82, 28.5)).toEqual([]); // Saimaa, Finland
    expect(fileNotices(-43.72, 170.1)).toHaveLength(1); // Hooker Valley
    expect(fileNotices(-33.87, 151.2)).toEqual([]); // Sydney
    const verdicts = readFileSync("docs/real-places-credits.md", "utf8");
    for (const p of PROVIDERS) expect(verdicts, p.licence).toContain(p.licenceUrl);
    expect(readFileSync("real-places/credits/index.html", "utf8")).toContain("/src/places/credits-main.tsx");
    expect(readFileSync("vite.config.ts", "utf8")).toContain("./real-places/credits/index.html");
  });
});

// A sample of every size for the checks on every push: the first two places at 96² and 128², and
// the first at 256² (placeSample; the browser tests use it too).
const SAMPLE = placeSample(INDEX);
const builds = new Map<string, ReturnType<typeof placeTimber>>();
const built = (id: string) => {
  if (!builds.has(id)) builds.set(id, placeTimber(placeData(INDEX.places.find((p) => p.id === id)!)));
  return builds.get(id)!;
};

checkPlaces("a sample of every size validates and is the index's file (every place: nightly and the release check)", SAMPLE, (e) => built(e.id));

describe("a sample of places", () => {
  it("writes the description into the file, and the file is the index's", () => {
    for (const e of SAMPLE) {
      const r = built(e.id);
      const file = readTimber(r.bytes);
      expect(file.metadata?.MapDescription).toBe(placeDescription(placeData(e)));
      expect(sha256(r.bytes)).toBe(e.sha256);
    }
  });

  it("Refine: the editor imports a place, and exports it unedited as the same file", () => {
    for (const e of SAMPLE) {
      const r = built(e.id);
      const s = MapSession.importMap(r.bytes, r.fileName);
      expect(s.mode).toBe("import");
      expect(s.meta.name).toBe(e.name);
      expect(s.size).toEqual({ x: e.size, y: e.size });
      expect(s.validate("import", { loadOnly: true }).report.passed).toBe(true);
      const out = s.exportTimber();
      expect(out.fileName).toBe(`${e.name}.timber`);
      expect(sha256(out.bytes)).toBe(e.sha256);
    }
  });
});

// The Python validator (prototype/validate.py), as the oracle runs it: the same verdict for every
// check. CI installs Python; a machine without it skips this.
function python(): string | null {
  for (const exe of [process.env.PYTHON ?? "python", "python3"]) {
    const r = spawnSync(exe, ["-c", "import numpy"], { encoding: "utf8" });
    if (!r.error && r.status === 0) return exe;
  }
  return null;
}
const PY = python();
if (!PY && process.env.CI) throw new Error("CI needs Python with numpy for the real places oracle");

describe.skipIf(!PY)("both validators agree on the sample (prototype/validate.py)", () => {
  it("every check has the same verdict, and every map passes both", () => {
    const dir = join(".scratch", "places-oracle");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const paths: string[] = [];
    for (const e of SAMPLE) {
      const p = join(dir, `${e.id}.timber`);
      writeFileSync(p, built(e.id).bytes);
      // an explicit empty feature list, as the survey's oracle wrote it: Python also checks outflow
      writeFileSync(join(dir, `${e.id}.damgoodmaps.json`), gzipSync(strToU8(JSON.stringify({ spec: null, features: [] })), { mtime: 0 }));
      paths.push(p);
    }
    const r = spawnSync(PY!, ["-B", "prototype/validate.py", "--json", ...paths], { encoding: "utf8", maxBuffer: 256 << 20 });
    expect(r.error).toBeUndefined();
    const reports = new Map<string, { passed: boolean; checks: { id: string; ok: boolean; na: boolean; approx?: string }[] }>();
    for (const line of (r.stdout ?? "").split(/\r?\n/)) if (line.startsWith("{")) {
      const j = JSON.parse(line) as { path: string; passed: boolean; checks: { id: string; ok: boolean; na: boolean; approx?: string }[] };
      reports.set(relative(".", j.path).split(sep).join("/"), j);
    }
    const ts = (c: CheckResult) => (c.applicable === false ? "na" : c.approximate ? "approx" : c.ok ? "pass" : "fail");
    const py = (c: { ok: boolean; na: boolean; approx?: string }) => (c.na ? "na" : c.approx ? "approx" : c.ok ? "pass" : "fail");
    for (const [k, e] of SAMPLE.entries()) {
      const rep = reports.get(paths[k].split(sep).join("/"));
      expect(rep, `${e.id}: no Python report. ${r.stderr ?? ""}`).toBeDefined();
      expect(rep!.passed, e.id).toBe(true);
      const b = built(e.id);
      const v = validateMap(readTimber(b.bytes), { profile: "generate", designedFor: "normal", features: [], water: { model: b.validation.model!, settled: b.validation.water! } });
      const a = Object.fromEntries(v.report.checks.map((c) => [c.id, ts(c)]));
      const p = Object.fromEntries(rep!.checks.map((c) => [c.id, py(c)]));
      expect(p, e.id).toEqual(a);
    }
    expect(r.status).toBe(0);
  });
});

describe("real places stay out of the generator (D108), and the browser never builds one", () => {
  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) out.push(...sources(path));
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(path);
    }
    return out;
  }

  it("only the gallery and the page's Refine link use them", () => {
    const users = sources("src")
      .filter((f) => /from\s+["'][^"']*places\/[^"']*["']/.test(readFileSync(f, "utf8")))
      .map((f) => f.split(sep).join("/"))
      .filter((f) => !f.startsWith("src/places/") && !f.startsWith("src/core/places/"))
      .sort();
    expect(users).toEqual(["src/ui/App.tsx"]);
    // the page's Refine link loads only the fetch helpers, never the place builder
    expect(readFileSync("src/ui/App.tsx", "utf8")).not.toMatch(/core\/places/);
  });

  it("the pages fetch the .timber built at deploy time: the builder is only a type to them", () => {
    let seen = 0;
    for (const f of sources("src/places")) {
      for (const line of readFileSync(f, "utf8").split("\n").filter((l) => /from\s+["'][^"']*core\/places\/place["']/.test(l))) {
        expect(line, f).toMatch(/^import type /);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
