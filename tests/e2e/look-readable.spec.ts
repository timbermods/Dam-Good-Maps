// Map look's fix round (PLAN §20 D114) in the page: the 3D view's legend names every meaning it
// draws, with a note that some objects grow from afar, and the preview's best dam site is hatched
// (overlay alpha 255), so it reads on any ground or water.

import { expect, test } from "@playwright/test";

test("the 3D legend names every meaning, and the best dam site is hatched", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./#s=4242&z=96&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForFunction(() => !!window.dgm3d, null, { timeout: 60_000 });
  const legend = page.locator(".view3d-legend");
  for (const text of ["Living trees and bushes", "The start: district center", "Slopes: arrows point uphill", "Ruins", "Mine site", "Geothermal field", "Water source", "Badwater source", "Water mixed with badwater", "Best dam site", "drawn larger"])
    await expect(legend).toContainText(text);
  const hatched = await page.evaluate(() => {
    const d = window.dgm3d!.renderer.overlayData()!;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] === 255) n++;
    return n;
  });
  expect(hatched).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
