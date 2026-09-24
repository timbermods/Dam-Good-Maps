// The Claude request suite (EDITOR_PLAN §9, ROADMAP M12): every request of requests.json, on its
// map, through the Messages API bridge with the same prompts and tools the artifact edition uses;
// graded against the reference solutions.
//
//   cd investigation/claude/harness && npm install
//   ANTHROPIC_API_KEY=… npx tsx investigation/claude/harness/run-suite.ts [--only M01,S01] [--kind compound]
//       [--model claude-opus-5-5] [--effort high] [--artifact-limits] [--judge] [--out file]
//   npx tsx investigation/claude/harness/run-suite.ts --scripted     (no key: replays the reference
//       solutions through the same loop and grader, to test the harness itself)
//
// A request passes when:
// - every goal the corpus marks feasible has all its expectations met on the final map, measured
//   by the app (never by the model's own expectations);
// - no guard that passed before fails after, and nothing was accepted that the reference refuses;
// - the report names every trade-off the app found and every goal not met (keyword check, and the
//   optional judge against the corpus's must-say list), and says none of the must-not-say text.
//
// Not run in the investigation: there is no key in its environment.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { openSetup } from "../lib/fixtures";
import { checkExpectations, valuesBefore } from "../lib/intent";
import { measureSession } from "../lib/metrics";
import { ClaudeTools } from "../lib/tools";
import { substitute, type Corpus, type RequestCase } from "../lib/corpus";
import { MessagesApiBridge, type BridgeTool, type BridgeTurn, type ClaudeBridge } from "./bridge";
import { runLoop, type LoopResult } from "./loop";
import { judgePrompt } from "./prompts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const corpus = JSON.parse(readFileSync(join(root, "requests.json"), "utf8")) as Corpus;

// --------------------------------------------------------------------------- the scripted bridge

/** Plays the reference solution as if it were the model: the reference calls, the proposal, then
 *  the app's own draft as the report. Tests the loop and the grader without an API key. */
export class ScriptedBridge implements ClaudeBridge {
  readonly route = "api" as const;
  private step = 0;
  private results: unknown[] = [];
  constructor(private r: RequestCase) {}
  async send(messages: Anthropic.Beta.BetaMessageParam[], _tools: BridgeTool[]): Promise<BridgeTurn> {
    void _tools;
    // read the last tool result back, for "$N.path" references
    const last = messages[messages.length - 1];
    if (last.role === "user" && Array.isArray(last.content)) {
      for (const b of last.content) if (b.type === "tool_result" && typeof b.content === "string") this.results.push(JSON.parse(b.content.replace(/\n\[budget:[^\]]*\]$/, "")));
    }
    const calls = this.r.reference.calls;
    const turn = (content: Anthropic.Beta.BetaContentBlock[], stop: string): BridgeTurn => ({ content, stopReason: stop, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, model: "scripted" });
    const use = (name: string, input: unknown): Anthropic.Beta.BetaContentBlock => ({ type: "tool_use", id: `toolu_${this.step}`, name, input, caller: { type: "direct" } } as unknown as Anthropic.Beta.BetaContentBlock);
    if (this.step < calls.length) {
      const c = calls[this.step++];
      return turn([use(c.tool, substitute(c.args, this.results))], "tool_use");
    }
    if (this.step === calls.length && this.r.reference.proposal) {
      this.step++;
      const p = this.r.reference.proposal;
      return turn([use("propose", { request: this.r.text, goals: this.r.goals.map((g) => ({ id: g.id, text: g.text })), steps: substitute(p.steps, this.results), expectations: this.r.goals.flatMap((g) => g.expect.map((e) => ({ ...e, goal: g.id }))), report: "(scripted: the app's draft follows)" })], "tool_use");
    }
    const draft = (this.results[this.results.length - 1] as { draftReport?: string } | undefined)?.draftReport ?? "(no proposal: answered from the tools)";
    return turn([{ type: "text", text: draft, citations: null } as unknown as Anthropic.Beta.BetaContentBlock], "end_turn");
  }
}

// ------------------------------------------------------------------------------------ grading

const TRADEOFF_WORDS: Record<string, RegExp> = {
  "badwater-poisons-reservoir": /badwater.*(reservoir|dam)|(reservoir|dam).*badwater/i,
  "less-flow": /(fill|slower|weaker|less water|trickle)/i,
  guard: /(start|rule|berr|tree|water)/i,
  reduced: /(reduc|narrow|smaller|lower|at most|widest|limit)/i,
  "map-wide": /(whole map|map-wide|everywhere|entire map|all of the map)/i,
};

export interface Graded {
  id: string;
  kind: string;
  pass: boolean;
  failures: string[];
  loop: Omit<LoopResult, "proposals"> & { proposals: { accepted: boolean }[] };
  judge?: unknown;
}

