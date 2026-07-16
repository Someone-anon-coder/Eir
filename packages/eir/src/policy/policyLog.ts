import type { FallbackOutcome } from "../fallback/verdict.js";
import type { MatchAttempt } from "../matching/matcher.js";
import type { PolicyAction } from "./stateMachine.js";

/**
 * NOTE-004 (Phase 9 hardening): a `"healed"` retry outcome used to carry
 * no information about *why* Mechanism A's verification step passed —
 * "genuinely compared before/after and matched," "stored post-condition
 * was a real `\"none\"` (nothing to check, by design)," and "no
 * post-condition was ever stored for this selector at all (no baseline)"
 * all collapsed into the same bare `"healed"`. The first is a real,
 * independent correctness check; the third is a much weaker trust signal
 * an adopter deserves to see distinguished. See NOTES.md NOTE-004.
 */
export type PostConditionVerification = "verified" | "skipped-none" | "skipped-no-baseline";

/**
 * What actually happened once policy acted on a match (Phase 6) — richer
 * than `MatchLogEntry` (Phase 5's raw match result, unchanged, still read
 * by the benchmark's existing classifier). This is the channel the
 * reporter and the benchmark's dual-mode upgrade read from.
 */
export type RetryOutcome =
  | { readonly kind: "not-attempted" }
  | { readonly kind: "healed"; readonly verification: PostConditionVerification }
  | { readonly kind: "heal-rejected-post-condition-mismatch" }
  | { readonly kind: "heal-attempted-retry-failed" };

export interface HealAttemptEvent {
  readonly kind: "heal-attempt";
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly matchAttempt: MatchAttempt;
  readonly action: PolicyAction;
  readonly retryOutcome: RetryOutcome;
  /** PNG bytes of the matched/healed element, captured at match time — `null` if capture failed or nothing was matched. */
  readonly screenshot: Buffer | null;
  /**
   * Phase 8: the LLM fallback's suggestion-capped verdict — always `null`
   * on a `heal-and-continue` event, structurally: the fallback is only
   * consulted after policy has already decided *not* to heal (see
   * `fallback/runFallback.ts`'s `FallbackEligibleAction`).
   */
  readonly fallback: FallbackOutcome | null;
}

/** Mechanism B (RISK-009 closure) — an ordinary success whose fresh capture looked suspiciously unlike its own baseline. */
export interface DriftSuspectedEvent {
  readonly kind: "drift-suspected";
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly score: number;
}

export type PolicyEvent = HealAttemptEvent | DriftSuspectedEvent;

export interface PolicyRecorder {
  record(event: PolicyEvent): void;
}

/** Test-scoped (see the `eirPolicyLog` fixture) — one per test, so every event can be tied to the test that produced it. */
export class PolicyLog implements PolicyRecorder {
  readonly #events: PolicyEvent[] = [];

  record(event: PolicyEvent): void {
    this.#events.push(event);
  }

  get events(): readonly PolicyEvent[] {
    return this.#events;
  }
}
