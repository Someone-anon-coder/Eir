import type { MatchAttempt } from "../matching/matcher.js";
import { DEFAULT_HEAL_THRESHOLD, DEFAULT_MIN_MARGIN } from "../policy/thresholds.js";

export type UncertainMatch = Extract<MatchAttempt, { kind: "matched" }>;

/**
 * The trigger contract (Blueprint P6 / approach doc Phase 8 work item 1):
 * the fallback fires *only* on the heuristic engine's formal admission of
 * uncertainty — a completed match whose winner failed heal qualification
 * on the measured bars. This covers both named shapes at once:
 * "suggested-but-uncertain" (above the suggest floor, below a bar) and
 * "missed-with-candidates" (a match too weak even to suggest).
 *
 * Deliberately mode-independent: it reads the same constants the policy
 * machine reads (`policy/thresholds.ts`), never `EirMode`. A confident
 * match held back only by `suggest-only`'s trust posture is a confident
 * answer, not uncertainty — same numbers in both modes, same firing
 * decision in both modes, so the comparison benchmark measures the
 * matcher, not the posture.
 *
 * `rejected` and `no-candidates` attempts can never fire: there is no
 * candidate shortlist to judge, and the provider only ever receives
 * fingerprint + shortlist (Blueprint §7.8's data constraint).
 */
export function isFormallyUncertain(attempt: MatchAttempt): attempt is UncertainMatch {
  return (
    attempt.kind === "matched" &&
    (attempt.confidence < DEFAULT_HEAL_THRESHOLD || attempt.margin < DEFAULT_MIN_MARGIN)
  );
}
