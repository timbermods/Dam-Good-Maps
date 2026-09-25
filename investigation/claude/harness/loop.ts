// The request loop (EDITOR_PLAN §7 "Loop"): the request and the map summary go in; Claude asks
// the tools, dry-runs and proposes; the app answers every tool call; the loop ends on Claude's
// final answer, a refusal, or the budget. The budget grows with the goals Claude declares in its
// first dry_run or propose (harness/prompts.ts budgetFor), up to a ceiling.
//
// Append-only: every assistant turn goes back exactly as it came, and all the tool results of a
// turn go back together in one user message. Route A's 64 KiB input cap is measured every turn.

import type Anthropic from "@anthropic-ai/sdk";
import type { ClaudeTools } from "../lib/tools";
import { TOOL_DEFS } from "../lib/tools";
import type { ClaudeBridge } from "./bridge";
import { BUDGET_SPENT, budgetFor, firstMessage } from "./prompts";

export const ARTIFACT_INPUT_LIMIT = 64 * 1024;

export interface LoopResult {
  stop: "answered" | "refusal" | "max_tokens" | "budget" | "turns" | "input-too-large" | "error";
  report: string;
  proposals: { accepted: boolean; result: Record<string, unknown>; report: string }[];
  toolCalls: { name: string; bytes: number; error: boolean; overBudget: boolean }[];
  rounds: number;
  goalsDeclared: number;
  budget: { rounds: number; calls: number };
  turns: number;
  inputBytesMax: number;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  refusal?: { category: string | null; explanation: string | null };
  error?: string;
}

export interface LoopOptions {
  /** Stop when the input would pass the artifact's 64 KiB (route A); the API route only records it. */
  artifactLimits?: boolean;
  maxTurns?: number;
  selected?: string | null;
  onTurn?: (turn: number, blocks: unknown[]) => void;
}

function textOf(content: readonly { type: string; text?: string }[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
}

export async function runLoop(bridge: ClaudeBridge, tools: ClaudeTools, request: string, opts: LoopOptions = {}): Promise<LoopResult> {
  let budget = budgetFor(1);
  const res: LoopResult = { stop: "answered", report: "", proposals: [], toolCalls: [], rounds: 0, goalsDeclared: 0, budget, turns: 0, inputBytesMax: 0, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  const first = firstMessage(request, tools.summary(), budget, opts.selected);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: first.map((b) => ({ type: "text" as const, text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) })) },
  ];
  const maxTurns = opts.maxTurns ?? 40;
  for (let turn = 0; turn < maxTurns; turn++) {
    const bytes = JSON.stringify({ messages, tools: TOOL_DEFS }).length;
    res.inputBytesMax = Math.max(res.inputBytesMax, bytes);
    if (opts.artifactLimits && bytes > ARTIFACT_INPUT_LIMIT) {
      res.stop = "input-too-large";
      return res;
    }
    let t;
    try {
      t = await bridge.send(messages, TOOL_DEFS);
    } catch (e) {
      res.stop = "error";
      res.error = e instanceof Error ? e.message : String(e);
      return res;
    }
    res.turns++;
    res.usage.input += t.usage.input;
    res.usage.output += t.usage.output;
    res.usage.cacheRead += t.usage.cacheRead;
    res.usage.cacheWrite += t.usage.cacheWrite;
    opts.onTurn?.(turn, t.content);
    messages.push({ role: "assistant", content: t.content as Anthropic.Beta.BetaContentBlockParam[] });
    if (t.stopReason === "refusal") {
      res.stop = "refusal";
      res.refusal = t.refusal;
      res.report = textOf(t.content);
      return res;
    }
    if (t.stopReason === "max_tokens") {
      res.stop = "max_tokens";
      res.report = textOf(t.content);
      return res;
    }
    if (t.stopReason === "pause_turn") continue;
    const uses = t.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) {
      res.report = textOf(t.content) || res.proposals[res.proposals.length - 1]?.report || "";
      return res;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const args = (u.input ?? {}) as Record<string, unknown>;
      const round = u.name === "dry_run" || u.name === "propose";
      // the budget grows with the goals Claude declares, never shrinks
      if (round && Array.isArray(args.goals)) {
        res.goalsDeclared = Math.max(res.goalsDeclared, args.goals.length);
        const b = budgetFor(res.goalsDeclared);
        budget = { rounds: Math.max(budget.rounds, b.rounds), calls: Math.max(budget.calls, b.calls) };
        res.budget = budget;
      }
      const over = res.toolCalls.length >= budget.calls || (round && res.rounds >= budget.rounds);
      if (over) {
        res.toolCalls.push({ name: u.name, bytes: 0, error: true, overBudget: true });
        results.push({ type: "tool_result", tool_use_id: u.id, content: BUDGET_SPENT, is_error: true });
        continue;
      }
      if (round) res.rounds++;
      const c = tools.call(u.name, args);
      res.toolCalls.push({ name: u.name, bytes: c.bytes, error: c.error, overBudget: false });
      if (u.name === "propose" && !c.error) {
        const out = JSON.parse(c.result) as Record<string, unknown>;
        res.proposals.push({ accepted: out.accepted === true, result: out, report: String(args.report ?? "") });
      }
      const note = `\n[budget: rounds ${res.rounds} of ${budget.rounds}, tool calls ${res.toolCalls.length} of ${budget.calls}]`;
      results.push({ type: "tool_result", tool_use_id: u.id, content: c.result + note, ...(c.error ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }
  res.stop = "turns";
  return res;
}
