// The delivery spike page (EDITOR_PLAN §7, roadmap M3): can the Dam Good Maps editor ship as a
// Claude artifact? Each check runs the real code the artifact edition would ship and records what
// happened, so the results can be copied into the spike report (docs/spike-m3.md).

declare const __WORKER_CODE__: string;
declare const __APP_VERSION__: string;

type State = "wait" | "run" | "pass" | "fail" | "off" | "you";
type Check = "worker" | "open" | "zip" | "quick" | "default";

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

interface SampleTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute(input: Record<string, unknown>): unknown;
}

type SampleFn = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean; modelTierApplied?: string }>) & {
  limits(): Promise<{ maxPromptBytes: number; images?: unknown; tools?: { maxCount: number } }>;
};

interface Downloads {
  save(req: { filename: string; data: Blob | ArrayBuffer | Uint8Array | string }): Promise<{ status: string }>;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const results: Record<string, unknown> = {
  page: "Dam Good Maps delivery spike",
  appVersion: __APP_VERSION__,
  opened: new Date().toISOString(),
  userAgent: navigator.userAgent,
};
const LABEL: Record<State, string> = { wait: "Waiting", run: "Running", pass: "Passed", fail: "Failed", off: "Not here", you: "Needs you" };

function setState(check: Check, state: State, detail?: string): void {
  const chip = document.querySelector<HTMLElement>(`[data-chip="${check}"]`);
  if (chip) {
    chip.dataset.state = state;
    chip.querySelector(".state")!.textContent = LABEL[state];
  }
  const out = document.querySelector<HTMLElement>(`[data-out="${check}"]`);
  if (out && detail !== undefined) out.textContent = detail;
  renderResults();
}

function record(key: string, value: unknown): void {
  results[key] = value;
  renderResults();
}

function renderResults(): void {
  const el = document.getElementById("results-json");
  if (el) el.textContent = JSON.stringify(results, null, 2);
}

const ms = (t0: number) => Math.round(performance.now() - t0);

// ------------------------------------------------------------------------------ the blob worker

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function call<T>(kind: string, payload: Record<string, unknown> = {}, transfer: Transferable[] = []): Promise<T> {
  if (!worker) return Promise.reject(new Error("the worker did not start"));
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker!.postMessage({ id, kind, ...payload }, transfer);
  });
}

let generated: { name: string; bytes: Uint8Array } | null = null;

async function startWorker(): Promise<void> {
  setState("worker", "run", "Starting a worker from a blob: URL…");
  const t0 = performance.now();
  try {
    const url = URL.createObjectURL(new Blob([__WORKER_CODE__], { type: "text/javascript" }));
    worker = new Worker(url, { name: "dam-good-maps-core" });
    worker.onmessage = (ev) => {
      const { id, ok, result, error } = ev.data as { id: number; ok: boolean; result: unknown; error?: string };
      const p = pending.get(id);
      pending.delete(id);
      if (ok) p?.resolve(result);
      else p?.reject(new Error(error));
    };
    worker.onerror = (ev) => {
      for (const p of pending.values()) p.reject(new Error(ev.message || "worker error"));
      pending.clear();
    };
    const ping = await call<{ worker: boolean; crypto: boolean }>("ping");
    const pingMs = ms(t0);
    const g = await call<{ name: string; size: string; ms: number; passed: boolean; entities: number; sha256: string; bytes: Uint8Array }>("generate", { seed: 4242, size: 96 });
    generated = { name: g.name, bytes: g.bytes };
    const detail = `A blob worker started and answered in ${pingMs} ms. Inside it the generator made ${g.name} (${g.size}, ${g.entities} objects, validation ${g.passed ? "passed" : "failed"}) in ${g.ms} ms.\nsha256 ${g.sha256}`;
    record("worker", { ok: true, source: "blob: URL", pingMs, crypto: ping.crypto, generate: { name: g.name, size: g.size, ms: g.ms, passed: g.passed, entities: g.entities, sha256: g.sha256 } });
    setState("worker", "pass", detail);
    ($("use-generated") as HTMLButtonElement).disabled = false;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    record("worker", { ok: false, error: message });
    setState("worker", "fail", `The worker did not run: ${message}`);
  }
}

// ------------------------------------------------------------------------- opening a .timber

function readWithFileReader(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsArrayBuffer(file);
  });
}

