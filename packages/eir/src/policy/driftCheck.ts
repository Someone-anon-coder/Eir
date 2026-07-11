import type { Fingerprint } from "../fingerprint.js";
import { scoreCandidate } from "../matching/aggregate.js";
import type { CandidateFeatures, Weights } from "../matching/types.js";

/**
 * Mechanism B (NOTE-001 resolution / RISK-009 closure): on an *ordinary*
 * (non-throwing) imperative success, reuses Phase 5's own weighted scorer
 * — no new capture, no new scoring logic — to ask a question Phase 5
 * never needed to ask: not "which live candidate looks most like the
 * fingerprint," but "does the element I just successfully acted on still
 * look like the one I fingerprinted last time." A position-anchored
 * selector that silently resolved to the wrong row after a reorder
 * (RISK-009) scores low here across every dimension; a legitimate text
 * edit on an id-anchored selector still scores high (`attrOverlap`
 * dominates), so record mode's baseline refresh is never blocked by this
 * — see `docs/thresholds.md` and the retrofit's own Understanding Gate.
 */
export interface DriftCheckResult {
  readonly suspected: boolean;
  readonly score: number;
}

export function checkSelfSimilarity(
  stored: Readonly<Fingerprint>,
  fresh: Readonly<Fingerprint>,
  weights: Weights,
  threshold: number,
): DriftCheckResult {
  // `Fingerprint` structurally satisfies `CandidateFeatures` (= `Omit<Fingerprint, "v">`)
  // for a variable assignment — TS only excess-property-checks object literals.
  const candidate: CandidateFeatures = fresh;
  const { total } = scoreCandidate(stored, candidate, weights);
  return { suspected: total < threshold, score: total };
}
