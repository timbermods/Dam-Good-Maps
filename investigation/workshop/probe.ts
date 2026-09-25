// Import every copied map with the app's importer and list what it is: version, era, size,
// templates, and why it is skipped (saves and maps that need mods). Cheap: no water settle.
//
//   npx tsx investigation/workshop/probe.ts        → C:\dgm-workshop\probe.json

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { listMaps, lowPriority, ROOT } from "./lib/paths";
import { loadMap, sizeClass } from "./lib/load";

lowPriority();
const rows = [];
for (const ref of listMaps()) {
  const l = loadMap(ref);
  const row = {
    key: ref.key,
    source: ref.source,
    file: ref.fileName,
    version: l.version,
    format: l.format,
    era: l.era,
    size: [l.W, l.H],
    sizeClass: l.W ? sizeClass(l.W * l.H) : null,
    layers: l.layers,
    voxelsAboveVanilla: l.voxelsAboveVanilla,
    legacyHeightmap: l.legacyHeightmap,
    unknownTemplates: l.unknownTemplates,
    templates: l.templates,
    changes: l.report?.changes.map((c) => c.id) ?? [],
    flags: l.report?.flags.map((f) => f.message) ?? [],
    skip: l.skip,
  };
  rows.push(row);
  console.log(`${ref.key.padEnd(24)} ${String(l.version).padEnd(22)} ${l.format.padEnd(7)} ${l.W}x${l.H} layers ${l.layers}${l.skip ? `  SKIP ${l.skip}` : ""}`);
}
writeFileSync(join(ROOT, "probe.json"), JSON.stringify(rows, null, 1));
const used = rows.filter((r) => !r.skip);
console.log(`\n${rows.length} maps, ${used.length} used, ${rows.length - used.length} skipped`);
