// Report templates: what the player reads after a proposal (EDITOR_PLAN §7 "Loop"). The app drafts
// the facts; Claude writes the report and must say every one of them. Rules:
// - one line per goal: what was built, with measured numbers;
// - every trade-off by name: what gave way, and why;
// - every goal not met: why, and the nearest feasible alternative, offered and not built;
// - the assumptions made; and whether every start requirement still holds.
// Short sentences in plain words (the timbermods writing rule): no ids unless the player needs them.

import type { Proposal, ProposalResult } from "./compound";
import type { Measured } from "./metrics";

const TEMPLATES = {
  built: (what: string, facts: string) => `Built ${what}${facts ? `: ${facts}` : ""}.`,
  notDone: (goal: string, why: string) => `Not done: ${goal}. ${cap(why)}.`,
  offer: (alt: string) => `Nearest I can do: ${alt}. Say "yes" to build that instead.`,
  tradeoff: (text: string) => `Trade-off: ${cap(text)}.`,
  assumption: (text: string) => `Assumption: ${text}.`,
  startOk: (list: string) => `Every start rule still holds (${list}).`,
  startBroken: (list: string) => `Warning: ${list}.`,
};

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function facts(m: Record<string, unknown>): string {
  const out: string[] = [];
  if (m.where) out.push(`in the ${String(m.where)}`);
  const c = m.course as { river: string; frac: number; bank: string } | undefined;
  if (c) out.push(`${Math.round(c.frac * 100)}% of the way down ${c.river}${c.bank && c.bank !== "on the river" ? `, on the ${c.bank}` : ""}`);
  if (m.lipWidth !== undefined) out.push(`${m.lipWidth} tiles of falling water, a ${m.drop}-level drop, ${m.flow} blocks/s`);
  const res = m.reservoir as { volume: number; area: number; damLength: number } | null | undefined;
  if (res) out.push(`a dam ${res.damLength} tiles long would hold ${res.volume} blocks over ${res.area} tiles`);
  if (m.reservoirClean === false) out.push("its water is contaminated");
  if (m.kind === "badwaterBasin") {
    const o = m.outlet as { to?: string; river?: string; frac?: number } | undefined;
    out.push(`${m.strength} blocks/s of badwater, draining ${o?.river ? `into ${o.river} ${Math.round((o.frac ?? 0) * 100)}% of the way down` : "to the map edge"}`);
  }
  if (m.area !== undefined && m.kind === "lake") out.push(`${m.area} tiles at level ${m.level}`);
  if (m.trees !== undefined) out.push(`${m.trees} trees`);
  if (m.bushes !== undefined) out.push(`${m.bushes} berry bushes`);
  if (m.scrap !== undefined) out.push(`${m.scrap} scrap`);
  if (m.distanceToStart !== undefined && m.kind !== "start") out.push(`${m.distanceToStart} tiles from the start`);
  return out.join(", ");
}

const NAMES: Record<string, string> = {
  waterfall: "a waterfall",
  damSite: "a dam site",
  gorge: "a gorge",
  terracedCliffs: "terraced cliffs",
  badwaterBasin: "a badwater spring",
  lake: "a lake",
  river: "a river",
  forest: "a forest",
  berryPatch: "a berry patch",
  ruinField: "a ruin field",
  hill: "a hill",
  plateau: "a plateau",
  landform: "a landform",
};

/** The app's draft: every fact the final report must carry. */
export function writeReport(r: ProposalResult, p: Proposal, after: Measured): string {
  const lines: string[] = [];
  for (const st of r.steps) {
    if (!st.ok) continue;
    if (st.op === "changeSettings") {
      const moved = (st.resolved.moved as string[] | undefined) ?? [];
      lines.push(`Changed the map's settings${st.resolved.word ? ` to make it ${String(st.resolved.word)}` : ""}${moved.length ? `: ${moved.join("; ")}` : ""}.`);
      continue;
    }
    if (st.op === "moveStart") {
      lines.push(`Moved the start to (${(st.resolved.to as number[]).join(", ")}).`);
      continue;
    }
    for (const m of st.made) {
      const meas = r.measured.find((x) => x.handle === m.handle) ?? {};
      if (st.op === "moveStart") continue;
      lines.push(TEMPLATES.built(NAMES[String((meas as { kind?: string }).kind ?? m.kind)] ?? m.kind, facts(meas as Record<string, unknown>)));
    }
    if (st.op === "deleteFeature") lines.push(`Removed the ${String(st.resolved.kind ?? "feature")}.`);
    if (st.op === "undoLast") lines.push(`Undid the last change (${st.report.join("; ")}).`);
    if (st.op === "changeSetPiece") lines.push(`Changed the ${String(st.resolved.target)}: ${st.report.slice(0, 2).join("; ")}.`);
  }
  for (const t of r.tradeoffs) if (t.kind !== "order") lines.push(TEMPLATES.tradeoff(t.text));
  for (const n of r.notMet) {
    lines.push(TEMPLATES.notDone(n.text, n.why));
    if (n.alternative) lines.push(TEMPLATES.offer(n.alternative));
  }
  const assumptions = new Set<string>();
  for (const st of r.steps) for (const a of (st.resolved.assumptions as string[] | undefined) ?? []) assumptions.add(a);
  for (const a of assumptions) lines.push(TEMPLATES.assumption(a));
  const start = r.guards.startRequirements.filter((g) => !["start.clear", "start.count", "start.flat", "start.entrance"].includes(g.id));
  const broken = start.filter((g) => !g.ok);
  if (broken.length) lines.push(TEMPLATES.startBroken(broken.map((g) => `${g.id} is ${String(g.value)} (the rule is ${String(g.limit)})`).join("; ")));
  else if (start.length) lines.push(TEMPLATES.startOk(start.filter((g) => g.value !== undefined).map((g) => `${g.id.replace("start.", "")} ${String(g.value)}${g.limit !== undefined ? ` of ${String(g.limit)}` : ""}`).join(", ")));
  void p;
  void after;
  return lines.join("\n");
}

/** What a report must mention to be accurate (the grading key's report checks). */
export function mustMention(r: ProposalResult): string[] {
  const out: string[] = [];
  for (const t of r.tradeoffs) if (t.kind === "badwater-poisons-reservoir" || t.kind === "less-flow" || t.kind === "guard" || t.kind === "reduced") out.push(t.kind);
  for (const n of r.notMet) out.push(`not met: ${n.goal}`);
  return out;
}
