// Build the local rating page: C:\dgm-workshop\rate\index.html. It shows about 40 maps that span
// the range (sizes, eras, water, relief, popularity and score), each with its two renders, and lets
// Kyler rate "fun" and "unique" from 1 to 5 with an optional note. Answers autosave in the browser
// and save as JSON (C:\dgm-workshop\ratings.json), which fit-score.ts reads. Never published: it
// shows other creators' maps.
//
//   npx tsx investigation/workshop/rating-page.ts
//
// The pick: 6 official maps (the 3 recommended and 3 others) as anchors, then workshop maps by
// farthest-point sampling on the variety score, starting from the most subscribed map, so every
// pick is as unlike the ones before it as possible.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTable, type Row } from "./lib/table";
import { ROOT } from "./lib/paths";
import { distance, featureVector, scaleFrom, type VarietyInput } from "./lib/variety";

const COUNT = 40;
const rows = readTable();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const input = (r: Row): VarietyInput => ({ key: r.key, layout: r.raw.layout, features: featureVector(r.raw) });
const scale = scaleFrom(workshop.map(input));

const picked: Row[] = [];
for (const name of ["Plains", "Lakes", "Waterfalls", "Canyon", "Pillars", "ThousandIslands"]) {
  const o = official.find((r) => r.title === name);
  if (o) picked.push(o);
}
const subs = (r: Row) => (r.meta as any)?.lifetime_subscribers ?? 0; // eslint-disable-line @typescript-eslint/no-explicit-any
const pool = workshop.slice();
pool.sort((a, b) => subs(b) - subs(a));
const chosen: Row[] = [pool.shift()!];
const inputs = new Map(pool.map((r) => [r.key, input(r)] as const));
inputs.set(chosen[0].key, input(chosen[0]));
while (chosen.length < COUNT - picked.length && pool.length) {
  let best = -1;
  let bestD = -1;
  pool.forEach((r, k) => {
    const d = Math.min(...chosen.map((c) => distance(inputs.get(r.key)!, inputs.get(c.key)!, scale)));
    if (d > bestD) {
      bestD = d;
      best = k;
    }
  });
  chosen.push(pool.splice(best, 1)[0]);
}
const maps = [...picked, ...chosen].map((r) => ({
  key: r.key,
  title: r.title,
  author: r.author ?? (r.source === "official" ? "Mechanistry (official)" : null),
  url: r.url,
  size: `${r.W}×${r.H}`,
  version: r.format,
  source: r.source,
}));
// a stable shuffle, so official maps are not all first
const order = maps.map((m, k) => ({ m, k: ((k + 1) * 2654435761) % 4294967296 })).sort((a, b) => a.k - b.k).map((x) => x.m);