async function grade(r: RequestCase, bridgeFor: () => ClaudeBridge, opts: { artifactLimits: boolean; judge: ClaudeBridge | null }): Promise<Graded> {
  const failures: string[] = [];
  const o = openSetup(corpus.setups, r.setup);
  const before = measureSession(o.session);
  // the values "change" expectations compare with, read before Claude touches the map (on a copy
  // of the conversation, so reading "the lake" leaves no alias behind)
  const wasByGoal = new Map(r.goals.map((g) => [g.id, valuesBefore(o.session, structuredClone(o.conv), before, g.expect)]));
  const tools = new ClaudeTools(o.session, o.conv);
  const loop = await runLoop(bridgeFor(), tools, r.text, { artifactLimits: opts.artifactLimits, selected: o.conv.selected });
  if (loop.stop !== "answered") failures.push(`the loop stopped: ${loop.stop}${loop.error ? ` (${loop.error})` : ""}`);
  const after = measureSession(o.session);
  const accepted = loop.proposals.filter((p) => p.accepted);
  const madeIds = new Set(accepted.flatMap((p) => ((p.result.steps as { made?: string[] }[]) ?? []).flatMap((s) => s.made ?? [])).map((h) => o.conv.handles[h]));
  const made = o.conv.made.filter((m) => madeIds.has(m.id));
  // goals, measured by the app on the final map
  const wantAccepted = r.reference.proposal ? (r.reference.expect?.accepted ?? true) : false;
  if (!wantAccepted && accepted.length && r.feasible === "no") failures.push("a proposal was accepted for a request that cannot be done");
  const unmet = new Set(r.reference.expect?.notMet ?? []);
  if (wantAccepted) {
    for (const g of r.goals) {
      if (!g.expect.length || unmet.has(g.id)) continue;
      const checks = checkExpectations(o.session, o.conv, before, after, g.expect, made, wasByGoal.get(g.id));
      for (const c of checks) if (!c.pass) failures.push(`goal ${g.id} (${g.text}): ${c.subject} ${c.metric} ${c.why}`);
    }
  }
  // guards
  const was = new Map(before.guards.map((g) => [g.id, g.ok]));
  const broken = after.guards.filter((g) => !g.ok && g.applicable && was.get(g.id) !== false);
  if (broken.length) failures.push(`guards broken: ${broken.map((g) => g.id).join(", ")}`);
  // the report
  const report = loop.report;
  if (!report.trim()) failures.push("no report");
  const last = accepted[accepted.length - 1]?.result;
  if (last) {
    for (const k of (last.tradeoffKinds as string[]) ?? []) if (TRADEOFF_WORDS[k] && !TRADEOFF_WORDS[k].test(report)) failures.push(`the report does not name the ${k} trade-off`);
    for (const n of (last.notMet as { text: string }[]) ?? []) if (!/not|couldn|can't|cannot|unable|instead|offer/i.test(report)) failures.push(`the report does not say "${n.text}" was not met`);
  }
  for (const bad of r.report.mustNotSay ?? []) if (report.toLowerCase().includes(bad.toLowerCase())) failures.push(`the report says "${bad}"`);
  let judged: unknown;
  if (opts.judge) {
    const facts = JSON.stringify({ proposals: loop.proposals.map((p) => ({ accepted: p.accepted, tradeoffs: p.result.tradeoffs, notMet: p.result.notMet, measured: p.result.measured, draft: p.result.draftReport })) }).slice(0, 30000);
    const t = await opts.judge.send([{ role: "user", content: judgePrompt(r.text, facts, r.report.mustSay, report) }], []);
    const text = t.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    try {
      judged = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if ((judged as { accurate?: boolean }).accurate === false) failures.push("the judge found the report inaccurate");
    } catch {
      judged = text;
    }
  }
  return { id: r.id, kind: r.kind, pass: failures.length === 0, failures, loop: { ...loop, proposals: loop.proposals.map((p) => ({ accepted: p.accepted })) }, ...(judged ? { judge: judged } : {}) };
}

// ------------------------------------------------------------------------------------- main

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const opt = (k: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
  const only = opt("--only")?.split(",");
  const kind = opt("--kind");
  const scripted = argv.includes("--scripted");
  const cases = corpus.requests.filter((r) => (!only || only.includes(r.id)) && (!kind || r.kind === kind));
  const api = () => new MessagesApiBridge({ model: opt("--model"), effort: (opt("--effort") as "high" | undefined) ?? "high" });
  const judge = argv.includes("--judge") && !scripted ? new MessagesApiBridge({ model: opt("--judge-model") ?? "claude-sonnet-5", effort: "medium" }) : null;
  const out: Graded[] = [];
  for (const r of cases) {
    const g = await grade(r, scripted ? () => new ScriptedBridge(r) : api, { artifactLimits: argv.includes("--artifact-limits"), judge });
    out.push(g);
    console.log(`${g.pass ? "PASS" : "FAIL"} ${r.id.padEnd(5)} ${r.kind.padEnd(16)} rounds ${g.loop.rounds}/${g.loop.budget.rounds} calls ${g.loop.toolCalls.length}/${g.loop.budget.calls} input ${Math.round(g.loop.inputBytesMax / 1024)} KiB ${g.pass ? "" : g.failures.join(" | ").slice(0, 300)}`);
  }
  const passed = out.filter((g) => g.pass).length;
  const byKind: Record<string, [number, number]> = {};
  for (const g of out) {
    const k = (byKind[g.kind] ??= [0, 0]);
    k[1]++;
    if (g.pass) k[0]++;
  }
  console.log(`\n${passed}/${out.length} pass`, byKind);
  const file = opt("--out") ?? join(root, "out", `suite-${scripted ? "scripted" : "api"}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ran: new Date().toISOString(), scripted, passed, total: out.length, byKind, results: out }, null, 1));
  if (passed < out.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
