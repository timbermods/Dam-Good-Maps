// The editor's panels (EDITOR_PLAN §4): the four tabs with their tools, the inspector of the
// selected feature, the preview of a planned edit, the problems an edit made, the history list,
// the map's health pill and the export dialog.

import type { Remote } from "comlink";
import { useEffect, useRef, useState } from "preact/hooks";
import type { OpParams } from "../core/doc/ops";
import type { Orientation } from "../core/format/footprints";
import type { Feature, SetPieceFeature } from "../core/features/schema";
import type { Facing } from "../core/features/setpieces/common";
import { saveFile } from "../platform";
import type { EntityView } from "../render3d/model";
import type { GeneratorApi } from "../worker/generator.worker";
import type { CheckItem, DamSiteView, ExportCheck, SessionInfo, ToolPlan, ToolRequest } from "../worker/session";
import type { FixOp } from "../core/validate/report";
import { featureName, tabOf, type FeatureIndex, type StartCheck, type Tab } from "./features";
import { LAND_TOOLS, RESOURCE_TOOLS, TOOL_HINTS, TOOL_NAMES, WATER_TOOLS, type Edge, type FlowWord, type Species, type ToolKind, type ToolOptions } from "./tools";

// ------------------------------------------------------------------------------------- the tabs

const TABS: { id: Tab; name: string }[] = [
  { id: "land", name: "Land" },
  { id: "water", name: "Water" },
  { id: "resources", name: "Resources" },
  { id: "start", name: "Start" },
];

const TOOLS_OF: Record<Tab, ToolKind[]> = { land: LAND_TOOLS, water: WATER_TOOLS, resources: RESOURCE_TOOLS, start: [] };

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
  damSites: DamSiteView[] | null;
  onDamSites(show: boolean): void;
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
        {p.tab === "water" ? <DamSiteToggle sites={p.damSites} onToggle={p.onDamSites} /> : null}
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

function DamSiteToggle({ sites, onToggle }: { sites: DamSiteView[] | null; onToggle(show: boolean): void }) {
  return (
    <section class="layer-toggle" aria-label="Dam sites">
      <label class="check">
        <input type="checkbox" checked={sites !== null} onChange={(e) => onToggle((e.target as HTMLInputElement).checked)} />
        Show dam sites
      </label>
      {sites ? (
        sites.length ? (
          <p class="note">
            Orange lines mark the best places for a dam. The best holds {sites[0].volume.toLocaleString()} water behind {sites[0].length} tiles of dam, {sites[0].height} high.
          </p>
        ) : (
          <p class="note">No good dam sites near the start. Add one on a river with the Dam site tool.</p>
        )
      ) : null}
    </section>
  );
}

function TabNote({ tab, info }: { tab: Tab; info: SessionInfo }) {
  const imported = info.kind === "import";
  if (tab === "start") {
    if (imported) return <p class="note">Drag the start's handle to move it. The district center needs level ground and a free tile at its door.</p>;
    return <p class="note">Select the start, then drag its handle. Green means the district center fits; red means it does not. Water, trees and berries nearby show as you drag.</p>;
  }
  if (imported && tab === "land") return <p class="note">Imported maps have no features to select yet. Draw new land on top of the map.</p>;
  return null;
}

function Num(p: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void }) {
  // what the player is typing, until it commits: a re-render meanwhile (the worker finishing an
  // edit) must not put the old value back
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label>
      {p.label}
      <input
        type="number"
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        value={draft ?? p.value}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onChange={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          setDraft(null);
          if (Number.isFinite(v)) p.onChange(Math.min(p.max, Math.max(p.min, v)));
        }}
      />
    </label>
  );
}

