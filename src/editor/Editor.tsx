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
import { bankFor } from "../core/features/raster/terrain";
import { rulesFor } from "../core/validate/playability";
import { saveFile } from "../platform";
import { ORIENTATION_NAMES, surfaceWater, type EntityView, type MapView, type SoilView, type SurfaceWater, type WaterView } from "../render3d/model";
import { damLegendSwatch } from "../render3d/palette";
import type { MapRenderer, PointerTool, TileHit, ViewState } from "../render3d";
import { View3D } from "../ui/View3D";
import type { GeneratorApi } from "../worker/generator.worker";
import type { CheckItem, CheckProgress, DamSiteView, EditorEvent, EntityInfo, ExportCheck, SessionInfo, SessionOpen, SessionUpdate, ShapePreview, ToolPlan, ToolRequest, ViewUpdate, WaterLayers } from "../worker/session";
import { anchorOf, checkStartAt, clampMove, describeTile, entitiesByTile, featureName, FeatureIndex, moveBlocked, newId, rectOf, riverAt, tabOf, type StartCheck, type Tab, type TileContext } from "./features";
import { EntityInspector, ExportDialog, HistoryPanel, Inspector, InstantProblems, LayerLegend, plain, PreviewCard, StartIndicators, StatusPill, TabPanel, whereOf, type EntityChange, type ItemActions, type LayerKind } from "./panels";
import { BrushBar } from "./BrushBar";
import { WaterBar } from "./WaterBar";
import { WaterPlayer } from "./waterPlayer";
import { ellipseOutline, fitOutline, moveOutline, outlineBox, ShapeDrag, type ShapeHost } from "./liveShapes";
import { hollowAt } from "../core/features/hollow";
import { OFFICIAL_FLOW } from "../core/gen/calibrated";
import type { AreaPreview } from "../core/doc/placing";
import { BRUSHES, BrushPainter, DEFAULT_BRUSH, nextSize, paste, type BrushSettings, type BrushTool, type Stroke } from "./brushes";
import type { TerrainState } from "../core/features/raster/strokePreview";
import type { BrushParams } from "../core/features/raster/brush";
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
  /** The water on screen, as the worker sent it. */
  waterView: WaterView;
  entities: EntityView;
  /** The objects on each tile, made when first asked for after the objects change. */
  entitiesAt: Map<number, number[]> | null;
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
      /** Strokes whose painted terrain differed from the worker's build (0 when all is well). */
      strokeMismatches(): number;
      /** Strokes, undos and redos on their way to the worker. */
      pendingTerrain(): number;
      /** The last stroke painted (its operation's params), or null. */
      lastStroke(): BrushParams | null;
      /** The shape being dragged: the worker's last answer for it (what it builds and says), or null. */
      shapePreview(): ShapePreview | null;
      /** The hollow a Lake click at (x, y) would fill (as the Lake tool reads it). */
      lakeAt(x: number, y: number): { fills: boolean; level: number; tiles: number; low: number };
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
  // (a river's Natural or Exact is remembered between uses)
  const [options, setOptions] = useState<ToolOptions>(() => ({ ...DEFAULT_OPTIONS, riverNatural: remembered("dgm.riverNatural", "1") === "1" }));
  useEffect(() => remember("dgm.riverNatural", options.riverNatural ? "1" : "0"), [options.riverNatural]);
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
  /** The water is flowing into an edit's new shape (how far it has come, 0–1), or null. */
  const [flowing, setFlowing] = useState<number | null>(null);
  /** The water's journey, played at a pace the eye can follow; its controls; a drought to watch. */
  const player = useRef<WaterPlayer | null>(null);
  const [, setPlayerTick] = useState(0);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  const [drought, setDroughtState] = useState(false);
  const droughtRef = useRef(false);
  const setDrought = (on: boolean) => {
    droughtRef.current = on;
    setDroughtState(on);
  };
  /** Where the water stood in the frame shown before (the camera follows where it rises most). */
  const lastDepth = useRef<Float32Array | null>(null);
  player.current ??= new WaterPlayer({
    show: (f) => showWater(f.water),
    changed: () => {
      setPlayerTick((n) => n + 1);
      setFlowing(player.current!.progress);
    },
  });
  const [instant, setInstant] = useState<CheckItem[]>([]);
  const [damSites, setDamSites] = useState<DamSiteView[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(true);
  const [viewTick, setViewTick] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  // the footprint under the pointer (object tools) and the objects on a clicked tile (advanced)
  const [fit, setFit] = useState<{ tiles: number[]; problem: string | null } | null>(null);
  const [picked, setPicked] = useState<{ x: number; y: number; list: EntityInfo[] } | null>(null);
  /** What the shape being dragged says, where the pointer is, and what it covers (live shapes). */
  const [shapeNote, setShapeNote] = useState<{ text: string; ok: boolean; warn: boolean; x: number; y: number } | null>(null);
  const [shapeTiles, setShapeTiles] = useState<{ tiles: number[]; area?: AreaPreview } | null>(null);
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
        // an edit other than a stroke: the strokes the page could undo on its own are no longer
        // the latest steps of the history
        if (u.ok) {
          localUndo.current = [];
          localRedo.current = [];
        }
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

  /** Put water on the map (a frame of its journey, a draft's): the renderer, the page's copy, and
   *  with Follow on, the camera drifting to where the water rises most. */
  function showWater(w: WaterView) {
    const r = renderer.current;
    r?.updateWater(w);
    const W = infoRef.current.W;
    const H = infoRef.current.H;
    mirror.current.water = r?.mapState()?.surface ?? surfaceWater(W, H, w);
    mirror.current.waterView = w;
    const depth = new Float32Array(W * H);
    for (let k = 0; k < w.count; k++) depth[w.tile[k]] = Math.max(depth[w.tile[k]], w.depth[k]);
    const before = lastDepth.current;
    lastDepth.current = depth;
    if (!followRef.current || !r || !before || before.length !== depth.length) return;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < depth.length; i++) {
      const rise = depth[i] - before[i];
      if (rise < 0.05) continue;
      sx += (i % W) * rise;
      sy += Math.floor(i / W) * rise;
      n += rise;
    }
    if (n < 0.5) return;
    const v = r.getView();
    const tx = sx / n + 0.5;
    const tz = -(sy / n + 0.5);
    r.setView({ target: [v.target[0] + (tx - v.target[0]) * 0.15, v.target[1], v.target[2] + (tz - v.target[2]) * 0.15] });
  }

  /** The soil's colours from `from` to `to` over about two seconds (the last step is `to` itself). */
  const soilTimer = useRef(0);
  function growSoil(r: MapRenderer, from: SoilView, to: SoilView) {
    clearTimeout(soilTimer.current);
    const t0 = performance.now();
    const n = to.moisture.length;
    const moisture = new Uint8Array(n);
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 2000);
      if (t >= 1) {
        r.updateSoil(to);
        return;
      }
      for (let i = 0; i < n; i++) {
        const a = from.moisture[i];
        const b = to.moisture[i];
        if (a === b) {
          moisture[i] = b;
          continue;
        }
        // wetter tiles start sooner: moisture spreads out from the water
        const k = Math.max(0, Math.min(1, t * 1.6 - (1 - Math.max(a, b) / 255) * 0.6));
        moisture[i] = Math.round(a + (b - a) * k);
      }
      r.updateSoil({ moisture, contamination: to.contamination });
      soilTimer.current = window.setTimeout(step, 100);
    };
    step();
  }

  /** A drought to watch, or the map's own water back at once. */
  function toggleDrought(on: boolean) {
    if (on) {
      setDrought(true);
      player.current?.begin(null, true);
      void api.startDrought();
    } else {
      setDrought(false);
      void api.stopWeather().then((v) => {
        player.current?.clear();
        applyView(v);
      });
    }
  }

  function applyUpdate(u: SessionUpdate): void {
    applyView(u.view);
    // an edit: its water's journey starts from the water right after it
    if (u.ok) {
      if (droughtRef.current) setDrought(false);
      player.current?.begin(u.view.water ? { water: u.view.water, done: 0 } : null);
    }
    // the instant checks: the problems this edit made, in the region it changed (with the checks
    // worker they come as an event a moment later)
    if (u.instant) setInstant(u.instant.items.filter((c) => c.here && c.class === "load"));
    // the same features keep the page's own copy (its index and lists are not worked out again)
    const i = u.info.featuresKey === infoRef.current.featuresKey ? { ...u.info, features: infoRef.current.features } : u.info;
    setInfo(i);
    props.onChange(i);
  }

  /** Apply what changed on the map to the mirror and the renderer. While strokes the page painted
   *  are on their way to the worker, the page's own terrain is ahead of the worker's: its
   *  terrain waits for the last of them (it is the same, byte for byte). */
  function applyView(v: ViewUpdate): void {
    const r = renderer.current;
    const m = mirror.current;
    if (v.heights && pendingTerrain.current === 0) {
      if (checkStroke.current) {
        checkStroke.current = false;
        if (!sameBytes(m.heights, v.heights)) {
          strokeMismatches.current++;
          console.warn("a stroke painted on the page differs from the map the worker built; the worker's is shown");
        }
      }
      m.heights = v.heights;
      r?.updateTerrain(v.heights);
    }
    if (v.terrain && pendingTerrain.current === 0) terrain.current = v.terrain;
    if (v.water) {
      // (the renderer works out the surface water: the page reads it from there)
      r?.updateWater(v.water);
      m.water = r?.mapState()?.surface ?? surfaceWater(infoRef.current.W, infoRef.current.H, v.water);
      m.waterView = v.water;
    }
    // the soil follows the water (the preview's, then the exact settle's): the ground's colours,
    // and the ivy on ruins, so it comes before the objects
    if (v.soil) {
      // the land comes alive with the water (D181): the soil's colours move to the new moisture
      // over about two seconds, the tiles that end wettest (by the water) first
      const from = m.soil;
      m.soil = v.soil;
      if (r && from && from.moisture.length === v.soil.moisture.length) growSoil(r, from, v.soil);
      else r?.updateSoil(v.soil);
    }
    if (v.entities) {
      m.entities = v.entities;
      m.entitiesAt = null;
      r?.updateEntities(v.entities);
    }
    if (v.water || v.entities) setWaterTick((t) => t + 1);
  }

  const apply = (op: EditOp, label?: string) => run(() => api.apply(op, "user", label));

  // ------------------------------------------------------------------------------ the brushes

  const [brushTool, setBrushTool] = useState<BrushTool | null>(null);
  const [brush, setBrushState] = useState<BrushSettings>(loadBrush);
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const brushToolRef = useRef(brushTool);
  brushToolRef.current = brushTool;
  const setBrush = (s: BrushSettings) => {
    setBrushState(s);
    saveBrush(s);
  };
  /** The terrain the page paints strokes on (the build's, from the worker), and the strokes on
   *  their way to the worker. */
  const terrain = useRef<TerrainState>(props.opened.terrain);
  const pendingTerrain = useRef(0);
  const checkStroke = useRef(false);
  const strokeMismatches = useRef(0);
  /** Strokes at the top of the history, which the page undoes and redoes at once. */
  const localUndo = useRef<Stroke[]>([]);
  const localRedo = useRef<Stroke[]>([]);
  const painter = useRef<BrushPainter | null>(null);
  const holdTimer = useRef(0);

  /** Put a stroke's terrain before or after it back on the map, at once. */
  function showStroke(s: Stroke, which: "before" | "after") {
    const r = renderer.current;
    const W = infoRef.current.W;
    const snap = s[which];
    paste(mirror.current.heights, snap.shown, s.rect, W);
    const pre = terrain.current.pre;
    paste(pre, snap.pre, s.rect, W);
    if (r) {
      r.updateTerrainRect(mirror.current.heights, s.rect);
      r.refreshShadows();
    }
  }

  /** Send the worker a stroke, an undo or a redo of one; the page has shown it already. */
  function sendTerrain(fn: () => Promise<SessionUpdate>) {
    pendingTerrain.current++;
    const next = queue.current.then(async () => {
      setBusy((b) => b + 1);
      try {
        const u = await fn();
        pendingTerrain.current--;
        if (pendingTerrain.current === 0) checkStroke.current = true;
        if (!u.ok) {
          // the worker refused it: the page takes the worker's terrain again
          localUndo.current = [];
          localRedo.current = [];
          if (u.errors.length) setMessage({ kind: "error", text: plain(u.errors[0]) });
          const now = await api.terrainNow();
          if (pendingTerrain.current === 0) {
            mirror.current.heights = now.heights;
            terrain.current = now.terrain;
            renderer.current?.updateTerrain(now.heights);
          }
        }
        applyUpdate(u);
      } catch (e) {
        pendingTerrain.current = Math.max(0, pendingTerrain.current - 1);
        setMessage({ kind: "error", text: String(e instanceof Error ? e.message : e) });
      } finally {
        setBusy((b) => b - 1);
      }
    });
    queue.current = next;
  }

  const undo = () => {
    if (painter.current?.painting) return painter.current.cancel();
    const s = localUndo.current.pop();
    if (!s) return run(() => api.undo());
    showStroke(s, "before");
    localRedo.current.push(s);
    sendTerrain(() => api.undo());
  };
  const redo = () => {
    if (painter.current?.painting) return;
    const s = localRedo.current.pop();
    if (!s) return run(() => api.redo());
    showStroke(s, "after");
    localUndo.current.push(s);
    sendTerrain(() => api.redo());
  };

  function pickBrush(t: BrushTool | null) {
    painter.current?.end();
    setShapeNote(null);
    setBrushTool(t);
    if (t) {
      setTool(null);
      cancelTool();
      setSelected(null);
      setPicked(null);
    }
  }
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
          // the exact settle's water ends the journey in progress (eased into), or shows at once
          if (r.view.water && player.current?.hasJourney) player.current.push({ water: r.view.water, done: 1, final: () => applyView(r.view) });
          else applyView(r.view);
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

  // the worker's own news between its answers: the water as it flows after an edit, then the
  // settled water with the soil and plants on it (live editing: an edit never waits on the water)
  useEffect(() => {
    void api.listen(
      proxy((e: EditorEvent) => {
        if (e.version !== infoRef.current.version) return;
        if (e.kind === "water") {
          // a draft's water shows as it comes; an edit's plays at a pace the eye can follow
          if (e.draft) {
            // (a journey still playing would paint over the draft's water)
            if (player.current?.hasJourney) player.current.clear();
            showWater(e.water);
          }
          else player.current?.push({ water: e.water, done: e.done });
        } else if (e.kind === "settled") {
          player.current?.push({ water: e.view.water ?? mirror.current.waterView, done: 1, final: () => applyView(e.view) });
        } else if (e.kind === "weather") {
          if (!droughtRef.current) return;
          const words = e.phase === "drought" ? `Drought: day ${Math.max(1, Math.ceil(e.day))} of ${e.days}` : e.phase === "return" ? "The water comes back" : undefined;
          player.current?.push({ water: e.water, done: e.phase === "drought" ? e.day / e.days / 2 : 0.5, ...(words ? { words } : {}), ...(e.phase === "end" ? { final: () => setDrought(false) } : {}) });
        } else setInstant(e.instant.items.filter((c) => c.here && c.class === "load"));
      }),
    );
    return () => void api.listen(null);
  }, []);

  // ------------------------------------------------------------------------------- the view

  const entitiesAt = (): Map<number, number[]> => {
    const m = mirror.current;
    m.entitiesAt ??= entitiesByTile(m.entities, info.W);
    return m.entitiesAt;
  };
  /** The tile of a water or badwater source on or next to (x, y) (a badwater source covers 3×3). */
  const sourceNear = (x: number, y: number): [number, number] | null => {
    const m = mirror.current.entities;
    const at = entitiesAt();
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= info.W || ny >= info.H) continue;
        for (const k of at.get(ny * info.W + nx) ?? []) {
          const t = m.templates[m.template[k]];
          if (t === "WaterSource" ? dx === 0 && dy === 0 : t === "BadwaterSource") return [nx, ny];
        }
      }
    return null;
  };
  const ctx = (): TileContext => ({ W: info.W, H: info.H, heights: mirror.current.heights, water: mirror.current.water, entities: mirror.current.entities, entitiesAt: entitiesAt(), index: indexed, soil: mirror.current.soil });

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
      layers.push({ tiles, color: SELECTED, outline: true });
      if (drag && drag.id === feature.id && (drag.dx || drag.dy) && feature.kind !== "start") layers.push({ tiles, color: MOVING, dx: drag.dx, dy: drag.dy });
    }
    if (drawing) layers.push({ tiles: rectTiles(drawing, info.W), color: DRAWING });
    if (draft.length) {
      const pts = hoverTile ? [...draft, hoverTile] : draft;
      layers.push({ tiles: lineTiles(pts, info.W, info.H, !!tool && gestureOf(tool) === "outline"), color: DRAWING });
    }
    if (shapeTiles?.area) {
      layers.push({ tiles: shapeTiles.area.bare, color: BARE });
      layers.push({ tiles: shapeTiles.area.dead, color: DEAD });
      layers.push({ tiles: shapeTiles.area.alive, color: GOOD });
    } else if (shapeTiles) layers.push({ tiles: shapeTiles.tiles, color: PREVIEW, outline: true });
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
  }, [feature, drag, drawing, draft, hoverTile, plan, planning, fit, picked, startDrag, damSites, instant, indexed, ready, waterLayers, layer, shapeTiles]);

  // ------------------------------------------------------------------------------ the tools

  function planRequest(req: ToolRequest) {
    setPlanning(true);
    setPlan(null);
    // what the last tool did gives way to the next one's preview
    setMessage((m) => (m?.kind === "info" ? null : m));
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
    // a shape the player finished is placed at once (live editing: no Place step); a river drawn
    // by clicks keeps its draft on screen, water and all, until the worker's map replaces it
    if (tool === "river") {
      const drag = shapeDrag.current;
      shapeDrag.current = null;
      return placeShape(req, riverId.current, drag);
    }
    if (LIVE_TOOLS.has(tool)) return placeShape(req, newId(), null);
    planRequest(req);
  }

  /** A river being drawn (live editing): its id, and its request with the pointer as its end. */
  const riverId = useRef("");
  function riverDraft(points: Point[]): ToolRequest | null {
    return toolRequest("river", optionsRef.current, { points, W: info.W, H: info.H });
  }
  /** Show the river drawn so far, to the pointer: its channel carved, its water flowing in. */
  function drawRiver(points: Point[]) {
    const req = riverDraft(points);
    if (!req) return;
    shapeDrag.current ??= new ShapeDrag(shapeHost());
    shapeDrag.current.update({ kind: "new", req, id: riverId.current });
  }

  // ------------------------------------------------------------------------------ live shapes

  const shapeDrag = useRef<ShapeDrag | null>(null);
  const pointerAt = useRef({ x: 0, y: 0 });
  const shapeHost = (): ShapeHost => ({
    api,
    renderer: renderer.current!,
    W: infoRef.current.W,
    H: infoRef.current.H,
    heights: () => mirror.current.heights,
    restore: (v) => applyView(v),
    show: (p) => {
      if (!p) {
        setShapeNote(null);
        setShapeTiles(null);
        setLiveHeight(null);
        return;
      }
      const words = p.ok ? (p.cursor ?? [p.label.replace(/^(Add|Change) /, ""), ...p.report.slice(0, 1)].filter(Boolean).join(": ")) : plain(p.errors[0] ?? "This does not fit here.");
      setShapeNote({ text: words.replace(/^./, (c) => c.toUpperCase()), ok: p.ok, warn: !!p.warn, ...pointerAt.current });
      setShapeTiles(p.ok ? { tiles: p.tiles, ...(p.area ? { area: p.area } : {}) } : null);
    },
  });

  /** Where the pointer is over the map, for the shape's note. */
  function notePointer(ev: PointerEvent) {
    const box = renderer.current?.canvas.getBoundingClientRect();
    if (box) pointerAt.current = { x: ev.clientX - box.left, y: ev.clientY - box.top };
  }

  /** Place a shape tool's edit (a release, or the last corner): the result shown while dragging
   *  stays until the worker's map replaces it; a refusal puts the ground back and says why. (The
   *  worker plans the released shape itself: the last preview may be of an earlier one.) */
  function placeShape(req: ToolRequest, id: string, drag: ShapeDrag | null) {
    drag?.finish();
    void run(
      () => api.applyTool(req, id),
      (u) => {
        if (!u.ok) {
          drag?.cancel();
          return;
        }
        const f = u.info.features.find((g) => g.id === id);
        if (f) {
          setSelected(f.id);
          setTab(tabOf(f));
        }
        // a river, or an outline drawn by clicks, said little or nothing while it was drawn: what the
        // tool did shows now ("River: a sealed mouth on the north edge feeds it")
        const plan = (u as SessionUpdate & { plan?: ToolPlan }).plan;
        if ((!drag || req.tool === "river") && plan?.ok && plan.report.length) setMessage({ kind: "info", text: plain(`${plan.label.replace(/^Add /, "").replace(/^./, (c) => c.toUpperCase())}: ${plan.report.slice(0, 3).join("; ")}.`) });
      },
    );
  }

  /** The request a live tool makes of a dragged rectangle: rounded shapes for hills, islands,
   *  ridges, canyons, valleys and lakes; plateaus and resource areas keep their rectangle. */
  function shapeRequest(t: ToolKind, r: Rect): ToolRequest | null {
    const outline = t === "plateau" || t === "forest" || t === "berryPatch" || t === "ruinField" ? rectToOutline(r) : ellipseOutline(r);
    return toolRequest(t, optionsFor(t, optionsRef.current), { points: outline, W: info.W, H: info.H });
  }

  function planAt(x: number, y: number) {
    if (!tool) return;
    if (tool === "slope") return slopeAt(x, y);
    if (tool === "lake" || tool === "source" || tool === "badwaterSource") return placeSource(tool, x, y);
    const river = riverAt(indexedRef.current, x, y);
    const req = toolRequest(tool, optionsFor(tool, optionsRef.current), { at: [x, y], river, W: info.W, H: info.H });
    if (!req) return setMessage({ kind: "error", text: "Click on a river." });
    setFit(null);
    planRequest(req);
  }

  // ---------------------------------------------------------------------------- water sources

  /** Where a lake's spring goes for a click at (x, y): the lowest point of the hollow there, and
   *  what its water does (fills the hollow to a level, or runs on downhill). */
  function lakeAt(x: number, y: number) {
    const m = mirror.current;
    return hollowAt(m.heights, m.water?.depth ?? null, info.W, info.H, x, y);
  }

  /** A water or badwater source, or a lake's spring, placed with a click: its water spreads at
   *  once (live editing), one undo step. */
  function placeSource(t: ToolKind, x: number, y: number) {
    let at: [number, number] = [x, y];
    let said = "";
    if (t === "lake") {
      const h = lakeAt(x, y);
      if (!h.fills) return setMessage({ kind: "error", text: "No hollow here: water from a spring here runs on downhill. Click a low spot." });
      at = [h.low % info.W, Math.floor(h.low / info.W)];
      said = `a spring fills it to level ${h.level}, about ${h.tiles} tiles, then it spills over its rim`;
    }
    const req = toolRequest(t, optionsRef.current, { at, W: info.W, H: info.H });
    if (!req) return;
    setFit(null);
    void run(
      () => api.applyTool(req, newId()),
      (u) => {
        if (u.ok && said) setMessage({ kind: "info", text: `Lake: ${said}.` });
      },
    );
  }

  /** What a water tool says under the pointer: a source's strength, the lake a click would fill. */
  function waterHover(x: number, y: number, ev: PointerEvent | null) {
    const t = toolRef.current;
    if (t !== "lake" && t !== "source" && t !== "badwaterSource") return;
    if (ev) notePointer(ev);
    const o = optionsRef.current;
    let text: string;
    let ok = true;
    if (t === "lake") {
      const h = lakeAt(x, y);
      ok = h.fills;
      text = h.fills ? `Lake: fills to level ${h.level} here, about ${h.tiles} tiles` : "No hollow here: its water would run on downhill";
    } else {
      const v = t === "badwaterSource" ? o.badwaterStrength : o.sourceStrength;
      text = `${TOOL_NAMES[t]}: ${v} water/s${v > OFFICIAL_FLOW ? " · stronger than any official map" : ""}`;
    }
    setShapeNote({ text, ok: true, warn: !ok, ...pointerAt.current });
  }

  // the footprint under the pointer: one check in flight, then the latest tile
  const fitWant = useRef<string | null>(null);
  const fitBusy = useRef(false);
  function hoverFit(x: number, y: number) {
    const t = toolRef.current;
    if (!t || (!objectKindOf(t, optionsRef.current) && t !== "object" && t !== "source" && t !== "badwaterSource") || planRef.current) {
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
    // a source's strength: its water answers each step, and one adjustment is one undo step
    const strength = (c.props as { WaterSource?: { SpecifiedStrength?: number } } | undefined)?.WaterSource?.SpecifiedStrength;
    const name = e.template === "BadwaterSource" ? "Badwater source" : "Water source";
    void run(
      () => (strength !== undefined && !c.remove && !c.move ? api.applyStep(op, `${name}: ${strength} water/s`, `strength:${e.id}`) : api.apply(op, "user", label)),
      (u) => {
        if (u.ok) pickTile(at[0], at[1]);
      },
    );
  }

  /** The slope tool: remove the slope on a tile, or pin one on the low tile of a 1-level step,
   *  its high side toward the higher neighbour (the one whose opposite tile is level with it). */
  function slopeAt(x: number, y: number) {
    const m = mirror.current;
    const here = entitiesAt().get(y * info.W + x) ?? [];
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
    shapeDrag.current?.cancel();
    shapeDrag.current = null;
    setDrawing(null);
    setFit(null);
    fitWant.current = null;
  }

  // the drawing tool takes left clicks and drags on the map
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    if (!tool) {
      if (!brushToolRef.current) r.tool = null;
      return;
    }
    const g = gestureOf(tool);
    const W = info.W;
    const H = info.H;
    let start: [number, number] | null = null;
    let dragged = false;
    let lastUp = 0;
    let lastTile = -1;
    const live = LIVE_TOOLS.has(tool);
    let liveId = "";
    /** A river drawn freehand: the points so far (a new one every few tiles). */
    let stroke: Point[] = [];
    const at = (ev: PointerEvent, hit: { x: number; y: number }): Point => {
      const p = r.pickAtLevel(ev.clientX, ev.clientY, r.heightAt(hit.x, hit.y));
      return p ? [Math.round(p.point[0] * 2) / 2 - 0.5, Math.round(-p.point[2] * 2) / 2 - 0.5] : [hit.x, hit.y];
    };
    const t: PointerTool = {
      down(hit, ev) {
        if (!hit) return false;
        // a preview waits for Place or Cancel
        if (planRef.current) return true;
        start = [hit.x, hit.y];
        dragged = false;
        liveId = newId();
        notePointer(ev);
        if (g === "path" && !draftRef.current.length) {
          riverId.current = newId();
          stroke = [at(ev, hit)];
        }
        if (g === "rect") setDrawing(rectOf(start, start, W, H));
        return true;
      },
      hover(hit, ev) {
        notePointer(ev);
        // a river drawn by clicks: its draft runs to the pointer
        if (g !== "path" || !hit || draftRef.current.length < 1) return;
        drawRiver([...draftRef.current, at(ev, hit)]);
      },
      move(hit, ev) {
        notePointer(ev);
        if (!start || !hit) return;
        if (g === "path" && stroke.length && !draftRef.current.length) {
          // a river drawn freehand: its channel carves in under the pointer as it goes
          const p = at(ev, hit);
          const last = stroke[stroke.length - 1];
          if (!dragged && Math.hypot(p[0] - stroke[0][0], p[1] - stroke[0][1]) < 2) return;
          dragged = true;
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) stroke.push(p);
          drawRiver([...stroke, p]);
          return;
        }
        if (g === "rect") setDrawing(rectOf(start, [hit.x, hit.y], W, H));
        else if (g === "outline" && !draftRef.current.length && Math.abs(hit.x - start[0]) + Math.abs(hit.y - start[1]) >= 2) {
          dragged = true;
          const r = rectOf(start, [hit.x, hit.y], W, H);
          if (!live) return setDrawing(r);
          // the shape's real result, growing as it is dragged
          const req = shapeRequest(tool, r);
          if (!req) return;
          shapeDrag.current ??= new ShapeDrag(shapeHost());
          shapeDrag.current.update({ kind: "new", req, id: liveId });
        }
      },
      cancel() {
        start = null;
        stroke = [];
        shapeDrag.current?.cancel();
        shapeDrag.current = null;
        setDrawing(null);
      },
      up(hit, ev) {
        const a = start;
        start = null;
        if (!a) return;
        const b: [number, number] = hit ? [hit.x, hit.y] : a;
        if (g === "path" && dragged && stroke.length) {
          // a freehand river is placed on release, if its water has somewhere to go
          const points = hit ? [...stroke, at(ev, hit)] : stroke;
          stroke = [];
          const drag = shapeDrag.current;
          shapeDrag.current = null;
          const req = toolRequest("river", optionsRef.current, { points, W, H });
          if (!req) {
            drag?.cancel();
            return;
          }
          return placeShape(req, riverId.current, drag);
        }
        stroke = [];
        if (live && dragged) {
          const drag = shapeDrag.current;
          shapeDrag.current = null;
          const req = shapeRequest(tool, rectOf(a, b, W, H));
          if (!req || !drag) {
            drag?.cancel();
            return;
          }
          return placeShape(req, liveId, drag);
        }
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
    painter.current = new BrushPainter({
      renderer: r,
      W: infoRef.current.W,
      H: infoRef.current.H,
      heights: () => mirror.current.heights,
      terrain: () => terrain.current,
      settings: () => ({ ...brushRef.current, tool: brushToolRef.current ?? "raise" }),
      commit: (stroke, pre) => {
        terrain.current = { ...terrain.current, pre };
        localUndo.current.push(stroke);
        localRedo.current = [];
        sendTerrain(() => api.apply({ op: "brush", params: stroke.params }, "user", stroke.label));
      },
      picked: (level) => setBrush({ ...brushRef.current, level }),
      strength: (value) => setBrush({ ...brushRef.current, strength: value }),
      painting: (on) => {
        clearTimeout(holdTimer.current);
        if (!brushRef.current.holdWater) return;
        if (on) void api.holdWater(true);
        else holdTimer.current = window.setTimeout(() => void api.holdWater(false), 900);
      },
      note: (text, ev) => {
        if (!text) return setShapeNote(null);
        if (ev) notePointer(ev);
        setShapeNote({ text, ok: true, warn: false, ...pointerAt.current });
      },
      wet: (x, y) => (mirror.current.water?.depth[y * infoRef.current.W + x] ?? 0) > 0.05,
    });
    r.onClick = (hit) => {
      if (advancedRef.current && hit) {
        setSelected(null);
        return pickTile(hit.x, hit.y);
      }
      if (!hit) return setSelected(null);
      // a water or badwater source: selected, its strength to change (the water answers live)
      if (sourceNear(hit.x, hit.y)) {
        setSelected(null);
        return pickTile(...sourceNear(hit.x, hit.y)!);
      }
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
  // a brush out takes the map's left button; put away, the brush under the cursor goes
  useEffect(() => {
    const r = renderer.current;
    const p = painter.current;
    if (!r || !p) return;
    if (brushTool) {
      r.tool = p.tool;
      p.showCursor();
    } else {
      if (r.tool === p.tool) r.tool = null;
      p.hideCursor();
    }
  }, [brushTool, ready]);
  // a new size, strength or level shows on the brush under the cursor at once
  useEffect(() => painter.current?.showCursor(), [brush]);

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

  // ------------------------------------------------------------------ a landform's handles (live)

  /** The height the height handle shows while it is changed (null: the landform's own). */
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  /** A selected landform drawn by its outline: it moves, resizes and changes height live. */
  const shaped = feature && feature.kind === "landform" && feature.params.outline && feature.params.height !== undefined && !blocked ? feature : null;
  const shapeHandles = useMemo(() => {
    const r = renderer.current;
    if (!r || !shaped || !shaped.params.outline) return null;
    const b = outlineBox(shaped.params.outline);
    const W = info.W;
    const H = info.H;
    const at = (x: number, y: number) => {
      const tx = Math.max(0, Math.min(W - 1, Math.round(x)));
      const ty = Math.max(0, Math.min(H - 1, Math.round(y)));
      return r.project(x + 0.5, r.heightAt(tx, ty) + 0.3, -(y + 0.5));
    };
    // south-west, south-east, north-east, north-west
    const corners = [at(b.x0, b.y0), at(b.x1, b.y0), at(b.x1, b.y1), at(b.x0, b.y1)];
    return { box: b, corners };
  }, [shaped, viewTick, info.W, info.H]);

  /** A handle's live change: shown as it is dragged, placed on release, Esc puts it back. */
  function handleDrag(ev: PointerEvent, next: (e: PointerEvent) => Record<string, unknown> | null, label: (params: Record<string, unknown>) => string) {
    const f = shaped;
    if (!f) return;
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture(ev.pointerId);
    notePointer(ev);
    const drag = new ShapeDrag(shapeHost());
    shapeDrag.current = drag;
    let params: Record<string, unknown> | null = null;
    const move = (e: PointerEvent) => {
      notePointer(e);
      const p = next(e);
      if (!p || JSON.stringify(p) === JSON.stringify(params)) return;
      params = p;
      drag.update({ kind: "change", id: f.id, patch: { params: p } });
    };
    const up = (e: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (shapeDrag.current !== drag) return; // Esc put it back
      shapeDrag.current = null;
      if (e.type === "pointercancel" || !params) return drag.cancel();
      commitChange(f.id, params, label(params), drag);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  /** Place a handle's change as one undo step; a refusal puts the ground back and says why. */
  function commitChange(id: string, params: Record<string, unknown>, label: string, drag: ShapeDrag) {
    drag.finish();
    void run(
      () => api.changeFeature(id, { params }, label),
      (u) => {
        if (!u.ok) drag.cancel();
      },
    );
  }

  /** A corner handle: that corner follows the pointer, the opposite one stays. */
  function onResizeDown(ev: PointerEvent, corner: number) {
    const r = renderer.current;
    const f = shaped;
    if (!r || !f || !f.params.outline || !anchor) return;
    const outline = f.params.outline;
    const b = outlineBox(outline);
    const level = r.heightAt(anchor[0], anchor[1]);
    const W = info.W;
    const H = info.H;
    const name = featureName(f).toLowerCase();
    handleDrag(
      ev,
      (e) => {
        const at = r.pickAtLevel(e.clientX, e.clientY, level);
        if (!at) return null;
        const x = Math.max(-0.5, Math.min(W - 0.5, Math.round(at.point[0] * 2) / 2 - 0.5));
        const y = Math.max(-0.5, Math.min(H - 0.5, Math.round(-at.point[2] * 2) / 2 - 0.5));
        const east = corner === 1 || corner === 2;
        const north = corner === 2 || corner === 3;
        const box = {
          x0: east ? b.x0 : Math.min(x, b.x1 - 2),
          x1: east ? Math.max(x, b.x0 + 2) : b.x1,
          y0: north ? b.y0 : Math.min(y, b.y1 - 2),
          y1: north ? Math.max(y, b.y0 + 2) : b.y1,
        };
        return { outline: fitOutline(outline, box) };
      },
      () => `Resize ${name}`,
    );
  }

  /** The height handle: up and down, a level every 14 pixels. */
  function onHeightDown(ev: PointerEvent) {
    const f = shaped;
    if (!f || f.params.height === undefined) return;
    const h0 = f.params.height;
    const y0 = ev.clientY;
    const name = featureName(f).toLowerCase();
    handleDrag(
      ev,
      (e) => {
        const h = Math.max(0, Math.min(16, h0 + Math.round((y0 - e.clientY) / 14)));
        setLiveHeight(h);
        return { height: h };
      },
      (p) => `Change ${name} height to ${String(p.height)}`,
    );
  }

  /** The height handle by keyboard: the arrows change it a level, placed a moment after the last. */
  const heightKey = useRef<{ h: number; timer: number; drag: ShapeDrag } | null>(null);
  function onHeightKey(ev: KeyboardEvent) {
    const f = shaped;
    if (!f || f.params.height === undefined) return;
    const d = ev.key === "ArrowUp" || ev.key === "ArrowRight" ? 1 : ev.key === "ArrowDown" || ev.key === "ArrowLeft" ? -1 : 0;
    const k = heightKey.current;
    if (ev.key === "Escape" && k) {
      clearTimeout(k.timer);
      k.drag.cancel();
      heightKey.current = null;
      return;
    }
    if (!d) return;
    ev.preventDefault();
    ev.stopPropagation();
    const cur = k ?? { h: f.params.height, timer: 0, drag: new ShapeDrag(shapeHost()) };
    clearTimeout(cur.timer);
    cur.h = Math.max(0, Math.min(16, cur.h + d));
    setLiveHeight(cur.h);
    // (what it says shows beside the handle)
    if (handlePos) pointerAt.current = { x: handlePos.x, y: handlePos.y };
    cur.drag.update({ kind: "change", id: f.id, patch: { params: { height: cur.h } } });
    const name = featureName(f).toLowerCase();
    cur.timer = window.setTimeout(() => {
      heightKey.current = null;
      commitChange(f.id, { height: cur.h }, `Change ${name} height to ${cur.h}`, cur.drag);
    }, 700);
    heightKey.current = cur;
  }

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
    if (f && f.kind === "start") {
      // a generated start's bench takes the ground's level there and runs to a river's bank (D97)
      const level = Math.max(1, mirror.current.heights[y * info.W + x]);
      const bank = bankFor(info.features, x, y, level, f.params.benchRadius);
      bench = { level, radius: f.params.benchRadius, ...(bank ? { bank } : {}) };
    }
    return { x, y, check: checkStartAt(ctx(), x, y, door, bench, s.owner, needs) };
  }

  /** Place a move. A landform's live result (`shown`) stays on screen until the worker's map
   *  replaces it; a refusal, or a move back to where it was, puts the ground back. */
  function commitMove(dx: number, dy: number, shown?: ShapeDrag) {
    setDrag(null);
    setStartDrag(null);
    if (!dx && !dy) return shown?.cancel();
    if (importStart) {
      void run(() => api.moveStartTo(importStart.x + dx, importStart.y + dy));
      return;
    }
    if (moving)
      void run(
        () => api.moveFeature(moving.id, dx, dy),
        (u) => {
          if (!u.ok) shown?.cancel();
        },
      );
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
    // a landform shows its real result where it would go (live editing)
    const live = shaped && shaped.params.outline ? { id: shaped.id, outline: shaped.params.outline, drag: new ShapeDrag(shapeHost()) } : null;
    if (live) shapeDrag.current = live.drag;
    const move = (e: PointerEvent) => {
      // (Esc put the landform back: the handle stays put until the button comes up)
      if (live && shapeDrag.current !== live.drag) return;
      const at = r.pickAtLevel(e.clientX, e.clientY, level);
      if (!at) return;
      notePointer(e);
      const next = clamp(at.x - start.x, at.y - start.y);
      if (live && (next[0] !== cur[0] || next[1] !== cur[1])) live.drag.update({ kind: "change", id: live.id, patch: { params: { outline: moveOutline(live.outline, next[0], next[1]) } } });
      cur = next;
      setDrag({ id: handleId, dx: cur[0], dy: cur[1] });
      if (isStart) setStartDrag(startPreview(cur[0], cur[1]));
    };
    const up = (e: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (live && shapeDrag.current !== live.drag) {
        // Esc put it back
        setDrag(null);
        return;
      }
      shapeDrag.current = null;
      if (e.type === "pointercancel") {
        live?.drag.cancel();
        setDrag(null);
        setStartDrag(null);
        return;
      }
      live?.drag.finish();
      commitMove(cur[0], cur[1], live?.drag);
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
      // the brushes: 1–5 pick one (again: it stays out), [ and ] size it, Esc cancels a stroke,
      // then puts it away
      if (!mod && !ev.altKey && /^[1-5]$/.test(ev.key)) {
        const b = BRUSHES[Number(ev.key) - 1].tool;
        if (painter.current && brushToolRef.current !== b) pickBrush(b);
        return;
      }
      if (!mod && (ev.key === "[" || ev.key === "]") && brushToolRef.current) {
        ev.preventDefault();
        setBrush({ ...brushRef.current, size: nextSize(brushRef.current.size, ev.key === "]" ? 1 : -1) });
        return;
      }
      // a river's width, like a brush's size (from as wide as its flow needs: 3)
      if (!mod && (ev.key === "[" || ev.key === "]") && toolRef.current === "river") {
        ev.preventDefault();
        const o = optionsRef.current;
        const w = Math.max(2, Math.min(9, (o.riverWidth || 3) + (ev.key === "]" ? 1 : -1)));
        setOptions({ ...o, riverWidth: w });
        return;
      }
      if (ev.key === "Escape" && painter.current?.painting) {
        painter.current.cancel();
        return;
      }
      if (ev.key === "Escape" && brushToolRef.current && !planRef.current) {
        pickBrush(null);
        return;
      }
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        void (ev.shiftKey ? redo() : undo());
      } else if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        void redo();
      } else if (ev.key === "Escape") {
        if (shapeDrag.current) {
          // a shape or a handle being dragged: the ground as it was, and nothing placed on release
          const sd = shapeDrag.current;
          if (toolRef.current) renderer.current?.tool?.cancel?.();
          if (shapeDrag.current === sd) {
            sd.cancel();
            shapeDrag.current = null;
          }
          setDrag(null);
          return;
        }
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
      strokeMismatches: () => strokeMismatches.current,
      lastStroke: () => localUndo.current.at(-1)?.params ?? null,
      shapePreview: () => shapeDrag.current?.preview ?? null,
      lakeAt: (x, y) => lakeAt(x, y),
      pendingTerrain: () => pendingTerrain.current,
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

  // the dam sites' line in the legend, with their tiles (a click on it points to them)
  const legendExtra = useMemo(
    () => (damSites ? [{ swatch: damLegendSwatch(), label: "Dam sites", markers: true, tiles: damSites.flatMap((d) => d.tiles.filter(([x, y]) => x >= 0 && y >= 0 && x < info.W && y < info.H).map(([x, y]) => y * info.W + x)) }] : []),
    [damSites, info.W, info.H],
  );
  const notices = [...info.notices, ...(info.importReport?.changes.filter((c) => c.level === "warning").map((c) => c.message) ?? [])];
  const flags = info.importReport?.flags ?? [];
  const importChanges = info.importReport?.changes.length ?? 0;
  const hint = tool
    ? gestureOf(tool) === "path"
      ? `${TOOL_NAMES[tool]}: drag from its source to where its water goes, or click its bends and double-click.`
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
          {/* (a stroke the page has painted can be undone at once, before the worker has it) */}
          <button type="button" class="ghost" onClick={() => void undo()} disabled={!info.canUndo && !localUndo.current.length} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" class="ghost" onClick={() => void redo()} disabled={!info.canRedo && !localRedo.current.length} title="Redo (Ctrl+Y)">
            Redo
          </button>
          <button type="button" class="ghost" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
            History{info.orphans.length ? ` (${info.orphans.length} to review)` : ""}
          </button>
          <StatusPill check={check} busy={busy > 0} progress={progress} flowing={flowing} onOpen={() => setExporting(true)} />
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
            if (t) pickBrush(null);
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
            legendExtra={legendExtra}
            markersWanted={damSites !== null || tool === "damSite" || tool === "slope"}

            onHover={(hit: TileHit | null) => {
              setHover(hit ? describeTile(ctx(), hit.x, hit.y) : null);
              if (draftRef.current.length) setHoverTile(hit ? [hit.x, hit.y] : null);
              if (hit) {
                hoverFit(hit.x, hit.y);
                waterHover(hit.x, hit.y, null);
              } else {
                fitWant.current = null;
                setFit(null);
                if (toolRef.current === "lake" || toolRef.current === "source" || toolRef.current === "badwaterSource") setShapeNote(null);
              }
            }}
            hoverText={fit && !plan && hover ? `${hover} · ${fit.problem ? `Can't go here: ${plain(fit.problem)}` : "Fits here"}` : hover}
          >
            <BrushBar active={brushTool} settings={brush} onPick={pickBrush} onSettings={setBrush} loading={!ready} />
            {player.current ? <WaterBar player={player.current} follow={follow} onFollow={setFollow} drought={drought} onDrought={toggleDrought} /> : null}
            {shapeNote ? (
              <div class={`map-note shape-note${shapeNote.ok ? (shapeNote.warn ? " warn" : "") : " error"}`} role="status" style={{ left: `${shapeNote.x + 16}px`, top: `${shapeNote.y + 16}px` }}>
                {shapeNote.text}
              </div>
            ) : null}
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
                {shaped && !drag ? (
                  <button
                    type="button"
                    class="handle wide"
                    aria-label={`Height of ${featureName(shaped)}: ${liveHeight ?? shaped.params.height}. Drag up or down, or use the arrow keys`}
                    title="Drag up or down to change its height, or use the arrow keys"
                    onPointerDown={onHeightDown}
                    onKeyDown={onHeightKey}
                  >
                    <span aria-hidden="true">↕ {liveHeight ?? shaped.params.height}</span>
                  </button>
                ) : null}
                {feature ? (
                  <button type="button" class="handle delete" aria-label={`Delete ${featureName(feature)}`} title="Delete" onClick={() => deleteFeature(feature)}>
                    <span aria-hidden="true">×</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {shaped && shapeHandles && !drag
              ? shapeHandles.corners.map((c, k) =>
                  c.visible ? (
                    <div class="handles centred" key={`corner-${k}`} style={{ left: `${c.x}px`, top: `${c.y}px` }}>
                      <button type="button" class="handle small resize" aria-label={`Resize ${featureName(shaped)}: drag this corner`} title="Drag to resize" onPointerDown={(e) => onResizeDown(e, k)}>
                        <span aria-hidden="true">⤡</span>
                      </button>
                    </div>
                  ) : null,
                )
              : null}
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

/** A setting kept in this browser (a missing or blocked store gives the default). */
function remembered(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not kept */
  }
}

/** The tools whose shapes show their real result while dragged and are placed on release. */
const LIVE_TOOLS = new Set<ToolKind>(["hill", "plateau", "ridge", "canyon", "valley", "island", "forest", "berryPatch", "ruinField"]);

const BRUSH_KEY = "dgm.brush";

/** The brush the viewer last used: its size, strength and water option (not its level). */
function loadBrush(): BrushSettings {
  try {
    const s = JSON.parse(localStorage.getItem(BRUSH_KEY) ?? "null") as Partial<BrushSettings> | null;
    if (!s) return DEFAULT_BRUSH;
    return {
      ...DEFAULT_BRUSH,
      size: typeof s.size === "number" ? Math.min(24, Math.max(1, s.size)) : DEFAULT_BRUSH.size,
      strength: typeof s.strength === "number" ? Math.min(10, Math.max(1, Math.round(s.strength))) : DEFAULT_BRUSH.strength,
      holdWater: s.holdWater === true,
    };
  } catch {
    return DEFAULT_BRUSH;
  }
}

function saveBrush(s: BrushSettings): void {
  try {
    localStorage.setItem(BRUSH_KEY, JSON.stringify({ size: s.size, strength: s.strength, holdWater: s.holdWater }));
  } catch {
    // the brush lasts for this visit only
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

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
  return { heights: v.heights, water: surfaceWater(v.W, v.H, v.water), waterView: v.water, entities: v.entities, entitiesAt: null, soil: v.soil };
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
