import { buildMutationRun } from "./groundTruth.js";
import { startDevServer } from "./devServer.js";
import { runProbeSuite, type ProbeTestResult } from "./probeRunner.js";
import { classifyProbeRun, type ProbeOutcome } from "./outcome.js";
import type { MutationClass } from "./mutationClasses.js";

export interface TargetOutcome {
  readonly targetId: string;
  /**
   * The *run's* class — what this outcome counts toward in the report.
   * For every class except `compound-release` this is identical to the
   * target's own home class. For `compound-release`, the underlying
   * targets are drawn from (and still individually tagged with) one of
   * the six base classes — `sourceClass` preserves that provenance, but
   * `mutationClass` here is always `"compound-release"` so its outcomes
   * report as their own row instead of silently inflating whichever base
   * classes happened to get mixed in this run's seed.
   */
  readonly mutationClass: MutationClass;
  readonly sourceClass: MutationClass;
  readonly route: string;
  readonly frozenSelectorKey: string;
  readonly distractorId?: string;
  /** Did the probe pass *before* mutation? False here means the ground truth itself is broken, independent of any mutation — a target-registry bug. */
  readonly controlPassed: boolean;
  readonly probeOutcome: ProbeOutcome;
}

export interface BenchRunResult {
  readonly mutationClass: MutationClass;
  readonly seed: number;
  /** Kept separate from every other field so it never enters a determinism comparison — see the DoD's reproducibility proof. */
  readonly generatedAt: string;
  readonly outcomes: readonly TargetOutcome[];
}

function resultsByTargetId(results: readonly ProbeTestResult[]): Map<string, ProbeTestResult> {
  return new Map(results.map((result) => [result.targetId, result]));
}

/**
 * The two-phase run this whole harness exists to prove out: a *control*
 * run (mutation unset) establishes that every ground-truth selector is
 * genuinely valid against the unmutated app; a *mutated* run (the seeded
 * override payload set) is what gets classified. Running control every
 * time — not just once, ever — is deliberate: it's what turns "the
 * selector failed" into "the selector failed *because of this mutation*,"
 * not because of a stale or broken target registry.
 */
export async function runBenchmark(mutationClass: MutationClass, seed: number): Promise<BenchRunResult> {
  const run = buildMutationRun(mutationClass, seed);
  const overrideJson = JSON.stringify(run.overridePayload);

  const controlServer = await startDevServer(undefined);
  let controlResults: readonly ProbeTestResult[];
  try {
    controlResults = await runProbeSuite(mutationClass, seed);
  } finally {
    await controlServer.stop();
  }

  const mutatedServer = await startDevServer(overrideJson);
  let mutatedResults: readonly ProbeTestResult[];
  try {
    mutatedResults = await runProbeSuite(mutationClass, seed);
  } finally {
    await mutatedServer.stop();
  }

  const controlByTarget = resultsByTargetId(controlResults);
  const mutatedByTarget = resultsByTargetId(mutatedResults);

  const outcomes: TargetOutcome[] = run.groundTruth.map((entry) => {
    const control = controlByTarget.get(entry.targetId);
    const mutated = mutatedByTarget.get(entry.targetId);
    if (control === undefined || mutated === undefined) {
      throw new Error(
        `Probe suite produced no result for target "${entry.targetId}" (control: ${String(control !== undefined)}, mutated: ${String(mutated !== undefined)})`,
      );
    }
    return {
      targetId: entry.targetId,
      mutationClass,
      sourceClass: entry.mutationClass,
      route: entry.route,
      frozenSelectorKey: entry.frozenSelectorKey,
      ...(entry.distractorId !== undefined ? { distractorId: entry.distractorId } : {}),
      controlPassed: control.passed,
      probeOutcome: classifyProbeRun(mutated.passed, mutated.errorMessage),
    };
  });

  return { mutationClass, seed, generatedAt: new Date().toISOString(), outcomes };
}
