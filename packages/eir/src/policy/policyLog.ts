import type { MatchAttempt } from "../matching/matcher.js";
import type { PolicyAction } from "./stateMachine.js";

/**
 * What actually happened once policy acted on a match (Phase 6) — richer
 * than `MatchLogEntry` (Phase 5's raw match result, unchanged, still read
 * by the benchmark's existing classifier). This is the channel the
 * reporter and the benchmark's dual-mode upgrade read from.
 */
export type RetryOutcome =
  | { readonly kind: "not-attempted" }
  | { readonly kind: "healed" }
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
