// The settings' bands, from the study: per size class (small, medium, large, max), the workshop's
// p10 / median / p90 next to the official median, and the proposed changes as data ready to drop
// into the calibration table (src/core/gen/calibrated.ts `DENSITY`, PLAN §5).
//
//   npx tsx investigation/workshop/settings-bands.ts    → investigation/workshop/settings-bands.json
//
// Maps of unusual shape are kept out (a side over 256, or an aspect of 4 or more), and water numbers
// come only from maps whose water our steady state can show.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readGenerated, readTable, stat, type Row } from "./lib/table";

const rows = readTable().filter((r) => !r.unusual);
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const gen = readGenerated();
const SIZES = ["small", "medium", "large", "max"] as const;
const bySize = (set: Row[], k: string) => SIZES.map((s) => stat(set.filter((r) => r.sizeClass === s).map((r) => r.v[k]), 3));
const med = (set: Row[], k: string) => SIZES.map((s) => stat(set.filter((r) => r.sizeClass === s).map((r) => r.v[k]), 1).median);

const table = (k: string) => ({ official: med(official, k), workshop: bySize(workshop, k) });

const out = {
  note: "Size classes as calibrated.ts SIZE_ANCHORS (small ≤ 12k tiles, medium ≤ 20k, large ≤ 45k, max above). Each array is [small, medium, large, max]. 'workshopMedian' rows are new DENSITY rows in the shape of calibrated.ts; 'settings' are the proposed ranges (PLAN §5), each with its evidence.",
  densityRows: {
    workshop_trees_per_10k: med(workshop, "treesPer10k"),
    workshop_bushes_per_10k: med(workshop, "bushesPer10k"),
    workshop_scrap_per_1k: med(workshop, "scrapPer1k"),
    workshop_water_strength_per_10k: med(workshop, "cleanStrengthPer10k"),
    waterfalls_per_map_official: med(official, "waterfalls"),
    waterfalls_per_map_workshop: med(workshop, "waterfalls"),
    lakes_per_map_workshop: med(workshop, "lakes"),
    springs_per_map_workshop: med(workshop, "springs"),
    islands_per_map_workshop: med(workshop, "islands100"),
  },
  evidence: {
    heightRange: table("heightRange"),
    step1Share: table("step1Share"),
    flatShare: table("flatShare"),
    startReach: table("startReach"),
    cleanStrengthPer10k: table("cleanStrengthPer10k"),
    waterShare: table("waterShare"),
    waterfalls: table("waterfalls"),
    maxFallDrop: table("maxFallDrop"),
    springs: table("springs"),
    treesPer10k: table("treesPer10k"),
    bushesPer10k: table("bushesPer10k"),
    scrapPer1k: table("scrapPer1k"),
    generated128: Object.fromEntries(["heightRange", "step1Share", "flatShare", "waterShare", "waterfalls", "maxFallDrop", "springs", "treesPer10k", "bushesPer10k", "scrapPer1k"].map((k) => [k, stat(gen.map((r) => r.v[k]), 3)])),
  },
  settings: {
    terracing: { change: "one-level step share at Smooth (0) from 0.86 to 0.92; theme defaults toward 25–35", why: "workshop median 0.81 (p90 0.91), official 0.62; generated at defaults 0.58" },
    buildableLand: { change: "add Rugged below Tight: flat share 0.30, walkable land from the start 500 (Easy 750)", why: "workshop flat share p10 0.27, median 0.44; generated at defaults 0.69 (flatter than every official median)" },
    relief: { change: "theme defaults +15–20 (River Valley 50 → 70): the range target 12–13 levels", why: "generated median height range 10; official 13, workshop 14 (p90 18 with terrain above 16)" },
    riverFlow: { change: "none: Lush (4×) already reaches the workshop's p90 at medium", why: "workshop clean strength per 10k: medium median 4.9, p90 9.6; Lush at 128² is 8.8" },
    springs: { change: "new setting Springs (sg): None / Few (1–3) / Many (4–10): inland springs feeding streams", why: "workshop median 4 inland spring clusters per map (p90 13); generated 0" },
    waterfalls: { change: "Many from 3–6 to 3–10; add Cascading (c): 10–20; typical drop from 2–3 to 3–7", why: "workshop median 7 falls per map (p90 21), tallest drop median 6.1; generated 2 falls, tallest 2.4" },
    waterShareCap: { change: "water.no_flood follows the premise's water budget: 0.35 by default, up to 0.70 for water premises (moat, archipelago, lone island, lake world)", why: "workshop water share median 0.27, p90 0.67 on the 81 maps our settle can show; 28% are above 0.35, 9% above 0.70" },
    forestDensity: { change: "range 50–200% to 50–300%", why: "workshop trees per 10k up to 1.8–3× the official medians by size (carpet forests)" },
    berryBushes: { change: "range 50–300% to 50–500%; default 150%", why: "workshop bushes per 10k median 2–5× official by size" },
    badwaterDistance: { change: "defaults Easy 40 → 30, Normal 30 → 15, Hard 15 → 8", why: "official nearest badwater to the start: median 14.8, p25 10; generated 36" },
  },
};
writeFileSync(join(process.cwd(), "investigation", "workshop", "settings-bands.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out.densityRows, null, 1));
