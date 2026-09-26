// ROADMAP M4 acceptance: generate → refine → back to settings → regenerate → refine keeps the
// player's edits, through the page itself. Also: the editor's tools, handles, undo and redo, the
// history, export from both screens, and the autosave after a reload.

import { expect, test, type Page } from "@playwright/test";

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await page.evaluate(([x, y]) => window.dgmEditor!.tileToClient(x, y), from);
  const b = await page.evaluate(([x, y]) => window.dgmEditor!.tileToClient(x, y), to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  await page.evaluate(() => window.dgmEditor!.idle());
}

const info = (page: Page) => page.evaluate(() => window.dgmEditor!.info());

test("generate → refine → back to settings → regenerate → refine keeps the player's edits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });

  // refine: the editor opens the generated map in 3D
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "River Valley" })).toBeVisible();
  expect((await page.evaluate(() => window.dgm3d!.renderer.info())).triangles).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Top-down" }).click();

  // the player's own edits: a stroke of the Lower brush, and a water source (the brush kit and the
  // water, D182, D184)
  let i = await info(page);
  const W = i.W;
  const start0 = (i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position;
  const x = start0[0] < W / 2 ? Math.round(W * 0.78) : Math.round(W * 0.22);
  const lowered: [number, number] = [x, 12];
  const ground = await page.evaluate(([a, b]) => window.dgm3d!.renderer.heightAt(a, b), lowered);
  await page.getByRole("button", { name: "Lower brush (2)" }).click();
  await drag(page, [lowered[0] - 3, lowered[1]], [lowered[0] + 3, lowered[1]]);
  await page.waitForFunction(() => window.dgmEditor!.pendingTerrain() === 0, null, { timeout: 30_000 });
  await page.keyboard.press("Escape");
  // a spring on dry, empty ground north of the stroke
  const spring = await page.evaluate(
    ([cx, y0]) => {
      const m = window.dgm3d!.renderer.mapState()!;
      for (let y = y0; y < m.H - 4; y++)
        for (const x2 of [cx, cx - 4, cx + 4]) {
          if (m.surface.depth[y * m.W + x2] > 0) continue;
          let empty = true;
          for (let k = 0; k < m.entities.count && empty; k++) if (Math.abs(m.entities.x[k] - x2) <= 2 && Math.abs(m.entities.y[k] - y) <= 2) empty = false;
          if (empty) return [x2, y] as [number, number];
        }
      return null;
    },
    [x, 20] as const,
  );
  expect(spring).not.toBeNull();
  await page.getByRole("tab", { name: "Water" }).click();
  await page.getByRole("region", { name: "Add" }).getByRole("button", { name: "Source", exact: true }).click();
  const sp = await page.evaluate(([a, b]) => window.dgmEditor!.tileToClient(a, b), spring!);
  await page.mouse.click(sp.x, sp.y);
  await page.evaluate(() => window.dgmEditor!.idle());
  await page.getByRole("button", { name: "Done" }).click();
  i = await info(page);
  expect(i.history.map((h) => h.label)).toEqual([expect.stringMatching(/^Lower, \d+ tiles$/), "Place water source"]);
  const springs = () => page.evaluate(async ([a, b]) => (await window.dgmEditor!.worker.entitiesAt(a, b)).filter((e) => e.template === "WaterSource").length, spring!);
  expect(await springs()).toBe(1);

  // an edit of what the generator made: move the start two tiles with its handle's arrow keys
  await page.getByRole("tab", { name: "Start" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const before = i.features.find((f) => f.kind === "start")!.params as { position: [number, number] };
  await page.getByRole("button", { name: /^Move Start/ }).focus();
  // (west: the berry bushes this map plants for its start stay within reach; two tiles east, 12
  // of them fall outside the 20 tiles start.food counts, and export would warn)
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await info(page)).history.length, { timeout: 30_000 }).toBe(3);
  await page.evaluate(() => window.dgmEditor!.idle());
  i = await info(page);
  const moved = i.features.find((f) => f.kind === "start")!.params as { position: [number, number] };
  expect(moved.position).toEqual([before.position[0] - 2, before.position[1]]);

  // undo and redo, and the history list
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.evaluate(() => window.dgmEditor!.idle());
  expect((await info(page)).history.map((h) => h.applied)).toEqual([true, true, false]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.evaluate(() => window.dgmEditor!.idle());
  await page.getByRole("button", { name: /^History/ }).click();
  await expect(page.getByRole("complementary", { name: "History" }).getByRole("button", { name: "Move start" })).toBeVisible();

  // export from the editor (export profile): the map is ready to play
  await page.getByRole("button", { name: "Export .timber" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/checks pass/)).toBeVisible({ timeout: 60_000 });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("River Valley (4242).timber");
  await dialog.getByRole("button", { name: "Done" }).click();

  // back to settings: the card shows the edited map; change a setting and generate again
  await page.getByRole("button", { name: "Back to settings" }).click();
  await expect(page.getByRole("button", { name: "Generate, keeping my edits" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Your 3 edits stay/)).toBeVisible();
  await page.getByLabel("Designed for").selectOption("hard");
  await page.getByRole("button", { name: "Generate, keeping my edits" }).click();
  await expect(page.getByText(/seed 4242 · designed for hard/)).toBeVisible({ timeout: 120_000 });
  // export from the settings page too
  await page.getByRole("button", { name: /^Export River Valley/ }).click();
  await expect(page.getByRole("dialog").getByText(/checks pass|Warnings/)).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press("Escape");

  // refine again: the edits are all there, and the regeneration is one more step in the history
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor, null, { timeout: 60_000 });
  i = await info(page);
  expect(i.spec!.designedFor).toBe("hard");
  expect(i.history.map((h) => h.label)).toEqual([expect.stringMatching(/^Lower, \d+ tiles$/), "Place water source", "Move start", "Change settings and regenerate"]);
  expect(i.edits).toBe(3);
  expect(i.orphans).toEqual([]);
  expect((i.features.find((f) => f.kind === "start")!.params as { position: [number, number] }).position).toEqual(moved.position);
  // the lowered ground stays so on the new map, and the spring is there
  expect(await page.evaluate(([a, b]) => window.dgm3d!.renderer.heightAt(a, b), lowered)).toBeLessThan(ground);
  expect(await springs()).toBe(1);

  // the autosave: a reload in the editor opens the same map with its edits
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForFunction(() => !!window.dgmEditor, null, { timeout: 60_000 });
  const again = await info(page);
  expect(again.history.length).toBe(3); // a reopened document's history starts at its generation
  expect(again.edits).toBe(3);
  expect(await springs()).toBe(1);
  expect(errors).toEqual([]);
});

test("a feature is selected by clicking it, and its delete handle refuses what others build on", async ({ page }) => {
  await page.goto("./#s=77&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  // click the start's tile: the start is selected, with its handles
  const start = (await info(page)).features.find((f) => f.kind === "start")!.params as { position: [number, number] };
  const p = await page.evaluate(([x, y]) => window.dgmEditor!.tileToClient(x, y), start.position);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("complementary", { name: "Start, selected" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete Start" })).toBeVisible();
  // the river: the valley builds on it, so deleting it is refused with the reason
  await page.getByRole("tab", { name: "Water" }).click();
  await page.locator(".feature-list").getByRole("button", { name: "River", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete River" }).click();
  await expect(page.getByRole("alert")).toContainText(/build on this river/);
  expect((await info(page)).edits).toBe(0);
  // hover reads the tile in plain words
  const q = await page.evaluate(() => window.dgmEditor!.tileToClient(40, 40));
  await page.mouse.move(q.x, q.y);
  await expect(page.locator(".readout")).toContainText(/height \d+/);
});
