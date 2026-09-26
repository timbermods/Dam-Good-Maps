// ROADMAP M7 through the page: an object shows its footprint under the pointer, green where the
// game keeps it and red where the game would delete it, and a click there is refused; a weir closes
// a river; a river turned to badwater shows its warnings first; advanced mode places an object by
// hand and delays a water source with numeric fields.

import { expect, test, type Page } from "@playwright/test";

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());
const idle = (page: Page) => page.evaluate(() => window.dgmEditor!.idle());
const plan = (page: Page) => page.evaluate(() => window.dgmEditor!.plan());

async function refine(page: Page, hash: string) {
  await page.goto(`./#${hash}`);
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
}

async function client(page: Page, x: number, y: number) {
  return page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), [x, y] as [number, number]);
}

async function clickTile(page: Page, x: number, y: number) {
  const p = await client(page, x, y);
  await page.mouse.click(p.x, p.y);
  await idle(page);
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await client(page, from[0], from[1]);
  const b = await client(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  await idle(page);
}

/** Hover a tile with an object tool and wait for its footprint check. */
async function fitAt(page: Page, x: number, y: number, W: number): Promise<{ tiles: number[]; problem: string | null }> {
  const p = await client(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 2 });
  const i = y * W + x;
  await page.waitForFunction((k) => !!window.dgmEditor!.fit()?.tiles.includes(k), i, { timeout: 10_000 });
  return (await page.evaluate(() => window.dgmEditor!.fit()))!;
}

/** A tile of the main river's path, part way down it. */
async function riverTile(page: Page, share: number): Promise<[number, number]> {
  const i = await info(page);
  const river = i.features.find((f) => f.kind === "river" && "edge" in (f.params as { entry: object }).entry)!;
  const path = (river.params as { path: [number, number][] }).path;
  const k = Math.min(path.length - 1, Math.round(share * (path.length - 1)));
  return [Math.round(path[k][0]), Math.round(path[k][1])];
}

/** Level tiles away from the start and the rivers, nearest the middle first: where to try an object. */
async function candidates(page: Page): Promise<[number, number][]> {
  const i = await info(page);
  const start = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;
  const paths = i.features.filter((f) => f.kind === "river").flatMap((f) => (f.params as { path: [number, number][] }).path);
  const heightAt = (x: number, y: number) => page.evaluate(([a, b]) => window.dgm3d!.renderer.heightAt(a, b), [x, y] as [number, number]);
  const out: [number, number][] = [];
  for (let y = 8; y < i.H - 8; y += 6)
    for (let x = 8; x < i.W - 8; x += 6) {
      if (Math.abs(x - start[0]) + Math.abs(y - start[1]) < 16) continue;
      if (paths.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 10)) continue;
      out.push([x, y]);
    }
  out.sort((a, b) => Math.abs(a[0] - i.W / 2) + Math.abs(a[1] - i.H / 2) - (Math.abs(b[0] - i.W / 2) + Math.abs(b[1] - i.H / 2)));
  const level: [number, number][] = [];
  for (const [x, y] of out) {
    const h = await heightAt(x, y);
    if ((await heightAt(x + 1, y)) === h && (await heightAt(x, y + 1)) === h && (await heightAt(x - 1, y)) === h && (await heightAt(x, y - 1)) === h) level.push([x, y]);
  }
  return level;
}

async function greenSpot(page: Page, W: number): Promise<[number, number]> {
  for (const [x, y] of await candidates(page)) {
    const f = await fitAt(page, x, y, W);
    if (!f.problem) return [x, y];
  }
  throw new Error("no place for the object");
}

