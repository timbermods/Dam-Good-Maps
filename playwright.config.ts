import { defineConfig } from "@playwright/test";

// The e2e tests run against the production build, served under the same base as GitHub Pages.
// Locally they use the installed Chrome (channel "chrome"); CI installs Playwright's Chromium.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173/dam-good-maps/",
    channel,
  },
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/dam-good-maps/",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DGM_BASE: "/dam-good-maps/" },
  },
});
