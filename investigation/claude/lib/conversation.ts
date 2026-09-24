// What a conversation with the in-app Claude remembers between requests (EDITOR_PLAN §7
// "Follow-ups"): the names Claude gave to what it made, the feature the player selected, and what
// each accepted proposal did, so "make it wider" or "undo the waterfall" find the right feature.

import { guidFrom } from "../../../src/core/math/hash";
import type { RefContext } from "./places";

export interface Made {
  handle: string;
  id: string;
  kind: string;
  /** The request text that made it. */
  request: string;
}

export interface Conversation {
  handles: Record<string, string>;
  selected: string | null;
  last: string | null;
  made: Made[];
  /** Accepted proposals, oldest first: the request and how many undo steps it took. */
  accepted: { text: string; undoSteps: number; handles: string[] }[];
  counter: number;
  seed: number;
}

export function newConversation(seed = 0): Conversation {
  return { handles: {}, selected: null, last: null, made: [], accepted: [], counter: 0, seed };
}

export function refContext(c: Conversation): RefContext {
  return { handles: c.handles, selected: c.selected, last: c.last };
}

/** A fresh feature id (a lowercase GUID, as user and Claude features have, PLAN §19.4). */
export function newId(c: Conversation, what: string): string {
  c.counter++;
  return guidFrom(c.seed, "claude", c.counter, what);
}

/** A handle for a new feature: the one asked for, or kind-N. */
export function newHandle(c: Conversation, kind: string, wanted?: string): string {
  const base = (wanted ?? kind).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "feature";
  if (wanted && !(base in c.handles)) return base;
  let k = 1;
  while (`${base}-${k}` in c.handles) k++;
  return `${base}-${k}`;
}
