import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { JSONReport, JSONReportSuite, JSONReportSpec } from "@playwright/test/reporter";
import { readGroundTruthFile, type QuantizedBoundingBox } from "./groundTruthFile.js";
import { readMatchLogFile, type MatchLogEntry } from "./matchLog.js";
import { readPolicyLogFile, type PolicyLogEntry } from "./policyLog.js";

const BENCHMARK_DIR = new URL("..", import.meta.url).pathname;

/** `probe.spec.ts` reads `EIR_BENCH_MODE` and applies it via `test.use({ eirConfig })`; unset/"suggest-only" preserves Phase 4/5's original never-retries behavior exactly. */
export type BenchMode = "suggest-only" | "heal";

export interface ProbeTestResult {
  readonly targetId: string;
  readonly passed: boolean;
  readonly errorMessage: string | undefined;
  /** Eir's own recorded heal attempt for this target's failure, if any (Phase 5). */
  readonly matchAttempt: MatchLogEntry | undefined;
  /** near-duplicate-sibling-swap only: the distractor's live bbox, read independently of Eir (Phase 5 ground truth). */
  readonly distractorBBox: QuantizedBoundingBox | null | undefined;
  /** Phase 6 (NOTE-001 retrofit): what policy actually decided and did — real retry outcomes, not inferred from pass/fail. Empty unless `EIR_POLICY_LOG_FILE` produced anything for this target. */
  readonly policyEvents: readonly PolicyLogEntry[];
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
  policyLog: ReadonlyMap<string, readonly PolicyLogEntry[]>,
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
    policyEvents: policyLog.get(spec.title) ?? [],
  };
}

/**
 * Spawns `playwright test` against the already-running dev server (started
 * by `devServer.ts`) with `EIR_BENCH_CLASS`/`EIR_BENCH_SEED` set — the same
 * two env vars `probes/probe.spec.ts` reads to generate its test list. A
 * nonzero exit code is the *expected* outcome once a mutation is live
 * (every generated test is supposed to fail, unless `mode: "heal"`
 * actually heals it — see below), so it is never treated as an invocation
 * error — only a missing/unparseable report file is.
 *
 * Also sets `EIR_MATCH_LOG_FILE`/`EIR_GROUND_TRUTH_FILE`/
 * `EIR_POLICY_LOG_FILE` — Phase 5's two opt-in channels (Eir's own
 * recorded match attempts; this harness's independent near-dup distractor
 * readings) plus Phase 6's own (real policy decisions/retry outcomes) —
 * and reads all three back alongside the JSON test report, merging them
 * into each `ProbeTestResult` by target id (== Playwright test title)
 * rather than execution order.
 *
 * `mode` defaults to `"suggest-only"`, preserving Phase 4/5's original
 * "nothing ever retries" behavior exactly — existing committed baselines
 * (`packages/benchmark/results/*.json`) stay reproducible byte-for-byte.
 * `"heal"` is the NOTE-001 retrofit's own evidence mode (see
 * `healModeEvidence.ts`): `probe.spec.ts` applies real enacted thresholds
 * via `test.use({ eirConfig })`, so a probe can now genuinely *pass*
 * (`spec.ok === true`) via a real heal-and-continue instead of always
 * failing once mutated.
 */
export async function runProbeSuite(
  mutationClass: string,
  seed: number,
  mode: BenchMode = "suggest-only",
): Promise<readonly ProbeTestResult[]> {
  const outputFile = path.join(BENCHMARK_DIR, `.probe-report-${randomUUID()}.json`);
  const matchLogFile = path.join(BENCHMARK_DIR, `.probe-matchlog-${randomUUID()}.jsonl`);
  const groundTruthFile = path.join(BENCHMARK_DIR, `.probe-groundtruth-${randomUUID()}.jsonl`);
  const policyLogFile = path.join(BENCHMARK_DIR, `.probe-policylog-${randomUUID()}.jsonl`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "playwright", "test"], {
      cwd: BENCHMARK_DIR,
      env: {
        ...process.env,
        EIR_BENCH_CLASS: mutationClass,
        EIR_BENCH_SEED: String(seed),
        EIR_BENCH_MODE: mode,
        PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile,
        EIR_MATCH_LOG_FILE: matchLogFile,
        EIR_GROUND_TRUTH_FILE: groundTruthFile,
        EIR_POLICY_LOG_FILE: policyLogFile,
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

  const [matchLog, groundTruth, policyLog] = await Promise.all([
    readMatchLogFile(matchLogFile),
    readGroundTruthFile(groundTruthFile),
    readPolicyLogFile(policyLogFile),
  ]);
  await Promise.all([
    unlink(matchLogFile).catch(() => {}),
    unlink(groundTruthFile).catch(() => {}),
    unlink(policyLogFile).catch(() => {}),
  ]);

  const report = JSON.parse(raw) as JSONReport;
  return collectSpecs(report.suites).map((spec) => toProbeResult(spec, matchLog, groundTruth, policyLog));
}
