import type { QuantizedBoundingBox } from "./groundTruthFile.js";
import type { MatchLogEntry } from "./matchLog.js";

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
 * Measurement lens only — NOT enacted runtime policy (that's Phase 6's
 * job, per Blueprint §7.6). Used here purely to *label* the benchmark's
 * own report rows so the tuning loop has something to read; Phase 6
 * proposes its own real threshold(s) informed by, but not bound to, this
 * number. Starting value is a v0 guess, tuned in docs/tuning-log.md.
 */
export const MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD = 0.7;

function bboxDistance(a: QuantizedBoundingBox, b: QuantizedBoundingBox): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * near-duplicate-sibling-swap precision check (Phase 5): the *only* class
 * with a real, live distractor to compare against (see NOTES.md NOTE-002 /
 * Blueprint §7.5 — the other six classes' taxonomy leaves no legitimate
 * second candidate, so "healed-wrong" there would need a different,
 * heavier ground-truth mechanism this phase deliberately doesn't build —
 * see the session's recorded design decision). `undefined` distractorBBox
 * means "not a near-dup target, or its live element wasn't captured" —
 * never treated as evidence of a wrong match.
 */
function matchedTheDistractor(
  winnerBBox: QuantizedBoundingBox,
  correctBBox: QuantizedBoundingBox,
  distractorBBox: QuantizedBoundingBox | null | undefined,
): boolean {
  if (distractorBBox === null || distractorBBox === undefined) return false;
  return bboxDistance(winnerBBox, distractorBBox) < bboxDistance(winnerBBox, correctBBox);
}

function describeWinner(winner: { readonly tag: string; readonly attrs: Readonly<Record<string, string>> }): string {
  const attrSummary = Object.entries(winner.attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return attrSummary.length > 0 ? `<${winner.tag} ${attrSummary}>` : `<${winner.tag}>`;
}

/**
 * Phase 5's real classifier: reads what Eir's own matcher actually
 * decided (`matchAttempt`, recorded via `MatchingContext` — see
 * `packages/eir/src/matching/matchLogFile.ts`) plus, for near-dup targets
 * only, an independently-read distractor position, and turns them into
 * one of Blueprint §7.8's four outcome classes. No attempt recorded at
 * all, a triage-gate rejection, or no live candidates found are all
 * `missed` — Eir never got (or never took) a real shot at this one.
 */
export function classifyUnhealedFailure(
  matchAttempt: MatchLogEntry | undefined,
  distractorBBox: QuantizedBoundingBox | null | undefined,
): Outcome {
  if (matchAttempt === undefined) return { kind: "missed" };

  const { result } = matchAttempt;
  if (result.kind === "rejected" || result.kind === "no-candidates") {
    return { kind: "missed" };
  }

  const { confidence, winner, fingerprint } = result;
  const wrong = matchedTheDistractor(winner.bbox, fingerprint.bbox, distractorBBox);

  if (confidence >= MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD) {
    if (wrong) {
      return { kind: "healed-wrong", confidence, matchedWrong: describeWinner(winner) };
    }
    return { kind: "healed-correct", confidence };
  }

  return { kind: "suggested", confidence };
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

export function classifyProbeRun(
  passed: boolean,
  errorMessage: string | undefined,
  matchAttempt: MatchLogEntry | undefined,
  distractorBBox: QuantizedBoundingBox | null | undefined,
): ProbeOutcome {
  if (passed) {
    return { status: "mutation-ineffective" };
  }
  return {
    status: "mutation-effective",
    outcome: classifyUnhealedFailure(matchAttempt, distractorBBox),
    error: errorMessage ?? "",
  };
}

/** Exhaustive dispatch guard for `Outcome.kind` — a new kind added to the union without a matching branch fails to compile here, not silently at runtime. */
export function assertNeverOutcome(value: never): never {
  throw new Error(`Unreachable outcome kind: ${JSON.stringify(value)}`);
}
