import { defineConfig } from "vitest/config";

// The investigation's own tests (npx vitest run -c investigation/claude/vitest.config.ts).
export default defineConfig({
  test: {
    root: __dirname,
    include: ["tests/**/*.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