async function openFile(file: File, via: "file input" | "drop" | "generated map"): Promise<void> {
  setState("open", "run", `Reading ${file.name}…`);
  const t0 = performance.now();
  try {
    const buf = await readWithFileReader(file);
    const readMs = ms(t0);
    const info = await call<{
      name: string;
      bytes: number;
      ms: number;
      size: string;
      version: string;
      layers: number;
      entities: number;
      starts: number;
      topTemplates: [string, number][];
      caves: number;
      changes: string[];
      flags: string[];
      loadChecks: { passed: number; failed: string[] };
    }>("open", { name: file.name, bytes: buf }, [buf]);
    const lines = [
      `${info.name}: ${(info.bytes / 1024).toFixed(0)} KB, read by FileReader in ${readMs} ms, parsed and normalized in the worker in ${info.ms} ms.`,
      `Map ${info.size}, saved by ${info.version || "an unknown version"}, ${info.layers} terrain layers, ${info.entities} objects, ${info.starts} start(s), ${info.caves} cave or overhang columns.`,
      `Most common: ${info.topTemplates.map(([t, n]) => `${t} ${n}`).join(", ")}.`,
      `Load checks: ${info.loadChecks.passed} pass${info.loadChecks.failed.length ? `; failing: ${info.loadChecks.failed.join(", ")}` : ""}.`,
      ...(info.changes.length ? ["Import normalization:", ...info.changes.map((c) => `  • ${c}`)] : ["Import normalization: nothing to change."]),
      ...info.flags.map((f) => `Flag: ${f}`),
    ];
    record("open", { ok: true, via, readMs, ...info });
    setState("open", via === "generated map" ? "pass" : "pass", lines.join("\n"));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    record("open", { ok: false, via, error: message });
    setState("open", "fail", `Could not open ${file.name}: ${message}`);
  }
}

// ------------------------------------------------------------------------------- saving a .zip

let downloads: Downloads | null = null;

async function saveZip(): Promise<void> {
  if (!generated) return;
  if (!downloads) {
    record("zip", { ok: false, error: "the downloads capability is not available in this view" });
    setState("zip", "off", "Saving needs the Claude viewer's downloads capability, which this view does not have.");
    return;
  }
  setState("zip", "run", "Waiting for you to confirm the save…");
  const name = generated.name.replace(/\.timber$/, ".zip");
  try {
    const z = await call<{ bytes: Uint8Array; sha256: string }>("zip", { name: generated.name, bytes: generated.bytes.slice().buffer });
    const t0 = performance.now();
    const r = await downloads.save({ filename: name, data: new Blob([z.bytes as unknown as ArrayBuffer], { type: "application/zip" }) });
    record("zip", { ok: true, filename: name, bytes: z.bytes.length, sha256: z.sha256, status: r.status, confirmMs: ms(t0) });
    setState("zip", "pass", `Saved ${name} (${(z.bytes.length / 1024).toFixed(0)} KB, status "${r.status}"). Extract it and put the .timber in Documents\\Timberborn\\Maps.\nsha256 ${z.sha256}`);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "error";
    record("zip", { ok: false, filename: name, code, message: (e as { message?: string }).message });
    setState("zip", code === "declined" ? "wait" : "fail", `The save did not happen: ${code}. ${(e as { message?: string }).message ?? ""}`);
  }
}

async function saveBareTimber(): Promise<void> {
  if (!generated || !downloads) return;
  const out = $("bare-out");
  out.textContent = "Offering the .timber directly…";
  try {
    const r = await downloads.save({ filename: generated.name, data: generated.bytes.slice() });
    record("bareTimber", { accepted: true, status: r.status });
    out.textContent = `The viewer accepted a bare .timber (status "${r.status}"): the allowlist includes it after all.`;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "error";
    record("bareTimber", { accepted: false, code, message: (e as { message?: string }).message });
    out.textContent = `Refused with "${code}"${code === "rejected_extension" ? ": .timber is not on the downloads allowlist, so the artifact saves a .zip (decision D10)." : "."}`;
  }
}

// ----------------------------------------------------------------------------- Claude and tools

let sample: SampleFn | null = null;
let stopper: AbortController | null = null;

