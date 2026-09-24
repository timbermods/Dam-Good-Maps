// The generator page (PLAN §14.1): settings on the left; preview, map card and downloads on the
// right. M1 has the basics: seed, size, difficulty and theme (River Valley).

import { useEffect, useMemo, useState } from "preact/hooks";
import { createGenerator, saveFile } from "../platform";
import {
  AVAILABLE_THEMES,
  decodeSpecFragment,
  encodeSpecFragment,
  GENERATOR_VERSION,
  makeSpec,
  seedFromText,
  SIZE_PRESETS,
  THEME_NAMES,
  THEMES,
  type Difficulty,
  type MapSpec,
  type SizePreset,
  type ThemeId,
} from "../core/spec/mapspec";
import type { GenerateResponse } from "../worker/api";
import { Preview2D, type Layers } from "./Preview2D";
import { MapCard } from "./MapCard";

const generator = createGenerator();

const LAYER_NAMES: Record<keyof Layers, string> = {
  water: "Water",
  moisture: "Moist soil",
  contamination: "Contaminated soil",
  reach: "Walkable from start",
  dam: "Dam site",
  entities: "Objects",
  features: "Feature outlines",
};

declare global {
  interface Window {
    /** Test hook: generate a map from a URL fragment and return its sha256 (tests/e2e). */
    dgm?: { generate(fragment: string): Promise<{ sha256: string; bytes: number; passed: boolean }> };
  }
}
window.dgm = {
  async generate(fragment: string) {
    const d = decodeSpecFragment(fragment);
    if (!d) throw new Error("bad fragment");
    const r = await generator.generate(d.spec);
    return { sha256: r.sha256, bytes: r.timber.length, passed: r.passed };
  },
};

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

function initialSpec(): { spec: MapSpec; fromLink: boolean; note?: string } {
  const d = decodeSpecFragment(location.hash);
  if (d) {
    const note = d.version !== GENERATOR_VERSION ? `This link was made with generator ${d.version}; this is ${GENERATOR_VERSION}, so the map may differ.` : undefined;
    return { spec: d.spec, fromLink: true, note: d.problems.length ? d.problems.join("; ") : note };
  }
  return { spec: makeSpec({ seed: randomSeed() }), fromLink: false };
}

