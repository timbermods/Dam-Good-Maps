// The request corpus's format (requests.json) and the checks that grade a run against it. The
// reference solutions (every request's `reference`) are the grading key for M12: the same checks
// grade the reference run here and the model's run in the harness.

import type { Expectation } from "./intent";
import type { Setup } from "./fixtures";
import type { Goal } from "./compound";
import type { Step } from "./steps";

export type Kind =
  | "suite"
  | "simple"
  | "followup"
  | "compass"
  | "feature-relative"
  | "flow-relative"
  | "words"
  | "compound"
  | "vague"
  | "impossible"
  | "conflicting"
  | "question"
  | "safety"
  | "workshop";

export interface Check {
  /** "summary", "call:N" (the Nth reference call), "propose", or "final" (the map after). */
  on: string;
  /** A dot path into the JSON ("sites.0.measured.reservoir", "notMet.length"). */
  path: string;
  op: "exists" | "missing" | "equals" | "min" | "max" | "includes" | "matches" | "true" | "false";
  value?: unknown;
  why?: string;
}

export interface RequestCase {
  id: string;
  kind: Kind;
  /** The player's words, exactly. */
  text: string;
  setup: string;
  /** Goals, each with the measurable expectations behind it (intent-check format). */
  goals: (Goal & { expect: Expectation[] })[];
  /** yes: every goal can be met; partly: some goals meet a limit or a conflict; no: none can. */
  feasible: "yes" | "partly" | "no";
  /** Whether today's operations can express the request (see `needs` when not). */
  expressible: boolean;
  needs?: string[];
  /** What the final report must say (facts, trade-offs, unmet goals and their alternatives). */
  report: { mustSay: string[]; mustNotSay?: string[] };
  /** The request passes when all of these hold (plain words; the machine checks are in reference). */
  pass: string[];
  reference: {
    calls: { tool: string; args: Record<string, unknown> }[];
    proposal?: { goals?: Goal[]; steps: Step[]; expectations?: Expectation[] };
    /** accepted (default: true when there is a proposal), goals expected unmet, trade-off kinds. */
    expect?: { accepted?: boolean; notMet?: string[]; tradeoffs?: string[]; allExpectations?: boolean };
    checks?: Check[];
  };
  note?: string;
}

export interface Corpus {
  version: 1;
  generated: string;
  about: string;
  setups: Record<string, Setup>;
  requests: RequestCase[];
}

export function at(o: unknown, path: string): unknown {
  if (!path) return o;
  let cur: unknown = o;
  for (const k of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (k === "length" && (Array.isArray(cur) || typeof cur === "string")) return (cur as unknown[]).length;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function runCheck(c: Check, sources: Record<string, unknown>): { pass: boolean; actual: unknown } {
  const v = at(sources[c.on], c.path);
  switch (c.op) {
    case "exists":
      return { pass: v !== undefined && v !== null, actual: v };
    case "missing":
      return { pass: v === undefined || v === null || (Array.isArray(v) && v.length === 0), actual: v };
    case "equals":
      return { pass: JSON.stringify(v) === JSON.stringify(c.value), actual: v };
    case "min":
      return { pass: typeof v === "number" && v >= Number(c.value), actual: v };
    case "max":
      return { pass: typeof v === "number" && v <= Number(c.value), actual: v };
    case "includes":
      return { pass: JSON.stringify(v ?? "").toLowerCase().includes(String(c.value).toLowerCase()), actual: typeof v === "string" ? v.slice(0, 200) : JSON.stringify(v)?.slice(0, 200) };
    case "matches":
      return { pass: new RegExp(String(c.value), "i").test(typeof v === "string" ? v : JSON.stringify(v ?? "")), actual: typeof v === "string" ? v.slice(0, 200) : JSON.stringify(v)?.slice(0, 200) };
    case "true":
      return { pass: v === true, actual: v };
    case "false":
      return { pass: v === false, actual: v };
  }
}

/** Replace "$N.path" strings in call arguments by values from earlier results. */
export function substitute(args: unknown, results: unknown[]): unknown {
  if (typeof args === "string") {
    const m = /^\$(\d+)\.(.+)$/.exec(args);
    if (m) return at(results[Number(m[1])], m[2]);
    return args;
  }
  if (Array.isArray(args)) return args.map((a) => substitute(a, results));
  if (args && typeof args === "object") return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, substitute(v, results)]));
  return args;
}
