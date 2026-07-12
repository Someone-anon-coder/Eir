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
    // Phase 7 discovery: without this, a vanished locator never produces
    // Playwright's own action-timeout error — it runs out the *test's*
    // 30s timeout instead ("Test timeout of 30000ms exceeded.", lowercase
    // "timeout"), which `classifyFailureSpecies` doesn't recognize as
    // zero-match (it looks for capital-T "Timeout", the shape a bounded
    // action timeout actually produces — see NOTES.md RISK-011). Matches
    // `packages/benchmark`'s own config, which already set this and is
    // exactly why its probes correctly exercised Eir's triage while this
    // suite silently didn't.
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
