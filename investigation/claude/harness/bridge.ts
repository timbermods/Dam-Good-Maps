// ClaudeBridge (EDITOR_PLAN §7 "Recommendation"): one interface, two adapters.
// - MessagesApiBridge: route B and the request suite in Node, over the official TypeScript SDK.
//   In the browser the same code runs with `dangerouslyAllowBrowser: true` (the SDK sends the
//   anthropic-dangerous-direct-browser-access header the M3 spike proved).
// - The artifact adapter (route A) wraps the runtime's `sample` capability: it takes the same
//   messages and tools, runs the page functions itself, and has no system prompt, a 64 KiB input
//   cap and a 32 KB tool-result cap. Its shape is sketched at the end; it can only run inside a
//   published artifact.
//
// Thinking: the default model (claude-opus-5-5, PLAN §20 D8) always thinks, and its thinking blocks
// belong to the conversation that made them, so the loop is append-only: every response is sent
// back unchanged, and nothing earlier in the history is ever edited.

import Anthropic from "@anthropic-ai/sdk";

export interface BridgeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface BridgeTurn {
  /** The assistant's content blocks, exactly as returned: send them back unchanged. */
  content: Anthropic.Beta.BetaContentBlock[];
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** Set when a refusal happened (and whether a fallback model carried on). */
  refusal?: { category: string | null; explanation: string | null };
  model: string;
}

export interface ClaudeBridge {
  readonly route: "api" | "artifact";
  send(messages: Anthropic.Beta.BetaMessageParam[], tools: BridgeTool[]): Promise<BridgeTurn>;
}

export interface ApiOptions {
  apiKey?: string;
  /** PLAN §20 D8: claude-opus-5-5 by default, claude-sonnet-5 the cheaper choice. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /** Server-side refusal fallback ("default" routes by refusal category). */
  fallbacks?: boolean;
  browser?: boolean;
}

export class MessagesApiBridge implements ClaudeBridge {
  readonly route = "api" as const;
  private client: Anthropic;
  constructor(private opts: ApiOptions = {}) {
    this.client = new Anthropic({ ...(opts.apiKey ? { apiKey: opts.apiKey } : {}), ...(opts.browser ? { dangerouslyAllowBrowser: true } : {}) });
  }

  async send(messages: Anthropic.Beta.BetaMessageParam[], tools: BridgeTool[]): Promise<BridgeTurn> {
    const model = this.opts.model ?? "claude-opus-5-5";
    // the stable prefix: the tool definitions (cached at the last one) and the first message's
    // instructions and map summary (marked in the message by the loop)
    const defs: Anthropic.Beta.BetaTool[] = tools.map((t, k) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Beta.BetaTool["input_schema"],
      ...(k === tools.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
    }));
    const response = await this.client.beta.messages.create({
      model,
      max_tokens: this.opts.maxTokens ?? 16000,
      // Opus 5.5 thinks always; effort is the control (its default is medium: set it explicitly)
      thinking: { type: "adaptive" },
      output_config: { effort: this.opts.effort ?? "high" },
      // forced tool choice is refused by the default model: auto, steered by the prompt
      tool_choice: { type: "auto" },
      tools: defs,
      messages,
      ...(this.opts.fallbacks !== false ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    const u = response.usage;
    return {
      content: response.content,
      stopReason: response.stop_reason,
      usage: { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
      ...(response.stop_reason === "refusal" ? { refusal: { category: response.stop_details?.category ?? null, explanation: response.stop_details?.explanation ?? null } } : {}),
      model: response.model,
    };
  }
}

/** Errors worth one retry (the SDK already retries 408/409/429/5xx and connection errors twice). */
export function isRetryable(e: unknown): boolean {
  return e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError;
}

// ----------------------------------------------------------------------------- route A (sketch)
//
// Inside the artifact, M12's platform adapter (PLAN §19.9) does the same with the runtime:
//
//   const claude = await window.claude.use();            // resolves after first render (M3 spike)
//   const reply = await claude.sample({
//     modelTier: "default",                              // quick | default | complex, no model id
//     messages,                                          // the first message carries the instructions
//     tools: TOOL_DEFS.map((t) => ({ ...t, inputSchema: t.input_schema, execute: (args) => tools.call(t.name, args).result })),
//   });
//
// Limits the loop must respect there: no system prompt (the pack has none), 64 KiB of input in all
// (loop.ts measures it and stops before it), 32 KB per tool result (tools.ts fits every result),
// 4 KB per input schema (all seven are under 2 KB). `sample` runs the tool calls itself, so the
// app counts rounds and calls inside `execute` and answers BUDGET_SPENT once they run out.
