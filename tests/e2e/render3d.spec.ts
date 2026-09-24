// The 3D view (PLAN §14.2, ROADMAP M4) as far as CI can check it: the generator's 3D switch builds
// a 256² map into 64 chunks with water and objects, hover reads tiles in plain words, a terrain
// change remeshes only its chunks, and the camera orbits. The build budget (under 1.5 s at 256²)
// is asserted on a machine with a GPU; CI renders in software (376 ms there in M4), so it gets 3 s
// and the number is logged. The fps budget needs a real GPU and display: `npm run bench:3d`.

import { expect, test } from "@playwright/test";

const BUILD_BUDGET_MS = process.env.CI ? 3_000 : 1_500;

test("the 3D preview builds a 256² map, reads tiles on hover, and remeshes only dirty chunks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./#s=1&z=256&d=n&t=riverValley");
  await expect(page.getByText(/All \d+ checks passed/)).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForFunction(() => !!window.dgm3d, null, { timeout: 60_000 });
  const build = await page.evaluate(() => window.dgm3d!.build);
  console.log(`3D build at 256²: ${build.ms.toFixed(0)} ms (meshing ${build.meshMs.toFixed(0)} ms), ${build.terrainQuads} terrain quads, ${build.waterQuads} water quads, ${build.instances} objects`);
  expect(build.chunks).toBe(64);
  expect(build.terrainQuads).toBeGreaterThan(1000);
  expect(build.waterQuads).toBeGreaterThan(100);
  expect(build.instances).toBeGreaterThan(1000);
  expect(build.ms).toBeLessThan(BUILD_BUDGET_MS);
  const drawn = await page.evaluate(() => window.dgm3d!.renderer.info());
  expect(drawn.triangles).toBeGreaterThan(10_000);

  // hover: the readout names what is under the pointer
  const c = await page.evaluate(() => window.dgm3d!.renderer.tileToClient(128, 128));
  await page.mouse.move(c.x, c.y);
  await expect(page.locator(".readout")).toContainText(/height \d+/);

  // a terrain change remeshes the chunks around it only (a 3×3 raise inside one chunk: 1 chunk;
  // on a chunk corner: the 4 chunks that meet there)
  const counts = await page.evaluate(() => {
    const r = window.dgm3d!.renderer;
    const W = 256;
    const at = (x: number, y: number) => r.heightAt(x, y);
    const heights = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) heights[y * W + x] = at(x, y);
    const a = heights.slice();
    for (let y = 40; y <= 42; y++) for (let x = 40; x <= 42; x++) a[y * W + x] = Math.min(16, a[y * W + x] + 1);
    const one = r.updateTerrain(a);
    const b = a.slice();
    b[31 * W + 31] = Math.min(16, b[31 * W + 31] + 1);
    b[32 * W + 32] = Math.min(16, b[32 * W + 32] + 1);
    const corner = r.updateTerrain(b);
    return { one, corner };
  });
  expect(counts).toEqual({ one: 1, corner: 4 });

  // the top-down view and an orbit render frames
  await page.getByRole("button", { name: "Top-down" }).click();
  await page.getByRole("button", { name: "Orbit" }).click();
  const orbit = await page.evaluate(() => window.dgm3d!.renderer.benchOrbit(1500));
  console.log(`orbit (${process.env.CI ? "software rendering, not a budget" : "this machine"}): ${orbit.fps.toFixed(0)} fps, p95 ${orbit.p95.toFixed(1)} ms`);
  expect(orbit.frames).toBeGreaterThan(5);
  // back to 2D: the canvas preview is still there
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByLabel("Map preview, north up")).toBeVisible();
  expect(errors).toEqual([]);
});
