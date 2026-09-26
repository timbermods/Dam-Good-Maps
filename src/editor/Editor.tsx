// The editor (EDITOR_PLAN §4): the map fills the screen in the shared 3D view; four tabs along the
// side (Land, Water, Resources, Start) with their tools; a small inspector beside the selected
// feature with its move and delete handles; undo, redo, history, the map's health and export always
// visible. The document itself lives in the worker (src/worker/session.ts): every edit is an
// operation sent there, and only what changed comes back.
//
// A tool's gesture (an outline, a river's points, a click) is planned by the worker on the current
// map, shown as a preview with its report, and placed with one click (EDITOR_PLAN §1: see it before
// you commit). After every edit the instant checks come back with it; the problems it made are
// shown at once with their fixes. Objects show their footprint under the pointer, green where the
// game keeps them and red (with the reason) where it would delete them; advanced mode opens the
// objects on a clicked tile with their numbers.

import { proxy, type Remote } from "comlink";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { EditOp } from "../core/doc/ops";
import { cornerFor } from "../core/doc/tools";
import { orientationForHigh } from "../core/features/setpieces";
import { startEntranceTile, type Orientation } from "../core/format/footprints";
import type { Feature, Point } from "../core/features/schema";
import type { FixOp } from "../core/validate/report";
import { rulesFor } from "../core/validate/playability";
import { saveFile } from "../platform";
import { ORIENTATION_NAMES, surfaceWater, type EntityView, type MapView, type SoilView, type SurfaceWater } from "../render3d/model";
import { damLegendSwatch } from "../render3d/palette";
import type { MapRenderer, PointerTool, TileHit, ViewState } from "../render3d";
import { View3D } from "../ui/View3D";
import type { GeneratorApi } from "../worker/generator.worker";
import type { CheckItem, CheckProgress, DamSiteView, EntityInfo, ExportCheck, SessionInfo, SessionOpen, SessionUpdate, ToolPlan, ToolRequest, ViewUpdate, WaterLayers } from "../worker/session";
import { anchorOf, checkStartAt, clampMove, describeTile, entitiesByTile, featureName, FeatureIndex, moveBlocked, newId, rectOf, riverAt, tabOf, type StartCheck, type Tab, type TileContext } from "./features";
import { EntityInspector, ExportDialog, HistoryPanel, Inspector, InstantProblems, LayerLegend, plain, PreviewCard, StartIndicators, StatusPill, TabPanel, whereOf, type EntityChange, type ItemActions, type LayerKind } from "./panels";
import {
  BAD,
  BARE,
  DAM,
  DEAD,
  DEFAULT_OPTIONS,
  DRAWING,
  featureFromRect,
  gestureOf,
  GOOD,
  lineTiles,
  MOVING,
  objectKindOf,
  optionsFor,
  paintOverlay,
  PREVIEW,
  PROBLEM,
  rectTiles,
  rectToOutline,
  SELECTED,
  TOOL_NAMES,
  toolRequest,
  type OverlayLayer,
  type Rect,
  type ToolKind,
  type ToolOptions,
} from "./tools";

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
  soil?: SoilView;
}

type Drag = { id: string; dx: number; dy: number } | null;

declare global {
  interface Window {
    /** Test hook: the open editor (tests/e2e). */
    dgmEditor?: {
      info: () => SessionInfo;
      tileToClient(x: number, y: number): { x: number; y: number };
      select(id: string | null): void;
      idle(): Promise<void>;
      /** The preview on screen (a planned tool edit), or null. */
      plan(): ToolPlan | null;
      /** The problems the last edit made. */
      instant(): CheckItem[];
      /** The footprint under the pointer (object tools): its tiles, and why the game would refuse it. */
      fit(): { tiles: number[]; problem: string | null } | null;
      /** The start's check while it moves (its footprint and the three start requirements). */
      startCheck(): StartCheck | null;
      /** The worker, for timing its answers (tests/e2e/preview.spec.ts). */
      worker: Remote<GeneratorApi>;
    };
  }
}

