import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { JSONReport, JSONReportSuite, JSONReportSpec } from "@playwright/test/reporter";

const BENCHMARK_DIR = new URL("..", import.meta.url).pathname;

export interface ProbeTestResult {
  readonly targetId: string;
  readonly passed: boolean;
  readonly errorMessage: string | undefined;
}

function collectSpecs(suites: readonly JSONReportSuite[]): JSONReportSpec[] {
  const specs: JSONReportSpec[] = [];
  for (const suite of suites) {
    specs.push(...suite.specs);
    if (suite.suites !== undefined) {
      specs.push(...collectSpecs(suite.suites));
    }
  }
  return specs;
}

function toProbeResult(spec: JSONReportSpec): ProbeTestResult {
  const test = spec.tests[0];
  const result = test?.results[0];
  const errorMessage = result?.error?.message ?? result?.errors[0]?.message;
  return {
    targetId: spec.title,
    passed: spec.ok,
    errorMessage,
  };
}

/**
 * Spawns `playwright test` against the already-running dev server (started
 * by `devServer.ts`) with `EIR_BENCH_CLASS`/`EIR_BENCH_SEED` set — the same
 * two env vars `probes/probe.spec.ts` reads to generate its test list. A
 * nonzero exit code is the *expected* outcome once a mutation is live
 * (every generated test is supposed to fail), so it is never treated as an
 * invocation error — only a missing/unparseable report file is.
 */
export async function runProbeSuite(
  mutationClass: string,
  seed: number,
): Promise<readonly ProbeTestResult[]> {
  const outputFile = path.join(BENCHMARK_DIR, `.probe-report-${randomUUID()}.json`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "playwright", "test"], {
      cwd: BENCHMARK_DIR,
      env: {
        ...process.env,
        EIR_BENCH_CLASS: mutationClass,
        EIR_BENCH_SEED: String(seed),
        PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile,
      },
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", () => resolve());
  });

  let raw: string;
  try {
    raw = await readFile(outputFile, "utf-8");
  } catch (error) {
    throw new Error(
      `Probe suite for ${mutationClass}/seed ${seed} produced no readable JSON report at ${outputFile}`,
      { cause: error },
    );
  } finally {
    await unlink(outputFile).catch(() => {});
  }

  const report = JSON.parse(raw) as JSONReport;
  return collectSpecs(report.suites).map(toProbeResult);
}
