// The brush bar (live editing): a compact bar over the map with the five terrain brushes as icons,
// and, while one is out, its size, its strength, flatten's level and the water option. Every
// button says its shortcut. The first time a brush comes out, one line says how to paint.

import { useState } from "preact/hooks";
import { BRUSHES, SIZE_MAX, SIZE_MIN, type BrushSettings, type BrushTool } from "./brushes";

const HINT_KEY = "dgm.brushHint";

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "seen";
  } catch {
    return false;
  }
}

function seeHint(): void {
  try {
    localStorage.setItem(HINT_KEY, "seen");
  } catch {
    // the hint shows again next time
  }
}

/** The brushes' icons: an arrow up, an arrow down, a level line, a wave, a weathered peak. */
function Icon({ tool }: { tool: BrushTool }) {
  const common = { width: 20, height: 20, viewBox: "0 0 20 20", "aria-hidden": "true" as const, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const };
  switch (tool) {
    case "raise":
      return (
        <svg {...common}>
          <path d="M3 16h14M10 13V4M6 8l4-4 4 4" />
        </svg>
      );
    case "lower":
      return (
        <svg {...common}>
          <path d="M3 4h14M10 7v9M6 12l4 4 4-4" />
        </svg>
      );
    case "flatten":
      return (
        <svg {...common}>
          <path d="M2 10h16M4 6l2 2M16 6l-2 2M4 14l2-2M16 14l-2-2" />
        </svg>
      );
    case "smooth":
      return (
        <svg {...common}>
          <path d="M2 12c2.5-5 5-5 8 0s5.5 5 8 0" />
        </svg>
      );
    case "naturalize":
      return (
        <svg {...common}>
          <path d="M2 16l4-6 2 2 3-6 3 4 2-2 2 8" />
        </svg>
      );
  }
}

export interface BrushBarProps {
  /** The brush out, or null. */
  active: BrushTool | null;
  settings: BrushSettings;
  onPick(tool: BrushTool | null): void;
  onSettings(s: BrushSettings): void;
  /** The map is still loading: the brushes wait until they can paint. */
  loading?: boolean;
}

export function BrushBar(p: BrushBarProps) {
  const [hint, setHint] = useState(() => !hintSeen());
  const s = p.settings;
  const set = (patch: Partial<BrushSettings>) => p.onSettings({ ...s, ...patch });
  return (
    <div class="brush-bar-wrap">
      <div class="map-bar" role="toolbar" aria-label="Terrain brushes">
        {BRUSHES.map((b) => (
          <button
            type="button"
            key={b.tool}
            class="icon-button"
            aria-pressed={p.active === b.tool}
            aria-label={`${b.name} brush (${b.key})`}
            title={p.loading ? "The map is still loading" : `${b.name} (${b.key}): ${b.hint}`}
            disabled={p.loading}
            onClick={() => p.onPick(p.active === b.tool ? null : b.tool)}
          >
            <Icon tool={b.tool} />
            <span class="icon-word">{b.name}</span>
          </button>
        ))}
        {p.active ? (
          <div class="bar-group">
            <label class="slider-field" title="Brush size ([ and ])">
              Size
              <input type="range" min={SIZE_MIN} max={SIZE_MAX} step={0.5} value={s.size} aria-valuetext={`${s.size} tiles`} onInput={(e) => set({ size: Number((e.target as HTMLInputElement).value) })} />
              <output>{s.size}</output>
            </label>
            <label class="slider-field" title="Strength (Shift+wheel)">
              Strength
              <input type="range" min={1} max={10} step={1} value={s.strength} onInput={(e) => set({ strength: Number((e.target as HTMLInputElement).value) })} />
              <output>{s.strength}</output>
            </label>
            {p.active === "flatten" ? (
              <label class="slider-field" title="The level it flattens to: Ctrl+click the map to pick one">
                Level
                <select value={s.level === null ? "start" : String(s.level)} onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  set({ level: v === "start" ? null : Number(v) });
                }}>
                  <option value="start">Where I start</option>
                  {Array.from({ length: 17 }, (_, k) => k).map((k) => (
                    <option key={k} value={String(k)}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      {p.active && hint ? (
        <p class="map-note" role="status">
          Drag to paint. Right-drag moves the view. Shift inverts, [ ] sizes, Ctrl+Z undoes.{" "}
          <button
            type="button"
            class="linkish"
            aria-label="Dismiss the hint"
            onClick={() => {
              seeHint();
              setHint(false);
            }}
          >
            ×
          </button>
        </p>
      ) : null}
    </div>
  );
}
