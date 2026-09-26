// The start requirements in the page (PLAN §5.6, D85, D164; ROADMAP M8's start acceptance): the map
// card lists the three requirements with the validator's numbers and the map's own settings, and
// the editor's start indicators and its green or red footprint follow them while the start moves.
// Water is the walk over the map's own ground and slopes (D153); wood is in logs (D164).

import { expect, test, type Page } from "@playwright/test";

type Check = { id: string; ok: boolean; value?: number | string; limit?: number | string; where?: { tiles?: [number, number][] } };
const WOOD_WORDS = "(, (all|mostly) [a-z]+|, [a-z]+ and [a-z]+)?";

async function checks(page: Page): Promise<Record<string, Check>> {
  const cur = await page.evaluate(() => window.dgm!.current!());
  return Object.fromEntries(cur!.checks.map((c) => [c.id, c]));
}

test("the map card lists the start requirements, and the editor's start follows them", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./#s=77&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });

  // the card: each requirement, met, with the validator's number and Normal's defaults
  let c = await checks(page);
  const req = page.getByRole("region", { name: "Start requirements" });
  await expect(req.locator('[data-check="start.water"]')).toHaveText(`Water without stairs: ${c["start.water"].value} tiles' walk (at most 20)`);
  await expect(req.locator('[data-check="start.wood"]')).toHaveText(new RegExp(`^Starting wood: ${c["start.wood"].value} logs within 20 tiles' walk${WOOD_WORDS} \\(at least 120\\)$`));
  await expect(req.locator('[data-check="start.food"]')).toHaveText(`Starting bushes: ${c["start.food"].value} living within 20 tiles' walk (at least 30)`);
  for (const id of ["start.water", "start.wood", "start.food"]) await expect(req.locator(`[data-check="${id}"]`)).toHaveClass(/\bok\b/);

  // the settings are the thresholds: Minimum starting wood 75 moves the card's number
  await page.locator("summary", { hasText: /^Advanced: start rules$/ }).click();
  await page.getByLabel("Minimum starting wood (logs)").fill("75");
  await page.getByLabel("Minimum starting wood (logs)").dispatchEvent("change");
  await page.getByRole("button", { name: /Generate/ }).click();
  await expect(page).toHaveURL(/&sl=75/, { timeout: 60_000 });
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 60_000 });
  c = await checks(page);
  expect(c["start.wood"].limit).toBe(75);
  await expect(req.locator('[data-check="start.wood"]')).toContainText("(at least 75)");

  // the editor: the indicators name the three requirements with the map's numbers
  await page.getByRole("button", { name: "Refine this map" }).click();
  await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Top-down" }).click();
  await page.getByRole("tab", { name: "Start" }).click();
  await page.locator(".feature-list").getByRole("button", { name: "Start", exact: true }).click();
  const handle = page.getByRole("button", { name: /^Move Start/ });
  await handle.focus();
  // a nudge there and back: the indicators read the start's own place, which the validator passed
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  const box = page.locator(".start-indicators");
  await expect(box).toContainText(/Water without stairs: [\d.]+ tiles' walk \(at most 20\)/);
  await expect(box).toContainText(new RegExp(`Starting wood: \\d+ logs${WOOD_WORDS} \\(at least 75\\)`));
  await expect(box).toContainText(/Starting bushes: \d+ \(at least 30\)/);
  const near = await page.evaluate(() => window.dgmEditor!.startCheck());
  expect(near!.problem).toBeNull();
  expect(near!.meets).toBe(true);
  // the page's walks give the validator's water distance and its wood (every tree in reach, by
  // its species' logs); it counts every bush that is not dead, so at least the validator's living
  // ones (D105)
  expect(near!.water).toBe(c["start.water"].value);
  expect(near!.wood).toBe(c["start.wood"].value);
  expect(near!.bushes).toBeGreaterThanOrEqual(c["start.food"].value as number);
  await expect(box.getByRole("paragraph").first()).toHaveText("The district center fits here");

  // walked away from the river, the water is too far, or the wood and bushes fall short: the
  // footprint turns red and says which requirement it misses
  const start = (await page.evaluate(() => window.dgmEditor!.info())).features.find((f) => f.kind === "start")!.params as { position: [number, number] };
  const water = c["start.water"].where!.tiles![0];
  const away = water[1] > start.position[1] ? "ArrowDown" : "ArrowUp";
  let far = near;
  for (let k = 0; k < 40 && far!.meets; k++) {
    await page.keyboard.press(away);
    far = await page.evaluate(() => window.dgmEditor!.startCheck());
  }
  expect(far!.meets).toBe(false);
  await expect(box.getByRole("paragraph").first()).toHaveText(/Fits, but misses a start requirement|Does not fit/);
  await expect(box.locator("li.low").first()).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
