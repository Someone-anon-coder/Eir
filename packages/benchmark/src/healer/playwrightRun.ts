import { spawn } from "node:child_process";
import path from "node:path";
import type { JSONReport, JSONReportSuite } from "@playwright/test/reporter";

export interface SpecResult {
  readonly title: string;
  readonly status: string;
}

export interface PlaywrightRun {
  readonly results: readonly SpecResult[];
  /** Every spec reported exactly `expected` (passed, not skipped or flaky). */
  readonly allPassed: boolean;
  readonly reportParsed: boolean;
}

function collect(suites: readonly JSONReportSuite[]): SpecResult[] {
  const out: SpecResult[] = [];
  for (const suite of suites) {
    for (const spec of suite.specs) {
      const test = spec.tests[0];
      out.push({ title: spec.title, status: test?.status ?? "unknown" });
    }
    if (suite.suites !== undefined) out.push(...collect(suite.suites));
  }
  return out;
}

/** Runs `playwright test` from a workspace and reads the JSON report from stdout. A red run is a normal result, not an error. */
export function runPlaywright(
  cwd: string,
  files: readonly string[],
  env: Readonly<Record<string, string>> = {},
  timeoutMs = 180_000,
  extraArgs: readonly string[] = [],
): Promise<PlaywrightRun> {
  return new Promise((resolve) => {
    const child = spawn(
      path.join(cwd, "node_modules", ".bin", "playwright"),
      ["test", ...files, "--reporter=json", ...extraArgs],
      {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "ignore"],
        detached: true,
      },
    );
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      try {
        const report = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as JSONReport;
        const results = collect(report.suites);
        resolve({
          results,
          allPassed: results.length > 0 && results.every((r) => r.status === "expected"),
          reportParsed: true,
        });
      } catch {
        resolve({ results: [], allPassed: false, reportParsed: false });
      }
    });
  });
}
