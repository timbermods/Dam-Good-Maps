// The "how it plays" card: a few plain sentences from a map's opening (lib/opening.ts), written for
// a Timberborn player per CLAUDE.md (short, action first, plain words, each thing once). It says
// what the land does, never how the generator made it.

import type { Opening } from "./opening";

const KIND: Record<string, string> = {
  river: "a river",
  lake: "a lake",
  pond: "a pond",
  stream: "a stream",
  none: "water",
};

function list(v: string[]): string {
  if (v.length <= 1) return v.join("");
  return `${v.slice(0, -1).join(", ")} and ${v[v.length - 1]}`;
}

/** Directions as a player says them: "north and east", or "every side". */
function sides(v: string[]): string {
  if (v.length >= 6) return "every side";
  const main = v.filter((d) => !d.includes("-"));
  return list(main.length >= 2 ? main : v);
}

export function card(o: Opening): string[] {
  const f = o.facts;
  const out: string[] = [];
  out.push(`You start by ${KIND[f.waterKind]}, ${f.waterWalk <= 1 ? "right beside you" : `${f.waterWalk} tiles away on your own level`}.`);
  if (f.drought === "holds") out.push(`In a drought it keeps most of its water.`);
  else if (f.drought === "shrinks") out.push(`In a drought it shrinks: store water before the first one.`);
  else out.push(`In a drought it runs dry: store water early.`);
  if (f.dam && f.dam.dist <= 40) out.push(`A ${f.dam.length}-tile dam ${f.dam.dist <= 8 ? "right by the start" : `${f.dam.dist} tiles ${f.dam.dir}`} holds a drought's water.`);
  else out.push(`There is no easy dam near the start: build levees or dig a reservoir.`);
  if (f.threat?.kind === "badwater") out.push(`Badwater lies ${f.threat.dist} tiles ${f.threat.dir}${f.threat.upstream ? ", and it reaches your water" : ""}.`);
  else if (f.threat?.kind === "thorns") out.push(`Thorns bar the way ${f.threat.dir}, ${f.threat.dist} tiles out.`);
  else if (f.threat?.kind === "core") out.push(`An unstable core waits ${f.threat.dist} tiles ${f.threat.dir}.`);
  const land = f.land === "wide" ? "wide, level land" : f.land === "some" ? "some level land" : "narrow ledges";
  const where = sides(f.openTo);
  out.push(f.openTo.length ? `Expand ${where === "every side" ? "on every side" : `to the ${where}`}, on ${land}${f.levelsNear > 4 ? ` across ${f.levelsNear} levels` : ""}.` : `The start is boxed in: stairs lead out.`);
  if (f.hidden.length) out.push(`Further out: ${list(f.hidden)}.`);
  return out;
}
