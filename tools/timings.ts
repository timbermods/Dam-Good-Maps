// Timings against their budgets, as information. Kyler's one rule (PLAN §20 D115, D145): measures
// and numeric budgets are information only; breakage, decided principles and what a player feels
// block, and CI's timing tests are reported numbers that never fail a build. A test or benchmark
// that times something records it here instead of failing on it: the time is printed, and when
// DGM_TIMINGS names a file (CI), appended to it as a JSON line. tools/ci-timings.ts turns that file
// into the job summary, with a warning for each time over its budget.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Timing {
  /** What was timed, in plain words (the test or benchmark and the step). */
  what: string;
  ms: number;
  /** The budget it is compared with (PLAN, ROADMAP), in ms. */
  budget: number;
}

/** Prints and records a timing; true when it is within its budget. */
export function recordTiming(t: Timing): boolean {
  const within = t.ms <= t.budget;
  console.log(`${t.what}: ${Math.round(t.ms)} ms (budget ${t.budget} ms${within ? "" : ", over: reported, not a failure"})`);
  const file = process.env.DGM_TIMINGS;
  if (file) {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ what: t.what, ms: Math.round(t.ms), budget: t.budget })}\n`);
  }
  return within;
}
