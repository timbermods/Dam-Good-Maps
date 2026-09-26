// Live editing's water tools (PLAN §20 D179, D180): a river drawn freehand carves its channel under
// the pointer while its water flows in behind, says its size and what it does beside the pointer,
// and is placed on release as one step; Esc mid-draw leaves no trace; drawn from a river, it is a
// branch of it; a water source spreads its water at once, and its strength, changed with a
// slider, is one undo step; the Lake tool fills a hollow from a spring; with Ctrl, Flatten reads a
// river's bed.

import { expect, test, type Page } from "@playwright/test";

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());
const idle = (page: Page) => page.evaluate(() => window.dgmEditor!.idle());
const heights = (page: Page) => page.evaluate(() => Array.from(window.dgm3d!.renderer.mapState()!.heights));
const wet = (page: Page) =>
  page.evaluate(() => {
    const d = window.dgm3d!.renderer.mapState()!.surface.depth;
    let n = 0;
    for (let i = 0; i < d.length; i++) if (d[i] > 0.05) n++;
    return n;
  });

async function client(page: Page, x: number, y: number) {
  return page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), [x, y] as const);
}

/** A freehand stroke through these tiles; `mid` runs halfway with the button down. */
async function draw(page: Page, pts: [number, number][], mid?: () => Promise<void>) {
  const p = await client(page, ...pts[0]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let k = 1; k < pts.length; k++) {
    const q = await client(page, ...pts[k]);
    await page.mouse.move(q.x, q.y, { steps: 3 });
    await page.waitForTimeout(40);
    if (mid && k === Math.floor(pts.length / 2)) await mid();
  }
  await page.waitForTimeout(400);
}

