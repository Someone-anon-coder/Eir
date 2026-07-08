import type { Page } from "@playwright/test";
import type { Fingerprint } from "../fingerprint.js";
import { runTriageGates, type TriageInput, type TriageRejectionReason } from "../triage/gates.js";
import { assertNever } from "../assertNever.js";
import { decideMargin, INITIAL_WEIGHTS, scoreCandidates } from "./aggregate.js";
import { captureCandidates } from "./captureCandidates.js";
import { suggestSelector, type SuggestedSelector } from "./suggestSelector.js";
import type { ScoreBreakdown, CandidateFeatures, Weights } from "./types.js";

/**
 * Orchestrates Blueprint §7.5's full funnel: triage gates → transient
 * candidate capture → weighted scoring → decision margin → suggested
 * selector. This phase's output is *recorded*, never acted on (no retry —
 * that's Phase 6's policy layer): the caller decides what to do with a
 * `MatchAttempt`, this function only ever produces one.
 */
export type MatchAttempt =
  | { readonly kind: "rejected"; readonly reason: TriageRejectionReason; readonly detail: string }
  | { readonly kind: "no-candidates"; readonly fingerprint: Fingerprint }
  | {
      readonly kind: "matched";
      readonly fingerprint: Fingerprint;
      readonly candidateCount: number;
      readonly winner: CandidateFeatures;
      readonly breakdown: ScoreBreakdown;
      readonly confidence: number;
      readonly margin: number;
      readonly suggestion: SuggestedSelector | null;
    };

export interface MatcherInput extends TriageInput {
  readonly page: Page;
  readonly weights?: Weights;
}

export async function attemptMatch(input: MatcherInput): Promise<MatchAttempt> {
  const decision = runTriageGates(input);

  switch (decision.kind) {
    case "rejected":
      return { kind: "rejected", reason: decision.reason, detail: decision.detail };

    case "eligible": {
      const { fingerprint } = decision;
      const weights = input.weights ?? INITIAL_WEIGHTS;

      const captured = await captureCandidates(input.page, fingerprint.tag);
      if (captured.length === 0) {
        return { kind: "no-candidates", fingerprint };
      }

      const scored = scoreCandidates(
        fingerprint,
        captured.map((c) => c.features),
        weights,
      );
      const decided = decideMargin(scored);
      if (decided === null) {
        return { kind: "no-candidates", fingerprint };
      }

      const winnerCapture = captured[decided.winner.index];
      if (winnerCapture === undefined) {
        // Unreachable: `decided.winner.index` always indexes into the same
        // `captured` array `scoreCandidates` was built from.
        return { kind: "no-candidates", fingerprint };
      }

      const suggestion = await suggestSelector(input.page, winnerCapture);

      return {
        kind: "matched",
        fingerprint,
        candidateCount: captured.length,
        winner: decided.winner.features,
        breakdown: decided.winner.breakdown,
        confidence: decided.winner.total,
        margin: decided.margin,
        suggestion,
      };
    }

    // Exhaustiveness — a third `TriageDecision` kind added later fails to
    // compile here rather than silently falling through unhandled.
    default:
      return assertNever(decision);
  }
}
