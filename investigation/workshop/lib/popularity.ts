// Popularity of workshop maps, allowing for upload date: log lifetime subscribers after a straight
// fit on log age in days. A map above the fit is more popular than its age explains. Hints only:
// subscribers follow authors, collections and front-page luck as much as the map itself.

import type { Row } from "./table";

export const STUDY_DAY = Date.UTC(2026, 8, 24);

export function lifetimeSubs(r: Row): number | null {
  const m = r.meta as { lifetime_subscribers?: number } | null;
  return m?.lifetime_subscribers ?? null;
}

export function ageDays(r: Row): number | null {
  const posted = r.meta?.posted;
  if (!posted) return null;
  return Math.max(30, (STUDY_DAY - Date.parse(posted + "T00:00:00Z")) / 864e5);
}

export function fitLine(x: number[], y: number[]): [number, number] {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  return [my - b * mx, b];
}

/** Each workshop map's popularity residual (null without metadata), and the fit. */
export function popularityResiduals(rows: Row[]): { resid: Map<string, number>; fit: [number, number] } {
  const ok = rows.filter((r) => r.source === "workshop" && lifetimeSubs(r) && ageDays(r));
  const x = ok.map((r) => Math.log(ageDays(r)!));
  const y = ok.map((r) => Math.log(lifetimeSubs(r)!));
  const fit = fitLine(x, y);
  const resid = new Map<string, number>();
  ok.forEach((r, i) => resid.set(r.key, y[i] - (fit[0] + fit[1] * x[i])));
  return { resid, fit };
}
