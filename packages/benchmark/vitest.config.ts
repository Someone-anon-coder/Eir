import { defineConfig } from "vitest/config";

// Unit tests live under src/ (Vitest); probes/ holds the Playwright probe
// spec, which must never be collected here — it imports `playwright-eir`'s
// `test`, not Vitest's, and reads env vars the harness sets at bench time.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
