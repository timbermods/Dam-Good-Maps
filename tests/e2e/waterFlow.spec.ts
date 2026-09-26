// The water's journey after an edit (live editing, PLAN §20 D179 (2), D180 (8)): it plays over a
// few seconds, not all at once; pause holds it, skip jumps to the latest, replay plays it again; it
// ends exactly at the water the map has (the worker's, the export's); a drought drains the map and
// brings the water back, ending at the map's water again.

import { expect, test, type Page } from "@playwright/test";

const idle = (page: Page) => page.evaluate(() => window.dgmEditor!.idle());
const wet = (page: Page) =>
  page.evaluate(() => {
    const d = window.dgm3d!.renderer.mapState()!.surface.depth;
    let n = 0;
    for (let i = 0; i < d.length; i++) if (d[i] > 0.05) n++;
    return n;
  });
/** The water on screen and the worker's, as total depth (they must match once settled). */
const volumes = (page: Page) =>
  page.evaluate(async () => {
    const shown = window.dgm3d!.renderer.mapState()!.surface.depth;
    let a = 0;
    for (let i = 0; i < shown.length; i++) if (shown[i] > 0) a += shown[i];
    const w = (await window.dgmEditor!.worker.sessionView()).view.water;
    let b = 0;
    for (let k = 0; k < w.count; k++) b += w.depth[k];
    return { shown: a, worker: b };
  });

test("the water's journey plays over a few seconds, pauses, skips, replays, and ends at the map's water; a drought comes and goes", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  const bar = page.getByRole("toolbar", { name: "Water time" });
  await expect(bar.getByRole("status")).toHaveText("Water settled");
  const i = await page.evaluate(() => window.dgmEditor!.info());
  const W = i.W;
  const start = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;

  // a strong water source on high ground away from the start: its water spreads over seconds
  await page.getByRole("tab", { name: "Water" }).click();
  await page.getByRole("region", { name: "Add" }).getByRole("button", { name: "Water source", exact: true }).click();
  const at: [number, number] = [start[0] < W / 2 ? Math.round(W * 0.85) : Math.round(W * 0.15), Math.round(W * 0.9)];
  const p = await page.evaluate(([x, y]) => window.dgmEditor!.tileToClient(x, y), at);
  const w0 = await wet(page);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  const seen: number[] = [];
  for (let k = 0; k < 8; k++) {
    await page.waitForTimeout(250);
    seen.push(await wet(page));
  }
  // it grows over the frames, not in one step
  expect(new Set(seen).size).toBeGreaterThanOrEqual(4);
  expect(Math.max(...seen)).toBeGreaterThan(w0);
  await expect(bar.getByRole("status")).toContainText(/Water flowing|Water settled/);

  // pause holds it
  await bar.getByRole("button", { name: "Pause", exact: true }).click();
  const held = await wet(page);
  await page.waitForTimeout(600);
  expect(await wet(page)).toBe(held);
  await bar.getByRole("button", { name: "Play", exact: true }).click();

  // it ends at the map's water: what the worker has, what the export gets
  await expect(bar.getByRole("status")).toHaveText("Water settled", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  let v = await volumes(page);
  expect(Math.abs(v.shown - v.worker)).toBeLessThan(1e-3 * Math.max(1, v.worker));

  // replay: from the water right after the edit, then back to the same end
  const settled = await wet(page);
  await bar.getByRole("button", { name: "Replay" }).click();
  await page.waitForTimeout(200);
  expect(await wet(page)).not.toBe(settled);
  await bar.getByRole("button", { name: "Skip" }).click();
  await expect(bar.getByRole("status")).toHaveText("Water settled");
  v = await volumes(page);
  expect(Math.abs(v.shown - v.worker)).toBeLessThan(1e-3 * Math.max(1, v.worker));

  // a drought: the water drains and dries, then comes back to the map's water
  await bar.getByRole("button", { name: "Drought" }).click();
  await expect(bar.getByRole("status")).toContainText(/Drought: day \d+ of \d+/);
  await expect.poll(() => wet(page), { timeout: 30_000 }).toBeLessThan(settled / 2);
  await expect(bar.getByRole("status")).toHaveText("Water settled", { timeout: 120_000 });
  await expect(bar.getByRole("button", { name: "Drought" })).toHaveAttribute("aria-pressed", "false");
  v = await volumes(page);
  expect(Math.abs(v.shown - v.worker)).toBeLessThan(1e-3 * Math.max(1, v.worker));
  expect(errors).toEqual([]);
});
