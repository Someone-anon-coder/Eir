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
/** Just enough to re-resolve the winning candidate live for a retry (Phase 6) — `page.locator(selector).nth(domIndex)`, the same addressing `CapturedCandidate` already uses. */
export interface WinnerLocatorRef {
  readonly selector: string;
  readonly domIndex: number;
}

/**
 * Phase 8: how many top-scored candidates a `matched` attempt carries for
 * the LLM fallback's shortlist. Small on purpose — the fallback is a
 * tiebreak between a handful of plausible answers, not a second pass over
 * the whole page, and every entry is prompt tokens.
 */
export const MATCH_SHORTLIST_SIZE = 5;

/** One shortlist entry: the candidate's features, the heuristic scorers' own reading of it, and its re-resolution ref. */
export interface ShortlistEntry {
  readonly features: CandidateFeatures;
  readonly breakdown: ScoreBreakdown;
  readonly total: number;
  readonly selector: string;
  readonly domIndex: number;
}

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
      /** Phase 6: how heal-and-continue re-resolves this exact candidate to retry the action against it. */
      readonly winnerLocator: WinnerLocatorRef;
      /** Phase 8: top-scored candidates (winner first), the only element data the LLM fallback is ever shown. */
      readonly shortlist: readonly ShortlistEntry[];
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

      const captured = await captureCandidates(input.page, fingerprint.tag, fingerprint.attrs["type"]);
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

      const shortlist: ShortlistEntry[] = [];
      for (const scoredCandidate of scored.slice(0, MATCH_SHORTLIST_SIZE)) {
        const capture = captured[scoredCandidate.index];
        if (capture === undefined) continue; // Unreachable, same reasoning as winnerCapture above.
        shortlist.push({
          features: scoredCandidate.features,
          breakdown: scoredCandidate.breakdown,
          total: scoredCandidate.total,
          selector: capture.selector,
          domIndex: capture.domIndex,
        });
      }

      return {
        kind: "matched",
        fingerprint,
        candidateCount: captured.length,
        winner: decided.winner.features,
        breakdown: decided.winner.breakdown,
        confidence: decided.winner.total,
        margin: decided.margin,
        suggestion,
        winnerLocator: { selector: winnerCapture.selector, domIndex: winnerCapture.domIndex },
        shortlist,
      };
    }

    // Exhaustiveness — a third `TriageDecision` kind added later fails to
    // compile here rather than silently falling through unhandled.
    default:
      return assertNever(decision);
  }
}
