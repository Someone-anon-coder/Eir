import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { JSONReport, JSONReportSuite, JSONReportSpec } from "@playwright/test/reporter";
import { readGroundTruthFile, type QuantizedBoundingBox } from "./groundTruthFile.js";
import { readMatchLogFile, type MatchLogEntry } from "./matchLog.js";

const BENCHMARK_DIR = new URL("..", import.meta.url).pathname;

export interface ProbeTestResult {
  readonly targetId: string;
  readonly passed: boolean;
  readonly errorMessage: string | undefined;
  /** Eir's own recorded heal attempt for this target's failure, if any (Phase 5). */
  readonly matchAttempt: MatchLogEntry | undefined;
  /** near-duplicate-sibling-swap only: the distractor's live bbox, read independently of Eir (Phase 5 ground truth). */
  readonly distractorBBox: QuantizedBoundingBox | null | undefined;
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

function toProbeResult(
  spec: JSONReportSpec,
  matchLog: ReadonlyMap<string, readonly MatchLogEntry[]>,
  groundTruth: ReadonlyMap<string, QuantizedBoundingBox | null>,
): ProbeTestResult {
  const test = spec.tests[0];
  const result = test?.results[0];
  const errorMessage = result?.error?.message ?? result?.errors[0]?.message;
  return {
    targetId: spec.title,
    passed: spec.ok,
    errorMessage,
    matchAttempt: matchLog.get(spec.title)?.[0],
    distractorBBox: groundTruth.get(spec.title),
  };
}

/**
 * Spawns `playwright test` against the already-running dev server (started
 * by `devServer.ts`) with `EIR_BENCH_CLASS`/`EIR_BENCH_SEED` set — the same
 * two env vars `probes/probe.spec.ts` reads to generate its test list. A
 * nonzero exit code is the *expected* outcome once a mutation is live
 * (every generated test is supposed to fail), so it is never treated as an
 * invocation error — only a missing/unparseable report file is.
 *
 * Also sets `EIR_MATCH_LOG_FILE`/`EIR_GROUND_TRUTH_FILE` — Phase 5's two
 * opt-in channels (Eir's own recorded match attempts; this harness's
 * independent near-dup distractor readings) — and reads both back
 * alongside the JSON test report, merging them into each `ProbeTestResult`
 * by target id (== Playwright test title) rather than execution order.
 */
export async function runProbeSuite(
  mutationClass: string,
  seed: number,
): Promise<readonly ProbeTestResult[]> {
  const outputFile = path.join(BENCHMARK_DIR, `.probe-report-${randomUUID()}.json`);
  const matchLogFile = path.join(BENCHMARK_DIR, `.probe-matchlog-${randomUUID()}.jsonl`);
  const groundTruthFile = path.join(BENCHMARK_DIR, `.probe-groundtruth-${randomUUID()}.jsonl`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "playwright", "test"], {
      cwd: BENCHMARK_DIR,
      env: {
        ...process.env,
        EIR_BENCH_CLASS: mutationClass,
        EIR_BENCH_SEED: String(seed),
        PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile,
        EIR_MATCH_LOG_FILE: matchLogFile,
        EIR_GROUND_TRUTH_FILE: groundTruthFile,
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

  const [matchLog, groundTruth] = await Promise.all([
    readMatchLogFile(matchLogFile),
    readGroundTruthFile(groundTruthFile),
  ]);
  await Promise.all([unlink(matchLogFile).catch(() => {}), unlink(groundTruthFile).catch(() => {})]);

  const report = JSON.parse(raw) as JSONReport;
  return collectSpecs(report.suites).map((spec) => toProbeResult(spec, matchLog, groundTruth));
}