test("an object is red where the game would delete it, refused there, and placed where it fits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await refine(page, "s=4242&z=96&d=n&t=riverValley");
  const W = (await info(page)).W;
  await page.getByRole("tab", { name: "Resources" }).click();
  await page.getByRole("button", { name: "Relic", exact: true }).click();
  await page.getByLabel("Size").selectOption("medium");
  // on the river: red, with the reason, and a click is refused
  const [rx, ry] = await riverTile(page, 0.5);
  const red = await fitAt(page, rx, ry, W);
  expect(red.problem).toMatch(/does not fit there/);
  expect(red.tiles.length).toBe(6);
  await expect(page.getByRole("status").filter({ hasText: "Can't go here" })).toBeVisible();
  await clickTile(page, rx, ry);
  const card = page.getByRole("complementary", { name: "Preview" });
  await expect(card.getByRole("alert")).toContainText(/does not fit there/);
  await expect(card.getByRole("button", { name: "Place" })).toHaveCount(0);
  await card.getByRole("button", { name: "OK" }).click();
  expect((await info(page)).history).toEqual([]);
  // on level, dry ground: green, and placed
  const [x, y] = await greenSpot(page, W);
  await clickTile(page, x, y);
  expect((await plan(page))!.ok).toBe(true);
  await card.getByRole("button", { name: "Place" }).click();
  await idle(page);
  const i = await info(page);
  expect(i.history.map((h) => h.label)).toEqual(["Add medium relic"]);
  expect(i.features.filter((f) => f.kind === "mapObject" && f.origin === "user").map((f) => (f.params as { kind: string }).kind)).toEqual(["relicMedium"]);
  expect(await page.evaluate(() => window.dgmEditor!.instant())).toEqual([]);
  expect(errors).toEqual([]);
});

test("a weir closes a river, a badwater river warns first, and advanced mode delays a water source", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await refine(page, "s=4242&z=96&d=n&t=riverValley");
  const W = (await info(page)).W;

  // a weir: click the river, then Place
  await page.getByRole("tab", { name: "Water" }).click();
  await page.getByRole("button", { name: "Weir", exact: true }).click();
  let placed = false;
  for (const share of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    const [x, y] = await riverTile(page, share);
    await clickTile(page, x, y);
    const p = (await plan(page))!;
    if (p.ok) {
      await page.getByRole("complementary", { name: "Preview" }).getByRole("button", { name: "Place" }).click();
      await idle(page);
      placed = true;
      break;
    }
    await page.getByRole("complementary", { name: "Preview" }).getByRole("button", { name: "OK" }).click();
  }
  expect(placed).toBe(true);
  await page.getByRole("button", { name: "Done" }).click();
  expect((await info(page)).history.map((h) => h.label)).toEqual(["Add weir"]);

  // the main river turned to badwater: its warnings first, then Undo takes it back
  const river = (await info(page)).features.find((f) => f.kind === "river" && "edge" in (f.params as { entry: object }).entry)!;
  await page.evaluate((id) => window.dgmEditor!.select(id), river.id);
  await page.getByRole("complementary", { name: /selected/ }).getByRole("button", { name: "Make it badwater" }).click();
  await idle(page);
  const card = page.getByRole("complementary", { name: "Preview" });
  await expect(card).toContainText(/beavers can't drink it/);
  await card.getByRole("button", { name: "Place" }).click();
  await idle(page);
  expect(((await info(page)).features.find((f) => f.id === river.id)!.params as { badwater: boolean }).badwater).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await idle(page);
  await page.keyboard.press("Escape");

  // advanced mode: a water source placed by hand, then delayed to cycle 3
  await page.getByRole("tab", { name: "Resources" }).click();
  await page.getByLabel("Advanced").check();
  await expect(page.getByRole("button", { name: "Unstable core", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Object", exact: true }).click();
  await page.getByRole("combobox", { name: "Object" }).selectOption("WaterSource");
  const [x, y] = await greenSpot(page, W);
  await clickTile(page, x, y);
  await page.getByRole("complementary", { name: "Preview" }).getByRole("button", { name: "Place" }).click();
  await idle(page);
  await page.getByRole("button", { name: "Done" }).click();
  await clickTile(page, x, y);
  const inspector = page.getByRole("complementary", { name: "Water source, selected" });
  await expect(inspector).toBeVisible();
  // the checkbox shows the map's state: it turns on once the edit is made
  await inspector.getByLabel("Turns on later").click();
  await idle(page);
  await expect(inspector.getByLabel("Turns on later")).toBeChecked();
  await inspector.getByLabel("In cycle").fill("3");
  await inspector.getByLabel("In cycle").press("Enter");
  await idle(page);
  await expect(inspector.getByLabel("Turns on later")).toBeChecked();
  await expect(inspector.getByLabel("In cycle")).toHaveValue("3");
  expect((await info(page)).history.filter((h) => h.applied).map((h) => h.label)).toEqual(["Add weir", "Place water source", "Change an object", "Change an object"]);
  expect(errors).toEqual([]);
});
