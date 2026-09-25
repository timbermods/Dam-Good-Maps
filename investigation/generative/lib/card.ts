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

/** `hard`: from the weather-cycle simulation, the day the start loses pumpable water in a later
 *  Hard drought (null: it never does) and that drought's length. */
export function card(o: Opening, hard: { lostDay: number | null; days: number } | null = null): string[] {
  const f = o.facts;
  const out: string[] = [];
  out.push(`You start by ${KIND[f.waterKind]}, ${f.waterWalk <= 1 ? "right beside you" : `${f.waterWalk} tiles away on your own level`}.`);
  const normal = f.drought === "holds" ? "In a Normal drought it keeps most of its water" : f.drought === "shrinks" ? "In a Normal drought it shrinks" : "In a drought it runs dry";
  if (!hard) out.push(`${normal}${f.drought === "holds" ? "." : ": store water early."}`);
  else if (hard.lostDay === null) out.push(f.drought === "dries" ? `It runs low in a drought, but lasts through a ${hard.days}-day Hard one.` : `${normal}, and it lasts through a ${hard.days}-day Hard drought.`);
  else if (hard.lostDay <= 1) out.push(f.drought === "dries" ? `In a drought it runs dry within a day: store water early.` : `${normal}; in a Hard drought it is gone within a day.`);
  else out.push(f.drought === "dries" ? `In a drought it runs dry, after ${hard.lostDay} days in a Hard one: store water early.` : `${normal}; in a Hard drought it lasts ${hard.lostDay} days.`);
  const an = (n: number) => (/^(8|11|18)/.test(String(n)) ? "An" : "A");
  if (f.dam && f.dam.dist <= 40) out.push(`${an(f.dam.length)} ${f.dam.length}-tile dam ${f.dam.dist <= 8 ? "right by the start" : `${f.dam.dist} tiles ${f.dam.dir}`} holds a drought's water.`);
  else out.push(`There is no easy dam near the start: build levees or dig a reservoir.`);
  if (f.threat?.kind === "badwater") out.push(`Badwater lies ${f.threat.dist} tiles ${f.threat.dir}${f.threat.upstream ? `, and some drains into your ${f.waterKind === "none" ? "water" : f.waterKind}` : ""}.`);
  else if (f.threat?.kind === "thorns") out.push(`Thorns bar the way ${f.threat.dir}, ${f.threat.dist} tiles out.`);
  else if (f.threat?.kind === "core") out.push(`An unstable core waits ${f.threat.dist} tiles ${f.threat.dir}.`);
  const land = f.land === "wide" ? "wide, level land" : f.land === "some" ? "some level land" : "narrow ledges";
  const where = sides(f.openTo);
  out.push(f.openTo.length ? `Expand ${where === "every side" ? "on every side" : `to the ${where}`}, on ${land}${f.levelsNear > 4 ? ` across ${f.levelsNear} levels` : ""}.` : `The start is boxed in: stairs lead out.`);
  if (f.hidden.length) out.push(`Further out: ${list(f.hidden)}.`);
  return out;
}
