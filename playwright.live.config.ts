import { defineConfig } from "@playwright/test";

// The live check (.github/workflows/live-check.yml, tests/live): the deployed site, not a local
// build, so there is no web server. DGM_LIVE_URL points it at another address, e.g. a local preview.
// Locally it uses the installed Chrome (channel "chrome"); CI installs Playwright's Chromium.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome");

export default defineConfig({
  testDir: "tests/live",
  timeout: 900_000,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.DGM_LIVE_URL ?? "https://timbermods.github.io/dam-good-maps/",
    channel,
  },
});
