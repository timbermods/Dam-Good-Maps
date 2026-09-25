// The 3D view on the page (PLAN §14.2, EDITOR_PLAN §4): the shared renderer on a canvas, with the
// view buttons (orbit, top-down, reset, height colours), a compass that always shows north, the
// hover readout and a legend of what the colours mean (Map look, D86). The generator's 3D preview
// and the editor both use it; the editor puts its handles on top.

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
  /** More legend lines for what the page draws on the map (a dam site, say). */
  legendExtra?: LegendEntry[];
  /** Whether the legend starts open (the editor starts it closed, to keep its map clear). */
  legendOpen?: boolean;
  children?: ComponentChildren;
  /** Extra class on the frame (the editor fills its area). */
  class?: string;
}

function backgroundColor(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--map-bg").trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  return m ? parseInt(m[1], 16) : 0xe9dfc8;
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

export function View3D(props: View3DProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const [mode, setMode] = useState<ViewMode>("orbit");
  const [ground, setGround] = useState<GroundMode>(savedGround);
  const [error, setError] = useState<string | null>(null);
  const onHover = useRef(props.onHover);
  onHover.current = props.onHover;

  useEffect(() => {
    let r: MapRenderer;
    try {
      r = new MapRenderer(canvas.current!, backgroundColor());
    } catch (e) {
      setError("The 3D view needs WebGL, which this browser has turned off. The 2D view still works.");
      console.warn(e);
      return;
    }
    renderer.current = r;
    r.setGroundMode(ground);
    r.onHover = (hit) => onHover.current?.(hit);
    r.onView = (v) => {
      const el = compass.current;
      if (el) el.style.transform = `rotate(${v.mode === "top" ? 0 : (v.yaw * 180) / Math.PI}deg)`;
    };
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const recolor = () => r.setBackground(backgroundColor());
    media?.addEventListener?.("change", recolor);
    return () => {
      media?.removeEventListener?.("change", recolor);
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

  const toggleGround = () => {
    const next: GroundMode = ground === "height" ? "moisture" : "height";
    setGround(next);
    saveGround(next);
    renderer.current?.setGroundMode(next);
  };

  const legend = [...legendEntries(ground), ...objectLegend(), ...(props.legendExtra ?? [])];

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
      </div>
      <div class="compass" aria-label="Compass: north is the top of the top-down view" role="img">
        <div ref={compass} class="needle">
          <span>N</span>
        </div>
      </div>
      {error ? null : (
        <details class="view3d-legend" open={props.legendOpen ?? true}>
          <summary>Legend</summary>
          <ul>
            {legend.map((e) => (
              <li key={e.label}>
                <span class="swatch" style={{ background: e.swatch }} aria-hidden="true" />
                {e.label}
              </li>
            ))}
          </ul>
          <p class="note">From afar, dead trees, slope arrows and the start are drawn larger.</p>
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