/** The start's middle tile, its facing and the entity or feature it belongs to. */
interface StartHere {
  x: number;
  y: number;
  orientation: Orientation;
  /** The start feature (generated maps), or null for an imported map's own StartingLocation. */
  feature: string | null;
  owner: string;
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
  const [draft, setDraft] = useState<Point[]>([]);
  const [hoverTile, setHoverTile] = useState<[number, number] | null>(null);
  const [plan, setPlan] = useState<ToolPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [drag, setDrag] = useState<Drag>(null);
  const [startDrag, setStartDrag] = useState<{ x: number; y: number; check: StartCheck } | null>(null);
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [check, setCheck] = useState<ExportCheck | null>(null);
  // the background check's progress (the canonical settle, then the checks), and the water layer
  const [progress, setProgress] = useState<CheckProgress | null>(null);
  const [layer, setLayer] = useState<LayerKind>("none");
  const [waterLayers, setLayers] = useState<WaterLayers | null>(null);
  const [waterTick, setWaterTick] = useState(0);
  const [instant, setInstant] = useState<CheckItem[]>([]);
  const [damSites, setDamSites] = useState<DamSiteView[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(true);
  const [viewTick, setViewTick] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  // the footprint under the pointer (object tools) and the objects on a clicked tile (advanced)
  const [fit, setFit] = useState<{ tiles: number[]; problem: string | null } | null>(null);
  const [picked, setPicked] = useState<{ x: number; y: number; list: EntityInfo[] } | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const index = useMemo(() => new FeatureIndex(info.W, info.H), [info.W, info.H, view]);
  const indexed = useMemo(() => {
    index.update(info.features);
    return index;
  }, [index, info.features]);
  const infoRef = useRef(info);
  infoRef.current = info;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const planRef = useRef(plan);
  planRef.current = plan;
  // the tools read the latest options when they act (an option changed just before a click counts)
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const feature = selected ? (info.features.find((f) => f.id === selected) ?? null) : null;
  // the start requirements and targets of this map: its settings, or its difficulty's defaults
  const needs = useMemo(() => {
    const r = rulesFor(info.spec, info.designedFor);
    return { rules: r, reachMin: r.reachMin };
  }, [info.spec, info.designedFor]);
  useEffect(() => {
    if (selected && !feature) setSelected(null);
  }, [feature, selected]);

  // ------------------------------------------------------------------------------ worker calls

  /** Queue a worker call after the ones before it (edits and plans stay in order). */
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.current.then(fn);
    queue.current = next.catch(() => undefined);
    return next;
  }

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
    applyView(u.view);
    // the instant checks: the problems this edit made, in the region it changed
    if (u.instant) setInstant(u.instant.items.filter((c) => c.here && c.class === "load"));
    setInfo(u.info);
    props.onChange(u.info);
  }

  /** Apply what changed on the map to the mirror and the renderer. */
  function applyView(v: ViewUpdate): void {
    const r = renderer.current;
    const m = mirror.current;
    if (v.heights) {
      m.heights = v.heights;
      r?.updateTerrain(v.heights);
    }
    if (v.water) {
      m.water = surfaceWater(infoRef.current.W, infoRef.current.H, v.water);
      r?.updateWater(v.water);
    }
    // the soil follows the water (the preview's, then the exact settle's): the ground's colours,
    // and the ivy on ruins, so it comes before the objects
    if (v.soil) {
      m.soil = v.soil;
      r?.updateSoil(v.soil);
    }
    if (v.entities) {
      m.entities = v.entities;
      m.entitiesAt = entitiesByTile(v.entities, infoRef.current.W);
      r?.updateEntities(v.entities);
    }
    if (v.water || v.entities) setWaterTick((t) => t + 1);
  }

  const apply = (op: EditOp, label?: string) => run(() => api.apply(op, "user", label));
  const undo = () => run(() => api.undo());
  const redo = () => run(() => api.redo());
  const applyFix = (fix: FixOp[]) => run(() => api.applyAll(fix.map(({ label: _l, ...op }) => op as EditOp), fix[0]?.label || "Fix", "fix"));

  // the map's health (export profile), checked in the background a moment after each change
  // (EDITOR_PLAN §6): the canonical settle runs in slices and replaces the preview's water, then
  // every check runs; a newer edit drops it. It is not queued, so edits never wait for it.
  useEffect(() => {
    setCheck((c) => (c && c.version === info.version ? c : null));
    setProgress(null);
    let live = true;
    const t = setTimeout(() => {
      void api
        .backgroundCheck(proxy((p: CheckProgress) => live && setProgress(p)))
        .then((r) => {
          if (!live || !r || r.check.version !== infoRef.current.version) return;
          applyView(r.view);
          setCheck(r.check);
          setProgress(null);
        })
        .catch(() => {
          // the check is advisory here: export runs it again
        });
    }, 700);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [info.version]);

  // the water layer on show: fetched again after every change of the map or its water
  useEffect(() => {
    if (layer === "none") return setLayers(null);
    let live = true;
    void enqueue(() => api.waterLayers()).then((l) => live && setLayers(l));
    return () => {
      live = false;
    };
  }, [layer, info.version, waterTick, check?.version]);

  // the Dam site tool shows the dam sites while it is out, and puts them away after unless the
  // player had them on
  const damsByTool = useRef(false);
  useEffect(() => {
    if (tool === "damSite") {
      if (damSites === null) {
        damsByTool.current = true;
        setDamSites([]);
      }
    } else if (damsByTool.current) {
      damsByTool.current = false;
      setDamSites(null);
    }
  }, [tool]);

  // the dam-site layer, measured again after each change while it is shown
  const showDams = damSites !== null;
  useEffect(() => {
    if (!showDams) return;
    // (a layer put away before its sites arrive stays away)
    void enqueue(() => api.damSites()).then((d) => setDamSites((shown) => (shown === null ? null : d.sites)));
  }, [showDams, info.version]);

  useEffect(() => props.onChange(info), []);

  // ------------------------------------------------------------------------------- the view

  const ctx = (): TileContext => ({ W: info.W, H: info.H, heights: mirror.current.heights, water: mirror.current.water, entities: mirror.current.entities, entitiesAt: mirror.current.entitiesAt, index: indexed, soil: mirror.current.soil });

  // where the start is: its feature, or an imported map's own StartingLocation
  const startHere = useMemo((): StartHere | null => {
    const f = info.features.find((g) => g.kind === "start");
    if (f && f.kind === "start") return { x: f.params.position[0], y: f.params.position[1], orientation: f.params.orientation, feature: f.id, owner: f.id };
    const e = mirror.current.entities;
    for (let k = 0; k < e.count; k++) {
      if (e.templates[e.template[k]] !== "StartingLocation") continue;
      const o = ORIENTATION_NAMES[e.orientation[k]] as Orientation;
      const [cx, cy] = cornerToCentre(e.x[k], e.y[k], o);
      return { x: cx, y: cy, orientation: o, feature: null, owner: e.owners[e.owner[k]] };
    }
    return null;
  }, [info.features, info.version]);

  // overlay: the selected feature, a move preview, a shape being drawn, a planned edit, the start's
  // footprint while it moves, dam sites, the problems an edit made
  useEffect(() => {
    const r = renderer.current;
    const data = r?.overlayData();
    if (!r || !data) return;
    const layers: OverlayLayer[] = [];
    if (waterLayers && layer !== "none") layers.push(...layerOverlay(waterLayers, layer));
    if (damSites) for (const d of damSites) layers.push({ tiles: d.tiles.filter(([x, y]) => x >= 0 && y >= 0 && x < info.W && y < info.H).map(([x, y]) => y * info.W + x), color: DAM });
    if (feature) {
      const tiles = indexed.tilesOf(feature);
      layers.push({ tiles, color: SELECTED });
      if (drag && drag.id === feature.id && (drag.dx || drag.dy) && feature.kind !== "start") layers.push({ tiles, color: MOVING, dx: drag.dx, dy: drag.dy });
    }
    if (drawing) layers.push({ tiles: rectTiles(drawing, info.W), color: DRAWING });
    if (draft.length) {
      const pts = hoverTile ? [...draft, hoverTile] : draft;
      layers.push({ tiles: lineTiles(pts, info.W, info.H, !!tool && gestureOf(tool) === "outline"), color: DRAWING });
    }
    if (plan?.ok && plan.area) {
      layers.push({ tiles: plan.area.bare, color: BARE });
      layers.push({ tiles: plan.area.dead, color: DEAD });
      layers.push({ tiles: plan.area.alive, color: GOOD });
    } else if (plan?.ok) layers.push({ tiles: plan.tiles, color: PREVIEW });
    if (fit && !plan && !planning) layers.push({ tiles: fit.tiles, color: fit.problem ? BAD : GOOD });
    if (picked) layers.push({ tiles: [picked.y * info.W + picked.x], color: SELECTED });
    if (startDrag) layers.push({ tiles: [...startDrag.check.tiles, startDrag.check.door], color: startDrag.check.problem || !startDrag.check.meets ? BAD : GOOD });
    for (const c of instant) for (const [x, y] of c.where?.tiles ?? []) layers.push({ tiles: [y * info.W + x], color: PROBLEM });
    paintOverlay(data, info.W, info.H, layers);
    r.commitOverlay();
  }, [feature, drag, drawing, draft, hoverTile, plan, planning, fit, picked, startDrag, damSites, instant, indexed, ready, waterLayers, layer]);

  // ------------------------------------------------------------------------------ the tools

  function planRequest(req: ToolRequest) {
    setPlanning(true);
    setPlan(null);
    const id = newId();
    void enqueue(() => api.planTool(req, id))
      .then((p) => setPlan(p))
      .catch((e) => setMessage({ kind: "error", text: String(e instanceof Error ? e.message : e) }))
      .finally(() => setPlanning(false));
  }

  function finishDraft(points: Point[]) {
    if (!tool) return;
    setDraft([]);
    const req = toolRequest(tool, optionsFor(tool, optionsRef.current), { points, W: info.W, H: info.H });
    if (!req) return setMessage({ kind: "error", text: gestureOf(tool) === "path" ? "Click at least two points for a river." : "Click at least three corners." });
    planRequest(req);
  }

  function planAt(x: number, y: number) {
    if (!tool) return;
    if (tool === "slope") return slopeAt(x, y);
    const river = riverAt(indexedRef.current, x, y);
    const req = toolRequest(tool, optionsFor(tool, optionsRef.current), { at: [x, y], river, W: info.W, H: info.H });
    if (!req) return setMessage({ kind: "error", text: "Click on a river." });
    setFit(null);
    planRequest(req);
  }

  // the footprint under the pointer: one check in flight, then the latest tile
  const fitWant = useRef<string | null>(null);
  const fitBusy = useRef(false);
  function hoverFit(x: number, y: number) {
    const t = toolRef.current;
    if (!t || (!objectKindOf(t, optionsRef.current) && t !== "object") || planRef.current) {
      fitWant.current = null;
      return setFit(null);
    }
    const req = toolRequest(t, optionsFor(t, optionsRef.current), { at: [x, y], W: info.W, H: info.H });
    if (!req) return;
    const key = JSON.stringify(req);
    if (fitWant.current === key) return;
    fitWant.current = key;
    if (fitBusy.current) return;
    const next = (r: ToolRequest, k: string) => {
      fitBusy.current = true;
      void api
        .footprintCheck(r)
        .then((f) => {
          if (fitWant.current === k) setFit(f);
        })
        .catch(() => setFit(null))
        .finally(() => {
          fitBusy.current = false;
          const want = fitWant.current;
          if (want && want !== k) next(JSON.parse(want) as ToolRequest, want);
        });
    };
    next(req, key);
  }
  useEffect(() => {
    fitWant.current = null;
    setFit(null);
  }, [tool, options, info.version]);

  // advanced mode: the objects on a clicked tile, with their numbers
  function pickTile(x: number, y: number) {
    void enqueue(() => api.entitiesAt(x, y)).then((list) => {
      setPicked(list.length ? { x, y, list } : null);
      if (!list.length) setMessage({ kind: "info", text: `No objects on the tile at (${x}, ${y}).` });
    });
  }
  function changeEntity(e: EntityInfo, c: EntityChange) {
    if (!picked) return;
    let at: [number, number] = [picked.x, picked.y];
    let op: EditOp;
    if (c.remove) op = { op: "deleteEntities", params: { entities: [e.id] } };
    else if (c.move) {
      const turn = c.move.turn ? TURN_NEXT[e.orientation] : e.orientation;
      op = { op: "moveEntity", params: { id: e.id, x: e.x + c.move.dx, y: e.y + c.move.dy, ...(c.move.turn ? { orientation: turn } : {}) } };
      at = [picked.x + c.move.dx, picked.y + c.move.dy];
    } else op = { op: "setEntityProps", params: { id: e.id, components: c.props ?? {} } };
    const label = c.remove ? "Delete an object" : c.move ? (c.move.turn ? "Turn an object" : "Move an object") : "Change an object";
    void run(
      () => api.apply(op, "user", label),
      (u) => {
        if (u.ok) pickTile(at[0], at[1]);
      },
    );
  }

  /** The slope tool: remove the slope on a tile, or pin one on the low tile of a 1-level step,
   *  its high side toward the higher neighbour (the one whose opposite tile is level with it). */
  function slopeAt(x: number, y: number) {
    const m = mirror.current;
    const here = m.entitiesAt.get(y * info.W + x) ?? [];
    if (here.some((k) => m.entities.templates[m.entities.template[k]] === "Slope")) {
      void apply({ op: "removeSlope", params: { x, y } }, "Remove a slope");
      return;
    }
    const h = m.heights[y * info.W + x];
    const at = (xx: number, yy: number) => (xx >= 0 && yy >= 0 && xx < info.W && yy < info.H ? m.heights[yy * info.W + xx] : -1);
    const sides: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const up = sides.filter(([dx, dy]) => at(x + dx, y + dy) === h + 1).sort((a, b) => (at(x - b[0], y - b[1]) === h ? 1 : 0) - (at(x - a[0], y - a[1]) === h ? 1 : 0));
    if (!up.length) return setMessage({ kind: "error", text: "Click the low tile beside a step one level up." });
    void apply({ op: "pinSlope", params: { x, y, orientation: orientationForHigh(up[0][0], up[0][1]) } }, "Place a slope");
  }

  function place() {
    const p = planRef.current;
    if (!p?.ok) return setPlan(null);
    setPlan(null);
    void run(
      () => api.applyAll(p.ops, p.label),
      (u) => {
        if (!u.ok || !p.featureId) return;
        const f = u.info.features.find((g) => g.id === p.featureId);
        if (f) {
          setSelected(f.id);
          setTab(tabOf(f));
        }
      },
    );
  }

  function cancelTool() {
    setPlan(null);
    setDraft([]);
    setDrawing(null);
    setFit(null);
    fitWant.current = null;
  }

  // the drawing tool takes left clicks and drags on the map
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    if (!tool) {
      r.tool = null;
      return;
    }
    const g = gestureOf(tool);
    const W = info.W;
    const H = info.H;
    let start: [number, number] | null = null;
    let dragged = false;
    let lastUp = 0;
    let lastTile = -1;
    const t: PointerTool = {
      down(hit) {
        if (!hit) return false;
        // a preview waits for Place or Cancel
        if (planRef.current) return true;
        start = [hit.x, hit.y];
        dragged = false;
        if (g === "rect") setDrawing(rectOf(start, start, W, H));
        return true;
      },
      move(hit) {
        if (!start || !hit) return;
        if (g === "rect") setDrawing(rectOf(start, [hit.x, hit.y], W, H));
        else if (g === "outline" && !draftRef.current.length && Math.abs(hit.x - start[0]) + Math.abs(hit.y - start[1]) >= 2) {
          dragged = true;
          setDrawing(rectOf(start, [hit.x, hit.y], W, H));
        }
      },
      up(hit) {
        const a = start;
        start = null;
        if (!a) return;
        const b: [number, number] = hit ? [hit.x, hit.y] : a;
        if (g === "rect") {
          setDrawing(null);
          const f = featureFromRect(tool, rectOf(a, b, W, H), optionsRef.current, W, mirror.current.heights);
          void run(
            () => api.apply({ op: "addFeature", params: { feature: f } }),
            (u) => {
              if (u.ok) {
                setSelected(f.id);
                setTab(tabOf(f));
              }
            },
          );
          return;
        }
        if (g === "outline" && dragged) {
          setDrawing(null);
          finishDraft(rectToOutline(rectOf(a, b, W, H)));
          return;
        }
        if (g === "point") return planAt(b[0], b[1]);
        // a click adds a point; a double click, or a click on the first corner, finishes
        const now = performance.now();
        const key = b[1] * W + b[0];
        const double = now - lastUp < 450 && key === lastTile;
        lastUp = now;
        lastTile = key;
        const pts = draftRef.current;
        if (double) return finishDraft(pts);
        if (g === "outline" && pts.length >= 3 && Math.abs(b[0] - pts[0][0]) + Math.abs(b[1] - pts[0][1]) <= 1) return finishDraft(pts);
        setDraft([...pts, [b[0], b[1]]]);
      },
    };
    r.tool = t;
    return () => {
      if (r.tool === t) r.tool = null;
    };
  }, [tool, info.W, info.H, ready]);

  function onReady(r: MapRenderer) {
    renderer.current = r;
    setReady(r);
    r.onClick = (hit) => {
      if (advancedRef.current && hit) {
        setSelected(null);
        return pickTile(hit.x, hit.y);
      }
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
      // the handles follow the view; with none on the map, the page need not redraw
      if (pending || !handleRef.current) return;
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
  const advancedRef = useRef(advanced);
  advancedRef.current = advanced;
  const toolRef = useRef(tool);
  toolRef.current = tool;

  /** Fly the camera to a tile (a problem's "Show"). */
  function showTile(x: number, y: number) {
    const r = renderer.current;
    if (!r) return;
    r.setView({ target: [x + 0.5, r.heightAt(x, y), -(y + 0.5)], distance: Math.min(r.getView().distance, 60) });
  }

  const entityAt = (id: string): [number, number] | null => {
    // the page's view has no entity ids: a problem's entities are found by the worker's "where"
    void id;
    return null;
  };
  const actions: ItemActions = {
    onFix: (fix) => void applyFix(fix),
    onShow: (c) => {
      const at = whereOf(c, entityAt);
      if (at) showTile(at[0], at[1]);
    },
    canShow: (c) => !!whereOf(c, entityAt),
  };

  // ----------------------------------------------------------------------------- the handles

  // the start of an imported map has no feature: on the Start tab it gets a move handle of its own
  const importStart = !feature && tab === "start" && startHere && !startHere.feature ? startHere : null;
  const anchor = feature ? anchorOf(indexed, feature) : importStart ? ([importStart.x, importStart.y] as [number, number]) : null;
  const handleId = feature?.id ?? (importStart ? "import-start" : null);
  const handleRef = useRef(handleId);
  handleRef.current = handleId;
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
  const moving = feature ?? null;
  const isStart = (feature && feature.kind === "start") || !!importStart;

  /** The start's footprint check at a move of (dx, dy) tiles. */
  function startPreview(dx: number, dy: number): { x: number; y: number; check: StartCheck } | null {
    const s = startHere;
    if (!s) return null;
    const x = s.x + dx;
    const y = s.y + dy;
    const [cx, cy] = cornerFor(x, y, s.orientation);
    const door = startEntranceTile(cx, cy, s.orientation);
    const f = s.feature ? info.features.find((g) => g.id === s.feature) : undefined;
    let bench: { level: number; radius: number; bank?: Point } | null = null;
    const moved = dx !== 0 || dy !== 0;
    if (f && f.kind === "start") {
      // a generated start's bench takes the ground's level there; where it stands, it keeps the
      // bench it has (a project saved before the water rule changed may run it to a bank)
      const level = moved ? Math.max(1, mirror.current.heights[y * info.W + x]) : f.params.benchLevel;
      const bank = moved ? undefined : f.params.bank;
      bench = { level, radius: f.params.benchRadius, ...(bank ? { bank } : {}) };
    }
    return { x, y, check: checkStartAt(ctx(), x, y, door, bench, s.owner, needs, moved) };
  }

  function commitMove(dx: number, dy: number) {
    setDrag(null);
    setStartDrag(null);
    if (!dx && !dy) return;
    if (importStart) {
      void run(() => api.moveStartTo(importStart.x + dx, importStart.y + dy));
      return;
    }
    if (moving) void run(() => api.moveFeature(moving.id, dx, dy));
  }

  function clamp(dx: number, dy: number): [number, number] {
    if (moving) return clampMove(moving, dx, dy, info.W, info.H);
    if (importStart) return [Math.max(2 - importStart.x, Math.min(info.W - 3 - importStart.x, dx)), Math.max(2 - importStart.y, Math.min(info.H - 3 - importStart.y, dy))];
    return [0, 0];
  }

  function onHandleDown(ev: PointerEvent) {
    const r = renderer.current;
    if (!r || !handleId || blocked || !anchor) return;
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture(ev.pointerId);
    const level = r.heightAt(anchor[0], anchor[1]);
    const start = r.pickAtLevel(ev.clientX, ev.clientY, level) ?? { x: anchor[0], y: anchor[1] };
    let cur: [number, number] = [0, 0];
    const move = (e: PointerEvent) => {
      const at = r.pickAtLevel(e.clientX, e.clientY, level);
      if (!at) return;
      cur = clamp(at.x - start.x, at.y - start.y);
      setDrag({ id: handleId, dx: cur[0], dy: cur[1] });
      if (isStart) setStartDrag(startPreview(cur[0], cur[1]));
    };
    const up = (e: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (e.type === "pointercancel") {
        setDrag(null);
        setStartDrag(null);
        return;
      }
      commitMove(cur[0], cur[1]);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // arrow keys on the focused handle nudge the feature; it is placed a moment after the last key
  const nudgeTimer = useRef(0);
  function onHandleKey(ev: KeyboardEvent) {
    const r = renderer.current;
    if (!r || !handleId || blocked) return;
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
      setStartDrag(null);
      return;
    }
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    const d = drag && drag.id === handleId ? drag : { id: handleId, dx: 0, dy: 0 };
    const [nx, ny] = clamp(d.dx + step[0], d.dy + step[1]);
    setDrag({ id: handleId, dx: nx, dy: ny });
    if (isStart) setStartDrag(startPreview(nx, ny));
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => commitMove(nx, ny), 700);
  }

  function deleteFeature(f: Feature) {
    void run(
      () => api.deleteFeature(f.id),
      (u) => u.ok && setSelected(null),
    );
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
        if (planRef.current || draftRef.current.length) return cancelTool();
        setTool(null);
        setDrawing(null);
        setSelected(null);
      } else if (ev.key === "Enter" && tool && draftRef.current.length && !(target?.tagName === "BUTTON")) {
        ev.preventDefault();
        finishDraft(draftRef.current);
      } else if (ev.key === "Backspace" && draftRef.current.length) {
        ev.preventDefault();
        setDraft(draftRef.current.slice(0, -1));
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && selectedRef.current && !target?.classList.contains("handle")) {
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
      plan: () => planRef.current,
      instant: () => instantRef.current,
      fit: () => fitRef.current,
      startCheck: () => startDragRef.current?.check ?? null,
      worker: api,
    };
    return () => {
      delete window.dgmEditor;
    };
  }, []);
  const instantRef = useRef(instant);
  instantRef.current = instant;
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const startDragRef = useRef(startDrag);
  startDragRef.current = startDrag;

  // ------------------------------------------------------------------------------ export

  async function exportProject() {
    const p = await api.project();
    saveFile(p.bytes, p.fileName, "application/gzip");
  }

  const notices = [...info.notices, ...(info.importReport?.changes.filter((c) => c.level === "warning").map((c) => c.message) ?? [])];
  const flags = info.importReport?.flags ?? [];
  const importChanges = info.importReport?.changes.length ?? 0;
  const hint = tool
    ? gestureOf(tool) === "path"
      ? `${TOOL_NAMES[tool]}: click from the source to the outlet, then double-click or press Enter.`
      : gestureOf(tool) === "outline"
        ? `${TOOL_NAMES[tool]}: drag a rectangle, or click the corners and double-click.`
        : gestureOf(tool) === "point"
          ? `${TOOL_NAMES[tool]}: click the map.`
          : `${TOOL_NAMES[tool]}: drag a rectangle on the map.`
    : null;

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
          <StatusPill check={check} busy={busy > 0} progress={progress} onOpen={() => setExporting(true)} />
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
          onTab={(t) => {
            // a tool belongs to its tab: another tab puts it away
            if (t !== tab) {
              setTool(null);
              cancelTool();
            }
            setTab(t);
          }}
          info={info}
          index={indexed}
          selected={selected}
          onSelect={(id) => setSelected(id)}
          tool={tool}
          onTool={(t) => {
            setTool(t);
            cancelTool();
            setSelected(null);
          }}
          options={options}
          onOptions={setOptions}
          damSites={damSites}
          onDamSites={(show) => {
            damsByTool.current = false;
            setDamSites(show ? [] : null);
          }}
          layer={layer}
          onLayer={setLayer}
          roofed={!!waterLayers?.roofed.length}
          advanced={advanced}
          onAdvanced={(on) => {
            setAdvanced(on);
            setPicked(null);
            if (!on && (tool === "core" || tool === "object")) {
              setTool(null);
              cancelTool();
            }
          }}
        />
        <section class="editor-map" aria-label="Map">
          <View3D
            view={view}
            class="editor-view"
            label={`3D view of ${info.name}. Click a feature to select it. Drag to turn, right-drag to move, wheel to zoom.`}
            onReady={onReady}
            legendExtra={damSites ? [{ swatch: damLegendSwatch(), label: "Dam sites", markers: true }] : []}
            markersWanted={damSites !== null || tool === "damSite" || tool === "slope"}
            legendOpen={false}
            onHover={(hit: TileHit | null) => {
              setHover(hit ? describeTile(ctx(), hit.x, hit.y) : null);
              if (draftRef.current.length) setHoverTile(hit ? [hit.x, hit.y] : null);
              if (hit) hoverFit(hit.x, hit.y);
              else {
                fitWant.current = null;
                setFit(null);
              }
            }}
            hoverText={fit && !plan && hover ? `${hover} · ${fit.problem ? `Can't go here: ${plain(fit.problem)}` : "Fits here"}` : hover}
          >
            {hint ? (
              <div class="tool-hint" role="status">
                {hint}
                {draft.length ? ` ${draft.length} point${draft.length > 1 ? "s" : ""}.` : ""}{" "}
                <button
                  type="button"
                  class="linkish"
                  onClick={() => {
                    setTool(null);
                    cancelTool();
                  }}
                >
                  Done
                </button>
              </div>
            ) : null}
            {handleId && handlePos ? (
              <div class="handles" style={{ left: `${handlePos.x}px`, top: `${handlePos.y}px` }}>
                <button
                  type="button"
                  class={`handle move${blocked ? " disabled" : ""}`}
                  aria-label={blocked ? `Move ${feature ? featureName(feature) : "Start"}: ${blocked}` : `Move ${feature ? featureName(feature) : "Start"}: drag, or use the arrow keys`}
                  title={blocked ?? "Drag to move, or use the arrow keys"}
                  aria-disabled={!!blocked}
                  onPointerDown={onHandleDown}
                  onKeyDown={onHandleKey}
                >
                  <span aria-hidden="true">✥</span>
                </button>
                {feature ? (
                  <button type="button" class="handle delete" aria-label={`Delete ${featureName(feature)}`} title="Delete" onClick={() => deleteFeature(feature)}>
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {startDrag ? <StartIndicators check={startDrag.check} rules={needs.rules} /> : null}
            {busy > 0 ? (
              <div class="working" role="status">
                Working…
              </div>
            ) : null}
          </View3D>
          {layer !== "none" && waterLayers ? <LayerLegend kind={layer} layers={waterLayers} /> : null}
          <PreviewCard plan={plan} pending={planning} onPlace={place} onCancel={cancelTool} />
          <InstantProblems items={instant} actions={actions} onClose={() => setInstant([])} />
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
          {picked && !feature ? <EntityInspector key={`${picked.x},${picked.y}`} list={picked.list} onChange={changeEntity} onClose={() => setPicked(null)} /> : null}
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
              onReplan={(req) => void run(() => api.applyTool(req, feature.id))}
              onPlan={(req) => planRequest(req)}
            />
          ) : null}
        </section>
        {showHistory ? <HistoryPanel info={info} onJump={(k) => void run(() => api.jump(k))} onClose={() => setShowHistory(false)} /> : null}
      </div>
      {exporting ? <ExportDialog api={api} info={info} onClose={() => setExporting(false)} onChecked={(c) => setCheck(c)} queue={enqueue} actions={actions} /> : null}
      <DropTarget onFile={props.onOpenFile} />
    </div>
  );
}

const TURN_NEXT: Record<Orientation, Orientation> = { Cw0: "Cw90", Cw90: "Cw180", Cw180: "Cw270", Cw270: "Cw0" };

/** The overlay of a water layer: moisture in three greens, badwater brown and the soil it spoils
 *  lighter, the drought's kept water blue and the water that dries up orange, the tiles under
 *  roofs violet. */
function layerOverlay(l: WaterLayers, kind: LayerKind): OverlayLayer[] {
  const pick = (codes: Uint8Array, code: number) => {
    const out: number[] = [];
    for (let i = 0; i < codes.length; i++) if (codes[i] === code) out.push(i);
    return out;
  };
  switch (kind) {
    case "moisture":
      return [
        { tiles: pick(l.moisture, 1), color: [120, 200, 110, 70] },
        { tiles: pick(l.moisture, 2), color: [70, 180, 90, 120] },
        { tiles: pick(l.moisture, 3), color: [30, 150, 70, 165] },
      ];
    case "badwater":
      return [
        { tiles: pick(l.badwater, 2), color: [190, 140, 70, 120] },
        { tiles: pick(l.badwater, 1), color: [120, 70, 30, 200] },
      ];
    case "drought":
      return [
        { tiles: pick(l.drought, 1), color: [50, 110, 235, 170] },
        { tiles: pick(l.drought, 2), color: [245, 150, 40, 170] },
      ];
    case "roofed":
      return [{ tiles: Array.from(l.roofed), color: [170, 90, 220, 150] }];
    default:
      return [];
  }
}

/** The middle tile of a StartingLocation at Coordinates (x, y) facing o. */
function cornerToCentre(x: number, y: number, o: Orientation): [number, number] {
  switch (o) {
    case "Cw0":
      return [x + 1, y + 1];
    case "Cw90":
      return [x + 1, y - 1];
    case "Cw180":
      return [x - 1, y - 1];
    case "Cw270":
      return [x - 1, y + 1];
  }
}

function mirrorOf(v: MapView): Mirror {
  return { heights: v.heights, water: surfaceWater(v.W, v.H, v.water), entities: v.entities, entitiesAt: entitiesByTile(v.entities, v.W), soil: v.soil };
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
