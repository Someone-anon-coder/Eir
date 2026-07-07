/**
 * Blueprint §7.8's four outcome classes, as a discriminated union — a
 * `missed` outcome cannot carry a `confidence` field; the shape itself
 * makes an unclassified result unrepresentable (the Pre-Phase TS Tip this
 * phase opened with).
 */
export type Outcome =
  | { readonly kind: "healed-correct"; readonly confidence: number }
  | { readonly kind: "healed-wrong"; readonly confidence: number; readonly matchedWrong: string }
  | { readonly kind: "suggested"; readonly confidence: number }
  | { readonly kind: "missed" };

/**
 * Phase 4 has no matching engine — that's Phase 5's job. Every genuinely
 * broken selector can only ever classify as `missed`, by construction:
 * nothing in the current engine is capable of producing healed-correct,
 * healed-wrong, or suggested. This function exists (rather than a bare
 * `{ kind: "missed" }` literal scattered at call sites) so Phase 5 has
 * exactly one place to extend when a real matcher exists to actually
 * decide among the four kinds.
 */
export function classifyUnhealedFailure(): Outcome {
  return { kind: "missed" };
}

/**
 * A probe's raw result, before Blueprint-outcome classification. A probe
 * that *fails* post-mutation is the expected, correct case — ground truth
 * said this selector would break, and it did (see `classifyUnhealedFailure`).
 * A probe that unexpectedly *passes* post-mutation means the mutation
 * didn't actually break what ground truth claimed it would — a defect in
 * the target registry (packages/benchmark/src/targets.ts), never a valid
 * Blueprint outcome, and reported separately so it can't be silently
 * miscounted as a real classification.
 */
export type ProbeOutcome =
  | { readonly status: "mutation-effective"; readonly outcome: Outcome; readonly error: string }
  | { readonly status: "mutation-ineffective" };

export function classifyProbeRun(passed: boolean, errorMessage: string | undefined): ProbeOutcome {
  if (passed) {
    return { status: "mutation-ineffective" };
  }
  return { status: "mutation-effective", outcome: classifyUnhealedFailure(), error: errorMessage ?? "" };
}
