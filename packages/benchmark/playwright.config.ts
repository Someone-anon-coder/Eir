import { defineConfig } from "@playwright/test";

// Deliberately no `webServer` block: the harness (src/devServer.ts) owns
// Ward's dev-server lifecycle directly, because a single `pnpm bench`
// invocation needs *two* server processes with different env (control,
// then mutated) — Playwright's `webServer` config is built for one static
// process per config load, not a mid-run restart with a different env.
export default defineConfig({
  testDir: "./probes",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  workers: 1,
  reporter: "json",
  // A "missed" outcome is a genuine zero-match/detached failure — Playwright
  // won't resolve that any faster by waiting longer, so there's no reason to
  // sit through the 30s default on every mutated probe. Short and uniform
  // across control and mutated runs, so a control-run probe that's merely
  // slow (not broken) still has a fair chance to pass.
  timeout: 8_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
    actionTimeout: 5_000,
    navigationTimeout: 8_000,
  },
});
