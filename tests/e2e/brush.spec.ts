// Live editing: the terrain brushes in the page. The ground changes under the cursor while the
// button is down; the stroke becomes one step of the history ("Raise, 38 tiles") whose map, built
// by the worker, is the one painted, byte for byte; undo and redo show at once; Esc cancels a
// stroke with no trace; Shift inverts; Ctrl+click picks flatten's level; [ ] size and Alt+wheel
// strength; the stroke is still there after a reload (the autosave).

import { expect, test, type Page } from "@playwright/test";

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());
const heights = (page: Page) => page.evaluate(() => Array.from(window.dgm3d!.renderer.mapState()!.heights));
const settled = (page: Page) => page.waitForFunction(() => window.dgmEditor!.pendingTerrain() === 0, null, { timeout: 30_000 });

async function client(page: Page, x: number, y: number) {
  return page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), [x, y] as const);
}

/** A stroke from tile a toward tile b; `mid` runs halfway through, the button still down. */
async function stroke(page: Page, a: [number, number], b: [number, number], opts: { mid?: () => Promise<void>; shift?: boolean } = {}) {
  const p = await client(page, ...a);
  const q = await client(page, ...b);
  await page.mouse.move(p.x, p.y);
  if (opts.shift) await page.keyboard.down("Shift");
  await page.mouse.down();
  for (let k = 1; k <= 30; k++) {
    await page.mouse.move(p.x + ((q.x - p.x) * k) / 30, p.y + ((q.y - p.y) * k) / 30);
    await page.waitForTimeout(10);
    if (k === 15 && opts.mid) await opts.mid();
  }
  await page.mouse.up();
  if (opts.shift) await page.keyboard.up("Shift");
}

test("the brushes paint under the cursor, undo at once, and keep their strokes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  const W = (await info(page)).W;
  const start = (await info(page)).features.find((f) => f.kind === "start")!.params as { position: [number, number] };
  // a place away from the start
  const at: [number, number] = start.position[0] < W / 2 ? [70, 30] : [20, 30];

  // the brush bar: labelled, with shortcuts; the number keys pick a brush
  const bar = page.getByRole("toolbar", { name: "Terrain brushes" });
  await expect(bar.getByRole("button", { name: "Raise brush (1)" })).toBeVisible();
  await page.keyboard.press("1");
  await expect(bar.getByRole("button", { name: "Raise brush (1)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Drag to paint" })).toBeVisible();

  // raise: the ground rises under the cursor before the button comes up
  const before = await heights(page);
  let during: number[] = [];
  await stroke(page, at, [at[0] + 8, at[1]], { mid: async () => void (during = await heights(page)) });
  expect(during.some((h, i) => h > before[i])).toBe(true);
  await settled(page);
  let i = await info(page);
  expect(i.history.at(-1)!.label).toMatch(/^Raise, \d+ tiles?$/);
  expect(await page.evaluate(() => window.dgmEditor!.strokeMismatches())).toBe(0);
  // the worker's map is the one painted, byte for byte
  const painted = await heights(page);
  const built = await page.evaluate(async () => Array.from((await window.dgmEditor!.worker.sessionView()).view.heights));
  expect(built).toEqual(painted);

  // undo shows at once (before the worker answers), redo too
  await page.keyboard.press("Control+z");
  expect(await heights(page)).toEqual(before);
  await settled(page);
  expect((await info(page)).history.at(-1)!.applied).toBe(false);
  await page.keyboard.press("Control+y");
  expect(await heights(page)).toEqual(painted);
  await settled(page);
  expect(await page.evaluate(() => window.dgmEditor!.strokeMismatches())).toBe(0);

  // Shift inverts: raise lowers
  await stroke(page, [at[0], at[1] + 6], [at[0] + 6, at[1] + 6], { shift: true });
  await settled(page);
  expect((await info(page)).history.at(-1)!.label).toMatch(/^Lower, /);

  // Esc cancels a stroke in progress: no trace on the map or in the history
  const steps = (await info(page)).history.length;
  const clean = await heights(page);
  await stroke(page, [at[0], at[1] + 12], [at[0] + 8, at[1] + 12], { mid: () => page.keyboard.press("Escape") });
  await page.waitForTimeout(300);
  await settled(page);
  expect(await heights(page)).toEqual(clean);
  expect((await info(page)).history.length).toBe(steps);

  // flatten: Ctrl+click picks the level from the ground
  await page.keyboard.press("3");
  const p = await client(page, ...start.position);
  const level = await page.evaluate(([x, y]) => window.dgm3d!.renderer.heightAt(x, y), start.position);
  await page.keyboard.down("Control");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Control");
  await expect(bar.getByRole("combobox")).toHaveValue(String(level));
  expect((await info(page)).history.length).toBe(steps);

  // [ and ] size the brush; Alt+wheel sets its strength
  const size = bar.getByRole("slider").first();
  const s0 = Number(await size.inputValue());
  await page.keyboard.press("]");
  expect(Number(await size.inputValue())).toBeGreaterThan(s0);
  await page.keyboard.press("[");
  expect(Number(await size.inputValue())).toBe(s0);
  const strength = bar.getByRole("slider").nth(1);
  const k0 = Number(await strength.inputValue());
  await page.mouse.move(p.x, p.y);
  await page.keyboard.down("Alt");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Alt");
  expect(Number(await strength.inputValue())).toBe(Math.min(10, k0 + 1));

  // Esc puts the brush away
  await page.keyboard.press("Escape");
  await expect(bar.getByRole("button", { name: "Flatten brush (3)" })).toHaveAttribute("aria-pressed", "false");

  // the strokes are kept: a reload opens the map with them (the autosave)
  i = await info(page);
  const kept = await heights(page);
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  expect((await info(page)).edits).toBe(i.edits);
  expect(await heights(page)).toEqual(kept);
  expect(errors).toEqual([]);
});