export function App() {
  const init = useMemo(initialSpec, []);
  const [seedText, setSeedText] = useState(String(init.spec.seed));
  const [size, setSize] = useState<{ x: number; y: number }>(init.spec.size);
  const [difficulty, setDifficulty] = useState<Difficulty>(init.spec.designedFor);
  const [theme, setTheme] = useState<ThemeId>(init.spec.theme);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | undefined>(init.note);
  const [layers, setLayers] = useState<Layers>({ water: true, moisture: false, contamination: false, reach: false, dam: true, entities: true, features: false });
  const [downloaded, setDownloaded] = useState(false);

  const spec = useMemo(
    () => makeSpec({ seed: seedFromText(seedText || "0"), size, designedFor: difficulty, theme }),
    [seedText, size, difficulty, theme],
  );
  const stale = !!result && encodeSpecFragment(result.spec) !== encodeSpecFragment(spec);

  async function run(s: MapSpec) {
    setBusy(true);
    setError(null);
    setDownloaded(false);
    try {
      const r = await generator.generate(s);
      setResult(r);
      history.replaceState(null, "", "#" + encodeSpecFragment(r.spec));
      if (!r.passed) setError(`No valid map after ${r.attempts} attempts. Try another seed.`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run(init.spec);
  }, []);

  const presetOf = (s: { x: number; y: number }) =>
    (Object.entries(SIZE_PRESETS).find(([, v]) => v === s.x && v === s.y)?.[0] as SizePreset | undefined) ?? "custom";

  return (
    <div class="app">
      <header class="top">
        <h1>Dam Good Maps</h1>
        <p class="tag">Timberborn maps from a seed: generate, look, download, play.</p>
      </header>
      <main class="panes">
        <section class="settings" aria-label="Settings">
          <h2>Map</h2>
          <label>
            Seed
            <div class="row">
              <input value={seedText} onInput={(e) => setSeedText((e.target as HTMLInputElement).value)} aria-label="Seed (a number or any text)" />
              <button type="button" class="ghost" title="Random seed" onClick={() => setSeedText(String(randomSeed()))}>
                Dice
              </button>
            </div>
          </label>
          <label>
            Size
            <select
              value={presetOf(size)}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value as SizePreset;
                if (v in SIZE_PRESETS) setSize({ x: SIZE_PRESETS[v], y: SIZE_PRESETS[v] });
              }}
            >
              {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((p) => (
                <option value={p} key={p}>
                  {p[0].toUpperCase() + p.slice(1)} ({SIZE_PRESETS[p]}×{SIZE_PRESETS[p]})
                </option>
              ))}
              {presetOf(size) === "custom" && <option value="custom">Custom ({size.x}×{size.y})</option>}
            </select>
          </label>
          <label>
            Theme
            <select value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value as ThemeId)}>
              {THEMES.map((t) => (
                <option value={t} key={t} disabled={!AVAILABLE_THEMES.includes(t)}>
                  {THEME_NAMES[t]}
                  {AVAILABLE_THEMES.includes(t) ? "" : " (coming later)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Designed for
            <select value={difficulty} onChange={(e) => setDifficulty((e.target as HTMLSelectElement).value as Difficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button type="button" class="primary" disabled={busy} onClick={() => run(spec)}>
            {busy ? "Generating…" : stale ? "Generate (settings changed)" : "Generate"}
          </button>
          {note && <p class="note">{note}</p>}
          <details class="more">
            <summary>What's in this version</summary>
            <p>
              One theme, River Valley. The water is simulated with the game's own rules and shipped settled, so rivers
              run from the first tick; trees live where that water keeps the soil moist. Every map is checked against
              the game's loading rules and for a colony's survival: clean water in pump reach, food, wood, land to
              build on, and a dam site that holds a drought's water. More settings and themes follow.
            </p>
          </details>
        </section>
        <section class="view" aria-label="Map">
          <div class="layers" role="group" aria-label="Preview layers">
            {(Object.keys(LAYER_NAMES) as (keyof Layers)[]).map((k) => (
              <label class="check" key={k}>
                <input type="checkbox" checked={layers[k]} onChange={() => setLayers({ ...layers, [k]: !layers[k] })} />
                {LAYER_NAMES[k]}
              </label>
            ))}
          </div>
          {error && <p class="error" role="alert">{error}</p>}
          {result ? <Preview2D result={result} layers={layers} /> : <div class="placeholder">{busy ? "Generating…" : ""}</div>}
          {result && (
            <>
              <MapCard result={result} />
              <div class="downloads">
                <button
                  type="button"
                  class="primary"
                  disabled={!result.passed}
                  onClick={() => {
                    saveFile(result.timber, result.timberName);
                    setDownloaded(true);
                  }}
                >
                  Download {result.timberName}
                </button>
                <button type="button" class="ghost" onClick={() => saveFile(result.project, result.projectName, "application/gzip")}>
                  Download project file
                </button>
                <button
                  type="button"
                  class="ghost"
                  disabled={!result.passed}
                  title="The same map with no water in the file: the game fills the rivers during the first day (for comparing in game)"
                  onClick={async () => {
                    const f = await generator.emptyWater();
                    if (f) saveFile(f.bytes, f.name);
                  }}
                >
                  Without pre-filled water
                </button>
              </div>
              <div class={downloaded ? "install open" : "install"}>
                <h3>Play it</h3>
                <ol>
                  <li>
                    Move <strong>{result.timberName}</strong> to <code>Documents\Timberborn\Maps</code> (on macOS{" "}
                    <code>~/Documents/Timberborn/Maps</code>).
                  </li>
                  <li>Start Timberborn, choose New game, and pick the map from your maps. The map editor can open it too.</li>
                  <li>
                    The game shows the file name as the map name. The project file (<code>.damgoodmaps.json</code>) keeps
                    the map's features for the editor that is coming later.
                  </li>
                </ol>
              </div>
            </>
          )}
        </section>
      </main>
      <footer class="foot">
        Generator {GENERATOR_VERSION}. Not affiliated with Mechanistry. <a href="https://github.com/timbermods/dam-good-maps">Source</a>
      </footer>
    </div>
  );
}
