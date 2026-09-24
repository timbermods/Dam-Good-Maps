// The app (PLAN §14.1, EDITOR_PLAN §4): generate → refine → play as one page. The settings page
// shows the map (2D, or 3D on request) with its card and downloads; "Refine this map" opens it in
// the editor, and "Back to settings" returns with the edits kept. Generating again while the map
// has edits regenerates around them (a settings change, PLAN §19.1). Any .timber or project file
// opens in the editor. The open map is autosaved in the browser.

import type { ComponentType } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { createGenerator, readFile, saveFile, storage, type Autosave } from "../platform";
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
import type { SessionInfo, SessionOpen } from "../worker/session";
import type { EditorProps } from "../editor/Editor";
import type { ExportDialogProps } from "../editor/panels";
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
    dgm?: { generate(fragment: string): Promise<{ sha256: string; bytes: number; passed: boolean; ms: number; ticks: number }> };
  }
}
window.dgm = {
  async generate(fragment: string) {
    const d = decodeSpecFragment(fragment);
    if (!d) throw new Error("bad fragment");
    const r = await generator.generate(d.spec);
    return { sha256: r.sha256, bytes: r.timber.length, passed: r.passed, ms: r.ms, ticks: r.facts.settle.ticks };
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

/** A lazily loaded module's export (the 3D view and the editor are separate chunks). */
function useLazy<T>(load: () => Promise<T>, when: boolean): T | null {
  const [mod, setMod] = useState<T | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!when || started.current) return;
    started.current = true;
    void load().then((m) => setMod(() => m));
  }, [when]);
  return mod;
}

function isProjectFile(name: string, bytes: Uint8Array): boolean {
  if (/\.timber$/i.test(name)) return false;
  if (/\.(json|gz)$/i.test(name)) return true;
  return bytes[0] === 0x1f && bytes[1] === 0x8b; // gzip, not a zip (.timber starts "PK")
}

interface Confirm {
  text: string;
  yes: string;
  onYes(): void;
}

