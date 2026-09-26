// Live editing: the shape tools. A hill dragged on the map shows its real result while the button
// is down (the worker's own planner and build steps), letting go places it as one step, and the map
// the worker builds is the one shown; Esc mid-drag puts the ground back with no trace; a shape the
// tool refuses says why while it is dragged and places nothing; the placed hill's handles resize it
// and change its height, live, each as one step.

import { expect, test, type Page } from "@playwright/test";

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());
const idle = (page: Page) => page.evaluate(() => window.dgmEditor!.idle());
const heights = (page: Page) => page.evaluate(() => Array.from(window.dgm3d!.renderer.mapState()!.heights));
const built = (page: Page) => page.evaluate(async () => Array.from((await window.dgmEditor!.worker.sessionView()).view.heights));

async function client(page: Page, x: number, y: number) {
  return page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), [x, y] as const);
}

/** Drag from tile a to tile b; `mid` runs with the button still down, after the worker has
 *  answered for the shape. */
async function dragShape(page: Page, a: [number, number], b: [number, number], mid?: () => Promise<void>) {
  const p = await client(page, ...a);
  const q = await client(page, ...b);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) {
    await page.mouse.move(p.x + ((q.x - p.x) * k) / 12, p.y + ((q.y - p.y) * k) / 12);
    await page.waitForTimeout(15);
  }
  await page.waitForFunction(() => !!window.dgmEditor!.shapePreview(), null, { timeout: 30_000 });
  if (mid) await mid();
  await page.mouse.up();
}

test("a hill shows its real result while dragged, is placed on release, and its handles change it live", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  const W = (await info(page)).W;
  const start = ((await info(page)).features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;
  const at: [number, number] = start[0] < W / 2 ? [64, 24] : [16, 24];
  await page.getByRole("tab", { name: "Land" }).click();
  await page.getByRole("button", { name: "Hill", exact: true }).click();

  // Esc mid-drag: the ground as it was, nothing placed
  const before = await heights(page);
  await dragShape(page, at, [at[0] + 14, at[1] + 14], async () => {
    await page.keyboard.press("Escape");
  });
  await idle(page);
  expect(await heights(page)).toEqual(before);
  expect((await info(page)).history).toEqual([]);

  // the hill rises while the button is down, with what it says beside the pointer
  let during: number[] = [];
  await dragShape(page, at, [at[0] + 14, at[1] + 14], async () => {
    during = await heights(page);
    await expect(page.locator(".shape-note")).toContainText(/Hill/);
  });
  expect(during.some((h, i) => h > before[i])).toBe(true);
  await idle(page);
  let i = await info(page);
  expect(i.history.map((h) => h.label)).toEqual(["Add hill"]);
  // what showed is what was placed: the worker's map is the one on screen
  expect(await built(page)).toEqual(await heights(page));
  const hill = i.features.find((f) => f.kind === "landform" && f.origin === "user")!;
  const area = (hill.params as { outline: [number, number][] }).outline;
  const height0 = (hill.params as { height: number }).height;

  // its height handle, by keyboard: two levels up, placed a moment after the last key
  const heightHandle = page.getByRole("button", { name: /^Height of .*: \d+/ });
  await expect(heightHandle).toBeVisible();
  await heightHandle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await info(page)).history.at(-1)!.label, { timeout: 10_000 }).toMatch(/height to/);
  await idle(page);
  i = await info(page);
  expect((i.features.find((f) => f.id === hill.id)!.params as { height: number }).height).toBe(Math.min(16, height0 + 2));
  expect(await built(page)).toEqual(await heights(page));

  // a corner handle: dragged outward, the hill grows as it is dragged and is placed on release
  const corner = page.getByRole("button", { name: /^Resize .*: drag this corner/ }).first();
  await expect(corner).toBeVisible();
  const box = (await corner.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const centre = await client(page, at[0] + 7, at[1] + 7);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(cx + ((cx - centre.x) * k) / 16, cy + ((cy - centre.y) * k) / 16);
    await page.waitForTimeout(20);
  }
  await page.waitForFunction(() => !!window.dgmEditor!.shapePreview(), null, { timeout: 30_000 });
  await page.mouse.up();
  await idle(page);
  i = await info(page);
  expect(i.history.at(-1)!.label).toMatch(/^Resize /);
  const outline = (i.features.find((f) => f.id === hill.id)!.params as { outline: [number, number][] }).outline;
  const span = (o: [number, number][]) => Math.max(...o.map((p) => p[0])) - Math.min(...o.map((p) => p[0])) + (Math.max(...o.map((p) => p[1])) - Math.min(...o.map((p) => p[1])));
  expect(span(outline)).toBeGreaterThan(span(area));
  expect(await built(page)).toEqual(await heights(page));

  // undo takes back one step at a time
  const steps = i.history.filter((h) => h.applied).length;
  await page.keyboard.press("Control+z");
  await idle(page);
  expect((await info(page)).history.filter((h) => h.applied).length).toBe(steps - 1);

  // a hill over the start is refused while it is dragged: it says why, and places nothing
  const count = (await info(page)).history.length;
  const clean = await heights(page);
  await dragShape(page, [start[0] - 5, start[1] - 5], [start[0] + 5, start[1] + 5], async () => {
    await page.waitForFunction(() => window.dgmEditor!.shapePreview()?.ok === false, null, { timeout: 30_000 });
    await expect(page.locator(".shape-note.error")).toContainText(/start/);
  });
  await idle(page);
  expect((await info(page)).history.length).toBe(count);
  expect(await heights(page)).toEqual(clean);
  expect(errors).toEqual([]);
});
