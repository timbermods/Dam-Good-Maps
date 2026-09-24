// The in-app Claude's view of the map, as a command line: the feature-level summary and the seven
// tools, with their size limits, and nothing else. Used for the self-played pilot (pilot/PILOT.md):
// whoever plays the in-app Claude sees only what this prints.
//
//   npx tsx investigation/claude/bin/cli.ts start <requestId>         the request and the map summary
//   npx tsx investigation/claude/bin/cli.ts tools                     the tool definitions
//   npx tsx investigation/claude/bin/cli.ts call <tool> '<json args>' one tool call on the open request
//   npx tsx investigation/claude/bin/cli.ts status                    rounds and tool calls used
//   npx tsx investigation/claude/bin/cli.ts end '<report>'            close the request with the final report
//
// Each process replays the accepted proposals of the open request from its state file, so the map
// is exactly as the calls left it (queries and dry runs change nothing).

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openSetup } from "../lib/fixtures";
import { ClaudeTools, TOOL_DEFS } from "../lib/tools";
import type { Corpus } from "../lib/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const stateDir = join(root, "pilot", "state");
const transcripts = join(root, "pilot", "transcripts");
mkdirSync(stateDir, { recursive: true });
mkdirSync(transcripts, { recursive: true });

interface State {
  id: string;
  text: string;
  setup: string;
  calls: { tool: string; args: Record<string, unknown>; bytes: number; error: boolean; accepted?: boolean }[];
  ended?: string;
}

const current = join(stateDir, "current.json");
const corpus = JSON.parse(readFileSync(join(root, "requests.json"), "utf8")) as Corpus;

function load(): State {
  if (!existsSync(current)) throw new Error("no open request: run `start <id>` first");
  return JSON.parse(readFileSync(current, "utf8")) as State;
}

function save(s: State): void {
  writeFileSync(current, JSON.stringify(s, null, 1));
  writeFileSync(join(stateDir, `${s.id}.json`), JSON.stringify(s, null, 1));
}

/** Open the request's map and replay the proposals the player accepted. */
function reopen(s: State): ClaudeTools {
  const o = openSetup(corpus.setups, s.setup);
  const t = new ClaudeTools(o.session, o.conv);
  for (const c of s.calls) if (c.tool === "propose" && c.accepted) t.call("propose", c.args);
  return t;
}

const rounds = (s: State) => s.calls.filter((c) => c.tool === "dry_run" || c.tool === "propose").length;

function status(s: State): string {
  return `[budget] rounds ${rounds(s)} of 3 · tool calls ${s.calls.length} of 10 (EDITOR_PLAN §7 today)`;
}

function log(s: State, text: string): void {
  appendFileSync(join(transcripts, `${s.id}.md`), text + "\n");
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "start": {
    const id = rest[0];
    const r = corpus.requests.find((x) => x.id === id);
    if (!r) throw new Error(`no request ${id}`);
    const s: State = { id, text: r.text, setup: r.setup, calls: [] };
    save(s);
    const t = reopen(s);
    const summary = t.summary();
    writeFileSync(join(transcripts, `${id}.md`), `# ${id}\n\nRequest: "${r.text}"\n\nSummary: ${summary.length} bytes\n\n`);
    console.log(`REQUEST: ${r.text}\n\nMAP SUMMARY (${summary.length} bytes):\n${summary}`);
    break;
  }
  case "tools":
    for (const d of TOOL_DEFS) console.log(`## ${d.name} (${JSON.stringify(d).length} bytes)\n${d.description}\n${JSON.stringify(d.input_schema)}\n`);
    break;
  case "call": {
    const s = load();
    if (s.ended) throw new Error("the request is closed");
    const tool = rest[0];
    const args = JSON.parse(rest[1] ?? "{}") as Record<string, unknown>;
    const t = reopen(s);
    const c = t.call(tool, args);
    const out = JSON.parse(c.result) as Record<string, unknown>;
    s.calls.push({ tool, args, bytes: c.bytes, error: c.error, ...(tool === "propose" ? { accepted: out.accepted === true } : {}) });
    save(s);
    log(s, `## call ${s.calls.length}: ${tool}\n\n\`\`\`json\n${JSON.stringify(args)}\n\`\`\`\n\nresult: ${c.bytes} bytes, ${c.ms} ms${c.error ? ", error" : ""}\n\n\`\`\`json\n${c.result.length > 6000 ? `${c.result.slice(0, 6000)} …` : c.result}\n\`\`\`\n`);
    console.log(c.result);
    console.log(`\n(${c.bytes} bytes, ${c.ms} ms) ${status(s)}`);
    break;
  }
  case "status":
    console.log(status(load()));
    break;
  case "end": {
    const s = load();
    s.ended = rest.join(" ");
    save(s);
    log(s, `## final report\n\n${s.ended}\n\n${status(s)}\n`);
    console.log(status(s));
    break;
  }
  default:
    console.log("commands: start <id> | tools | call <tool> '<json>' | status | end '<report>'");
}