const TOOLS = (log: { name: string; ms: number }[]): SampleTool[] => {
  const tool = (name: string, description: string, inputSchema?: Record<string, unknown>): SampleTool => ({
    name,
    description,
    ...(inputSchema ? { inputSchema } : {}),
    async execute(input) {
      const t0 = performance.now();
      try {
        return await call("tool", { tool: name, input });
      } finally {
        log.push({ name, ms: ms(t0) });
        $("tool-log").textContent = log.map((l) => `${l.name} (${l.ms} ms)`).join(" → ");
      }
    },
  });
  return [
    tool("map_facts", "Facts about the open Timberborn map: width, height, seed, name, object count, Pine trees, slopes. No input."),
    tool("find_start", "Where the colony starts: the StartingLocation's x, y, z (z is the ground level it stands on). No input."),
    tool("height_at", "Terrain height (levels) and water depth at one tile. Input: x and y, integer tile coordinates.", {
      type: "object",
      properties: { x: { type: "integer" }, y: { type: "integer" } },
      required: ["x", "y"],
    }),
  ];
};

async function askClaude(tier: "quick" | "default"): Promise<void> {
  if (!sample) return;
  const btns = document.querySelectorAll<HTMLButtonElement>("[data-ask]");
  btns.forEach((b) => (b.disabled = true));
  ($("stop") as HTMLButtonElement).disabled = false;
  const out = document.querySelector<HTMLElement>(`[data-out="${tier}"]`)!;
  setState(tier, "run", "Thinking…");
  const log: { name: string; ms: number }[] = [];
  $("tool-log").textContent = "";
  stopper = new AbortController();
  const t0 = performance.now();
  let first: number | null = null;
  try {
    const expected = {
      facts: await call<{ width: number; height: number; pineTrees: number }>("tool", { tool: "map_facts", input: {} }),
      start: await call<{ x: number; y: number; z: number }>("tool", { tool: "find_start", input: {} }),
    };
    const startHeight = (await call<{ height: number }>("tool", { tool: "height_at", input: { x: expected.start.x, y: expected.start.y } })).height;
    const prompt =
      "You are checking that an app's page tools work. Use the tools to find: the map's size, the terrain height at the " +
      "colony's start (look the start up, then ask for the height at its x and y), and how many Pine trees the map has. " +
      'Reply with only this JSON: {"size": "WIDTHxHEIGHT", "startHeight": number, "pines": number}';
    const r = await sample(prompt, {
      modelTier: tier,
      tools: TOOLS(log),
      signal: stopper.signal,
      onText: ({ text }: { text: string }) => {
        if (first === null) first = ms(t0);
        out.textContent = text;
      },
    });
    const total = ms(t0);
    const m = /\{[\s\S]*\}/.exec(r.text);
    let answer: { size?: string; startHeight?: number; pines?: number } | null = null;
    try {
      answer = m ? JSON.parse(m[0]) : null;
    } catch {
      answer = null;
    }
    const correct = !!answer && answer.size === `${expected.facts.width}x${expected.facts.height}` && answer.startHeight === startHeight && answer.pines === expected.facts.pineTrees;
    record(`sample_${tier}`, {
      ok: true,
      tierAsked: tier,
      tierApplied: r.modelTierApplied ?? null,
      firstTextMs: first,
      totalMs: total,
      toolCalls: log,
      truncated: r.truncated,
      answer,
      expected: { size: `${expected.facts.width}x${expected.facts.height}`, startHeight, pines: expected.facts.pineTrees },
      correct,
    });
    setState(
      tier,
      correct ? "pass" : "fail",
      `${r.text.trim()}\n\n${log.length} tool calls; first text after ${first ?? "?"} ms, answer complete after ${total} ms on the ${r.modelTierApplied ?? tier} tier. ${correct ? "The answer matches the map." : "The answer does not match the map."}`,
    );
  } catch (e) {
    const err = e as { code?: string; message?: string; text?: string };
    record(`sample_${tier}`, { ok: false, tierAsked: tier, code: err.code ?? "error", message: err.message, toolCalls: log, afterMs: ms(t0) });
    const state: State = err.code === "not_granted" || err.code === "sampling_disabled" || err.code === "tools_unavailable" ? "off" : err.code === "cancelled" ? "wait" : "fail";
    setState(tier, state, `${err.text ? err.text + "\n\n" : ""}Stopped: ${err.code ?? "error"}. ${err.message ?? ""}`);
  } finally {
    btns.forEach((b) => (b.disabled = false));
    ($("stop") as HTMLButtonElement).disabled = true;
    stopper = null;
  }
}

// ---------------------------------------------------------------------------- environment probes

