// The 3D view on the page (PLAN §14.2, EDITOR_PLAN §4): the shared renderer on a canvas, with the
// view buttons (orbit, top-down, reset, height colours, markers), a compass that always shows
// north, the hover readout and a legend of what the colours mean (Map look, D86). The view is
// clean by default, close to the game; **Markers** turns on the information layer (dam sites,
// slope arrows, level lines, small far-off objects drawn larger), and so does a tool that needs it.
// The generator's 3D preview and the editor both use it; the editor puts its handles on top.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { MapRenderer, type BuildStats, type MapView, type TileHit, type ViewMode } from "../render3d";
import { legendEntries, objectLegend, type GroundMode, type LegendEntry } from "../render3d/palette";

declare global {
  interface Window {
    /** Test hook: the 3D view on the page (tests/e2e). */
    dgm3d?: { renderer: MapRenderer; build: BuildStats };
  }
}

export interface View3DProps {
  view: MapView;
  label: string;
  onReady?(r: MapRenderer, stats: BuildStats): void;
  onHover?(hit: TileHit | null): void;
  hoverText?: string | null;
  /** More legend lines for what the page draws on the map (a dam site, say; `markers` for the
   *  lines that show only with **Markers** on). */
  legendExtra?: LegendEntry[];
  /** Turn **Markers** on while true (a tool that needs them, or a layer the player turned on). */
  markersWanted?: boolean;
  /** Whether the legend starts open (the editor starts it closed, to keep its map clear). */
  legendOpen?: boolean;
  children?: ComponentChildren;
  /** Extra class on the frame (the editor fills its area). */
  class?: string;
}

const GROUND_KEY = "dgm.groundColours";

/** The ground colours the viewer last chose (moisture unless they chose height). */
function savedGround(): GroundMode {
  try {
    return localStorage.getItem(GROUND_KEY) === "height" ? "height" : "moisture";
  } catch {
    return "moisture";
  }
}

function saveGround(mode: GroundMode): void {
  try {
    localStorage.setItem(GROUND_KEY, mode);
  } catch {
    // the choice lasts for this view only
  }
}

const MARKERS_KEY = "dgm.markers";

/** Whether the viewer last turned **Markers** on (off unless they did). */
function savedMarkers(): boolean {
  try {
    return localStorage.getItem(MARKERS_KEY) === "on";
  } catch {
    return false;
  }
}

function saveMarkers(on: boolean): void {
  try {
    localStorage.setItem(MARKERS_KEY, on ? "on" : "off");
  } catch {
    // the choice lasts for this view only
  }
}

export function View3D(props: View3DProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const [mode, setMode] = useState<ViewMode>("orbit");
  const [ground, setGround] = useState<GroundMode>(savedGround);
  const [markers, setMarkers] = useState<boolean>(() => savedMarkers() || !!props.markersWanted);
  const [error, setError] = useState<string | null>(null);
  const onHover = useRef(props.onHover);
  onHover.current = props.onHover;

  useEffect(() => {
    let r: MapRenderer;
    try {
      r = new MapRenderer(canvas.current!);
    } catch (e) {
      setError("The 3D view needs WebGL, which this browser has turned off. The 2D view still works.");
      console.warn(e);
      return;
    }
    renderer.current = r;
    r.setGroundMode(ground);
    r.setMarkers(markers);
    r.onHover = (hit) => onHover.current?.(hit);
    r.onView = (v) => {
      const el = compass.current;
      if (el) el.style.transform = `rotate(${v.mode === "top" ? 0 : (v.yaw * 180) / Math.PI}deg)`;
    };
    return () => {
      renderer.current = null;
      if (window.dgm3d?.renderer === r) delete window.dgm3d;
      r.dispose();
    };
  }, []);

  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    const stats = r.setMap(props.view);
    setMode("orbit");
    r.setMode("orbit");
    window.dgm3d = { renderer: r, build: stats };
    props.onReady?.(r, stats);
  }, [props.view]);

  const pick = (m: ViewMode) => {
    setMode(m);
    renderer.current?.setMode(m);
  };

  // a tool or layer that needs the markers turns them on; when it is done, the viewer's own choice
  // comes back
  const wanted = !!props.markersWanted;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const on = wanted || savedMarkers();
    setMarkers(on);
    renderer.current?.setMarkers(on);
  }, [wanted]);

  const toggleMarkers = () => {
    const next = !markers;
    setMarkers(next);
    saveMarkers(next);
    renderer.current?.setMarkers(next);
  };

  const toggleGround = () => {
    const next: GroundMode = ground === "height" ? "moisture" : "height";
    setGround(next);
    saveGround(next);
    renderer.current?.setGroundMode(next);
  };

  const all = [...legendEntries(ground), ...objectLegend(), ...(props.legendExtra ?? [])];
  const clean = all.filter((e) => !e.markers);
  const marked = all.filter((e) => e.markers);
  const item = (e: LegendEntry) => (
    <li key={e.label}>
      <span class="swatch" style={{ background: e.swatch }} aria-hidden="true" />
      {e.label}
    </li>
  );

  return (
    <div class={`view3d ${props.class ?? ""}`}>
      <canvas ref={canvas} aria-label={props.label} />
      {error ? <p class="view3d-error">{error}</p> : null}
      <div class="view3d-controls" role="group" aria-label="Camera">
        <button type="button" aria-pressed={mode === "orbit"} onClick={() => pick("orbit")} title="Drag to turn, right-drag to move, wheel to zoom">
          Orbit
        </button>
        <button type="button" aria-pressed={mode === "top"} onClick={() => pick("top")} title="North up. Drag to move, wheel to zoom">
          Top-down
        </button>
        <button type="button" onClick={() => renderer.current?.resetView()}>
          Reset view
        </button>
        <button type="button" aria-pressed={ground === "height"} onClick={toggleGround} title="Colour the ground by height instead of by soil">
          Height colours
        </button>
        <button type="button" aria-pressed={markers} onClick={toggleMarkers} title="Show dam sites, slope arrows and a line at every level, and draw small far-off objects larger">
          Markers
        </button>
      </div>
      <div class="compass" aria-label="Compass: north is the top of the top-down view" role="img">
        <div ref={compass} class="needle">
          <span>N</span>
        </div>
      </div>
      {error ? null : (
        <details class="view3d-legend" open={props.legendOpen ?? true}>
          <summary>Legend</summary>
          <ul>{clean.map(item)}</ul>
          <p class="legend-head">
            With <b>Markers</b> on:
          </p>
          <ul>{marked.map(item)}</ul>
          <p class="note">From afar, dead trees, slope arrows and the start are drawn larger, and dam sites wider.</p>
        </details>
      )}
      {props.hoverText ? (
        <div class="readout" role="status">
          {props.hoverText}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
