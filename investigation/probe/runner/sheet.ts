// A local HTML contact sheet of a run's screenshots: per map, per moment, every pose; where a pose
// reproduces a Map look capture, our 3D view's capture stands beside the game's shot. The sheet is
// written to C:\dgm-probe\sheet\ (outside the repository) and links the images
// where they are, so nothing is copied.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mainCheckout } from './catalog';
import type { MapResult, Pose } from './job';
import { REPO } from './paths';

export interface SheetMap {
  result: MapResult;
  poses: Pose[];
  verdicts: { id: string; verdict: string; detail: string }[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const url = (p: string) => pathToFileURL(p).href;
const dayText = (d: number) => `day ${Math.floor(d)}, ${String(Math.floor((d % 1) * 24)).padStart(2, '0')}:00`;

export function writeSheet(dir: string, runId: string, shotsDir: string, maps: SheetMap[]): string {
  mkdirSync(dir, { recursive: true });
  const parts: string[] = [];
  parts.push(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DGM Probe ${esc(runId)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { --bg: #f6f5f1; --fg: #1d1d1b; --muted: #6a6a64; --line: #d9d7cf; --pass: #1f7a3a; --fail: #b3261e; --na: #7a6a1f; }
@media (prefers-color-scheme: dark) { :root { --bg: #171716; --fg: #ecebe6; --muted: #a3a29b; --line: #34332f; --pass: #6fd08c; --fail: #ff8a80; --na: #e0c56e; } }
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; margin: 0 auto; padding: 16px; max-width: 1500px; }
h1 { font-size: 22px; } h2 { font-size: 19px; margin-top: 40px; border-top: 1px solid var(--line); padding-top: 16px; } h3 { font-size: 15px; color: var(--muted); }
nav a { margin-right: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 12px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; grid-column: 1 / -1; }
figure { margin: 0; } img { width: 100%; height: auto; display: block; border: 1px solid var(--line); background: #000; }
figcaption { font-size: 13px; color: var(--muted); padding: 3px 0; }
table { border-collapse: collapse; margin: 8px 0; } td, th { border-bottom: 1px solid var(--line); padding: 3px 8px; text-align: left; vertical-align: top; font-size: 14px; }
.pass { color: var(--pass); font-weight: 600; } .fail { color: var(--fail); font-weight: 600; } .na { color: var(--na); font-weight: 600; }
</style></head><body>`);
  parts.push(`<h1>DGM Probe: ${esc(runId)}</h1><p>Screenshots from Timberborn, by map and moment. Where a pose repeats one of Map look's captures, our 3D view's capture stands on the right.</p>`);
  parts.push('<nav>' + maps.map((m) => `<a href="#${esc(m.result.mapId)}">${esc(m.result.title)}</a>`).join('') + '</nav>');
  for (const m of maps) {
    const r = m.result;
    parts.push(`<h2 id="${esc(r.mapId)}">${esc(r.title)}</h2>`);
    parts.push(`<p>${esc(r.status)}${r.failure ? ': ' + esc(r.failure) : ''} · ${r.ticks} ticks in ${Math.round(r.realSeconds)} s (speed ${r.meanSpeed.toFixed(1)})</p>`);
    if (m.verdicts.length) {
      parts.push('<table><tr><th>Check</th><th>Result</th><th>Numbers</th></tr>');
      for (const v of m.verdicts) {
        const cls = v.verdict === 'passed' ? 'pass' : v.verdict === 'failed' ? 'fail' : 'na';
        parts.push(`<tr><td>${esc(v.id)}</td><td class="${cls}">${esc(v.verdict)}</td><td>${esc(v.detail)}</td></tr>`);
      }
      parts.push('</table>');
    }
    const moments = [...new Set(r.shots.map((s) => s.momentId))];
    for (const moment of moments) {
      const shots = r.shots.filter((s) => s.momentId === moment);
      parts.push(`<h3>${esc(moment)} · ${esc(dayText(shots[0].day))}</h3><div class="grid">`);
      for (const s of shots) {
        const pose = m.poses.find((p) => p.id === s.pose);
        const game = join(shotsDir, s.file);
        // lookCapture is the capture's path as Map look records it (relative to the repository, or to
        // the main checkout for the local-only Beavertopia captures)
        const look = pose?.lookCapture ? [join(REPO, pose.lookCapture), join(mainCheckout(), pose.lookCapture)].find((f) => existsSync(f)) ?? null : null;
        if (look && existsSync(look))
          parts.push(`<div class="pair"><figure><img loading="lazy" src="${url(game)}"><figcaption>Timberborn · ${esc(s.pose)}</figcaption></figure><figure><img loading="lazy" src="${url(look)}"><figcaption>Our 3D view (Map look, after) · ${esc(pose!.lookCapture!)}</figcaption></figure></div>`);
        else parts.push(`<figure><img loading="lazy" src="${url(game)}"><figcaption>${esc(s.pose)}</figcaption></figure>`);
      }
      parts.push('</div>');
    }
  }
  parts.push('</body></html>');
  const file = join(dir, `${runId}.html`);
  writeFileSync(file, parts.join('\n'));
  return file;
}