test("water tools: freehand rivers with their water flowing in, branches, sources and lakes", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  let i = await info(page);
  const W = i.W;
  const start = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;
  const main = i.features.find((f) => f.kind === "river")!;
  const path = (main.params as { path: [number, number][] }).path;
  // a column away from the start, where the main river crosses it
  const x = start[0] < W / 2 ? Math.round(W * 0.78) : Math.round(W * 0.22);
  const join = path.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best));
  const course = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, k) => [x, Math.round(from + ((to - from) * k) / n)] as [number, number]);
  await page.getByRole("tab", { name: "Water" }).click();
  const add = page.getByRole("region", { name: "Add" });
  await add.getByRole("button", { name: "River", exact: true }).click();

  // Esc mid-draw: the ground and the history as they were
  const ground0 = await heights(page);
  await draw(page, course(W - 1, Math.round((W - 1 + join[1]) / 2), 8), async () => {
    await page.waitForFunction(() => !!window.dgmEditor!.shapePreview(), null, { timeout: 30_000 });
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await idle(page);
  await page.waitForTimeout(500);
  expect(await heights(page)).toEqual(ground0);
  expect((await info(page)).history).toEqual([]);

  // a river from the north edge into the main river: its channel and its water while drawing
  const wet0 = await wet(page);
  let during = 0;
  await draw(page, course(W - 1, Math.round(join[1]) + 1, 14), async () => {
    await page.waitForFunction(() => !!window.dgmEditor!.shapePreview()?.cursor, null, { timeout: 30_000 });
    await expect(page.locator(".shape-note")).toContainText(/wide, \d deep/);
    await page.waitForTimeout(1200);
    during = await wet(page);
  });
  await expect(page.locator(".shape-note")).toContainText(/joins the river/);
  await page.mouse.up();
  await idle(page);
  expect(during).toBeGreaterThan(wet0);
  i = await info(page);
  expect(i.history.map((h) => h.label)).toEqual(["Add river"]);
  const drawn = i.features.find((f) => f.kind === "river" && f.origin === "user")!.params as { entry: object; exit: object };
  expect(drawn.entry).toEqual({ edge: "north" });
  expect(drawn.exit).toEqual({ river: main.id });

  // a branch: from the main river to the south edge, with no source of its own
  const bx = start[0] < W / 2 ? Math.round(W * 0.62) : Math.round(W * 0.38);
  const from = path.reduce((best, p) => (Math.abs(p[0] - bx) < Math.abs(best[0] - bx) ? p : best));
  await draw(page, Array.from({ length: 13 }, (_, k) => [Math.round(from[0]), Math.round(from[1] - (from[1] * k) / 12)] as [number, number]), async () => {
    await expect(page.locator(".shape-note")).toContainText(/a branch of the water it leaves/, { timeout: 30_000 });
  });
  await page.mouse.up();
  await idle(page);
  i = await info(page);
  expect(i.history.at(-1)!.label).toBe("Add river");
  const branch = i.features.filter((f) => f.kind === "river" && f.origin === "user").at(-1)!.params as { entry: object; exit: object };
  expect(Object.keys(branch.entry)).toEqual(["branch"]);
  expect(branch.exit).toEqual({ edge: "south" });

  // a water source: its water spreads at once
  await add.getByRole("button", { name: "Water source", exact: true }).click();
  const sx = start[0] < W / 2 ? Math.round(W * 0.85) : Math.round(W * 0.15);
  const sy = Math.round(W * 0.9);
  const sp = await client(page, sx, sy);
  await page.mouse.move(sp.x, sp.y);
  await expect(page.locator(".shape-note")).toContainText(/Water source: [\d.]+ water\/s/);
  const wet1 = await wet(page);
  await page.mouse.click(sp.x, sp.y);
  await idle(page);
  expect((await info(page)).history.at(-1)!.label).toBe("Place water source");
  await expect.poll(() => wet(page), { timeout: 10_000 }).toBeGreaterThan(wet1);

  // selected with no tool out, its strength changes live, one undo step for the adjustment
  await page.getByRole("button", { name: "Done" }).click();
  await page.mouse.click(sp.x, sp.y);
  const insp = page.getByRole("complementary", { name: /Water source, selected/ });
  await expect(insp).toBeVisible();
  const steps = (await info(page)).history.length;
  await insp.getByRole("slider").focus();
  for (let k = 0; k < 3; k++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await info(page)).history.length, { timeout: 10_000 }).toBe(steps + 1);
  await idle(page);
  expect((await info(page)).history.at(-1)!.label).toMatch(/^Water source: [\d.]+ water\/s$/);
  await insp.getByRole("button", { name: "Close" }).click();

  // a lake: a click in a hollow puts a spring at its lowest point (a hollow dug with one click of
  // Lower on flat, dry ground)
  const flat = await page.evaluate(
    ([w, s0, s1]) => {
      const m = window.dgm3d!.renderer.mapState()!;
      for (let y = 8; y < w - 8; y++)
        for (let x2 = 8; x2 < w - 8; x2++) {
          if (Math.hypot(x2 - s0, y - s1) < 16) continue;
          const h0 = m.heights[y * w + x2];
          let ok = true;
          for (let dy = -6; dy <= 6 && ok; dy++) for (let dx = -6; dx <= 6 && ok; dx++) if (m.heights[(y + dy) * w + x2 + dx] !== h0 || m.surface.depth[(y + dy) * w + x2 + dx] > 0) ok = false;
          if (ok) return [x2, y] as [number, number];
        }
      return null;
    },
    [W, start[0], start[1]] as const,
  );
  expect(flat).not.toBeNull();
  await page.getByRole("button", { name: "Lower brush (2)" }).click();
  const fp = await client(page, ...flat!);
  await page.mouse.click(fp.x, fp.y);
  await page.waitForFunction(() => window.dgmEditor!.pendingTerrain() === 0, null, { timeout: 30_000 });
  await page.keyboard.press("Escape");
  expect((await page.evaluate(([a, b]) => window.dgmEditor!.lakeAt(a, b), flat!)).fills).toBe(true);
  await page.getByRole("tab", { name: "Water" }).click();
  await add.getByRole("button", { name: "Lake", exact: true }).click();
  await page.mouse.move(fp.x + 2, fp.y);
  await page.mouse.move(fp.x, fp.y);
  await expect(page.locator(".shape-note")).toContainText(/Lake: fills to level \d+ here/);
  await page.mouse.click(fp.x, fp.y);
  await idle(page);
  expect((await info(page)).history.at(-1)!.label).toBe("Place water source");
  await expect(page.locator(".editor-message.info")).toContainText(/Lake: a spring fills it to level \d+/);

  // Flatten with Ctrl over the river reads its bed
  await page.getByRole("button", { name: "Flatten brush (3)" }).click();
  const mid = path[Math.floor(path.length / 2)];
  const mp = await client(page, Math.round(mid[0]), Math.round(mid[1]));
  await page.mouse.move(mp.x + 4, mp.y);
  await page.keyboard.down("Control");
  await page.mouse.move(mp.x, mp.y);
  await expect(page.locator(".shape-note")).toContainText(/riverbed: level \d+/);
  await page.keyboard.up("Control");
  expect(errors).toEqual([]);
});
