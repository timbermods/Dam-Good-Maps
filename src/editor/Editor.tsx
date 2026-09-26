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

import { proxy, transfer, wrap, type Remote } from "comlink";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { EditOp } from "../core/doc/ops";
import { cornerFor } from "../core/doc/tools";
import { orientationForHigh } from "../core/features/setpieces";
import { footprintTiles, startEntranceTile, type Orientation } from "../core/format/footprints";
import type { Feature, Point } from "../core/features/schema";
import type { FixOp } from "../core/validate/report";
import { rulesFor } from "../core/validate/playability";
import { saveFile } from "../platform";
import { FLIPPED, ORIENTATION_NAMES, surfaceWater, type EntityView, type MapView, type SoilView, type SurfaceWater, type WaterView } from "../render3d/model";
import { damLegendSwatch } from "../render3d/palette";
import type { MapRenderer, PointerTool, TileHit, ViewState } from "../render3d";
import { View3D } from "../ui/View3D";
import type { GeneratorApi } from "../worker/generator.worker";
import type { CheckItem, CheckProgress, DamSiteView, EditorEvent, EntityInfo, ExportCheck, SessionInfo, SessionOpen, SessionUpdate, ToolPlan, ToolRequest, ViewUpdate, WaterLayers } from "../worker/session";
import { anchorOf, checkStartAt, clampMove, startProblemAt, describeTile, entitiesByTile, featureName, FeatureIndex, feedingGroups, moveBlocked, newId, rectOf, riverAt, sourceGroups, tabOf, type StartCheck, type Tab, type TileContext } from "./features";
import { EntityInspector, ExportDialog, HistoryPanel, Inspector, InstantProblems, LayerLegend, plain, PreviewCard, SourceOptions, StartIndicators, StatusPill, TabPanel, whereOf, type EntityChange, type ItemActions, type LayerKind } from "./panels";
import { Juice, loadSound, type SoundSettings } from "./juice";
import type { StartCheckApi } from "./startCheck.worker";
import { startSpots } from "./startHint";
import { TopBar } from "./TopBar";
import { SELECT_MODES, Selection, selectTool, sizeWords, type SelectMode } from "./select";
import { WaterBar } from "./WaterBar";
import { WaterPlayer } from "./waterPlayer";
import type { Hazard } from "../core/sim/weather";
import { OFFICIAL_FLOW } from "../core/gen/calibrated";
import type { AreaPreview } from "../core/doc/placing";
import { BRUSHES, BrushPainter, DEFAULT_BRUSH, nextSize, paste, type BrushSettings, type BrushTool, type Stroke } from "./brushes";
import { tilesToRuns } from "../core/math/grid";
import type { TerrainState } from "../core/features/raster/strokePreview";
import type { BrushParams } from "../core/features/raster/brush";
import {
  BAD,
  BADWATER_STRENGTHS,
  BARE,
  DAM,
  DEAD,
  DEFAULT_OPTIONS,
  DRAWING,
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
  SOURCE_STRENGTHS,
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
  /** The map's water: the last the worker put in place (a journey's frames pass over it). */
  mapWater: WaterView;
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
      /** "The start fits here" after a Flatten stroke (D204), and how long its search took. */
      startHint(): { x: number; y: number; strong: boolean; ms: number } | null;

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
  /** The water is flowing into an edit's new shape (how far it has come, 0–1), or null. */
  const [flowing, setFlowing] = useState<number | null>(null);
  /** **Markers** is on (every source shows its marker then, D196). */
  const [markersOn, setMarkersOn] = useState(false);
  /** The source groups near the pointer, and those the pointer's water comes from (D196). */
  const [nearSources, setNearSources] = useState<number[]>([]);
  const [feeding, setFeeding] = useState<number[]>([]);
  /** Clear water (D196): T or the view button; any tool picked clears the water too. */
  const [clearWater, setClearWater] = useState(false);
  /** The layer the world is cut at (Alt+scroll, Alt+click), or null. */
  const [sliceLevel, setSliceLevel] = useState<number | null>(null);
  /** The Select tool (D184): open with M or a Ctrl+drag; its way of picking tiles. */
  const [selecting, setSelecting] = useState<SelectMode | null>(null);
  const selectingRef = useRef(selecting);
  selectingRef.current = selecting;
  const selection = useRef(new Selection(info.W, info.H));
  const [selectionTick, setSelectionTick] = useState(0);
  /** The tiles being drawn, before they join the selection. */
  const [selectDraw, setSelectDraw] = useState<number[] | null>(null);
  const [selectAmount, setSelectAmount] = useState(1);
  /** A water source being dragged to a new place: its footprint there (D184). */
  const [sourceDrag, setSourceDrag] = useState<number[] | null>(null);
  /** The water's journey, played at a pace the eye can follow; its controls; a drought to watch. */
  const player = useRef<WaterPlayer | null>(null);
  /** The editor is on the page (answers from the worker that come after it closed are dropped). */
  const mounted = useRef(true);
  /** The little feedback on every action (D205): its sounds, and the land's effects. */
  const [sound, setSoundState] = useState<SoundSettings>(loadSound);
  const juice = useRef<Juice | null>(null);
  useEffect(
    () => () => {
      mounted.current = false;
      juice.current?.dispose();
    },
    [],
  );
  const setSound = (s: SoundSettings) => {
    setSoundState(s);
    juice.current?.setSound(s);
  };
  /** Feedback for an action at tile (x, y). */
  const feel = (kind: Parameters<Juice["play"]>[0], x: number, y: number, size = 1, soft = false) => juice.current?.play(kind, x, y, size, soft);
  const [, setPlayerTick] = useState(0);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  /** A hazard playing (a drought or a badtide to watch), or null. */
  const [weather, setWeatherState] = useState<Hazard | null>(null);
  const weatherRef = useRef<Hazard | null>(null);
  const setWeather = (on: Hazard | null) => {
    weatherRef.current = on;
    setWeatherState(on);
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
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  /** What the shape being dragged says, where the pointer is, and what it covers (live shapes). */
  const [shapeNote, setShapeNote] = useState<{ text: string; ok: boolean; warn: boolean; x: number; y: number } | null>(null);
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

  /** A drought or a badtide to watch, or the map's own water back at once. */
  function toggleWeather(hazard: Hazard) {
    if (weatherRef.current !== hazard) {
      setWeather(hazard);
      player.current?.begin(null, true);
      void api.startWeather(hazard);
    } else {
      setWeather(null);
      void api.stopWeather().then((v) => {
        player.current?.clear();
        applyView(v);
        if (mirror.current.soil) renderer.current?.updateSoil(mirror.current.soil);
      });
    }
  }
  /** The soil's colours during a weather run (the map's own soil stays the page's copy). */
  function showSoil(soil: SoilView) {
    renderer.current?.updateSoil(soil);
  }

  function applyUpdate(u: SessionUpdate): void {
    applyView(u.view);
    // an edit: its water's journey starts from the water right after it
    if (u.ok) {
      if (weatherRef.current) setWeather(null);
      player.current?.begin(u.view.water ? { water: u.view.water, done: 0 } : null);
    }
    // the instant checks: the problems this edit made, in the region it changed (with the checks
    // worker they come as an event a moment later)
    if (u.instant) setInstant(u.instant.items.filter((c) => c.here && c.class === "load"));
    // the same features keep the page's own copy (its index and lists are not worked out again)
    const i = u.info.featuresKey === infoRef.current.featuresKey ? { ...u.info, features: infoRef.current.features } : u.info;
    // (at once: the worker's news for this version can come before the page renders it)
    infoRef.current = i;
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
      m.mapWater = v.water;
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
  const setBrush = (s: BrushSettings, save = true) => {
    // (at once: the ring and the next stroke read it before the page renders)
    brushRef.current = s;
    setBrushState(s);
    if (save) saveBrush(s);
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
  function sendTerrain(fn: () => Promise<SessionUpdate>): Promise<void> {
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
    return next;
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

  /** The top bar: a brush, Source, or nothing. */
  function pickTop(t: BrushTool | "source" | null) {
    if (t === "source") {
      pickBrush(null);
      setTool("source");
      cancelTool();
      setSelected(null);
      return;
    }
    if (t === null && toolRef.current === "source") setTool(null);
    pickBrush(t);
  }

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
          if (!r || !mounted.current) return;
          // the exact settle's water ends the journey in progress (eased into), or shows at once.
          // The worker put it in place and sends it once, so it shows even when the page moved on
          // while the check ran (the check started as an edit went in): only the report waits
          if (r.view.water && player.current?.hasJourney) player.current.push({ water: r.view.water, done: 1, final: () => applyView(r.view) });
          else applyView(r.view);
          if (!live || r.check.version !== infoRef.current.version) return;
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
        if (e.kind === "water" && e.draft) {
          // the water on a stroke being painted: shown as it comes (D197)
          if (player.current?.hasJourney) player.current.clear();
          showWater(e.water);
        } else if (e.kind === "water") {
          // an edit's water plays at a pace the eye can follow
          player.current?.push({ water: e.water, done: e.done });
        } else if (e.kind === "settled") {
          // (no water in it: the map's water was sent before, so it is the last put in place, not the
          // frame on screen)
          player.current?.push({ water: e.view.water ?? mirror.current.mapWater, done: 1, final: () => applyView(e.view) });
        } else if (e.kind === "weather") {
          const w = weatherRef.current;
          if (!w) return;
          const day = `day ${Math.max(1, Math.ceil(e.day))} of ${e.days}`;
          const words = e.phase === "drought" ? `Drought: ${day}` : e.phase === "badtide" ? `Badtide: ${day}` : e.phase === "return" ? (w === "badtide" ? "The water runs clean again" : "The water comes back") : undefined;
          const soil = e.soil;
          const show = soil ? () => showSoil(soil) : undefined;
          const final = e.phase === "end" ? () => (soil && showSoil(soil), setWeather(null)) : show;
          player.current?.push({ water: e.water, done: e.phase === "return" || e.phase === "end" ? 0.5 : e.day / e.days / 2, ...(words ? { words } : {}), ...(final ? { final } : {}) });
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
  /** The water or badwater source covering tile (x, y) (a badwater source covers 3 × 3): where it
   *  stands and its tiles. */
  const sourceAt = (x: number, y: number): { x: number; y: number; bad: boolean; tiles: [number, number][] } | null => {
    const m = mirror.current.entities;
    const W = infoRef.current.W;
    const H = infoRef.current.H;
    const at = entitiesAt();
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        for (const k of at.get(ny * W + nx) ?? []) {
          const template = m.templates[m.template[k]];
          if (template !== "WaterSource" && template !== "BadwaterSource") continue;
          const tiles = footprintTiles(template, { template, x: nx, y: ny, z: 0, orientation: ORIENTATION_NAMES[m.orientation[k]] as Orientation, flipped: false });
          if (tiles.some(([tx, ty]) => tx === x && ty === y)) return { x: nx, y: ny, bad: template === "BadwaterSource", tiles };
        }
      }
    return null;
  };
  const ctx = (): TileContext => ({ W: info.W, H: info.H, heights: mirror.current.heights, water: mirror.current.water, entities: mirror.current.entities, entitiesAt: entitiesAt(), index: indexed, soil: mirror.current.soil, editor: true });

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
    if (plan?.ok && plan.area) {
      layers.push({ tiles: plan.area.bare, color: BARE });
      layers.push({ tiles: plan.area.dead, color: DEAD });
      layers.push({ tiles: plan.area.alive, color: GOOD });
    } else if (plan?.ok) layers.push({ tiles: plan.tiles, color: PREVIEW });
    if (fit && !plan && !planning) layers.push({ tiles: fit.tiles, color: fit.problem ? BAD : GOOD });
    if (picked) layers.push({ tiles: [picked.y * info.W + picked.x], color: SELECTED });
    if (startDrag) layers.push({ tiles: [...startDrag.check.tiles, startDrag.check.door], color: startDrag.check.problem || !startDrag.check.meets ? BAD : GOOD });
    if (sourceDrag) layers.push({ tiles: sourceDrag, color: MOVING });
    if (selection.current.count) layers.push({ tiles: selection.current.tiles(), color: SELECTED, outline: true });
    if (selectDraw) layers.push({ tiles: selectDraw, color: DRAWING });
    for (const c of instant) for (const [x, y] of c.where?.tiles ?? []) layers.push({ tiles: [y * info.W + x], color: PROBLEM });
    paintOverlay(data, info.W, info.H, layers);
    r.commitOverlay();
  }, [feature, drag, drawing, draft, hoverTile, plan, planning, fit, picked, startDrag, damSites, instant, indexed, ready, waterLayers, layer, sourceDrag, selectionTick, selectDraw]);

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
    if (!req) return setMessage({ kind: "error", text: "Click at least three corners." });
    planRequest(req);
  }

  /** Where the pointer is, for the words beside it (flatten's level, a source's strength). */
  const pointerAt = useRef({ x: 0, y: 0 });

  /** Where the pointer is over the map, for the words beside it. */
  function notePointer(ev: PointerEvent) {
    const box = renderer.current?.canvas.getBoundingClientRect();
    if (box) pointerAt.current = { x: ev.clientX - box.left, y: ev.clientY - box.top };
  }

  function planAt(x: number, y: number) {
    if (!tool) return;
    if (tool === "slope") return slopeAt(x, y);
    if (tool === "source") return placeSource(x, y);
    const river = riverAt(indexedRef.current, x, y);
    const req = toolRequest(tool, optionsFor(tool, optionsRef.current), { at: [x, y], river, W: info.W, H: info.H });
    if (!req) return setMessage({ kind: "error", text: "Click on a river." });
    setFit(null);
    planRequest(req);
  }

  // ---------------------------------------------------------------------------- water sources

  /** A water or badwater source placed with a click: its water spreads at once (live editing),
   *  one undo step. Sources go anywhere in the editor (D184). */
  function placeSource(x: number, y: number) {
    const req = toolRequest("source", optionsRef.current, { at: [x, y], W: info.W, H: info.H });
    if (!req) return;
    setFit(null);
    void run(
      () => api.applyTool(req, newId()),
      (u) => u.ok && feel("source", x, y),
    );
  }

  /** The source's own record (its id, place and strength), from the worker. */
  function sourceInfo(x: number, y: number): Promise<EntityInfo | null> {
    return enqueue(() => api.entitiesAt(x, y)).then((list) => list.find((e) => e.template === "WaterSource" || e.template === "BadwaterSource") ?? null);
  }

  /** A source dragged somewhere else (D184): its footprint follows the pointer, and the drop is one
   *  undo step; a click without a drag selects it; Esc puts it back. Brushes paint over sources. */
  const sourceGrab = useRef<{ cancel(): void } | null>(null);
  function grabSource(hit: TileHit | null): PointerTool | null {
    if (!hit || brushToolRef.current || advancedRef.current) return null;
    const src = sourceAt(hit.x, hit.y);
    if (!src) return null;
    const W = infoRef.current.W;
    const H = infoRef.current.H;
    const from: [number, number] = [hit.x, hit.y];
    let to = from;
    let done = false;
    const record = sourceInfo(hit.x, hit.y);
    const canvas = renderer.current?.canvas;
    if (canvas) canvas.style.cursor = "grabbing";
    const end = () => {
      done = true;
      sourceGrab.current = null;
      setSourceDrag(null);
      if (canvas) canvas.style.cursor = "";
    };
    sourceGrab.current = { cancel: end };
    return {
      down: () => true,
      move(h) {
        if (!h || done) return;
        to = [h.x, h.y];
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        setSourceDrag(dx || dy ? src.tiles.map(([x, y]) => [x + dx, y + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y]) => y * W + x) : null);
      },
      up() {
        if (done) return;
        end();
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        if (!dx && !dy) {
          setSelected(null);
          return pickTile(from[0], from[1]);
        }
        void record.then((e) => {
          if (!e) return;
          const name = e.template === "BadwaterSource" ? "badwater source" : "water source";
          void run(() => api.apply({ op: "moveEntity", params: { id: e.id, x: e.x + dx, y: e.y + dy } }, "user", `Move a ${name}`));
        });
      },
      cancel: end,
    };
  }

  /** Shift+scroll over a source (D184, D196): its strength a step up or down, the water answering
   *  at once, the new strength beside the pointer; one adjustment is one undo step. */
  const sourceWheel = useRef<{ key: string; record: Promise<EntityInfo | null>; value: number | null; sent: number | null; busy: boolean } | null>(null);
  const wheelNoteTimer = useRef(0);
  function wheelSource(ev: WheelEvent, hit: TileHit | null): boolean {
    if (!ev.shiftKey || !hit) return false;
    const src = sourceAt(hit.x, hit.y);
    if (!src) return false;
    const key = `${src.x},${src.y}`;
    let w = sourceWheel.current;
    if (!w || w.key !== key) w = sourceWheel.current = { key, record: sourceInfo(hit.x, hit.y), value: null, sent: null, busy: false };
    // (browsers turn a Shift+wheel sideways)
    const up = (ev.deltaY || ev.deltaX) < 0;
    const box = renderer.current?.canvas.getBoundingClientRect();
    const at = box ? { x: ev.clientX - box.left, y: ev.clientY - box.top } : pointerAt.current;
    const state = w;
    void state.record.then((e) => {
      if (!e || sourceWheel.current !== state) return;
      const steps = e.template === "BadwaterSource" ? BADWATER_STRENGTHS : SOURCE_STRENGTHS;
      const now = state.value ?? ((e.components.WaterSource as { SpecifiedStrength?: number } | undefined)?.SpecifiedStrength ?? steps[0]);
      const k = steps.reduce((best, f, j) => (Math.abs(f - now) < Math.abs(steps[best] - now) ? j : best), 0);
      const value = steps[Math.max(0, Math.min(steps.length - 1, k + (up ? 1 : -1)))];
      state.value = value;
      const over = value > OFFICIAL_FLOW;
      setShapeNote({ text: over ? `${value} water/s: stronger than any official map` : `${value} water/s`, ok: true, warn: over, ...at });
      clearTimeout(wheelNoteTimer.current);
      wheelNoteTimer.current = window.setTimeout(() => {
        setShapeNote(null);
        if (sourceWheel.current === state && !state.busy) sourceWheel.current = null;
      }, 1500);
      const send = () => {
        if (state.busy || state.value === state.sent || state.value === null) return;
        const v = state.value;
        state.busy = true;
        state.sent = v;
        const name = e.template === "BadwaterSource" ? "Badwater source" : "Water source";
        const op: EditOp = { op: "setEntityProps", params: { id: e.id, components: { WaterSource: { SpecifiedStrength: v, CurrentStrength: v } } } };
        void run(
          () => api.applyStep(op, `${name}: ${v} water/s`, `strength:${e.id}`),
          (u) => {
            const p = pickedRef.current;
            if (u.ok && p && p.list.some((x) => x.id === e.id)) pickTile(p.x, p.y);
          },
        ).finally(() => {
          state.busy = false;
          send();
        });
      };
      send();
    });
    return true;
  }

  // ------------------------------------------------------------------------ the sources' markers

  /** The map's sources as markers (a river's mouth is one), from the page's view of the objects. */
  const groups = useMemo(() => sourceGroups(mirror.current.entities, info.W, mirror.current.heights), [info.version, ready]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  /** Near the pointer: the groups within two tiles; over water: the groups it comes from. */
  const hoverKey = useRef("");
  function hoverSources(hit: TileHit | null) {
    const key = hit ? `${hit.x},${hit.y}` : "";
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    const gs = groupsRef.current;
    const r = renderer.current;
    if (!hit) {
      setNearSources([]);
      setFeeding([]);
      r?.setSourceGlow([]);
      return;
    }
    const near: number[] = [];
    gs.forEach((g, k) => {
      if (g.tiles.some((t) => Math.abs((t % info.W) - hit.x) <= 2 && Math.abs(Math.floor(t / info.W) - hit.y) <= 2)) near.push(k);
    });
    setNearSources(near);
    const feed = mirror.current.water ? (feedingGroups(mirror.current.water, gs, info.W, info.H, hit.x, hit.y) ?? []) : [];
    setFeeding(feed);
    r?.setSourceGlow(feed.flatMap((k) => gs[k].tiles));
  }
  /** Which markers show: every one with Source picked or **Markers** on; else those near the
   *  pointer and those its water comes from. */
  const shownGroups = tool === "source" || markersOn ? groups.map((_, k) => k) : [...new Set([...nearSources, ...feeding])];
  const markerRef = useRef(false);
  markerRef.current = shownGroups.length > 0;

  function sourceMarkers() {
    const r = renderer.current;
    if (!r || !shownGroups.length) return null;
    void viewTick;
    return (
      <div class="source-markers" aria-hidden="true">
        {shownGroups.map((k) => {
          const g = groups[k];
          if (!g) return null;
          const p = r.project(g.x + 0.5, g.z + 0.6, -(g.y + 0.5));
          if (!p.visible) return null;
          const n = g.members.length;
          const words = `${n > 1 ? `${n} sources, ` : ""}${g.strength} ${g.bad ? "badwater" : "water"}/s`;
          return (
            <span key={k} class={`map-note source-marker${g.bad ? " bad" : ""}${feeding.includes(k) ? " feeding" : ""}`} style={{ left: `${p.x}px`, top: `${p.y}px` }}>
              {words}
            </span>
          );
        })}
      </div>
    );
  }

  // "the start fits here" (D204): after a Flatten stroke, a spot on its level ground for the district
  // center, looked for once the stroke is on the map and the page is idle; a click moves the start
  // there (one step)
  const [startHint, setStartHint] = useState<{ x: number; y: number; z: number; strong: boolean } | null>(null);
  const hintRef = useRef(false);
  hintRef.current = startHint !== null;
  const startHintRef = useRef(startHint);
  startHintRef.current = startHint;
  const hintJob = useRef(0);
  const hintTimer = useRef(0);
  function lookForStart(p: BrushParams) {
    const job = hintJob.current;
    const idle = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 1500 }) : window.setTimeout(fn, 100));
    idle(() => {
      if (job !== hintJob.current || !mounted.current) return;
      // (never while painting: it waits for the stroke to end)
      if (painter.current?.painting) return;
      lookForStartRef.current(p, job, true);
    });
  }
  /** The start's full check, off the page (made at the first hint). */
  const startChecker = useRef<Remote<StartCheckApi> | null>(null);
  const startWorker = useRef<Worker | null>(null);
  useEffect(() => () => startWorker.current?.terminate(), []);
  function findStart(p: BrushParams, job: number) {
    const s = startHere;
    const m = mirror.current;
    if (!s || !m.water) return;
    const t0 = performance.now();
    const W = info.W;
    // the quick part here: a spot on the stroke's level ground where the district center stands
    const spots = startSpots(p, m.heights, m.water.depth, W, info.H, s.orientation, s);
    const c = ctx();
    for (const sp of spots) {
      const [cx, cy] = cornerFor(sp.x, sp.y, s.orientation);
      const door = startEntranceTile(cx, cy, s.orientation);
      if (startProblemAt(c, sp.x, sp.y, door, null, s.owner)) continue;
      hintMs.current = Math.round(performance.now() - t0);
      const z = m.heights[sp.y * W + sp.x];
      setStartHint({ x: sp.x, y: sp.y, z, strong: false });
      clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setStartHint(null), 9000);
      // the start's requirements there (a walk over the whole map), in the background
      if (!startChecker.current) {
        startWorker.current = new Worker(new URL("./startCheck.worker.ts", import.meta.url), { type: "module" });
        startChecker.current = wrap<StartCheckApi>(startWorker.current);
      }
      const f = s.feature ? info.features.find((g) => g.id === s.feature) : undefined;
      const bench = f && f.kind === "start" ? { level: z, radius: f.params.benchRadius } : null;
      void startChecker.current
        .check({ W, H: info.H, heights: m.heights, water: m.water, entities: m.entities, river: indexed?.river ?? null, x: sp.x, y: sp.y, door, bench, self: s.owner, needs })
        .then((check) => {
          if (job !== hintJob.current || !mounted.current) return;
          hintMs.current = Math.round(performance.now() - t0);
          if (check.problem) return setStartHint(null);
          if (check.meets) setStartHint((h) => (h && h.x === sp.x && h.y === sp.y ? { ...h, strong: true } : h));
        })
        .catch(() => undefined);
      return;
    }
    hintMs.current = Math.round(performance.now() - t0);
  }
  const hintMs = useRef(0);
  const lookForStartRef = useRef<(p: BrushParams, job?: number, now?: boolean) => void>(() => undefined);
  lookForStartRef.current = (p, job, now) => (now ? findStart(p, job ?? hintJob.current) : lookForStart(p));
  function startHintTag() {
    const r = renderer.current;
    const h = startHint;
    if (!r || !h) return null;
    void viewTick;
    const at = r.project(h.x + 0.5, h.z + 0.3, -(h.y + 0.5));
    if (!at.visible) return null;
    return (
      <button
        type="button"
        class={`map-note map-tag start-hint${h.strong ? " strong" : ""}`}
        style={{ left: `${at.x}px`, top: `${at.y}px` }}
        title="Move the start here"
        onClick={() => {
          setStartHint(null);
          void run(() => api.moveStartTo(h.x, h.y));
        }}
      >
        {h.strong ? "The start fits here, with water, wood and berries in reach" : "The start fits here"}
      </button>
    );
  }

  /** The sources in the objects picked on a tile (a click on a source). */
  function pickedSources(): EntityInfo[] {
    return pickedRef.current?.list.filter((e) => e.template === "WaterSource" || e.template === "BadwaterSource") ?? [];
  }

  /** Remove sources: their water recedes live; one undo step. */
  function removeSources(list: EntityInfo[]) {
    const bad = list.every((e) => e.template === "BadwaterSource");
    void run(
      () => api.apply({ op: "deleteEntities", params: { entities: list.map((e) => e.id) } }, "user", list.length > 1 ? `Remove ${list.length} sources` : bad ? "Remove a badwater source" : "Remove a water source"),
      (u) => {
        if (!u.ok) return;
        setPicked(null);
        for (const e of list) feel("remove", e.x, e.y);
      },
    );
  }

  /** A word beside the pointer for a moment (a strength, a size). */
  const flashTimer = useRef(0);
  function flashNote(text: string, ev?: MouseEvent) {
    if (ev) {
      const box = renderer.current?.canvas.getBoundingClientRect();
      if (box) pointerAt.current = { x: ev.clientX - box.left, y: ev.clientY - box.top };
    }
    setShapeNote({ text, ok: true, warn: false, ...pointerAt.current });
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setShapeNote(null), 1200);
  }

  // the footprint under the pointer: one check in flight, then the latest tile
  const fitWant = useRef<string | null>(null);
  const fitBusy = useRef(false);
  function hoverFit(x: number, y: number) {
    const t = toolRef.current;
    if (!t || (!objectKindOf(t, optionsRef.current) && t !== "object" && t !== "source") || planRef.current) {
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
    if (c.kind) {
      // clean or bad is the source's own (D196): a new source of the other kind in its place
      const bad = c.kind === "bad";
      const cx = e.template === "BadwaterSource" ? e.x + 1 : e.x;
      const cy = e.template === "BadwaterSource" ? e.y + 1 : e.y;
      const s0 = Number((e.components.WaterSource as { SpecifiedStrength?: number } | undefined)?.SpecifiedStrength ?? 1);
      const req = toolRequest("source", { ...optionsRef.current, sourceBad: bad, sourceStrength: Math.min(8, s0), badwaterStrength: s0 }, { at: [cx, cy], W: info.W, H: info.H });
      if (!req || req.tool !== "entity") return;
      const place: EditOp = { op: "placeEntity", params: { id: newId(), template: req.template, x: req.x, y: req.y, orientation: req.orientation, ...(req.components ? { components: req.components } : {}) } };
      void run(
        () => api.applyAll([{ op: "deleteEntities", params: { entities: [e.id] } }, place], bad ? "Make a source badwater" : "Make a source clean"),
        (u) => {
          if (!u.ok) return;
          pickTile(cx, cy);
          feel("source", cx, cy);
        },
      );
      return;
    }
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
        if (!u.ok) return;
        // what was placed pops in
        for (const op of p.ops) if (op.op === "placeEntity") feel("place", op.params.x, op.params.y);
        if (!p.featureId) return;
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
    const t: PointerTool = {
      down(hit, ev) {
        if (!hit) return false;
        // a preview waits for Place or Cancel
        if (planRef.current) return true;
        start = [hit.x, hit.y];
        dragged = false;
        notePointer(ev);
        if (g === "rect") setDrawing(rectOf(start, start, W, H));
        return true;
      },
      hover(_hit, ev) {
        notePointer(ev);
      },
      move(hit, ev) {
        notePointer(ev);
        if (!start || !hit) return;
        if (g === "rect") setDrawing(rectOf(start, [hit.x, hit.y], W, H));
        else if (g === "outline" && !draftRef.current.length && Math.abs(hit.x - start[0]) + Math.abs(hit.y - start[1]) >= 2) {
          dragged = true;
          setDrawing(rectOf(start, [hit.x, hit.y], W, H));
        }
      },
      cancel() {
        start = null;
        setDrawing(null);
      },
      up(hit) {
        const a = start;
        start = null;
        if (!a) return;
        const b: [number, number] = hit ? [hit.x, hit.y] : a;
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
    juice.current ??= new Juice(() => renderer.current, sound);
    painter.current = new BrushPainter({
      renderer: r,
      W: infoRef.current.W,
      H: infoRef.current.H,
      heights: () => mirror.current.heights,
      terrain: () => terrain.current,
      settings: () => ({ ...brushRef.current, tool: brushToolRef.current ?? "raise" }),
      commit: (stroke, pre, protect) => {
        terrain.current = { ...terrain.current, pre, protect };
        localUndo.current.push(stroke);
        localRedo.current = [];
        hintJob.current++;
        setStartHint(null);
        const done = sendTerrain(() => api.apply({ op: "brush", params: stroke.params }, "user", stroke.label));
        // a Flatten stroke: where its level ground could take the start, once it is on the map
        if (stroke.params.tool === "flatten") void done.then(() => lookForStartRef.current(stroke.params));
      },
      picked: (level, what) => setBrush(what === "stop" ? { ...brushRef.current, stop: level } : { ...brushRef.current, level }),
      keep: () => keptTiles(),
      footprints: () => objectFootprints(),
      select: (hit, ev) => {
        // Ctrl+drag: a rectangle (the Select tool opens with it)
        setSelecting((m) => m ?? "rect");
        void ev;
        void hit;
        return selectTool(selection.current, selectHost(), "rect");
      },
      strength: (value, ev) => {
        setBrush({ ...brushRef.current, strength: value });
        if (ev) flashNote(`strength ${value}`, ev);
      },
      feel: (kind, x, y, size, soft) => feel(kind, x, y, size, soft),
      // F held: the size follows the pointer, saved once it is set (D205)
      resize: (size, ev, done) => {
        setBrush({ ...brushRef.current, size }, done);
        if (ev) flashNote(`size ${size}`, ev);
      },
      // a new stroke puts away the last one's start hint (its water flows while it is painted, D197)
      painting: (on) => {
        if (!on) return;
        hintJob.current++;
        setStartHint(null);
      },
      note: (text, ev) => {
        if (!text) return setShapeNote(null);
        if (ev) notePointer(ev);
        setShapeNote({ text, ok: true, warn: false, ...pointerAt.current });
      },
      wet: (x, y) => (mirror.current.water?.depth[y * infoRef.current.W + x] ?? 0) > 0.05,
      // the water flows on the stroke while it is painted (D197)
      draft: (rect, heights) => void api.draftStroke(rect, transfer(heights, [heights.buffer as ArrayBuffer])),
      cancelDraft: () => void api.cancelDraft(),
    });
    r.onSlice = (level) => setSliceLevel(level);
    r.onMarkers = (on) => setMarkersOn(on);
    setMarkersOn(r.markers);
    r.grab = (hit) => grabSource(hit);
    r.onWheel = (ev, hit) => wheelSource(ev, hit);
    r.onClick = (hit) => {
      if (advancedRef.current && hit) {
        setSelected(null);
        return pickTile(hit.x, hit.y);
      }
      if (!hit) return setSelected(null);
      // a water or badwater source: selected, its strength to change (the water answers live)
      if (sourceAt(hit.x, hit.y)) {
        setSelected(null);
        return pickTile(hit.x, hit.y);
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
      // the handles and the sources' markers follow the view; with none on the map, the page need
      // not redraw
      if (pending || (!handleRef.current && !markerRef.current && !hintRef.current)) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        setViewTick((n) => n + 1);
      });
    };
    setViewTick((n) => n + 1);
  }
  // ------------------------------------------------------------------------------ the Select tool

  function selectHost() {
    return {
      W: infoRef.current.W,
      H: infoRef.current.H,
      heights: () => mirror.current.heights,
      mode: () => selectingRef.current ?? "rect",
      changed: () => setSelectionTick((n) => n + 1),
      drawing: (tiles: number[] | null, words: string | null, ev: PointerEvent | null) => {
        setSelectDraw(tiles);
        if (!words) return setShapeNote(null);
        if (ev) notePointer(ev);
        setShapeNote({ text: words, ok: true, warn: false, ...pointerAt.current });
      },
    };
  }
  // the Select tool takes the map's left button while it is open and no brush is out
  useEffect(() => {
    const r = renderer.current;
    if (!r || !selecting || brushTool) return;
    const t = selectTool(selection.current, selectHost());
    r.tool = t;
    return () => {
      if (r.tool === t) r.tool = null;
    };
  }, [selecting, brushTool, ready]);
  function closeSelect() {
    selection.current.clear();
    setSelecting(null);
    setSelectDraw(null);
    setSelectionTick((n) => n + 1);
  }
  /** The selection's tiles as runs, for an operation. */
  const selectedRuns = () => tilesToRuns(selection.current.tiles(), info.W);
  /** What the Select tool does to the selection: one operation, one undo step each. */
  function selectAction(what: "raise" | "lower" | "flatten" | "dig" | "clear", level?: number) {
    const tiles = selection.current.tiles();
    if (!tiles.length) return;
    const h = mirror.current.heights;
    const cells = selectedRuns();
    const n = tiles.length;
    if (what === "clear") {
      // everything standing there but the start and the sources (the water is theirs)
      const at = entitiesAt();
      const ids: string[] = [];
      void (async () => {
        for (const i of tiles) {
          if (!at.get(i)?.length) continue;
          const list = await enqueue(() => api.entitiesAt(i % info.W, Math.floor(i / info.W)));
          for (const x of list) if (x.template !== "StartingLocation" && x.template !== "WaterSource" && x.template !== "BadwaterSource" && !ids.includes(x.id)) ids.push(x.id);
        }
        if (!ids.length) return setMessage({ kind: "info", text: "Nothing stands there to clear." });
        void run(() => api.apply({ op: "deleteEntities", params: { entities: ids } }, "user", `Clear ${ids.length} object${ids.length > 1 ? "s" : ""}`));
      })();
      return;
    }
    let op: EditOp;
    let label: string;
    if (what === "raise" || what === "lower") {
      op = { op: "sculpt", params: { mode: what, cells, amount: selectAmount } };
      label = `${what === "raise" ? "Raise" : "Lower"} ${n} tiles by ${selectAmount}`;
    } else if (what === "dig") {
      // dig out: down to the selection's lowest ground
      let lo = 99;
      for (const i of tiles) lo = Math.min(lo, h[i]);
      op = { op: "sculpt", params: { mode: "flatten", cells, level: lo } };
      label = `Dig out ${n} tiles to level ${lo}`;
    } else {
      op = { op: "sculpt", params: { mode: "flatten", cells, level: level! } };
      label = `Set ${n} tiles to level ${level}`;
    }
    // the land's answer, at the selection's middle
    let sx = 0;
    let sy = 0;
    for (const i of tiles) {
      sx += i % info.W;
      sy += Math.floor(i / info.W);
    }
    const mid: [number, number] = [Math.round(sx / n), Math.round(sy / n)];
    const size = Math.max(1, Math.sqrt(n) / 2);
    void run(
      () => api.apply(op, "user", label),
      (u) => u.ok && feel(what === "raise" ? "raise" : what === "lower" || what === "dig" ? "lower" : "shape", mid[0], mid[1], size),
    );
  }
  /** The selection's middle level (flatten's default). */
  function selectMedian(): number {
    const h = mirror.current.heights;
    const v = selection.current.tiles().map((i) => h[i]).sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : 0;
  }
  const [flattenTo, setFlattenTo] = useState<number | null>(null);
  function selectRow() {
    if (!selecting && !selection.current.count) return null;
    void selectionTick;
    const z = selection.current.size();
    const level = flattenTo ?? selectMedian();
    return (
      <div class="bar-group">
        <span class="bar-status" role="status">
          {z ? sizeWords(z) : "Select: drag on the map (Shift adds, Alt subtracts)"}
        </span>
        <label>
          Select
          <select aria-label="How to select" value={selecting ?? "rect"} onChange={(e) => setSelecting((e.target as HTMLSelectElement).value as SelectMode)}>
            {SELECT_MODES.map(([v, name]) => (
              <option key={v} value={v}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {z ? (
          <>
            <label>
              by
              <select aria-label="Levels" value={String(selectAmount)} onChange={(e) => setSelectAmount(Number((e.target as HTMLSelectElement).value))}>
                {[1, 2, 3, 4, 5, 6, 8].map((k) => (
                  <option key={k} value={String(k)}>
                    {k} level{k > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => selectAction("raise")}>
              Raise
            </button>
            <button type="button" onClick={() => selectAction("lower")}>
              Lower
            </button>
            <label>
              to level
              <select aria-label="Level" value={String(level)} onChange={(e) => setFlattenTo(Number((e.target as HTMLSelectElement).value))}>
                {Array.from({ length: 17 }, (_, k) => k).map((k) => (
                  <option key={k} value={String(k)}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => selectAction("flatten", level)}>
              Set level
            </button>
            <button type="button" title="Down to the selection's lowest ground" onClick={() => selectAction("dig")}>
              Dig out
            </button>
            <button type="button" title="Trees, bushes, ruins and the other objects there (not the start or the sources)" onClick={() => selectAction("clear")}>
              Clear objects
            </button>
          </>
        ) : null}
        <button type="button" class="linkish" aria-label="Close the selection" title="Close (Esc)" onClick={closeSelect}>
          ×
        </button>
      </div>
    );
  }

  /** The tiles a precise hold never digs out from under (D193): the start's footprint and the
   *  objects standing there (trees and bushes follow the ground), as runs. */
  /** The tiles of each object on more than one tile (a Flatten stroke keeps them level, D204). */
  function objectFootprints(): number[][] {
    const e = mirror.current.entities;
    const W = infoRef.current.W;
    const H = infoRef.current.H;
    const out: number[][] = [];
    for (let k = 0; k < e.count; k++) {
      const template = e.templates[e.template[k]];
      const tl = footprintTiles(template, { template, x: e.x[k], y: e.y[k], z: 0, orientation: ORIENTATION_NAMES[e.orientation[k]] as Orientation, flipped: (e.flags[k] & FLIPPED) !== 0 });
      if (tl.length < 2) continue;
      const g = tl.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y]) => y * W + x);
      if (g.length > 1) out.push(g);
    }
    return out;
  }
  function keptTiles(): [number, number, number][] {
    const e = mirror.current.entities;
    const W = infoRef.current.W;
    const H = infoRef.current.H;
    const tiles: number[] = [];
    for (let k = 0; k < e.count; k++) {
      const template = e.templates[e.template[k]];
      if (/^(Pine|Birch|Oak|Maple|ChestnutTree|Mangrove|Coffee|BlueberryBush|Dandelion|Cattail|Spadderdock|Succulent)/.test(template)) continue;
      const tl = footprintTiles(template, { template, x: e.x[k], y: e.y[k], z: 0, orientation: ORIENTATION_NAMES[e.orientation[k]] as Orientation, flipped: false });
      for (const [x, y] of tl) if (x >= 0 && y >= 0 && x < W && y < H) tiles.push(y * W + x);
    }
    return tilesToRuns([...new Set(tiles)].sort((a, b) => a - b), W);
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
  // level lines while the toggle is on (the brush kit)
  useEffect(() => renderer.current?.setLevelLines(brush.levelLines), [brush.levelLines, ready]);
  // any tool picked makes the water see-through, so the bed and the sources show (D196)
  useEffect(() => renderer.current?.setClearWater(clearWater || !!brushTool || !!tool || !!selecting), [clearWater, brushTool, tool, selecting, ready]);

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

  /** Place a move. */
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
      notePointer(e);
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
      // typing in a field or choosing from a list keeps its keys; a toggle just clicked does not
      const toggle = target?.tagName === "INPUT" && ["checkbox", "radio", "button"].includes((target as HTMLInputElement).type);
      if (target && !toggle && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const mod = ev.ctrlKey || ev.metaKey;
      // the brushes: 1–5 pick one (again: it stays out), [ and ] size it, Esc cancels a stroke,
      // then puts it away
      if (!mod && !ev.altKey && /^[1-5]$/.test(ev.key)) {
        const b = BRUSHES[Number(ev.key) - 1].tool;
        if (painter.current && brushToolRef.current !== b) pickBrush(b);
        return;
      }
      // 6: Source; M: the Select tool
      if (!mod && !ev.altKey && ev.key === "6" && painter.current) {
        pickTop(toolRef.current === "source" ? null : "source");
        return;
      }
      if (!mod && !ev.altKey && ev.key.toLowerCase() === "m") {
        if (selectingRef.current) closeSelect();
        else {
          pickBrush(null);
          setTool(null);
          setSelecting("rect");
        }
        return;
      }
      // { and }: the strength (as Shift+scroll)
      if (!mod && (ev.key === "{" || ev.key === "}") && brushToolRef.current) {
        ev.preventDefault();
        const strength = Math.max(1, Math.min(10, brushRef.current.strength + (ev.key === "}" ? 1 : -1)));
        setBrush({ ...brushRef.current, strength });
        flashNote(`strength ${strength}`);
        return;
      }
      if (!mod && (ev.key === "[" || ev.key === "]") && brushToolRef.current) {
        ev.preventDefault();
        const size = nextSize(brushRef.current.size, ev.key === "]" ? 1 : -1);
        setBrush({ ...brushRef.current, size });
        flashNote(`size ${size}`);
        return;
      }
      // F: hold and move the mouse to size the brush, a click sets it (D205; F does nothing else)
      if (!mod && !ev.altKey && ev.key.toLowerCase() === "f") {
        ev.preventDefault();
        if (!ev.repeat && brushToolRef.current) painter.current?.startResize();
        return;
      }
      if (ev.key === "Escape" && painter.current?.sizing) {
        painter.current.endResize(false);
        return;
      }
      if (ev.key === "Escape" && painter.current?.painting) {
        painter.current.cancel();
        return;
      }
      if (ev.key === "Escape" && sourceGrab.current) {
        sourceGrab.current.cancel();
        return;
      }
      if (ev.key === "Escape" && (selectingRef.current || selection.current.count)) {
        closeSelect();
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
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && pickedSources().length && !target?.classList.contains("handle")) {
        // a selected source: its water recedes live (D196)
        ev.preventDefault();
        removeSources(pickedSources());
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && selectedRef.current && !target?.classList.contains("handle")) {
        const f = infoRef.current.features.find((g) => g.id === selectedRef.current);
        if (f) deleteFeature(f);
      } else if (!mod && !ev.altKey && ev.key.toLowerCase() === "t") {
        // T: clear water, as the game (D196)
        setClearWater((on) => !on);
      }
    };
    // F let go: the size is set
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() === "f") painter.current?.endResize(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
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
      pendingTerrain: () => pendingTerrain.current,
      startHint: () => (startHintRef.current ? { x: startHintRef.current.x, y: startHintRef.current.y, strong: startHintRef.current.strong, ms: hintMs.current } : null),
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
            viewButtons={
              <>
                <button type="button" aria-pressed={clearWater} onClick={() => setClearWater(!clearWater)} title="See through the water to the bed and the sources (T). Any tool picked does it too.">
                  Clear water
                </button>
                <span class="reveal-group">
                  <button type="button" aria-pressed={sound.on} onClick={() => setSound({ ...sound, on: !sound.on })} title="The editor's little sounds: on or off (the volume beside it)">
                    Sound
                  </button>
                  <label class="slider-field reveal" title="Volume">
                    <input type="range" min="0" max="1" step="0.05" aria-label="Sound volume" value={sound.volume} disabled={!sound.on} onInput={(e) => setSound({ ...sound, volume: Number((e.target as HTMLInputElement).value) })} />
                  </label>
                </span>
              </>
            }

            onHover={(hit: TileHit | null) => {
              setHover(hit ? describeTile(ctx(), hit.x, hit.y) : null);
              hoverSources(hit);
              // a source can be picked up and moved
              const canvas = renderer.current?.canvas;
              if (canvas) canvas.style.cursor = hit && !brushToolRef.current && !advancedRef.current && sourceAt(hit.x, hit.y) ? "grab" : "";
              if (draftRef.current.length) setHoverTile(hit ? [hit.x, hit.y] : null);
              if (hit) hoverFit(hit.x, hit.y);
              else {
                fitWant.current = null;
                setFit(null);
              }
            }}
            hoverText={fit && !plan && hover ? `${hover} · ${fit.problem ? `Can't go here: ${plain(fit.problem)}` : "Fits here"}` : hover}
          >
            <TopBar
              active={brushTool}
              source={tool === "source"}
              settings={brush}
              onPick={pickTop}
              onSettings={setBrush}
              loading={!ready}
              sourceOptions={<SourceOptions options={options} onOptions={setOptions} />}
              selectRow={selectRow()}
            />
            {player.current ? <WaterBar player={player.current} follow={follow} onFollow={setFollow} weather={weather} onWeather={toggleWeather} /> : null}
            {sourceMarkers()}
            {startHintTag()}
            {sliceLevel !== null ? (
              <p class="map-note slice-note" role="status">
                Layer {sliceLevel}: the world above it is cut away. Alt+scroll up shows it all.
              </p>
            ) : null}
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
    };
  } catch {
    return DEFAULT_BRUSH;
  }
}

function saveBrush(s: BrushSettings): void {
  try {
    localStorage.setItem(BRUSH_KEY, JSON.stringify({ size: s.size, strength: s.strength }));
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
  return { heights: v.heights, water: surfaceWater(v.W, v.H, v.water), waterView: v.water, mapWater: v.water, entities: v.entities, entitiesAt: null, soil: v.soil };
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
