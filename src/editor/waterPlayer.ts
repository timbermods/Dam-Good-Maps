// The water's journey after an edit, played at a pace the eye can follow (live editing, PLAN §20
// D179 (2), D180 (8)). The worker settles the water as fast as it can and sends a frame every few
// ticks of the game (close together at first, where the water moves most); the page plays them,
// twenty a second at normal speed, so a new channel fills, the water creeps downstream, spills over
// drops and spreads into basins over a few seconds. The last frame is the settled water itself
// (and the export's water after it), so what the player watches ends exactly where the map is. The
// brushes never wait for it: frames only ever change the water shown.
//
// Pause, speed (1×, 2×, 4×), skip to the result and replay (the last journey again, from the water
// right after the edit). A weather run (a drought, then the water coming back) plays the same way.

import type { WaterView } from "../render3d/model";

export interface WaterFrame {
  water: WaterView;
  /** How far the journey has come (0–1), for the status. */
  done: number;
  /** The settled water, with what grows on it: shown last, and then the journey is over. */
  final?: () => void;
  /** A weather run's words ("Drought: day 4 of 9"). */
  words?: string;
}

export interface PlayerHost {
  /** Show a frame's water. */
  show(f: WaterFrame): void;
  /** The player's state changed (for its controls). */
  changed(): void;
}

/** Frames a second at normal speed. */
const FPS = 20;
/** Frames that ease the last of the journey into the settled water. */
const EASE = 16;

/** Water between two frames (t from 0 to 1): each tile's depth and contamination in between, its
 *  floor from the later frame. */
export function blendWater(a: WaterView, b: WaterView, t: number): WaterView {
  const at = new Map<number, number>();
  for (let k = 0; k < a.count; k++) at.set(a.tile[k], k);
  const tiles: number[] = [];
  const floor: number[] = [];
  const depth: number[] = [];
  const contamination: number[] = [];
  const seen = new Set<number>();
  for (let k = 0; k < b.count; k++) {
    const i = b.tile[k];
    seen.add(i);
    const j = at.get(i);
    tiles.push(i);
    floor.push(b.floor[k]);
    depth.push((j === undefined ? 0 : a.depth[j]) * (1 - t) + b.depth[k] * t);
    contamination.push((j === undefined ? b.contamination[k] : a.contamination[j]) * (1 - t) + b.contamination[k] * t);
  }
  for (let k = 0; k < a.count; k++) {
    const i = a.tile[k];
    if (seen.has(i)) continue;
    const d = a.depth[k] * (1 - t);
    if (d <= 0.001) continue;
    tiles.push(i);
    floor.push(a.floor[k]);
    depth.push(d);
    contamination.push(a.contamination[k]);
  }
  return { count: tiles.length, tile: Int32Array.from(tiles), floor: Float32Array.from(floor), depth: Float32Array.from(depth), contamination: Float32Array.from(contamination) };
}

export class WaterPlayer {
  private frames: WaterFrame[] = [];
  /** The frame on screen (−1: none of this journey yet). */
  private at = -1;
  private timer = 0;
  private finished = true;
  paused = false;
  speed = 1;
  /** A weather run is playing (its frames replace the journey's until it ends). */
  weather = false;

  constructor(private readonly host: PlayerHost) {}

  /** A new journey (an edit): its first frame is the water right after the edit. */
  begin(first: WaterFrame | null, weather = false): void {
    this.stopTimer();
    this.frames = first ? [first] : [];
    this.at = first ? 0 : -1;
    this.finished = false;
    this.weather = weather;
    this.host.changed();
  }

  /** A frame of the journey in progress. The settled water may differ from the last frame the
   *  worker's quick settle sent (the exact settle drains thin sheets it left): the journey eases
   *  into it over a few frames instead of jumping. */
  push(f: WaterFrame): void {
    const last = this.frames[this.frames.length - 1];
    this.finished = false;
    if (f.final && last && !this.weather) for (let k = 1; k <= EASE; k++) this.frames.push({ water: blendWater(last.water, f.water, k / (EASE + 1)), done: last.done + ((1 - last.done) * k) / (EASE + 1) });
    this.frames.push(f);
    if (f.final) this.finished = true;
    this.kick();
  }

  /** Whether frames are still to come or to show. */
  get playing(): boolean {
    return !this.finished || this.at < this.frames.length - 1;
  }

  /** How far along the frames on screen are (0–1), or null when nothing is playing. */
  get progress(): number | null {
    if (!this.playing) return null;
    return this.at >= 0 ? this.frames[this.at].done : 0;
  }

  /** The words of the frame on screen (a weather run's day), if any. */
  get words(): string | null {
    return this.at >= 0 ? (this.frames[this.at].words ?? null) : null;
  }

  /** Whether there is a journey to end (an edit's water shown or on its way). */
  get hasJourney(): boolean {
    return this.frames.length > 0 && !this.weather;
  }

  get canReplay(): boolean {
    return this.frames.length > 1 && !this.playing;
  }

  pause(on: boolean): void {
    this.paused = on;
    if (on) this.stopTimer();
    else this.kick();
    this.host.changed();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.host.changed();
  }

  /** Straight to the latest water there is (the result, once it has come). */
  skip(): void {
    this.stopTimer();
    if (!this.frames.length) return;
    // the final frame must be shown whole (its callback puts the plants in place)
    const last = this.frames.length - 1;
    for (let k = this.at + 1; k <= last; k++) if (this.frames[k].final && k !== last) this.frames[k].final!();
    this.at = last;
    this.show(this.frames[last]);
    this.host.changed();
  }

  /** The last journey again, from the water right after its edit. */
  replay(): void {
    if (this.frames.length < 2) return;
    this.stopTimer();
    this.at = 0;
    this.paused = false;
    this.show(this.frames[0]);
    this.kick();
    this.host.changed();
  }

  /** Forget the journey (a map opened, a weather run stopped). */
  clear(): void {
    this.stopTimer();
    this.frames = [];
    this.at = -1;
    this.finished = true;
    this.weather = false;
    this.host.changed();
  }

  private show(f: WaterFrame): void {
    this.host.show(f);
    if (f.final) f.final();
  }

  private kick(): void {
    if (this.timer || this.paused) return;
    if (this.at >= this.frames.length - 1) {
      this.host.changed();
      return;
    }
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (this.paused) return;
      // behind the worker by more than a few seconds: catch up a little faster
      const behind = this.frames.length - 1 - this.at;
      const step = Math.max(1, Math.floor(behind / (FPS * 6)));
      this.at = Math.min(this.frames.length - 1, this.at + step);
      this.show(this.frames[this.at]);
      this.host.changed();
      this.kick();
    }, 1000 / (FPS * this.speed));
  }

  private stopTimer(): void {
    clearTimeout(this.timer);
    this.timer = 0;
  }
}
