import { buildMutationRun } from "./groundTruth.js";
import { startDevServer } from "./devServer.js";
import { runProbeSuite, type ProbeTestResult } from "./probeRunner.js";
import type { MutationClass } from "./mutationClasses.js";

export interface HealModeEvidenceResult {
  readonly mutationClass: MutationClass;
  readonly seed: number;
  readonly generatedAt: string;
  readonly results: readonly ProbeTestResult[];
}

/**
 * NOTE-001 retrofit's own evidence run — real measured proof of whether
 * post-condition verification (Mechanism A) and the self-similarity drift
 * check (Mechanism B) actually catch what they were built to catch.
 * Mutated-server-only, no control run: Phase 4/5's suggest-only baseline
 * already proved ground truth is valid before mutation, and this run's
 * question is specifically "what does heal-and-continue do against a
 * real mutation," not "is the target registry sound." Deliberately
 * narrow — not a general "run any class in heal mode" capability, even
 * though `runProbeSuite`'s `mode` parameter (work item 5) supports that
 * too.
 */
export async function runHealModeEvidence(
  mutationClass: MutationClass,
  seed: number,
): Promise<HealModeEvidenceResult> {
  const run = buildMutationRun(mutationClass, seed);
  const overrideJson = JSON.stringify(run.overridePayload);

  const server = await startDevServer(overrideJson);
  let results: readonly ProbeTestResult[];
  try {
    results = await runProbeSuite(mutationClass, seed, "heal");
  } finally {
    await server.stop();
  }

  return { mutationClass, seed, generatedAt: new Date().toISOString(), results };
}

function summarizeTarget(result: ProbeTestResult): string {
  if (result.policyEvents.length === 0) {
    return result.passed ? "passed (no policy event recorded)" : "failed (no policy event recorded)";
  }
  return result.policyEvents
    .map((event) => {
      if (event.kind === "drift-suspected") {
        return `drift-suspected (self-similarity ${event.score.toFixed(4)})`;
      }
      const confidence = event.confidence === null ? "—" : event.confidence.toFixed(4);
      const margin = event.margin === null ? "—" : event.margin.toFixed(4);
      return `${event.actionKind} -> ${event.retryOutcomeKind} (confidence ${confidence}, margin ${margin})`;
    })
    .join("; ");
}

export function renderHealModeEvidenceMarkdown(evidence: HealModeEvidenceResult): string {
  const header =
    `## ${evidence.mutationClass} (seed ${String(evidence.seed)}, heal mode)\n\n` +
    "| Target | Test Passed | Policy Outcome |\n|---|---|---|";
  const rows = evidence.results.map(
    (result) => `| ${result.targetId} | ${String(result.passed)} | ${summarizeTarget(result)} |`,
  );
  return [header, ...rows].join("\n");
}