function Pick<T extends string>(p: { label: string; value: T; choices: [T, string][]; onChange(v: T): void }) {
  return (
    <label>
      {p.label}
      <select value={p.value} onChange={(e) => p.onChange((e.target as HTMLSelectElement).value as T)}>
        {p.choices.map(([v, name]) => (
          <option value={v} key={v}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

const FACING_CHOICES: [Facing, string][] = [
  ["north", "North"],
  ["east", "East"],
  ["south", "South"],
  ["west", "West"],
];
const FLOW_CHOICES: [FlowWord, string][] = [
  ["gentle", "Gentle (1 water/s)"],
  ["steady", "Steady (2 water/s)"],
  ["strong", "Strong (4 water/s)"],
];
const EDGE_CHOICES: [Edge, string][] = [
  ["gentle", "Gentle: 1-level steps, joined by slopes"],
  ["terraced", "Terraced: wide 1-level bands"],
  ["cliff", "Cliff: beavers need stairs"],
];

function ToolOptionsForm({ tool, options: o, onOptions }: { tool: ToolKind; options: ToolOptions; onOptions(o: ToolOptions): void }) {
  const set = (patch: Partial<ToolOptions>) => onOptions({ ...o, ...patch });
  const land = ["hill", "plateau", "ridge", "canyon", "valley", "island"].includes(tool);
  return (
    <div class="tool-options">
      <p class="note">{TOOL_HINTS[tool]}</p>
      {land ? (
        <>
          <label>
            Height
            <select value={String(o.height)} onChange={(e) => set({ height: Number((e.target as HTMLSelectElement).value) })}>
              <option value="0">{tool === "canyon" || tool === "valley" ? "2 below the ground" : tool === "plateau" && o.edge === "cliff" ? "2 above the ground" : "3 above the ground"}</option>
              {Array.from({ length: 16 }, (_, k) => k + 1).map((h) => (
                <option value={String(h)} key={h}>
                  Height {h}
                </option>
              ))}
            </select>
          </label>
          <Pick label="Edges" value={o.edge} choices={EDGE_CHOICES} onChange={(edge) => set({ edge })} />
          {o.edge === "terraced" ? <Num label="Band depth (tiles)" value={o.bandDepth} min={6} max={12} onChange={(bandDepth) => set({ bandDepth })} /> : null}
        </>
      ) : null}
      {tool === "river" ? <Pick label="Flow" value={o.flow} choices={FLOW_CHOICES} onChange={(flow) => set({ flow })} /> : null}
      {tool === "lake" ? (
        <>
          <label>
            Water level
            <select value={String(o.level)} onChange={(e) => set({ level: Number((e.target as HTMLSelectElement).value) })}>
              <option value="0">The lowest ground round it</option>
              {Array.from({ length: 15 }, (_, k) => k + 1).map((h) => (
                <option value={String(h)} key={h}>
                  Level {h}
                </option>
              ))}
            </select>
          </label>
          <Pick
            label="Spring"
            value={String(o.spring)}
            choices={[
              ["0.25", "Trickle"],
              ["0.5", "Gentle"],
              ["1", "Steady"],
            ]}
            onChange={(v) => set({ spring: Number(v) })}
          />
        </>
      ) : null}
      {tool === "waterfall" ? (
        <>
          <Num label="Drop (levels)" value={o.drop} min={1} max={15} onChange={(drop) => set({ drop })} />
          <p class="note">Away from a river, it also takes:</p>
          <Num label="Width (tiles)" value={o.fallWidth} min={2} max={102} onChange={(fallWidth) => set({ fallWidth })} />
          <Pick label="Falls toward" value={o.facing} choices={FACING_CHOICES} onChange={(facing) => set({ facing })} />
          <Pick label="Flow" value={o.flow} choices={FLOW_CHOICES} onChange={(flow) => set({ flow })} />
        </>
      ) : null}
      {tool === "damSite" ? <Num label="Dam height (levels above the river)" value={o.crest} min={1} max={4} onChange={(crest) => set({ crest })} /> : null}
      {tool === "gorge" ? (
        <>
          <Num label="Length (tiles)" value={o.gorgeLength} min={6} max={40} onChange={(gorgeLength) => set({ gorgeLength })} />
          <Num label="Width (tiles)" value={o.gorgeWidth} min={3} max={9} onChange={(gorgeWidth) => set({ gorgeWidth })} />
          <Num label="Wall height (levels)" value={o.wallHeight} min={2} max={14} onChange={(wallHeight) => set({ wallHeight })} />
          <label class="check">
            <input type="checkbox" checked={o.stairs} onChange={() => set({ stairs: !o.stairs })} />
            Stairs down to the water
          </label>
        </>
      ) : null}
      {tool === "terracedCliffs" ? (
        <>
          <Pick label="Faces" value={o.facing} choices={FACING_CHOICES} onChange={(facing) => set({ facing })} />
          <Num label="Bands" value={o.bands} min={3} max={6} onChange={(bands) => set({ bands })} />
          <Num label="Band depth (tiles)" value={o.bandDepth} min={6} max={12} onChange={(bandDepth) => set({ bandDepth })} />
          <Num label="Width (tiles)" value={o.cliffWidth} min={6} max={60} onChange={(cliffWidth) => set({ cliffWidth })} />
        </>
      ) : null}
      {tool === "badwater" ? <Num label="Strength (water/s)" value={o.strength} min={1} max={3} step={0.5} onChange={(strength) => set({ strength })} /> : null}
      {tool === "forest" ? (
        <label>
          Trees
          <select value={o.species} onChange={(e) => set({ species: (e.target as HTMLSelectElement).value as Species })}>
            <option value="mixed">Mixed</option>
            <option value="Pine">Pine</option>
            <option value="Birch">Birch</option>
            <option value="Oak">Oak</option>
          </select>
        </label>
      ) : null}
      {tool === "forest" || tool === "berryPatch" ? (
        <label>
          Density: {Math.round(o.density * 100)}%
          <input type="range" min="10" max="100" step="10" value={Math.round(o.density * 100)} onInput={(e) => set({ density: Number((e.target as HTMLInputElement).value) / 100 })} />
        </label>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------ the tool preview

export interface PreviewProps {
  plan: ToolPlan | null;
  pending: boolean;
  onPlace(): void;
  onCancel(): void;
}

/** The planned edit before it is placed: what it does, every value reduced, what it clears. */
export function PreviewCard({ plan, pending, onPlace, onCancel }: PreviewProps) {
  const place = useRef<HTMLButtonElement>(null);
  useEffect(() => place.current?.focus(), [plan]);
  if (!plan && !pending) return null;
  return (
    <aside class="preview-card" aria-label="Preview">
      {pending ? <p>Planning…</p> : null}
      {plan && !plan.ok ? (
        <p class="error" role="alert">
          {plain(plan.errors[0] ?? "This does not fit here.")}
        </p>
      ) : null}
      {plan?.ok ? (
        <>
          <h2>{plan.label}</h2>
          <ul>
            {plan.report.map((r) => (
              <li key={r}>{plain(r)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <footer>
        <button type="button" class="ghost" onClick={onCancel}>
          {plan && !plan.ok ? "OK" : "Cancel"}
        </button>
        {plan?.ok ? (
          <button type="button" class="primary" ref={place} onClick={onPlace}>
            Place
          </button>
        ) : null}
      </footer>
    </aside>
  );
}

/** The start's footprint check while it is dragged: fits or not, and what is nearby. */
export function StartIndicators({ check, needs }: { check: StartCheck; needs: { water: number; trees: number; bushes: number } }) {
  const mark = (ok: boolean) => (ok ? "ok" : "low");
  return (
    <div class="start-indicators" role="status">
      <p class={check.problem ? "bad" : "ok"}>{check.problem ? `Does not fit: ${check.problem}` : "The district center fits here"}</p>
      <ul>
        <li class={mark(check.water !== null && check.water <= needs.water)}>Water: {check.water === null ? "none in pump reach" : `${check.water} tiles`}</li>
        <li class={mark(check.trees >= needs.trees)}>Trees nearby: {check.trees}</li>
        <li class={mark(check.bushes >= needs.bushes)}>Berry bushes nearby: {check.bushes}</li>
      </ul>
    </div>
  );
}

// -------------------------------------------------------------------------------- the inspector

const TURN: Record<Orientation, Orientation> = { Cw0: "Cw90", Cw90: "Cw180", Cw180: "Cw270", Cw270: "Cw0" };
const FACING: Record<Orientation, string> = { Cw0: "south", Cw90: "west", Cw180: "north", Cw270: "east" };
const MOIST: Record<number, string> = { 1: "16 tiles", 2: "10 tiles", 3: "4 tiles", 4: "no tiles" };

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
  /** Plan the feature again with a changed request (a tool's request for rivers, lakes,
   *  landforms and set pieces), then apply it. */
  onReplan(req: ToolRequest): void;
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
      {f.kind === "landform" && f.params.outline && f.params.height !== undefined ? <LandformControls f={f} name={name} onPatch={p.onPatch} onReplan={p.onReplan} /> : null}
      {f.kind === "river" ? <RiverControls f={f} onPatch={p.onPatch} onReplan={p.onReplan} /> : null}
      {f.kind === "lake" && !f.params.planned && f.params.outlet.path ? <LakeControls f={f} onReplan={p.onReplan} /> : null}
      {f.kind === "setPiece" ? <PieceControls f={f} onReplan={p.onReplan} /> : null}
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

function LandformControls({ f, name, onPatch, onReplan }: { f: Extract<Feature, { kind: "landform" }>; name: string; onPatch: InspectorProps["onPatch"]; onReplan: InspectorProps["onReplan"] }) {
  const pr = f.params;
  const own = f.origin !== "generated";
  const replan = (patch: { height?: number; edgeStyle?: Edge; bandDepth?: number }) =>
    onReplan({ tool: "landform", outline: pr.outline!, kind: pr.kind, height: patch.height ?? pr.height, edgeStyle: patch.edgeStyle ?? pr.edgeStyle, ...(pr.bandDepth || patch.bandDepth ? { bandDepth: patch.bandDepth ?? pr.bandDepth } : {}) });
  return (
    <>
      <label>
        Height
        <input
          type="number"
          min="0"
          max="16"
          value={pr.height}
          onChange={(e) => {
            const v = Math.round(Number((e.target as HTMLInputElement).value));
            if (v >= 0 && v <= 16 && v !== pr.height) onPatch({ params: { height: v } }, `Change ${name.toLowerCase()} height`);
          }}
        />
      </label>
      {own ? <Pick label="Edges" value={pr.edgeStyle} choices={EDGE_CHOICES} onChange={(edgeStyle) => edgeStyle !== pr.edgeStyle && replan({ edgeStyle })} /> : null}
      {own && pr.edgeStyle === "terraced" ? <Num label="Band depth (tiles)" value={pr.bandDepth ?? 8} min={6} max={12} onChange={(bandDepth) => replan({ bandDepth })} /> : null}
    </>
  );
}

function RiverControls({ f, onPatch, onReplan }: { f: Extract<Feature, { kind: "river" }>; onPatch: InspectorProps["onPatch"]; onReplan: InspectorProps["onReplan"] }) {
  const pr = f.params;
  const drawn = pr.banks === true;
  const word: FlowWord | "exact" = pr.flow === 1 ? "gentle" : pr.flow === 2 ? "steady" : pr.flow === 4 ? "strong" : "exact";
  const flows: [string, string][] = [...FLOW_CHOICES, ...(word === "exact" ? ([["exact", `${pr.flow} water/s`]] as [string, string][]) : [])];
  const setFlow = (v: string) => {
    const flow = { gentle: 1, steady: 2, strong: 4 }[v as FlowWord];
    if (!flow || flow === pr.flow) return;
    if (drawn) onReplan({ tool: "river", points: pr.path, flow, bedDepth: pr.bedDepth });
    else onPatch({ params: { flow } }, "Change the river's flow");
  };
  return (
    <>
      <Pick label="Flow" value={word} choices={flows} onChange={setFlow} />
      {drawn ? (
        <label>
          Bed depth
          <select value={String(pr.bedDepth)} onChange={(e) => onReplan({ tool: "river", points: pr.path, flow: pr.flow, bedDepth: Number((e.target as HTMLSelectElement).value) })}>
            {[1, 2, 3, 4].map((d) => (
              <option value={String(d)} key={d}>
                {d} below its banks
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p class="note">Moist soil reaches {MOIST[pr.bedDepth] ?? "a few tiles"} from its banks. Drag its handle to move it.</p>
    </>
  );
}

function LakeControls({ f, onReplan }: { f: Extract<Feature, { kind: "lake" }>; onReplan: InspectorProps["onReplan"] }) {
  const pr = f.params;
  const spring = "spring" in pr.inflow ? pr.inflow.spring : 0;
  const replan = (patch: { level?: number; spring?: number }) => onReplan({ tool: "lake", outline: pr.outline, level: patch.level ?? pr.outlet.sill, floorDepth: pr.floorDepth, spring: patch.spring ?? spring });
  return (
    <>
      <Num label="Water level" value={pr.outlet.sill} min={1} max={15} onChange={(level) => level !== pr.outlet.sill && replan({ level })} />
      <Pick
        label="Spring"
        value={String(spring)}
        choices={[
          ["0", "None (it dries slowly)"],
          ["0.25", "Trickle"],
          ["0.5", "Gentle"],
          ["1", "Steady"],
        ]}
        onChange={(v) => replan({ spring: Number(v) })}
      />
      <p class="note">The water fills to the level of its outlet, then flows out.</p>
    </>
  );
}

function PieceControls({ f, onReplan }: { f: SetPieceFeature; onReplan: InspectorProps["onReplan"] }) {
  const req = f.params.request;
  const plan = f.params.plan;
  const kind = f.params.kind;
  const replan = (patch: Record<string, number | string | boolean>) => onReplan({ tool: "setPiece", piece: kind, request: { ...req, ...patch } });
  const generatedMarsh = kind === "badwaterBasin" && plan.mode === "marsh";
  return (
    <>
      {kind === "waterfall" ? (
        <>
          <Num label="Drop (levels)" value={Number(plan.drop)} min={1} max={15} onChange={(drop) => replan({ drop })} />
          {plan.mode === "standalone" ? (
            <>
              <Num label="Width (tiles)" value={Number(plan.width)} min={2} max={102} onChange={(width) => replan({ width })} />
              <Pick
                label="Flow"
                value={typeof req.flow === "string" ? req.flow : "exact"}
                choices={[...FLOW_CHOICES, ...(typeof req.flow === "number" ? ([["exact", `${req.flow} water/s`]] as [string, string][]) : [])]}
                onChange={(flow) => flow !== "exact" && replan({ flow })}
              />
            </>
          ) : null}
        </>
      ) : null}
      {kind === "damSite" ? <Num label="Dam height (levels above the river)" value={Number(plan.crest)} min={1} max={4} onChange={(crest) => replan({ crest })} /> : null}
      {kind === "gorge" ? (
        <>
          <Num label="Width (tiles)" value={Number(plan.width)} min={3} max={9} onChange={(width) => replan({ width })} />
          <Num label="Wall height (levels)" value={Number(plan.wallHeight)} min={2} max={14} onChange={(wallHeight) => replan({ wallHeight })} />
          <label class="check">
            <input type="checkbox" checked={Number(plan.notchSide) !== 0} onChange={() => replan({ access: Number(plan.notchSide) !== 0 ? "none" : "stairs" })} />
            Stairs down to the water
          </label>
        </>
      ) : null}
      {kind === "terracedCliffs" ? (
        <>
          <Num label="Bands" value={Number(plan.bands)} min={3} max={6} onChange={(bands) => replan({ bands })} />
          <Num label="Band depth (tiles)" value={Number(plan.depth)} min={6} max={12} onChange={(depth) => replan({ depth })} />
        </>
      ) : null}
      {kind === "badwaterBasin" && !generatedMarsh ? <Num label="Strength (water/s)" value={Number(plan.strength)} min={1} max={3} step={0.5} onChange={(strength) => replan({ strength })} /> : null}
      {f.params.report.length ? (
        <details>
          <summary>What it does</summary>
          <ul class="report">
            {f.params.report.map((r) => (
              <li key={r}>{plain(r)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
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

/** A problem's first tile, for "Show". */
export function whereOf(c: CheckItem, entityAt: (id: string) => [number, number] | null): [number, number] | null {
  if (c.where?.tiles?.length) return c.where.tiles[0];
  for (const id of c.where?.entities ?? []) {
    const p = entityAt(id);
    if (p) return p;
  }
  return null;
}

export interface ItemActions {
  onFix(fix: FixOp[]): void;
  onShow(c: CheckItem): void;
  canShow(c: CheckItem): boolean;
}

function Items({ items, actions }: { items: CheckItem[]; actions?: ItemActions }) {
  return (
    <ul>
      {items.map((c) => (
        <li key={c.id + c.message}>
          {c.message[0].toUpperCase() + c.message.slice(1)} <code>{c.id}</code>
          {actions && c.fix?.length ? (
            <>
              {" "}
              <button type="button" class="linkish" onClick={() => actions.onFix(c.fix!)}>
                {c.fix[0].label || "Fix it"}
              </button>
            </>
          ) : null}
          {actions && actions.canShow(c) ? (
            <>
              {" "}
              <button type="button" class="linkish" onClick={() => actions.onShow(c)}>
                Show
              </button>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The problems the last edit made (the instant checks), with their fixes. */
export function InstantProblems({ items, actions, onClose }: { items: CheckItem[]; actions: ItemActions; onClose(): void }) {
  if (!items.length) return null;
  return (
    <aside class="instant" role="alert" aria-label="Problems this edit made">
      <header>
        <h2>This edit made {items.length === 1 ? "a problem" : `${items.length} problems`}</h2>
        <button type="button" class="linkish" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      </header>
      <Items items={items} actions={actions} />
      <p class="note">Fix it, undo the edit, or carry on: the map can't be exported until it is fixed.</p>
    </aside>
  );
}

export interface ExportDialogProps {
  api: Remote<GeneratorApi>;
  info: SessionInfo;
  onClose(): void;
  onChecked(c: ExportCheck): void;
  queue<T>(fn: () => Promise<T>): Promise<T>;
  /** Fix and show buttons (the editor); the settings page lists the checks only. */
  actions?: ItemActions;
}

export function ExportDialog(p: ExportDialogProps) {
  const [check, setCheck] = useState<ExportCheck | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const load = () =>
    p
      .queue(() => p.api.exportCheck())
      .then((c) => {
        setCheck(c);
        p.onChecked(c);
      })
      .catch((e) => setError(String(e instanceof Error ? e.message : e)));
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
  // a fix changes the map: apply it, then check again
  const given = p.actions;
  const actions: ItemActions | undefined = given && {
    ...given,
    onFix: (fix) => {
      setCheck(null);
      given.onFix(fix);
      void load();
    },
    onShow: (c) => {
      given.onShow(c);
      p.onClose();
    },
  };
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
                <Items items={check.blocking} actions={actions} />
              </section>
            ) : null}
            {check.warnings.length ? (
              <section class="checks warn">
                <h3>Warnings</h3>
                <Items items={check.warnings} actions={actions} />
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
                <Items items={check.advisory} actions={actions} />
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

/** Engine messages name ids; the player sees plain words. */
export function plain(text: string): string {
  return text.replace(/\b(f-[a-z0-9]{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g, "it").replace(/^./, (c) => c.toUpperCase());
}
