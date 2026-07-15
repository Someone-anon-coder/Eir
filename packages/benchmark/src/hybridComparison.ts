import { startDevServer } from "./devServer.js";
import { buildMutationRun } from "./groundTruth.js";
import { MUTATION_CLASSES, type MutationClass } from "./mutationClasses.js";
import type { PolicyFallbackInfo } from "./policyLog.js";
import { runProbeSuite, type ProbeTestResult } from "./probeRunner.js";

/**
 * Phase 8's comparison benchmark (approach doc work item 4): heuristics-
 * only vs hybrid, across all 8 classes. Deliberately narrower than a full
 * second baseline run — the suggestion-cap (Blueprint P4 applied to AI)
 * means the fallback can *never* change a row's classified outcome
 * (healed-correct/healed-wrong/suggested/missed), so re-running the
 * mutated suite without fallback would reproduce the already-committed,
 * already-proven-deterministic `results/*.json` byte-for-byte (Phase 3/4's
 * own determinism proofs). This module therefore does exactly one real
 * thing per class: run the mutated suite once more, with the fallback
 * opted in, and record what the LLM said for the rows that triggered it —
 * the "hybrid" side of the comparison is additive evidence on top of the
 * unchanged heuristics-only baseline, not a parallel universe of results.
 *
 * "Correctness" for the LLM's verdict is intentionally the plainest honest
 * measure available: agreement with the heuristic's own top-ranked
 * candidate (index 0 of the shortlist), which Phase 5's own measured
 * 0.0% false-heal rate already establishes as correct across every class
 * — including near-duplicate-sibling-swap's genuinely adversarial pairs.
 * This is stated as what it is (an agreement rate against already-proven
 * ground truth), not reframed as some new independent oracle.
 */

/** Prices as of this phase's Cost Gate sign-off (2026-07-15) — see docs/hybrid-comparison.md for the source. Not part of the shipped package; this module is benchmark-only. */
export const GEMINI_FLASH_LITE_PRICE_PER_INPUT_TOKEN = 0.1 / 1_000_000;
export const GEMINI_FLASH_LITE_PRICE_PER_OUTPUT_TOKEN = 0.4 / 1_000_000;

export interface HybridInvocation {
  readonly targetId: string;
  readonly fallback: PolicyFallbackInfo;
}

export interface HybridClassResult {
  readonly mutationClass: MutationClass;
  readonly seed: number;
  readonly invocations: readonly HybridInvocation[];
}

function fallbackInvocationsFor(
  mutationClass: MutationClass,
  results: readonly ProbeTestResult[],
): readonly HybridInvocation[] {
  const invocations: HybridInvocation[] = [];
  for (const result of results) {
    for (const event of result.policyEvents) {
      if (event.kind === "heal-attempt" && event.fallback !== null) {
        invocations.push({ targetId: result.targetId, fallback: event.fallback });
      }
    }
  }
  return invocations;
}

/**
 * One real run: mutated-server-only (same reasoning as `healModeEvidence`
 * — the control run's job, proving ground truth is valid pre-mutation, is
 * already done by the heuristics-only baseline this reuses), suggest-only
 * mode, fallback opted in via `EIR_BENCH_FALLBACK`.
 */
export async function runHybridClass(mutationClass: MutationClass, seed: number): Promise<HybridClassResult> {
  const run = buildMutationRun(mutationClass, seed);
  const overrideJson = JSON.stringify(run.overridePayload);

  const server = await startDevServer(overrideJson);
  let results: readonly ProbeTestResult[];
  try {
    results = await runProbeSuite(mutationClass, seed, "suggest-only", true);
  } finally {
    await server.stop();
  }

  return { mutationClass, seed, invocations: fallbackInvocationsFor(mutationClass, results) };
}

export async function runHybridComparison(seed: number): Promise<readonly HybridClassResult[]> {
  const out: HybridClassResult[] = [];
  for (const mutationClass of MUTATION_CLASSES) {
    out.push(await runHybridClass(mutationClass, seed));
  }
  return out;
}

export interface HybridClassSummary {
  readonly mutationClass: MutationClass;
  readonly invocationCount: number;
  readonly endorsed: number;
  readonly contradicted: number;
  readonly alternative: number;
  readonly noneOfThem: number;
  readonly noVerdict: number;
  /** endorsed / invocationCount — agreement with the already-proven-correct heuristic winner. `null` when nothing fired. */
  readonly agreementRate: number | null;
  readonly avgLatencyMs: number | null;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly estimatedCostUsd: number;
}

export function summarizeClass(result: HybridClassResult): HybridClassSummary {
  const counts = { endorsed: 0, contradicted: 0, alternative: 0, "none-of-them": 0, "no-verdict": 0 };
  let latencySum = 0;
  let latencyCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const { fallback } of result.invocations) {
    counts[fallback.verdict]++;
    if (fallback.latencyMs !== null) {
      latencySum += fallback.latencyMs;
      latencyCount++;
    }
    if (fallback.inputTokens !== null) totalInputTokens += fallback.inputTokens;
    if (fallback.outputTokens !== null) totalOutputTokens += fallback.outputTokens;
  }

  const invocationCount = result.invocations.length;
  return {
    mutationClass: result.mutationClass,
    invocationCount,
    endorsed: counts.endorsed,
    contradicted: counts.contradicted,
    alternative: counts.alternative,
    noneOfThem: counts["none-of-them"],
    noVerdict: counts["no-verdict"],
    agreementRate: invocationCount === 0 ? null : counts.endorsed / invocationCount,
    avgLatencyMs: latencyCount === 0 ? null : latencySum / latencyCount,
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd:
      totalInputTokens * GEMINI_FLASH_LITE_PRICE_PER_INPUT_TOKEN +
      totalOutputTokens * GEMINI_FLASH_LITE_PRICE_PER_OUTPUT_TOKEN,
  };
}

export function renderHybridComparisonMarkdown(results: readonly HybridClassResult[]): string {
  const summaries = results.map(summarizeClass);
  const header =
    "| Class | Invocations | Endorsed | Contradicted | Alternative | None-of-them | No-verdict | Agreement | Avg latency (ms) | Tokens (in/out) | Est. cost (USD) |\n" +
    "|---|---|---|---|---|---|---|---|---|---|---|";
  const rows = summaries.map((s) => {
    const agreement = s.agreementRate === null ? "—" : `${(s.agreementRate * 100).toFixed(0)}%`;
    const latency = s.avgLatencyMs === null ? "—" : s.avgLatencyMs.toFixed(0);
    return `| ${s.mutationClass} | ${String(s.invocationCount)} | ${String(s.endorsed)} | ${String(s.contradicted)} | ${String(s.alternative)} | ${String(s.noneOfThem)} | ${String(s.noVerdict)} | ${agreement} | ${latency} | ${String(s.totalInputTokens)}/${String(s.totalOutputTokens)} | ${s.estimatedCostUsd.toFixed(6)} |`;
  });

  const totalInvocations = summaries.reduce((sum, s) => sum + s.invocationCount, 0);
  const totalCost = summaries.reduce((sum, s) => sum + s.estimatedCostUsd, 0);
  const totalEndorsed = summaries.reduce((sum, s) => sum + s.endorsed, 0);

  return [
    header,
    ...rows,
    "",
    `**Total: ${String(totalInvocations)} invocations, ${String(totalEndorsed)} endorsed (${totalInvocations === 0 ? "—" : `${((totalEndorsed / totalInvocations) * 100).toFixed(1)}%`} agreement), est. cost $${totalCost.toFixed(6)}.**`,
  ].join("\n");
}
