import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// The site is served from https://timbermods.github.io/dam-good-maps/ (PLAN §20, D12).
// DGM_BASE overrides it for local previews and the end-to-end tests.
export default defineConfig({
  base: process.env.DGM_BASE ?? "/dam-good-maps/",
  plugins: [preact()],
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: true,
    // the 3D view's chunk (three.js) is about 570 KB; it loads only when a player opens 3D
    chunkSizeWarningLimit: 700,
  },
});
