// The water's time controls over the map (live editing, PLAN §20 D180 (8)): pause, speed, skip to
// the result, replay the last journey, follow the water with the camera, and a drought to watch.
// Built from the shared bar and button styles (D176).

import type { WaterPlayer } from "./waterPlayer";

export interface WaterBarProps {
  player: WaterPlayer;
  /** The camera follows where the water moves most. */
  follow: boolean;
  onFollow(on: boolean): void;
  /** A drought is playing: stop it (the map's own water comes back at once). */
  drought: boolean;
  onDrought(on: boolean): void;
}

const SPEEDS = [1, 2, 4];

export function WaterBar({ player: p, follow, onFollow, drought, onDrought }: WaterBarProps) {
  const progress = p.progress;
  const status = p.words ?? (progress !== null ? `Water flowing… ${Math.round(progress * 100)}%` : "Water settled");
  return (
    <div class="map-bar water-bar" role="toolbar" aria-label="Water time">
      <span class="bar-status" role="status">
        {status}
      </span>
      <button type="button" class="icon-button" aria-pressed={p.paused} title={p.paused ? "Play the water" : "Pause the water"} onClick={() => p.pause(!p.paused)}>
        <span class="icon-word">{p.paused ? "Play" : "Pause"}</span>
      </button>
      <button type="button" class="icon-button" title="The water's speed" aria-label={`Speed ${p.speed}×`} onClick={() => p.setSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length])}>
        <span class="icon-word">{p.speed}×</span>
      </button>
      <button type="button" class="icon-button" title="Skip to where the water settles" disabled={progress === null} onClick={() => p.skip()}>
        <span class="icon-word">Skip</span>
      </button>
      <button type="button" class="icon-button" title="Watch the last change's water again" disabled={!p.canReplay} onClick={() => p.replay()}>
        <span class="icon-word">Replay</span>
      </button>
      <button type="button" class="icon-button" aria-pressed={follow} title="The camera follows the water" onClick={() => onFollow(!follow)}>
        <span class="icon-word">Follow</span>
      </button>
      <button type="button" class="icon-button" aria-pressed={drought} title={drought ? "End the drought: the water as the map has it" : "Watch a drought: the sources stop, the water drains and dries, then comes back"} onClick={() => onDrought(!drought)}>
        <span class="icon-word">Drought</span>
      </button>
    </div>
  );
}