export function App() {
  const init = useMemo(initialSpec, []);
  const [seedText, setSeedText] = useState(String(init.spec.seed));
  const [size, setSize] = useState<{ x: number; y: number }>(init.spec.size);
  const [difficulty, setDifficulty] = useState<Difficulty>(init.spec.designedFor);
  const [theme, setTheme] = useState<ThemeId>(init.spec.theme);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  /** The settings page shows the open document's map (its edits included). */
  const [fromSession, setFromSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | undefined>(init.note);
  const [layers, setLayers] = useState<Layers>({ water: true, moisture: false, contamination: false, reach: false, dam: true, entities: true, features: false });
  const [downloaded, setDownloaded] = useState(false);
  const [preview, setPreview] = useState<"2d" | "3d">("2d");
  const [screen, setScreen] = useState<"settings" | "editor">("settings");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [opened, setOpened] = useState<{ key: number; data: SessionOpen } | null>(null);
  const [resume, setResume] = useState<Autosave | null>(null);
  const [saveState, setSaveState] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef(0);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const Preview3D = useLazy(() => import("./Preview3D").then((m) => m.default), preview === "3d");
  const EditorMod = useLazy(() => import("../editor/Editor").then((m) => m.default as ComponentType<EditorProps>), screen === "editor" || !!opened);
  const Dialog = useLazy(() => import("../editor/panels").then((m) => m.ExportDialog as ComponentType<ExportDialogProps>), exporting);

  const spec = useMemo(
    () => makeSpec({ seed: seedFromText(seedText || "0"), size, designedFor: difficulty, theme }),
    [seedText, size, difficulty, theme],
  );
  const stale = !!result && encodeSpecFragment(result.spec) !== encodeSpecFragment(spec);
  const edited = fromSession && !!session && session.kind === "generated" && session.edits > 0;

  function showSpec(s: MapSpec) {
    setSeedText(String(s.seed));
    setSize(s.size);
    setDifficulty(s.designedFor);
    setTheme(s.theme);
  }

  // ------------------------------------------------------------------------------ generating

  async function run(s: MapSpec) {
    setBusy(true);
    setError(null);
    setDownloaded(false);
    try {
      if (edited) {
        // keep the player's edits: regenerate the open document with the new settings
        const r = await generator.regenerate(s);
        setSession(r.info);
        if (!r.ok || !r.response) {
          setError(`The map was not changed: ${r.errors.join("; ")}`);
          return;
        }
        setResult(r.response);
        scheduleSave();
        history.replaceState(null, "", "#" + encodeSpecFragment(r.response.spec));
        if (!r.response.passed) setError(`No layout passed every check after ${r.response.attempts} attempts; this is the last one. Try another seed.`);
        return;
      }
      if (session && session.kind === "generated" && session.edits === 0) {
        // nothing to keep: the open document was the unedited map
        await generator.closeSession();
        setSession(null);
        void storage.clear();
      }
      const r = await generator.generate(s);
      setResult(r);
      setFromSession(false);
      history.replaceState(null, "", "#" + encodeSpecFragment(r.spec));
      if (!r.passed) setError(`No valid map after ${r.attempts} attempts. Try another seed.`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const saved = await storage.load();
      if (saved && location.hash === "#edit") {
        await openBytes(saved.bytes, saved.name + ".damgoodmaps.json", true);
        return;
      }
      if (saved) setResume(saved);
      await run(init.spec);
    })();
  }, []);

  // -------------------------------------------------------------------------------- the editor

  function enterEditor(data: SessionOpen) {
    setSession(data.info);
    setOpened((o) => ({ key: (o?.key ?? 0) + 1, data }));
    setScreen("editor");
    setResume(null);
    history.replaceState(null, "", "#edit");
    scheduleSave();
  }

  /** Ask before replacing an open document that has edits. */
  function guard(action: () => void, what: string) {
    if (session && session.edits > 0) {
      setConfirm({
        text: `${what} closes ${session.name} and its ${session.edits} edit${session.edits > 1 ? "s" : ""}. Save its project file first if you want to keep them.`,
        yes: "Close it",
        onYes: action,
      });
    } else action();
  }

  async function refine() {
    setError(null);
    try {
      if (fromSession && session?.kind === "generated") enterEditor(await generator.sessionView());
      else guard(() => void generator.refine().then(enterEditor, (e) => setError(String(e instanceof Error ? e.message : e))), "Refining this map");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function openBytes(bytes: Uint8Array, name: string, fromAutosave = false) {
    setError(null);
    setBusy(true);
    try {
      const data = isProjectFile(name, bytes) ? await generator.openProject(bytes) : await generator.openTimber(bytes, name);
      enterEditor(data);
    } catch (e) {
      const text = String(e instanceof Error ? e.message : e);
      setError(fromAutosave ? `The autosaved map could not be opened: ${text}` : `${name} could not be opened: ${text}`);
      setScreen("settings");
      if (fromAutosave) await run(init.spec);
    } finally {
      setBusy(false);
    }
  }

  function openFile(file: File) {
    guard(() => void readFile(file).then((b) => openBytes(b, file.name)), `Opening ${file.name}`);
  }

  async function backToSettings(info: SessionInfo) {
    setScreen("settings");
    setSession(info);
    if (info.kind === "generated" && info.spec) {
      showSpec(info.spec);
      setBusy(true);
      try {
        setResult(await generator.settingsResponse());
        setFromSession(true);
        history.replaceState(null, "", "#" + encodeSpecFragment(info.spec));
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setBusy(false);
      }
    } else {
      setFromSession(false);
      history.replaceState(null, "", "#" + encodeSpecFragment(spec));
      if (!result) await run(spec);
    }
  }

  function discardEdits() {
    setConfirm({
      text: `Discard your ${session?.edits ?? 0} edits and show the generated map? This cannot be undone.`,
      yes: "Discard edits",
      onYes: () =>
        void (async () => {
          await generator.closeSession();
          setSession(null);
          setFromSession(false);
          await storage.clear();
          await run(spec);
        })(),
    });
  }

  // ------------------------------------------------------------------------------- autosave

  function scheduleSave() {
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const info = await generator.sessionInfo();
        if (!info) return;
        setSaveState("saving…");
        const p = await generator.project(6);
        const ok = await storage.save({ bytes: p.bytes, name: p.name, savedAt: new Date().toISOString(), kind: info.kind, screen: screenRef.current });
        setSaveState(ok ? "saved in this browser" : "autosave is off in this browser");
      } catch {
        setSaveState("autosave failed");
      }
    }, 1200);
  }

  const lastVersion = useRef(-1);
  function onEditorChange(info: SessionInfo) {
    setSession(info);
    if (info.version !== lastVersion.current) {
      lastVersion.current = info.version;
      scheduleSave();
    }
  }

  // ---------------------------------------------------------------------------------- render

  const presetOf = (s: { x: number; y: number }) =>
    (Object.entries(SIZE_PRESETS).find(([, v]) => v === s.x && v === s.y)?.[0] as SizePreset | undefined) ?? "custom";

  const confirmDialog = confirm ? (
    <div class="dialog-backdrop">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
        <p id="confirm-text">{confirm.text}</p>
        <footer>
          <button type="button" class="ghost" onClick={() => setConfirm(null)} autoFocus>
            Cancel
          </button>
          {session ? (
            <button type="button" class="ghost" onClick={() => void generator.project().then((p) => saveFile(p.bytes, p.fileName, "application/gzip"))}>
              Save project file
            </button>
          ) : null}
          <button
            type="button"
            class="primary"
            onClick={() => {
              const c = confirm;
              setConfirm(null);
              c.onYes();
            }}
          >
            {confirm.yes}
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  if (screen === "editor" && opened) {
    return (
      <>
        {EditorMod ? (
          <EditorMod key={opened.key} api={generator} opened={opened.data} onBack={(i) => void backToSettings(i)} onChange={onEditorChange} onOpenFile={openFile} saveState={saveState} />
        ) : (
          <div class="placeholder">Opening the editor…</div>
        )}
        {error ? (
          <p class="error floating" role="alert">
            {error}
          </p>
        ) : null}
        {confirmDialog}
      </>
    );
  }

  const openInput = (
    <label class="button ghost wide">
      Open a map
      <input
        type="file"
        class="visually-hidden"
        accept=".timber,.json,.gz,application/json"
        aria-label="Open a map or a project file in the editor"
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = "";
          if (file) openFile(file);
        }}
      />
    </label>
  );

  return (
    <div class="app">
      <header class="top">
        <h1>Dam Good Maps</h1>
        <p class="tag">Timberborn maps from a seed: generate, refine, download, play.</p>
      </header>
      {resume ? (
        <div class="banner" role="status">
          <span>
            Continue editing <strong>{resume.name}</strong>? It was saved in this browser {new Date(resume.savedAt).toLocaleString()}.
          </span>
          <button type="button" class="primary" onClick={() => void openBytes(resume.bytes, resume.name + ".damgoodmaps.json", true)}>
            Continue
          </button>
          <button
            type="button"
            class="ghost"
            onClick={() => {
              setResume(null);
              void storage.clear();
            }}
          >
            Discard
          </button>
        </div>
      ) : null}
      {session && session.kind === "import" ? (
        <div class="banner" role="status">
          <span>
            You are editing <strong>{session.name}</strong>.
          </span>
          <button type="button" class="primary" onClick={() => void generator.sessionView().then(enterEditor)}>
            Back to the editor
          </button>
        </div>
      ) : null}
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
            {busy ? "Generating…" : edited ? "Generate, keeping my edits" : stale ? "Generate (settings changed)" : "Generate"}
          </button>
          {edited ? (
            <p class="note">
              Your {session!.edits} edit{session!.edits > 1 ? "s stay" : " stays"} when you generate again.{" "}
              <button type="button" class="linkish" onClick={discardEdits}>
                Discard edits
              </button>
            </p>
          ) : null}
          {note && <p class="note">{note}</p>}
          {openInput}
          <details class="more">
            <summary>What's in this version</summary>
            <p>
              One theme, River Valley. The water is simulated with the game's own rules and shipped settled, so rivers
              run from the first tick; trees live where that water keeps the soil moist. Every map is checked against
              the game's loading rules and for a colony's survival: clean water in pump reach, food, wood, land to
              build on, and a dam site that holds a drought's water. Refine a map in the editor, or open any map to
              look at it in 3D and change it.
            </p>
          </details>
        </section>
        <section class="view" aria-label="Map">
          <div class="view-bar">
            <div class="segmented" role="group" aria-label="Preview">
              <button type="button" aria-pressed={preview === "2d"} onClick={() => setPreview("2d")}>
                2D
              </button>
              <button type="button" aria-pressed={preview === "3d"} onClick={() => setPreview("3d")}>
                3D
              </button>
            </div>
            {preview === "2d" ? (
              <div class="layers" role="group" aria-label="Preview layers">
                {(Object.keys(LAYER_NAMES) as (keyof Layers)[]).map((k) => (
                  <label class="check" key={k}>
                    <input type="checkbox" checked={layers[k]} onChange={() => setLayers({ ...layers, [k]: !layers[k] })} />
                    {LAYER_NAMES[k]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {result ? (
            preview === "3d" ? (
              Preview3D ? (
                <Preview3D result={result} />
              ) : (
                <div class="placeholder">Loading the 3D view…</div>
              )
            ) : (
              <Preview2D result={result} layers={layers} />
            )
          ) : (
            <div class="placeholder">{busy ? "Generating…" : ""}</div>
          )}
          {result && (
            <>
              <div class="downloads">
                <button type="button" class="primary" disabled={!result.passed && !fromSession} onClick={() => void refine()}>
                  Refine this map
                </button>
                {fromSession ? (
                  <>
                    <button type="button" class="ghost" onClick={() => setExporting(true)}>
                      Export {session?.timberName ?? result.timberName}
                    </button>
                    <button type="button" class="ghost" onClick={() => void generator.project().then((p) => saveFile(p.bytes, p.fileName, "application/gzip"))}>
                      Download project file
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      class="ghost"
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
                  </>
                )}
              </div>
              <MapCard result={result} />
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
                    your map and its edits: open it here to keep editing.
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
      {exporting && session && Dialog ? (
        <Dialog
          api={generator}
          info={session}
          onClose={() => setExporting(false)}
          onChecked={() => undefined}
          queue={(fn) => fn()}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
