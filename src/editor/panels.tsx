// The editor's panels (EDITOR_PLAN §4): the four tabs, the inspector of the selected feature, the
// history list, the map's health pill and the export dialog.

import type { Remote } from "comlink";
import { useEffect, useRef, useState } from "preact/hooks";
import type { OpParams } from "../core/doc/ops";
import type { Orientation } from "../core/format/footprints";
import type { Feature } from "../core/features/schema";
import { saveFile } from "../platform";
import type { EntityView } from "../render3d/model";
import type { GeneratorApi } from "../worker/generator.worker";
import type { CheckItem, ExportCheck, SessionInfo } from "../worker/session";
import { featureName, tabOf, type FeatureIndex, type Tab } from "./features";
import { TOOL_HINTS, TOOL_NAMES, type Species, type ToolKind, type ToolOptions } from "./tools";

// ------------------------------------------------------------------------------------- the tabs

const TABS: { id: Tab; name: string }[] = [
  { id: "land", name: "Land" },
  { id: "water", name: "Water" },
  { id: "resources", name: "Resources" },
  { id: "start", name: "Start" },
];

const TOOLS_OF: Record<Tab, ToolKind[]> = { land: ["plateau"], water: [], resources: ["forest", "berryPatch", "ruinField"], start: [] };

const LIST_MAX = 40;

export interface TabPanelProps {
  tab: Tab;
  onTab(t: Tab): void;
  info: SessionInfo;
  index: FeatureIndex;
  selected: string | null;
  onSelect(id: string): void;
  tool: ToolKind | null;
  onTool(t: ToolKind | null): void;
  options: ToolOptions;
  onOptions(o: ToolOptions): void;
}

