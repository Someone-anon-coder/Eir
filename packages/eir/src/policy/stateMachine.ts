import type { MatchAttempt } from "../matching/matcher.js";
import type { EirMode } from "./eirMode.js";
import { DEFAULT_MIN_MARGIN, DEFAULT_SUGGEST_THRESHOLD } from "./thresholds.js";

/**
 * Blueprint §7.6's policy state machine, as a discriminated union output —
 * a pure function of (match result, mode), table-tested exhaustively
 * below. Never performs the retry itself (that's `EirLocator`'s job, the
 * one place with real side effects) — this only ever *decides*.
 */
export type PolicyAction =
  | { readonly kind: "heal-and-continue" }
  | { readonly kind: "fail-with-suggestion" }
  | { readonly kind: "fail-normally" };

/**
 * Three-band decision (Blueprint §7.6 table), plus Phase 5's margin gate
 * layered on top of the high band, plus the `suggest-only` global switch
 * that removes the ability to ever retry without changing where the low
 * band sits.
 *
 * - No match at all (`rejected`/`no-candidates`) → always `fail-normally`;
 *   there is no confidence to judge.
 * - Below the suggest floor → `fail-normally`, regardless of mode — a
 *   match too weak to be worth showing is not worth showing in either
 *   mode.
 * - At/above the heal threshold *and* the margin bar, in `heal` mode →
 *   `heal-and-continue`.
 * - Everything else that cleared the suggest floor → `fail-with-
 *   suggestion` — this is where every `suggest-only` match lands (it can
 *   never reach `heal-and-continue`, by construction: that branch is only
 *   reachable when `mode.mode === "heal"`), and where a `heal`-mode match
 *   lands when confidence or margin falls short of the heal bar.
 */
export function decidePolicyAction(attempt: MatchAttempt, mode: EirMode): PolicyAction {
  if (attempt.kind !== "matched") {
    return { kind: "fail-normally" };
  }

  const { confidence, margin } = attempt;
  const suggestFloor = mode.mode === "heal" ? mode.suggestThreshold : DEFAULT_SUGGEST_THRESHOLD;

  if (confidence < suggestFloor) {
    return { kind: "fail-normally" };
  }

  if (mode.mode === "heal" && confidence >= mode.healThreshold && margin >= DEFAULT_MIN_MARGIN) {
    return { kind: "heal-and-continue" };
  }

  return { kind: "fail-with-suggestion" };
}
