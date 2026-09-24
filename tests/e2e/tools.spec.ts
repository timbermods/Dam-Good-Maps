// ROADMAP M5 through the page: the land and water tools plan on the map, show a preview with their
// report, and place as one step; a river drawn from the map edge carries water; a standalone
// waterfall and a dam site are placed with one click; moving the start shows its footprint and what
// is nearby; an edit that breaks the start shows the problem at once, with a one-click fix.

import { expect, test, type Page } from "@playwright/test";
import type { Feature } from "../../src/core/features/schema";

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());
const idle = (page: Page) => page.evaluate(() => window.dgmEditor!.idle());

async function clickTile(page: Page, x: number, y: number, dbl = false) {
  const p = await page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), [x, y]);
  if (dbl) await page.mouse.dblclick(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** The preview card after a tool's gesture: wait for the plan. */
async function preview(page: Page) {
  const card = page.getByRole("complementary", { name: "Preview" });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("Planning…")).toHaveCount(0, { timeout: 30_000 });
  return card;
}

test("the land and water tools: plan, preview, place", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./#s=4242&z=96&d=n&t=riverValley&lk=0");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  let i = await info(page);
  const W = i.W;
  const main = i.features.find((f) => f.kind === "river")!;
  const path = (main.params as { path: [number, number][] }).path;
  const start = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;

  // a river from the north edge into the generated river, away from the start
  await page.getByRole("tab", { name: "Water" }).click();
  await page.locator(".tools").getByRole("button", { name: "River", exact: true }).click();
  const far = start[0] < W / 2 ? 74 : 22;
  const join = path.reduce((best, p) => (Math.abs(p[0] - far) < Math.abs(best[0] - far) ? p : best));
  await clickTile(page, far, W - 1);
  await clickTile(page, far, Math.round((W - 1 + join[1]) / 2));
  await clickTile(page, Math.round(join[0]), Math.round(join[1]), true);
  let card = await preview(page);
  await expect(card).toContainText(/a sealed mouth on the north edge feeds it/i);
  await card.getByRole("button", { name: "Place" }).click();
  await idle(page);
  i = await info(page);
  expect(i.history.map((h) => h.label)).toEqual(["Add river"]);
  const drawn = i.features.find((f) => f.kind === "river" && f.origin === "user") as Extract<Feature, { kind: "river" }>;
  expect(drawn.params.entry).toEqual({ edge: "north" });
  expect(drawn.params.exit).toEqual({ river: main.id });
  // its channel carries water: hover a tile of it
  const q = await page.evaluate(([x, y]) => window.dgmEditor!.tileToClient(x, y), [far, W - 6]);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator(".readout")).toContainText(/water \d/);

  // a dam site: one click on the generated river, then Place
  await page.locator(".tools").getByRole("button", { name: "Dam site", exact: true }).click();
  const mid = path[Math.floor(path.length * 0.75)];
  await clickTile(page, Math.round(mid[0]), Math.round(mid[1]));
  card = await preview(page);
  await expect(card).toContainText(/holds about|would not hold water/);
  await card.getByRole("button", { name: "Place" }).click();
  await idle(page);
  expect((await info(page)).history.map((h) => h.label)).toEqual(["Add river", "Add dam site"]);

  // a standalone waterfall, 12 wide: the first spot in the south-west where it fits
  await page.locator(".tools").getByRole("button", { name: "Waterfall", exact: true }).click();
  await page.getByLabel("Width (tiles)").fill("12");
  await page.getByLabel("Width (tiles)").dispatchEvent("change");
  await page.getByLabel("Falls toward").selectOption("south");
  let placed = false;
  for (const [x, y] of [
    [24, 22],
    [30, 18],
    [70, 20],
    [60, 16],
    [16, 30],
  ]) {
    await clickTile(page, x, y);
    card = await preview(page);
    if (await card.getByRole("button", { name: "Place" }).count()) {
      await expect(card).toContainText(/springs? of .* feed its header pool/);
      await card.getByRole("button", { name: "Place" }).click();
      placed = true;
      break;
    }
    await card.getByRole("button", { name: "OK" }).click();
  }
  expect(placed).toBe(true);
  await idle(page);
  i = await info(page);
  const fall = i.features.find((f) => f.kind === "setPiece" && (f.params as { kind: string }).kind === "waterfall" && f.origin === "user");
  expect(fall).toBeTruthy();
  expect(((fall!.params as unknown as { plan: { width: number } }).plan).width).toBe(12);
  await page.getByRole("button", { name: "Done" }).click();

  // the inspector changes the fall: a drop of 4, planned again
  await page.evaluate((id) => window.dgmEditor!.select(id), fall!.id);
  await page.getByRole("complementary", { name: /Waterfall, selected/ }).getByLabel("Drop (levels)").fill("4");
  await page.getByRole("complementary", { name: /Waterfall, selected/ }).getByLabel("Drop (levels)").dispatchEvent("change");
  await idle(page);
  i = await info(page);
  expect(((i.features.find((f) => f.id === fall!.id)!.params as unknown as { plan: { drop: number } }).plan).drop).toBe(4);
  expect(i.history.at(-1)!.label).toBe("Change waterfall");
  expect(errors).toEqual([]);
});

test("the start: its footprint and what is nearby while it moves; a broken start gets a one-click fix", async ({ page }) => {
  await page.goto("./#s=77&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  await page.getByRole("tab", { name: "Start" }).click();
  await page.locator(".feature-list").getByRole("button", { name: "Start", exact: true }).click();
  // nudge it one tile: the indicators read the spot
  await page.getByRole("button", { name: /^Move Start/ }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: /The district center fits here|Does not fit/ })).toBeVisible();
  await expect(page.locator(".start-indicators")).toContainText(/Trees nearby: \d+/);
  await idle(page);
  await page.waitForTimeout(900);
  await idle(page);

  // turn its door to the south and move it to the south edge: its door is off the map, a load
  // problem the instant check shows at once, with its fix
  let i = await info(page);
  const inspector = page.getByRole("complementary", { name: "Start, selected" });
  for (let k = 0; k < 4 && !(await inspector.textContent())!.includes("door faces south"); k++) {
    await inspector.getByRole("button", { name: "Turn" }).click();
    await idle(page);
  }
  await expect(inspector).toContainText("door faces south");
  i = await info(page);
  const [, sy] = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;
  const handle = page.getByRole("button", { name: /^Move Start/ });
  await handle.focus();
  for (let k = 0; k < sy - 1; k++) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(900);
  await idle(page);
  const problems = page.getByRole("alert").filter({ hasText: /This edit made/ });
  await expect(problems).toBeVisible({ timeout: 30_000 });
  await problems.getByRole("button", { name: "Move the start to the nearest good spot" }).first().click();
  await idle(page);
  i = await info(page);
  expect(i.history.at(-1)!.label).toBe("Move the start to the nearest good spot");
  expect(await page.evaluate(() => window.dgmEditor!.instant().length)).toBe(0);
});
