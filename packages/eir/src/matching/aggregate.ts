import type { Fingerprint } from "../fingerprint.js";
import {
  scoreAncestorChain,
  scoreAttrOverlap,
  scoreBboxProximity,
  scoreLabelMatch,
  scoreSiblingPosition,
  scoreTextSimilarity,
} from "./scorers/index.js";
import {
  FEATURE_NAMES,
  type CandidateFeatures,
  type ScoreBreakdown,
  type ScoredCandidate,
  type Weights,
} from "./types.js";

/**
 * v0 — expected wrong; see docs/tuning-log.md. Hand-set only to get the
 * full pipeline running end-to-end before any real benchmark data exists
 * to tune against (Blueprint §7.5: "initial hand-set weights are expected
 * to be wrong").
 */
export const INITIAL_WEIGHTS: Weights = {
  attrOverlap: 0.3,
  textSimilarity: 0.2,
  labelMatch: 0.15,
  ancestorChain: 0.15,
  siblingPosition: 0.12,
  bboxProximity: 0.08,
};

function computeBreakdown(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): ScoreBreakdown {
  return {
    attrOverlap: scoreAttrOverlap(fp, cand),
    textSimilarity: scoreTextSimilarity(fp, cand),
    labelMatch: scoreLabelMatch(fp, cand),
    ancestorChain: scoreAncestorChain(fp, cand),
    siblingPosition: scoreSiblingPosition(fp, cand),
    bboxProximity: scoreBboxProximity(fp, cand),
  };
}

export function scoreCandidate(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
  weights: Weights,
): { readonly breakdown: ScoreBreakdown; readonly total: number } {
  const breakdown = computeBreakdown(fp, cand);
  let total = 0;
  for (const name of FEATURE_NAMES) {
    total += breakdown[name] * weights[name];
  }
  return { breakdown, total };
}

/** Sorted highest score first — ties broken by candidate order (stable sort), never randomly. */
export function scoreCandidates(
  fp: Readonly<Fingerprint>,
  candidates: readonly Readonly<CandidateFeatures>[],
  weights: Weights,
): readonly ScoredCandidate[] {
  return candidates
    .map((features, index) => {
      const { breakdown, total } = scoreCandidate(fp, features, weights);
      return { index, features, breakdown, total };
    })
    .sort((a, b) => b.total - a.total);
}

export interface DecisionMargin {
  readonly winner: ScoredCandidate;
  readonly runnerUp: ScoredCandidate | null;
  /** winner.total − runnerUp.total; equals winner.total when there is no runner-up (nothing to be close to). */
  readonly margin: number;
}

/**
 * Confidence isn't just the top score — it's the top score *and* the gap to
 * whatever else was plausible (Blueprint §7.5 stage 3). A high score with a
 * near-identical runner-up (two similar table rows) is exactly where false
 * heals happen; this function surfaces that gap as a first-class number
 * rather than an afterthought.
 */
export function decideMargin(scored: readonly ScoredCandidate[]): DecisionMargin | null {
  const [winner, runnerUp] = scored;
  if (winner === undefined) return null;
  const margin = runnerUp === undefined ? winner.total : winner.total - runnerUp.total;
  return { winner, runnerUp: runnerUp ?? null, margin };
}