export function TabPanel(p: TabPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // the player's own features first, then what the generator made
  const inTab = p.info.features.filter((f) => tabOf(f) === p.tab);
  const features = [...inTab.filter((f) => f.origin !== "generated"), ...inTab.filter((f) => f.origin === "generated")];
  const shown = features.slice(0, LIST_MAX);
  const onKey = (ev: KeyboardEvent) => {
    const k = TABS.findIndex((t) => t.id === p.tab);
    const next = ev.key === "ArrowDown" || ev.key === "ArrowRight" ? k + 1 : ev.key === "ArrowUp" || ev.key === "ArrowLeft" ? k - 1 : null;
    if (next === null) return;
    ev.preventDefault();
    const t = TABS[(next + TABS.length) % TABS.length];
    p.onTab(t.id);
    (document.getElementById(`tab-${t.id}`) as HTMLElement | null)?.focus();
  };
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [p.selected]);
  return (
    <nav class="tabs" aria-label="Editing">
      <div class="tablist" role="tablist" aria-orientation="vertical" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            key={t.id}
            aria-selected={p.tab === t.id}
            aria-controls="tabpanel"
            tabIndex={p.tab === t.id ? 0 : -1}
            onClick={() => p.onTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div class="tabpanel" id="tabpanel" role="tabpanel" aria-labelledby={`tab-${p.tab}`}>
        {TOOLS_OF[p.tab].length ? (
          <section class="tools" aria-label="Add">
            <h2>Add</h2>
            <div class="tool-buttons">
              {TOOLS_OF[p.tab].map((t) => (
                <button type="button" key={t} class={p.tool === t ? "primary" : "ghost"} aria-pressed={p.tool === t} onClick={() => p.onTool(p.tool === t ? null : t)}>
                  {TOOL_NAMES[t]}
                </button>
              ))}
            </div>
            {p.tool && TOOLS_OF[p.tab].includes(p.tool) ? <ToolOptionsForm tool={p.tool} options={p.options} onOptions={p.onOptions} /> : null}
          </section>
        ) : null}
        <TabNote tab={p.tab} info={p.info} />
        <div class="feature-list" ref={listRef}>
          {features.length ? <h2>On this map</h2> : null}
          <ul>
            {shown.map((f) => (
              <li key={f.id}>
                <button type="button" class="linkish" aria-current={p.selected === f.id} onClick={() => p.onSelect(f.id)}>
                  {featureName(f)}
                  {f.origin !== "generated" ? <span class="tag-user"> yours</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {features.length > shown.length ? <p class="muted">And {features.length - shown.length} more: click them on the map.</p> : null}
        </div>
      </div>
    </nav>
  );
}

function TabNote({ tab, info }: { tab: Tab; info: SessionInfo }) {
  const imported = info.kind === "import";
  if (tab === "water") return <p class="note">Select a river or lake to move or delete it. Drawing rivers and lakes, waterfalls and dam sites comes in the next version.</p>;
  if (tab === "start") {
    if (imported) return <p class="note">This map's start is part of the imported map. Moving it comes with the start tool in the next version.</p>;
    return <p class="note">Select the start, then drag its handle to move it. The district center needs flat ground and a free tile at its door.</p>;
  }
  if (imported && tab === "land") return <p class="note">Imported maps have no features to select yet. Add a plateau on top of the map.</p>;
  return null;
}

function ToolOptionsForm({ tool, options, onOptions }: { tool: ToolKind; options: ToolOptions; onOptions(o: ToolOptions): void }) {
  return (
    <div class="tool-options">
      <p class="note">{TOOL_HINTS[tool]}</p>
      {tool === "plateau" ? (
        <label>
          Height
          <select value={String(options.height)} onChange={(e) => onOptions({ ...options, height: Number((e.target as HTMLSelectElement).value) })}>
            <option value="0">2 above the ground</option>
            {Array.from({ length: 16 }, (_, k) => k + 1).map((h) => (
              <option value={String(h)} key={h}>
                Height {h}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {tool === "forest" ? (
        <label>
          Trees
          <select value={options.species} onChange={(e) => onOptions({ ...options, species: (e.target as HTMLSelectElement).value as Species })}>
            <option value="mixed">Mixed</option>
            <option value="Pine">Pine</option>
            <option value="Birch">Birch</option>
            <option value="Oak">Oak</option>
          </select>
        </label>
      ) : null}
      {tool === "forest" || tool === "berryPatch" ? (
        <label>
          Density: {Math.round(options.density * 100)}%
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={Math.round(options.density * 100)}
            onInput={(e) => onOptions({ ...options, density: Number((e.target as HTMLInputElement).value) / 100 })}
          />
        </label>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------------- the inspector

const TURN: Record<Orientation, Orientation> = { Cw0: "Cw90", Cw90: "Cw180", Cw180: "Cw270", Cw270: "Cw0" };
const FACING: Record<Orientation, string> = { Cw0: "south", Cw90: "west", Cw180: "north", Cw270: "east" };

export interface InspectorProps {
  feature: Feature;
  index: FeatureIndex;
  heights: Uint8Array;
  entities: EntityView;
  W: number;
  blocked: string | null;
  onClose(): void;
  onDelete(): void;
  onPatch(patch: OpParams["updateFeature"]["patch"], label: string): void;
}

export function Inspector(p: InspectorProps) {
  const f = p.feature;
  const tiles = p.index.tilesOf(f);
  let lo = 255;
  let hi = 0;
  for (const i of tiles) {
    lo = Math.min(lo, p.heights[i]);
    hi = Math.max(hi, p.heights[i]);
  }
  const owner = p.entities.owners.indexOf(f.id);
  let objects = 0;
  if (owner >= 0) for (let k = 0; k < p.entities.count; k++) if (p.entities.owner[k] === owner) objects++;
  const name = featureName(f);
  const facts: string[] = [];
  if (tiles.length) facts.push(`${tiles.length.toLocaleString()} tiles`);
  if (tiles.length) facts.push(lo === hi ? `height ${lo}` : `height ${lo}–${hi}`);
  if (f.kind === "forest") facts.push(`${objects} trees`);
  if (f.kind === "berryPatch") facts.push(`${objects} bushes`);
  if (f.kind === "ruinField") facts.push(`${objects} ruin columns`);
  if (f.kind === "river") facts.push(`${f.params.flow} water/s`);
  if (f.kind === "lake") facts.push(`water level ${f.params.outlet.sill}`);
  if (f.kind === "start") facts.push(`door faces ${FACING[f.params.orientation]}`);
  return (
    <aside class="inspector" aria-label={`${name}, selected`}>
      <header>
        <h2>{name}</h2>
        <button type="button" class="linkish" aria-label="Close" onClick={p.onClose}>
          ×
        </button>
      </header>
      <p class="muted">
        {facts.join(" · ")}
        {f.origin !== "generated" ? " · yours" : ""}
      </p>
      {(f.kind === "forest" || f.kind === "berryPatch") && (
        <label>
          Density: {Math.round(f.params.density * 100)}%
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={Math.round(f.params.density * 100)}
            onChange={(e) => p.onPatch({ params: { density: Number((e.target as HTMLInputElement).value) / 100 } }, `Change ${name.toLowerCase()} density`)}
          />
        </label>
      )}
      {f.kind === "landform" && f.params.outline && f.params.height !== undefined ? (
        <label>
          Height
          <input
            type="number"
            min="1"
            max="16"
            value={f.params.height}
            onChange={(e) => {
              const v = Math.round(Number((e.target as HTMLInputElement).value));
              if (v >= 1 && v <= 16 && v !== f.params.height) p.onPatch({ params: { height: v } }, `Change ${name.toLowerCase()} height`);
            }}
          />
        </label>
      ) : null}
      {f.kind === "start" ? (
        <button type="button" class="ghost" onClick={() => p.onPatch({ params: { orientation: TURN[f.params.orientation] } }, "Turn the start")}>
          Turn
        </button>
      ) : null}
      <p class="note">{p.blocked ?? "Drag the handle on the map to move it, or focus the handle and use the arrow keys."}</p>
      <button type="button" class="ghost danger" onClick={p.onDelete}>
        Delete
      </button>
    </aside>
  );
}

// ---------------------------------------------------------------------------------- the history

export function HistoryPanel({ info, onJump, onClose }: { info: SessionInfo; onJump(index: number): void; onClose(): void }) {
  const current = info.history.filter((h) => h.applied).length - 1;
  const orphanNotes = info.orphans.filter((o) => !info.history.some((h) => h.seq === o.seq && h.orphaned));
  return (
    <aside class="history" aria-label="History">
      <header>
        <h2>History</h2>
        <button type="button" class="linkish" aria-label="Close the history" onClick={onClose}>
          ×
        </button>
      </header>
      <p class="muted">Click a step to go back to it. Nothing is lost: you can go forward again until you make a new edit.</p>
      <ol>
        <li>
          <button type="button" class="linkish" aria-current={current === -1} onClick={() => onJump(-1)}>
            {info.kind === "import" ? "Opened the map" : "The generated map"}
          </button>
        </li>
        {info.history.map((h, k) => (
          <li key={k} class={h.applied ? "" : "undone"}>
            <button type="button" class="linkish" aria-current={current === k} onClick={() => onJump(k)}>
              {h.label}
            </button>
            {h.orphaned ? <p class="orphan">No effect now: {h.orphaned}.</p> : null}
          </li>
        ))}
      </ol>
      {orphanNotes.length ? (
        <>
          <h3>To review</h3>
          <ul>
            {orphanNotes.map((o) => (
              <li key={o.seq} class="orphan">
                {o.label}: {o.reason}.
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}

// ------------------------------------------------------------------------------ health and export

export function StatusPill({ check, busy, onOpen }: { check: ExportCheck | null; busy: boolean; onOpen(): void }) {
  let text = "Checking…";
  let tone = "wait";
  if (check && !busy) {
    if (check.blocking.length) {
      text = `${check.blocking.length} problem${check.blocking.length > 1 ? "s" : ""}`;
      tone = "bad";
    } else if (check.warnings.length) {
      text = `${check.warnings.length} warning${check.warnings.length > 1 ? "s" : ""}`;
      tone = "warn";
    } else {
      text = "Ready to play";
      tone = "ok";
    }
  }
  return (
    <button type="button" class={`pill ${tone}`} onClick={onOpen} title="Open the checks">
      {text}
    </button>
  );
}

function Items({ items }: { items: CheckItem[] }) {
  return (
    <ul>
      {items.map((c) => (
        <li key={c.id + c.message}>
          {c.message[0].toUpperCase() + c.message.slice(1)} <code>{c.id}</code>
        </li>
      ))}
    </ul>
  );
}

export interface ExportDialogProps {
  api: Remote<GeneratorApi>;
  info: SessionInfo;
  onClose(): void;
  onChecked(c: ExportCheck): void;
  queue<T>(fn: () => Promise<T>): Promise<T>;
}

export function ExportDialog(p: ExportDialogProps) {
  const [check, setCheck] = useState<ExportCheck | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    void p
      .queue(() => p.api.exportCheck())
      .then((c) => {
        if (!live) return;
        setCheck(c);
        p.onChecked(c);
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const canExport = !!check && !check.blocking.length && (!check.warnings.length || confirmed);
  async function doExport() {
    setError(null);
    const r = await p.queue(() => p.api.exportTimber(confirmed));
    if (!r.ok) return setError(r.errors.join(" "));
    saveFile(r.bytes, r.fileName);
    setSaved(r.fileName);
  }
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header>
          <h2 id="export-title">Export {p.info.timberName}</h2>
          <button type="button" class="linkish" aria-label="Close" onClick={p.onClose} ref={first}>
            ×
          </button>
        </header>
        {!check && !error ? <p>Checking the map…</p> : null}
        {check ? (
          <>
            {check.blocking.length ? (
              <section class="checks bad">
                <h3>Fix these first</h3>
                <p class="note">Each would stop the map from loading as you made it.</p>
                <Items items={check.blocking} />
              </section>
            ) : null}
            {check.warnings.length ? (
              <section class="checks warn">
                <h3>Warnings</h3>
                <Items items={check.warnings} />
                <label class="check">
                  <input type="checkbox" checked={confirmed} onChange={() => setConfirmed(!confirmed)} />
                  Export anyway. The warnings are added to the map's description.
                </label>
              </section>
            ) : null}
            {!check.blocking.length && !check.warnings.length ? <p class="ok-line">All {check.checks} checks pass. Ready to play.</p> : null}
            {check.advisory.length ? (
              <section class="checks">
                <h3>Good to know</h3>
                <Items items={check.advisory} />
              </section>
            ) : null}
            {check.existing.length ? (
              <section class="checks">
                <h3>Already in the map when you opened it</h3>
                <p class="note">These stay as they were. They do not stop the export.</p>
                <Items items={check.existing} />
              </section>
            ) : null}
            {!check.playability ? <p class="note">Water and colony checks run on generated maps. For imported maps they come in a later version.</p> : null}
          </>
        ) : null}
        {error ? (
          <p class="error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p class="ok-line" role="status">
            Saved <strong>{saved}</strong>. Move it to <code>Documents\Timberborn\Maps</code>, then start a new game and pick the map.
          </p>
        ) : null}
        <footer>
          <button type="button" class="ghost" onClick={p.onClose}>
            {saved ? "Done" : "Cancel"}
          </button>
          <button type="button" class="primary" disabled={!canExport} onClick={() => void doExport()}>
            Export
          </button>
        </footer>
      </div>
    </div>
  );
}
