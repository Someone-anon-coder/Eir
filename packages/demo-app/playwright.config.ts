import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Merges every worker's fingerprint shard into `.eir/routes/*.json` after
  // all workers have finished (Phase 3 — the store must never be written
  // from more than one process at a time). A bare package specifier, not
  // `require.resolve` — this project is ESM (`"type": "module"`), and
  // Playwright resolves this string with Node's own module resolution.
  globalTeardown: "playwright-eir/globalTeardown",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  // "list" for human console output; playwright-eir's own reporter (Phase
  // 6) alongside it, writing eir-report.json/.md + screenshots — real
  // dogfooding, not just unit-tested in isolation.
  reporter: [["list"], ["playwright-eir/reporter"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // Phase 7 discovery, Phase 9 engine-level fix (RISK-011): without this,
    // a vanished locator runs out the *test's* 30s timeout instead of a
    // bounded action timeout. `classifyFailureSpecies` was widened in
    // Phase 9 to a case-insensitive match, so it now recognizes both
    // message shapes and Eir's triage no longer silently dies without this
    // setting — its remaining value here is diagnosis *speed* (5s vs.
    // 30s+ before a broken selector's triage/match/report pipeline even
    // starts), not correctness. Matches `packages/benchmark`'s own config.
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
