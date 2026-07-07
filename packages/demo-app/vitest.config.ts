import { defineConfig } from "vitest/config";

// Unit tests live under src/ (Vitest); the Playwright reference/benchmark
// suites live under tests/ and probes/ and must never be collected here —
// they import `playwright-eir`'s `test`, not Vitest's.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
