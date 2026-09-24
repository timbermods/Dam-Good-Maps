// The editor shell (EDITOR_PLAN §4, ROADMAP M4): the map fills the screen in the shared 3D view;
// four tabs along the side (Land, Water, Resources, Start); a small inspector beside the selected
// feature with its move and delete handles; undo, redo, history, the map's health and export
// always visible. The document itself lives in the worker (src/worker/session.ts): every edit is
// an operation sent there, and only what changed comes back.

import type { Remote } from "comlink";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { dependentsOf, type EditOp } from "../core/doc/ops";
import type { Feature } from "../core/features/schema";
import { saveFile } from "../platform";
import { surfaceWater, type EntityView, type MapView, type SurfaceWater } from "../render3d/model";
import type { MapRenderer, PointerTool, TileHit, ViewState } from "../render3d";
import { View3D } from "../ui/View3D";
import type { GeneratorApi } from "../worker/generator.worker";
import type { ExportCheck, SessionInfo, SessionOpen, SessionUpdate } from "../worker/session";
import { anchorOf, clampMove, describeTile, entitiesByTile, featureName, FeatureIndex, moveBlocked, movePatch, rectOf, tabOf, type Tab, type TileContext } from "./features";
import { ExportDialog, HistoryPanel, Inspector, StatusPill, TabPanel } from "./panels";
import { DEFAULT_OPTIONS, DRAWING, featureFromRect, MOVING, paintOverlay, rectTiles, SELECTED, TOOL_NAMES, type OverlayLayer, type Rect, type ToolKind, type ToolOptions } from "./tools";

export interface EditorProps {
  api: Remote<GeneratorApi>;
  opened: SessionOpen;
  /** "Back to settings" (generated maps) or "New map" (imported ones). */
  onBack(info: SessionInfo): void;
  /** After every change (autosave keys on `info.version`). */
  onChange(info: SessionInfo): void;
  /** Open another file (the page confirms before replacing unsaved work). */
  onOpenFile(file: File): void;
  saveState: string;
}

interface Mirror {
  heights: Uint8Array;
  water: SurfaceWater;
  entities: EntityView;
  entitiesAt: Map<number, number[]>;
}

type Drag = { id: string; dx: number; dy: number } | null;

declare global {
  interface Window {
    /** Test hook: the open editor (tests/e2e). */
    dgmEditor?: { info: () => SessionInfo; tileToClient(x: number, y: number): { x: number; y: number }; select(id: string | null): void; idle(): Promise<void> };
  }
}