const dir = join(ROOT, "rate");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "maps.json"), JSON.stringify(order, null, 1));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Rate the maps</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#f6f3ec;--card:#fffdf8;--ink:#2a2419;--muted:#6f6556;--line:#ddd3c2;--accent:#7a4a1c;--pick:#e9d7bd}
@media (prefers-color-scheme: dark){:root{--bg:#1d1a16;--card:#27231e;--ink:#eee6d8;--muted:#b3a894;--line:#443c31;--accent:#e0a869;--pick:#4a3b29}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,Segoe UI,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
header h1{font-size:17px;margin:0 12px 0 0}header .n{color:var(--muted)}button{font:inherit;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);cursor:pointer}
button.main{background:var(--accent);color:var(--card);border-color:var(--accent)}main{max-width:1180px;margin:0 auto;padding:16px}
.intro{color:var(--muted);max-width:760px}.map{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 18px}
.map h2{font-size:16px;margin:0 0 2px}.meta{color:var(--muted);font-size:13px;margin-bottom:10px}.meta a{color:var(--accent)}
.pics{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:10px}.pics img{width:100%;height:auto;border-radius:6px;background:#ddd;cursor:zoom-in;image-rendering:pixelated}
.rate{display:flex;flex-wrap:wrap;gap:18px;margin-top:10px;align-items:center}.scale{display:flex;gap:4px;align-items:center}.scale b{min-width:56px;font-weight:600}
.scale label{display:inline-flex}.scale input{position:absolute;opacity:0;pointer-events:none}.scale span{display:inline-block;min-width:34px;text-align:center;padding:5px 0;border:1px solid var(--line);border-radius:6px;cursor:pointer}
.scale input:checked+span{background:var(--pick);border-color:var(--accent);font-weight:700}.scale input:focus-visible+span{outline:2px solid var(--accent)}
textarea{flex:1 1 280px;min-height:36px;font:inherit;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)}
.done{color:var(--accent);font-size:13px}dialog{max-width:96vw;max-height:94vh;padding:0;border:0;background:transparent}dialog img{max-width:96vw;max-height:94vh;image-rendering:pixelated}
@media (max-width:700px){.pics{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Rate the maps</h1><span class="n" id="count"></span>
<button class="main" id="save">Save ratings.json</button><button id="load">Load ratings.json</button><input type="file" id="file" accept=".json" hidden>
<span class="n" id="status"></span></header>
<main><p class="intro">For each map: how <b>fun</b> would it be to play, and how <b>unique</b> is it, from 1 to 5. A note is optional.
Answers are kept in this browser as you go. When you finish (or stop), press <b>Save ratings.json</b> and put the file at
<code>C:\\dgm-workshop\\ratings.json</code>. Click a picture to enlarge it. Left: top-down, north up. Right: 3D, seen from the south-east.</p>
<div id="list"></div></main>
<dialog id="zoom" aria-label="Enlarged picture"></dialog>
<script>
const MAPS = ${JSON.stringify(order)};
const KEY = "dgm-workshop-ratings";
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
const list = document.getElementById("list");
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function persist(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} count(); }
function count(){ const n = MAPS.filter(m => state[m.key] && state[m.key].fun && state[m.key].unique).length; document.getElementById("count").textContent = n + " of " + MAPS.length + " rated"; }
function scale(m, what){ let h = '<div class="scale" role="radiogroup" aria-label="' + what + '"><b>' + what[0].toUpperCase() + what.slice(1) + '</b>';
  for (let v = 1; v <= 5; v++) { const on = state[m.key] && state[m.key][what] === v; h += '<label><input type="radio" name="' + m.key + '-' + what + '" value="' + v + '"' + (on ? " checked" : "") + '><span>' + v + '</span></label>'; }
  return h + '</div>'; }
MAPS.forEach((m, i) => {
  const d = document.createElement("section"); d.className = "map"; d.id = m.key;
  const by = m.author ? " by " + esc(m.author) : "";
  const link = m.url ? ' · <a href="' + esc(m.url) + '" target="_blank" rel="noopener">Workshop page</a>' : "";
  d.innerHTML = '<h2>' + (i + 1) + '. ' + esc(m.title) + '</h2><div class="meta">' + esc(m.size) + ', made for ' + esc(m.version) + by + link + '</div>' +
    '<div class="pics"><img loading="lazy" src="../renders/' + m.key + '-top.png" alt="Top-down view of ' + esc(m.title) + '"><img loading="lazy" src="../renders/' + m.key + '-3d.png" alt="3D view of ' + esc(m.title) + '"></div>' +
    '<div class="rate">' + scale(m, "fun") + scale(m, "unique") + '<textarea placeholder="Note (optional)" aria-label="Note">' + esc((state[m.key] && state[m.key].note) || "") + '</textarea></div>';
  d.addEventListener("change", e => { const t = e.target; if (t.type !== "radio") return; const [, what] = t.name.split(/-(fun|unique)$/); state[m.key] = Object.assign({}, state[m.key], { [what]: Number(t.value) }); persist(); });
  d.querySelector("textarea").addEventListener("input", e => { state[m.key] = Object.assign({}, state[m.key], { note: e.target.value }); persist(); });
  d.querySelectorAll("img").forEach(img => img.addEventListener("click", () => { const z = document.getElementById("zoom"); const big = document.createElement("img"); big.src = img.src; big.alt = img.alt; z.replaceChildren(big); z.showModal(); }));
  list.appendChild(d);
});
document.getElementById("zoom").addEventListener("click", e => e.currentTarget.close());
function payload(){ const ratings = {}; for (const m of MAPS) if (state[m.key]) ratings[m.key] = state[m.key]; return JSON.stringify({ version: 1, saved: new Date().toISOString(), maps: MAPS.length, ratings }, null, 1); }
document.getElementById("save").addEventListener("click", async () => {
  const text = payload(); const st = document.getElementById("status");
  if (window.showSaveFilePicker) { try { const h = await showSaveFilePicker({ suggestedName: "ratings.json", types: [{ description: "JSON", accept: { "application/json": [".json"] } }] }); const w = await h.createWritable(); await w.write(text); await w.close(); st.textContent = "Saved."; return; } catch (e) { if (e && e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = "ratings.json"; a.click(); st.textContent = "Downloaded ratings.json: move it to C:\\\\dgm-workshop\\\\ratings.json";
});
document.getElementById("load").addEventListener("click", () => document.getElementById("file").click());
document.getElementById("file").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); state = Object.assign({}, state, j.ratings || {}); persist(); location.reload(); } catch (err) { document.getElementById("status").textContent = "That file is not a ratings file."; } });
count();
</script></body></html>
`;
writeFileSync(join(dir, "index.html"), html);
console.log(`wrote ${join(dir, "index.html")} with ${order.length} maps (${picked.length} official)`);
if (!existsSync(join(ROOT, "renders"))) console.log("renders are missing: run render.ts");
void readFileSync;