async function probe(): Promise<void> {
  const env: Record<string, unknown> = {
    origin: location.origin,
    framed: window.top !== window,
    crossOriginIsolated: self.crossOriginIsolated ?? false,
    worker: typeof Worker === "function",
    fileReader: typeof FileReader === "function",
  };
  try {
    localStorage.setItem("dgm-spike", "1");
    env.localStorage = localStorage.getItem("dgm-spike") === "1";
    localStorage.removeItem("dgm-spike");
  } catch (e) {
    env.localStorage = `blocked: ${(e as Error).name}`;
  }
  env.indexedDB = typeof indexedDB === "object" && indexedDB !== null;
  // the artifact CSP lets the page reach only its own origin: a call to the Messages API must fail
  const t0 = performance.now();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    env.messagesApi = `reachable: HTTP ${r.status}`;
  } catch (e) {
    env.messagesApi = `blocked (${(e as Error).name} after ${ms(t0)} ms)`;
  }
  const claude = (window as unknown as { claude?: ClaudeRuntime }).claude;
  env.claudeRuntime = !!claude?.use;
  record("environment", env);
  $("env-out").textContent = Object.entries(env)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
  if (!claude?.use) {
    setState("zip", "off", "This view has no Claude runtime: open the page as a Claude artifact to save files.");
    setState("quick", "off", "This view has no Claude runtime: open the page as a Claude artifact to ask Claude.");
    setState("default", "off", "This view has no Claude runtime.");
    record("capabilities", { downloads: null, sample: null });
    return;
  }
  const [d, s] = await Promise.all([claude.use("downloads"), claude.use("sample")]);
  downloads = (d as Downloads | null) ?? null;
  sample = (s as SampleFn | null) ?? null;
  const caps: Record<string, unknown> = { downloads: !!downloads, sample: !!sample };
  if (sample) {
    try {
      caps.sampleLimits = await sample.limits();
    } catch (e) {
      caps.sampleLimits = `limits() rejected: ${(e as { code?: string }).code ?? String(e)}`;
    }
  }
  record("capabilities", caps);
  if (downloads) {
    ($("save-zip") as HTMLButtonElement).disabled = !generated;
    ($("save-bare") as HTMLButtonElement).disabled = !generated;
    setState("zip", "you", "Ready: press Save to offer the .zip.");
  } else setState("zip", "off", "The downloads capability is not available in this view.");
  const tools = (caps.sampleLimits as { tools?: unknown } | undefined)?.tools;
  if (sample && tools) {
    document.querySelectorAll<HTMLButtonElement>("[data-ask]").forEach((b) => (b.disabled = false));
    setState("quick", "you", "Ready: press Ask to run it. The first call asks you to allow Claude to be used.");
    setState("default", "you", "Ready: press Ask to run it.");
  } else {
    const why = !sample ? "The sample capability is not available in this view." : "This view cannot offer page functions to Claude (no tools in sample.limits()).";
    setState("quick", "off", why);
    setState("default", "off", why);
  }
}

// ---------------------------------------------------------------------------------------- wiring

function wire(): void {
  $("timber-file").addEventListener("change", (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) void openFile(f, "file input");
  });
  const drop = $("drop");
  drop.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    drop.dataset.over = "1";
  });
  drop.addEventListener("dragleave", () => delete drop.dataset.over);
  drop.addEventListener("drop", (ev) => {
    ev.preventDefault();
    delete drop.dataset.over;
    const f = ev.dataTransfer?.files?.[0];
    if (f) void openFile(f, "drop");
  });
  $("use-generated").addEventListener("click", () => {
    if (generated) void openFile(new File([generated.bytes.slice() as unknown as ArrayBuffer], generated.name), "generated map");
  });
  $("save-zip").addEventListener("click", () => void saveZip());
  $("save-bare").addEventListener("click", () => void saveBareTimber());
  document.querySelectorAll<HTMLButtonElement>("[data-ask]").forEach((b) => b.addEventListener("click", () => void askClaude(b.dataset.ask as "quick" | "default")));
  $("stop").addEventListener("click", () => stopper?.abort());
  $("copy").addEventListener("click", async () => {
    const text = JSON.stringify(results, null, 2);
    const note = $("copy-note");
    try {
      await navigator.clipboard.writeText(text);
      note.textContent = "Copied.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("results-json"));
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      note.textContent = "Selected: press Ctrl+C (or ⌘C) to copy.";
    }
  });
}

wire();
renderResults();
void startWorker().then(probe);