export default function Editor(props: EditorProps) {
  const { api } = props;
  const [info, setInfo] = useState<SessionInfo>(props.opened.info);
  // the map as opened; later changes go to the renderer as updates (the page re-mounts the
  // editor for another map)
  const view = props.opened.view;
  const mirror = useRef<Mirror>(mirrorOf(view));
  const renderer = useRef<MapRenderer | null>(null);
  const [ready, setReady] = useState<MapRenderer | null>(null);
  const [tab, setTab] = useState<Tab>("land");
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolKind | null>(null);
  const [options, setOptions] = useState<ToolOptions>(DEFAULT_OPTIONS);
  const [drawing, setDrawing] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [check, setCheck] = useState<ExportCheck | null>(null);
  const [exporting, setExporting] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(true);
  const [viewTick, setViewTick] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const index = useMemo(() => new FeatureIndex(info.W, info.H), [info.W, info.H, view]);
  const indexed = useMemo(() => {
    index.update(info.features);
    return index;
  }, [index, info.features]);
  const infoRef = useRef(info);
  infoRef.current = info;

  const feature = selected ? (info.features.find((f) => f.id === selected) ?? null) : null;
  useEffect(() => {
    if (selected && !feature) setSelected(null);
  }, [feature, selected]);

  // ------------------------------------------------------------------------------ worker calls

  /** Run worker calls one after another; apply what changed to the view. */
  function run(fn: () => Promise<SessionUpdate>, onDone?: (u: SessionUpdate) => void): Promise<void> {
    const next = queue.current.then(async () => {
      setBusy((b) => b + 1);
      try {
        const u = await fn();
        applyUpdate(u);
        if (!u.ok && u.errors.length) setMessage({ kind: "error", text: plain(u.errors[0]) });
        else if (u.ok) setMessage(null);
        onDone?.(u);
      } catch (e) {
        setMessage({ kind: "error", text: String(e instanceof Error ? e.message : e) });
      } finally {
        setBusy((b) => b - 1);
      }
    });
    queue.current = next;
    return next;
  }

  function applyUpdate(u: SessionUpdate): void {
    const r = renderer.current;
    const m = mirror.current;
    const v = u.view;
    if (v.heights) {
      m.heights = v.heights;
      r?.updateTerrain(v.heights);
    }
    if (v.water) {
      m.water = surfaceWater(u.info.W, u.info.H, v.water);
      r?.updateWater(v.water);
    }
    if (v.entities) {
      m.entities = v.entities;
      m.entitiesAt = entitiesByTile(v.entities, u.info.W);
      r?.updateEntities(v.entities);
    }
    setInfo(u.info);
    props.onChange(u.info);
  }

  const apply = (op: EditOp, label?: string) => run(() => api.apply(op, "user", label));
  const undo = () => run(() => api.undo());
  const redo = () => run(() => api.redo());

  // the map's health (export profile), checked a moment after each change
  useEffect(() => {
    setCheck((c) => (c && c.version === info.version ? c : null));
    const t = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (infoRef.current.version !== info.version) return;
        try {
          setCheck(await api.exportCheck());
        } catch {
          // the check is advisory here: export runs it again
        }
      });
    }, 700);
    return () => clearTimeout(t);
  }, [info.version]);

  useEffect(() => props.onChange(info), []);

  // ------------------------------------------------------------------------------- the view

  const ctx = (): TileContext => ({ W: info.W, H: info.H, heights: mirror.current.heights, water: mirror.current.water, entities: mirror.current.entities, entitiesAt: mirror.current.entitiesAt, index: indexed });

  // overlay: the selected feature, a move preview, a rectangle being drawn
  useEffect(() => {
    const r = renderer.current;
    const data = r?.overlayData();
    if (!r || !data) return;
    const layers: OverlayLayer[] = [];
    if (feature) {
      const tiles = indexed.tilesOf(feature);
      layers.push({ tiles, color: SELECTED });
      if (drag && drag.id === feature.id && (drag.dx || drag.dy)) layers.push({ tiles, color: MOVING, dx: drag.dx, dy: drag.dy });
    }
    if (drawing) layers.push({ tiles: rectTiles(drawing, info.W), color: DRAWING });
    paintOverlay(data, info.W, info.H, layers);
    r.commitOverlay();
  }, [feature, drag, drawing, indexed, ready]);

  // the drawing tool takes left drags on the map
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    if (!tool) {
      r.tool = null;
      return;
    }
    let start: [number, number] | null = null;
    const t: PointerTool = {
      down(hit) {
        if (!hit) return false;
        start = [hit.x, hit.y];
        setDrawing(rectOf(start, start, info.W, info.H));
        return true;
      },
      move(hit) {
        if (start && hit) setDrawing(rectOf(start, [hit.x, hit.y], info.W, info.H));
      },
      up(hit) {
        const a = start;
        start = null;
        setDrawing(null);
        if (!a) return;
        const rect = rectOf(a, hit ? [hit.x, hit.y] : a, info.W, info.H);
        const f = featureFromRect(tool, rect, options, info.W, mirror.current.heights);
        void run(
          () => api.apply({ op: "addFeature", params: { feature: f } }),
          (u) => {
            if (u.ok) {
              setSelected(f.id);
              setTab(tabOf(f));
            }
          },
        );
      },
    };
    r.tool = t;
    return () => {
      if (r.tool === t) r.tool = null;
    };
  }, [tool, options, info.W, info.H, ready]);

  function onReady(r: MapRenderer) {
    renderer.current = r;
    setReady(r);
    r.onClick = (hit) => {
      if (!hit) return setSelected(null);
      const list = indexedRef.current.candidatesAt(hit.x, hit.y);
      if (!list.length) return setSelected(null);
      const cur = list.findIndex((f) => f.id === selectedRef.current);
      const next = list[(cur + 1) % list.length];
      setSelected(next.id);
      setTab(tabOf(next));
    };
    const onView = r.onView;
    let pending = false;
    r.onView = (v: ViewState) => {
      onView?.(v);
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        setViewTick((n) => n + 1);
      });
    };
    setViewTick((n) => n + 1);
  }
  const indexedRef = useRef(indexed);
  indexedRef.current = indexed;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ----------------------------------------------------------------------------- the handles

  const anchor = feature ? anchorOf(indexed, feature) : null;
  const handlePos = useMemo(() => {
    const r = renderer.current;
    if (!r || !anchor) return null;
    const [ax, ay] = anchor;
    const dx = drag?.dx ?? 0;
    const dy = drag?.dy ?? 0;
    const h = r.heightAt(ax, ay);
    const p = r.project(ax + dx + 0.5, h + 0.5, -(ay + dy + 0.5));
    return p.visible ? p : null;
  }, [anchor?.[0], anchor?.[1], drag, viewTick, feature]);

  const blocked = feature ? moveBlocked(feature) : null;

  function commitMove(f: Feature, dx: number, dy: number) {
    setDrag(null);
    if (!dx && !dy) return;
    void apply({ op: "updateFeature", params: { id: f.id, patch: movePatch(f, dx, dy, info.W, info.H, mirror.current.heights) } }, `Move ${featureName(f).toLowerCase()}`);
  }

  function onHandleDown(ev: PointerEvent) {
    const r = renderer.current;
    if (!r || !feature || blocked || !anchor) return;
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture(ev.pointerId);
    const level = r.heightAt(anchor[0], anchor[1]);
    const start = r.pickAtLevel(ev.clientX, ev.clientY, level) ?? { x: anchor[0], y: anchor[1] };
    const f = feature;
    let cur: [number, number] = [0, 0];
    const move = (e: PointerEvent) => {
      const at = r.pickAtLevel(e.clientX, e.clientY, level);
      if (!at) return;
      cur = clampMove(f, at.x - start.x, at.y - start.y, info.W, info.H);
      setDrag({ id: f.id, dx: cur[0], dy: cur[1] });
    };
    const up = (e: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (e.type === "pointercancel") return setDrag(null);
      commitMove(f, cur[0], cur[1]);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // arrow keys on the focused handle nudge the feature; it is placed a moment after the last key
  const nudgeTimer = useRef(0);
  function onHandleKey(ev: KeyboardEvent) {
    const r = renderer.current;
    if (!r || !feature || blocked) return;
    const v = r.getView();
    const yaw = v.mode === "top" ? 0 : v.yaw;
    // screen up and screen right, as tile steps
    const fx = -Math.sin(yaw);
    const fy = Math.cos(yaw);
    const up: [number, number] = Math.abs(fx) > Math.abs(fy) ? [Math.sign(fx), 0] : [0, Math.sign(fy)];
    const right: [number, number] = [up[1], -up[0]];
    const step = ev.key === "ArrowUp" ? up : ev.key === "ArrowDown" ? [-up[0], -up[1]] : ev.key === "ArrowRight" ? right : ev.key === "ArrowLeft" ? [-right[0], -right[1]] : null;
    if (ev.key === "Escape") {
      clearTimeout(nudgeTimer.current);
      setDrag(null);
      return;
    }
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    const f = feature;
    const d = drag && drag.id === f.id ? drag : { id: f.id, dx: 0, dy: 0 };
    const [nx, ny] = clampMove(f, d.dx + step[0], d.dy + step[1], info.W, info.H);
    setDrag({ id: f.id, dx: nx, dy: ny });
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => commitMove(f, nx, ny), 700);
  }

  function deleteFeature(f: Feature) {
    const deps = dependentsOf(info.features, f.id);
    if (deps.length) {
      const names = [...new Set(deps.map((d) => featureName(d).toLowerCase()))];
      setMessage({ kind: "error", text: `The ${names.join(" and the ")} ${deps.length === 1 ? "builds" : "build"} on this ${featureName(f).toLowerCase()}. Delete ${deps.length === 1 ? "it" : "them"} first.` });
      return;
    }
    void apply({ op: "deleteFeature", params: { id: f.id } }, `Delete ${featureName(f).toLowerCase()}`);
    setSelected(null);
  }

  // ------------------------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        void (ev.shiftKey ? redo() : undo());
      } else if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        void redo();
      } else if (ev.key === "Escape") {
        setTool(null);
        setDrawing(null);
        setSelected(null);
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && selectedRef.current && !(target?.classList.contains("handle"))) {
        const f = infoRef.current.features.find((g) => g.id === selectedRef.current);
        if (f) deleteFeature(f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------------------ test hook

  useEffect(() => {
    window.dgmEditor = {
      info: () => infoRef.current,
      tileToClient: (x, y) => renderer.current!.tileToClient(x, y),
      select: (id) => setSelected(id),
      idle: () => queue.current.then(() => undefined),
    };
    return () => {
      delete window.dgmEditor;
    };
  }, []);

  // ------------------------------------------------------------------------------ export

  async function exportProject() {
    const p = await api.project();
    saveFile(p.bytes, p.fileName, "application/gzip");
  }

  const notices = [...info.notices, ...(info.importReport?.changes.filter((c) => c.level === "warning").map((c) => c.message) ?? [])];
  const flags = info.importReport?.flags ?? [];
  const importChanges = info.importReport?.changes.length ?? 0;

  return (
    <div class="editor" aria-busy={busy > 0}>
      <header class="editor-bar">
        <button type="button" class="ghost" onClick={() => props.onBack(info)}>
          {info.kind === "generated" ? "Back to settings" : "New map"}
        </button>
        <div class="editor-title">
          <h1>{info.name}</h1>
          <span class="muted">
            {info.W}×{info.H}
            {info.kind === "import" ? " · imported" : ""}
            {info.edits ? ` · ${info.edits} edit${info.edits > 1 ? "s" : ""}` : ""}
            {props.saveState ? ` · ${props.saveState}` : ""}
          </span>
        </div>
        <div class="editor-actions" role="toolbar" aria-label="Edit">
          <button type="button" class="ghost" onClick={() => void undo()} disabled={!info.canUndo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" class="ghost" onClick={() => void redo()} disabled={!info.canRedo} title="Redo (Ctrl+Y)">
            Redo
          </button>
          <button type="button" class="ghost" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
            History{info.orphans.length ? ` (${info.orphans.length} to review)` : ""}
          </button>
          <StatusPill check={check} busy={busy > 0} onOpen={() => setExporting(true)} />
          <label class="button ghost">
            Open
            <input
              type="file"
              class="visually-hidden"
              accept=".timber,.json,.gz,application/json"
              aria-label="Open a map or project file"
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                input.value = "";
                if (file) props.onOpenFile(file);
              }}
            />
          </label>
          <button type="button" class="ghost" onClick={() => void exportProject()}>
            Save project
          </button>
          <button type="button" class="primary" onClick={() => setExporting(true)}>
            Export .timber
          </button>
        </div>
      </header>
      <div class="editor-main">
        <TabPanel
          tab={tab}
          onTab={setTab}
          info={info}
          index={indexed}
          selected={selected}
          onSelect={(id) => setSelected(id)}
          tool={tool}
          onTool={(t) => {
            setTool(t);
            setSelected(null);
          }}
          options={options}
          onOptions={setOptions}
        />
        <section class="editor-map" aria-label="Map">
          <View3D
            view={view}
            class="editor-view"
            label={`3D view of ${info.name}. Click a feature to select it. Drag to turn, right-drag to move, wheel to zoom.`}
            onReady={onReady}
            onHover={(hit: TileHit | null) => setHover(hit ? describeTile(ctx(), hit.x, hit.y) : null)}
            hoverText={hover}
          >
            {tool ? (
              <div class="tool-hint" role="status">
                {TOOL_NAMES[tool]}: drag a rectangle on the map. <button type="button" class="linkish" onClick={() => setTool(null)}>Done</button>
              </div>
            ) : null}
            {feature && handlePos ? (
              <div class="handles" style={{ left: `${handlePos.x}px`, top: `${handlePos.y}px` }}>
                <button
                  type="button"
                  class={`handle move${blocked ? " disabled" : ""}`}
                  aria-label={blocked ? `Move ${featureName(feature)}: ${blocked}` : `Move ${featureName(feature)}: drag, or use the arrow keys`}
                  title={blocked ?? "Drag to move, or use the arrow keys"}
                  aria-disabled={!!blocked}
                  onPointerDown={onHandleDown}
                  onKeyDown={onHandleKey}
                >
                  <span aria-hidden="true">✥</span>
                </button>
                <button type="button" class="handle delete" aria-label={`Delete ${featureName(feature)}`} title="Delete" onClick={() => deleteFeature(feature)}>
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ) : null}
            {busy > 0 ? (
              <div class="working" role="status">
                Working…
              </div>
            ) : null}
          </View3D>
          {message ? (
            <div class={`editor-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
              <button type="button" class="linkish" onClick={() => setMessage(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          ) : null}
          {noticesOpen && (notices.length || flags.length || importChanges) ? (
            <div class="editor-notices" role="status">
              {info.importReport && importChanges ? (
                <p>
                  Opened {info.name}. {importChanges} change{importChanges > 1 ? "s were" : " was"} needed to bring it to the current game version
                  {info.importReport.changes.some((c) => c.level === "warning") ? ":" : "."}
                </p>
              ) : null}
              <ul>
                {notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {flags.map((f) => (
                  <li key={f.id}>
                    {f.message}{" "}
                    <button type="button" class="linkish" onClick={() => void run(() => api.applyAll([f.fix], f.fix.label, "fix"))}>
                      {f.fix.label}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" class="linkish" onClick={() => setNoticesOpen(false)}>
                Hide
              </button>
            </div>
          ) : null}
          {feature ? (
            <Inspector
              feature={feature}
              index={indexed}
              heights={mirror.current.heights}
              entities={mirror.current.entities}
              W={info.W}
              blocked={blocked}
              onClose={() => setSelected(null)}
              onDelete={() => deleteFeature(feature)}
              onPatch={(patch, label) => void apply({ op: "updateFeature", params: { id: feature.id, patch } }, label)}
            />
          ) : null}
        </section>
        {showHistory ? <HistoryPanel info={info} onJump={(k) => void run(() => api.jump(k))} onClose={() => setShowHistory(false)} /> : null}
      </div>
      {exporting ? (
        <ExportDialog
          api={api}
          info={info}
          onClose={() => setExporting(false)}
          onChecked={(c) => setCheck(c)}
          queue={(fn) => {
            const next = queue.current.then(fn);
            queue.current = next.catch(() => undefined);
            return next;
          }}
        />
      ) : null}
      <DropTarget onFile={props.onOpenFile} />
    </div>
  );
}

function mirrorOf(v: MapView): Mirror {
  return { heights: v.heights, water: surfaceWater(v.W, v.H, v.water), entities: v.entities, entitiesAt: entitiesByTile(v.entities, v.W) };
}

/** Engine messages name ids; the player sees plain words. */
function plain(text: string): string {
  return text.replace(/\b(f-[a-z0-9]{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g, "it").replace(/^./, (c) => c.toUpperCase());
}

/** Dropping a .timber or project file on the editor opens it. */
function DropTarget({ onFile }: { onFile(file: File): void }) {
  const latest = useRef(onFile);
  latest.current = onFile;
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      latest.current(file);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
  return null;
}
